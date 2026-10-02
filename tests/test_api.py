from fastapi.testclient import TestClient
from fork_cast.storage import CandidateStorage, HistoryStorage
from fork_cast.app import create_app


def test_api_full_flow(tmp_path):
    cs = CandidateStorage(file_path=tmp_path / "candidates.json")
    hs = HistoryStorage(file_path=tmp_path / "history.json")
    cs.save_candidates(["牛肉拉面", "麦当劳", "麻辣烫", "轻食沙拉"])

    app = create_app(candidate_storage=cs, history_storage=hs, mock=True)
    client = TestClient(app)

    # 1. Health check
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["candidate_count"] == 4
    # 1.1 Frontend HTML served
    r_html = client.get("/")
    assert r_html.status_code == 200
    assert "吃什么" in r_html.text

    # 1.2 Copy API served
    r_copy = client.get("/api/copy")
    assert r_copy.status_code == 200
    assert r_copy.json()["brand"]["name"] == "吃什么"

    # 1.3 Stateless BYOK decision with client candidates and key
    r_stateless = client.post("/api/decide", json={
        "craving": "想喝点热汤",
        "candidates": ["生煎包", "瓦罐汤"],
        "api_key": "test_byok_key"
    })
    assert r_stateless.status_code == 200
    res_stateless = r_stateless.json()
    assert res_stateless["primary"] in ["生煎包", "瓦罐汤"]
    assert res_stateless["history_entry"] is not None
    assert res_stateless["history_entry"]["candidate"] in ["生煎包", "瓦罐汤"]

    # 1.4 D1 model BYOK decision
    r_d1 = client.post("/api/decide", json={
        "craving": "想喝点热汤",
        "candidates": ["生煎包", "瓦罐汤"],
        "api_key": "liquid_byok_key",
        "model": "d1:free"
    })
    assert r_d1.status_code == 200
    res_d1 = r_d1.json()
    assert res_d1["model"] == "d1:free"
    assert res_d1["primary"] in ["生煎包", "瓦罐汤"]

    # 2. Candidate management
    # List
    r = client.get("/api/candidates")
    assert r.status_code == 200
    assert len(r.json()["candidates"]) == 4

    # Add
    r = client.post("/api/candidates", json={"name": "黄焖鸡"})
    assert r.status_code == 200
    assert "黄焖鸡" in r.json()["candidates"]

    # Delete
    r = client.delete("/api/candidates/黄焖鸡")
    assert r.status_code == 200
    assert "黄焖鸡" not in r.json()["candidates"]

    # 3. Decision & Revocation flow
    # Send craving that triggers decisive pick
    r = client.post("/api/decide", json={
        "craving": "想吃汉堡炸鸡快餐，麦当劳走起！",
        "exclusions": []
    })
    assert r.status_code == 200
    data = r.json()
    assert data["verdict"] == "decisive_pick"
    assert data["primary"] == "麦当劳"
    assert data["auto_logged"] is True

    # Verify history now has 1 entry
    r_hist = client.get("/api/history")
    assert len(r_hist.json()) == 1
    assert r_hist.json()[0]["candidate"] == "麦当劳"

    # User says: "我不吃这个，撤销！"
    r_revoke = client.post("/api/history/revoke")
    assert r_revoke.status_code == 200
    assert r_revoke.json()["revoked_candidate"] == "麦当劳"
    assert r_revoke.json()["remaining_history_count"] == 0

    # Verify history is now empty
    r_hist_after = client.get("/api/history")
    assert len(r_hist_after.json()) == 0

    # User re-submits with 麦当劳 in exclusions
    r_retry = client.post("/api/decide", json={
        "craving": "想吃汉堡炸鸡快餐",
        "exclusions": ["麦当劳"]
    })
    assert r_retry.status_code == 200
    data_retry = r_retry.json()
    assert data_retry["primary"] != "麦当劳"

    # 4. Blind Box flow (Must not log to history per ADR-0002)
    hist_count_before = len(client.get("/api/history").json())
    r_bb = client.post("/api/blind-box")
    assert r_bb.status_code == 200
    assert r_bb.json()["candidate"] in ["牛肉拉面", "麦当劳", "麻辣烫", "轻食沙拉"]
    hist_count_after = len(client.get("/api/history").json())
    assert hist_count_after == hist_count_before

    # 5. Impasse flow (Impossible demand -> not logged)
    r_imp = client.post("/api/decide", json={
        "craving": "油炸食品但必须0卡0油减脂",
        "exclusions": []
    })
    assert r_imp.status_code == 200
    assert r_imp.json()["verdict"] == "impasse"
    assert r_imp.json()["auto_logged"] is False
