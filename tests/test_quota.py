import pytest
from pathlib import Path
from fork_cast.quota import QuotaManager, get_beijing_today
from fork_cast.storage import CandidateStorage, HistoryStorage
from fork_cast.app import create_app
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch, MagicMock


def test_quota_manager_basic_flow(tmp_path):
    q_file = tmp_path / "quota.json"
    qm = QuotaManager(limit=2, file_path=q_file)

    # Initial query
    limit, used, rem = qm.get_status("1.1.1.1", "dev_aaa")
    assert limit == 2
    assert used == 0
    assert rem == 2

    # 1st consume
    allowed, used, rem = qm.check_and_consume("1.1.1.1", "dev_aaa")
    assert allowed is True
    assert used == 1
    assert rem == 1

    # 2nd consume
    allowed, used, rem = qm.check_and_consume("1.1.1.1", "dev_aaa")
    assert allowed is True
    assert used == 2
    assert rem == 0

    # 3rd consume: blocked by limit
    allowed, used, rem = qm.check_and_consume("1.1.1.1", "dev_aaa")
    assert allowed is False
    assert used == 2
    assert rem == 0

    # Reload from disk: verifies persistence
    qm_reloaded = QuotaManager(limit=2, file_path=q_file)
    allowed, used, rem = qm_reloaded.check_and_consume("1.1.1.1", "dev_aaa")
    assert allowed is False
    assert used == 2

    # Different device on same IP gets its own quota
    allowed, used, rem = qm_reloaded.check_and_consume("1.1.1.1", "dev_bbb")
    assert allowed is True
    assert used == 1
    assert rem == 1


def test_quota_manager_cleanup_old_dates(tmp_path):
    q_file = tmp_path / "quota.json"
    qm = QuotaManager(limit=5, file_path=q_file)
    today = get_beijing_today()

    # Pre-populate historical entries
    qm._data["20250101"] = {"ip:dev": 5}
    qm._data["20250102"] = {"ip:dev": 5}
    qm._data[today] = {"ip:dev": 2}

    qm._cleanup_old_dates(today)

    assert "20250101" not in qm._data
    assert "20250102" not in qm._data
    assert today in qm._data
    assert qm._data[today]["ip:dev"] == 2


def test_api_quota_endpoints_and_byok_bypass(tmp_path):
    cs = CandidateStorage(file_path=tmp_path / "candidates.json")
    hs = HistoryStorage(file_path=tmp_path / "history.json")
    cs.save_candidates(["牛肉拉面", "麦当劳"])

    q_file = tmp_path / "quota.json"
    qm = QuotaManager(limit=2, file_path=q_file)

    app = create_app(
        candidate_storage=cs,
        history_storage=hs,
        quota_manager_instance=qm,
        mock=False
    )
    client = TestClient(app)

    # 1. GET /api/quota
    r_q = client.get("/api/quota?device_id=dev_test", headers={"X-Forwarded-For": "203.0.113.10"})
    assert r_q.status_code == 200
    q_data = r_q.json()
    assert q_data["limit"] == 2
    assert q_data["used"] == 0
    assert q_data["remaining"] == 2
    assert q_data["date"] == get_beijing_today()

    fake_resp = MagicMock()
    fake_resp.answers = {
        "is_achievable": MagicMock(noul=0.95),
        "is_indifferent": MagicMock(noul=0.05),
        "candidate_choice": MagicMock(confidence=0.9, probabilities={"牛肉拉面": 0.85, "麦当劳": 0.15})
    }

    with patch("fork_cast.engine.AsyncTypeSafeClient") as MockClient:
        mock_instance = MagicMock()
        mock_instance.system_one = AsyncMock(return_value=fake_resp)
        MockClient.return_value = mock_instance

        # 2. 1st call without personal key: succeeds, quota decrements to 1
        r1 = client.post(
            "/api/decide",
            json={"craving": "想吃面", "device_id": "dev_test"},
            headers={"X-Forwarded-For": "203.0.113.10"}
        )
        assert r1.status_code == 200
        assert r1.json()["quota_remaining"] == 1
        assert r1.json()["quota_limit"] == 2

        # 3. 2nd call without personal key: succeeds, quota decrements to 0
        r2 = client.post(
            "/api/decide",
            json={"craving": "想吃面", "device_id": "dev_test"},
            headers={"X-Forwarded-For": "203.0.113.10"}
        )
        assert r2.status_code == 200
        assert r2.json()["quota_remaining"] == 0

        # 4. 3rd call without personal key: quota exhausted, returns 429
        r3 = client.post(
            "/api/decide",
            json={"craving": "想吃面", "device_id": "dev_test"},
            headers={"X-Forwarded-For": "203.0.113.10"}
        )
        assert r3.status_code == 429
        assert "免费额度已用尽" in r3.json()["detail"]

        # 5. 4th call WITH personal key (BYOK): BYPASSES quota limit and succeeds!
        r_byok = client.post(
            "/api/decide",
            json={
                "craving": "想吃面",
                "device_id": "dev_test",
                "api_key": "my_personal_liquid_key"
            },
            headers={"X-Forwarded-For": "203.0.113.10"}
        )
        assert r_byok.status_code == 200
        assert r_byok.json()["primary"] == "牛肉拉面"

        # 6. Another device from same or different IP gets fresh quota
        r_other = client.post(
            "/api/decide",
            json={"craving": "想吃面", "device_id": "dev_other"},
            headers={"X-Forwarded-For": "203.0.113.10"}
        )
        assert r_other.status_code == 200
        assert r_other.json()["quota_remaining"] == 1
