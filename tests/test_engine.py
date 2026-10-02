import pytest
from fork_cast.storage import CandidateStorage, HistoryStorage
from fork_cast.context_builder import build_state_context
from fork_cast.engine import DecisionEngine
from fork_cast.models import VerdictType, HistoryEntry


def test_build_state_context():
    history = [
        HistoryEntry(
            id="1",
            timestamp="2026-09-20T12:00:00",
            candidate="黄焖鸡",
            verdict_type="decisive_pick",
            craving="午饭"
        )
    ]
    ctx = build_state_context(
        craving="晚上想吃面",
        recent_history=history,
        exclusions=["麦当劳"]
    )
    assert "【当前就餐时间】" in ctx
    assert "黄焖鸡" in ctx
    assert "麦当劳" in ctx
    assert "晚上想吃面" in ctx


@pytest.mark.asyncio
async def test_engine_impasse(tmp_path):
    cs = CandidateStorage(file_path=tmp_path / "candidates.json")
    hs = HistoryStorage(file_path=tmp_path / "history.json")
    cs.save_candidates(["牛肉拉面", "麦当劳", "轻食沙拉"])

    engine = DecisionEngine(candidate_storage=cs, history_storage=hs, mock=True)
    res = await engine.decide("想吃油炸但必须0热量0油严格减脂")

    assert res.verdict == VerdictType.IMPASSE
    assert res.primary is None
    assert res.auto_logged is False
    assert len(hs.load_history()) == 0


@pytest.mark.asyncio
async def test_engine_indifference(tmp_path):
    cs = CandidateStorage(file_path=tmp_path / "candidates.json")
    hs = HistoryStorage(file_path=tmp_path / "history.json")
    cs.save_candidates(["牛肉拉面", "麦当劳", "轻食沙拉"])

    engine = DecisionEngine(candidate_storage=cs, history_storage=hs, mock=True)
    res = await engine.decide("今天吃啥都行，随便，完全不挑，无所谓")

    assert res.verdict == VerdictType.INDIFFERENCE
    assert res.primary is None
    assert res.auto_logged is False
    assert len(hs.load_history()) == 0


@pytest.mark.asyncio
async def test_engine_decisive_pick(tmp_path):
    cs = CandidateStorage(file_path=tmp_path / "candidates.json")
    hs = HistoryStorage(file_path=tmp_path / "history.json")
    cs.save_candidates(["牛肉拉面", "麦当劳", "轻食沙拉"])

    engine = DecisionEngine(candidate_storage=cs, history_storage=hs, mock=True)
    res = await engine.decide("好累，想吃高热量快餐汉堡炸鸡，来份麦当劳！")

    assert res.verdict == VerdictType.DECISIVE_PICK
    assert res.primary == "麦当劳"
    assert res.auto_logged is True
    assert res.history_entry_id is not None
    # Verified implicitly logged to History per ADR-0002
    assert len(hs.load_history()) == 1
    assert hs.load_history()[0].candidate == "麦当劳"


@pytest.mark.asyncio
async def test_engine_session_exclusions(tmp_path):
    cs = CandidateStorage(file_path=tmp_path / "candidates.json")
    hs = HistoryStorage(file_path=tmp_path / "history.json")
    cs.save_candidates(["牛肉拉面", "麦当劳", "轻食沙拉"])

    engine = DecisionEngine(candidate_storage=cs, history_storage=hs, mock=True)
    # Exclude 麦当劳
    res = await engine.decide("想吃快餐汉堡", exclusions=["麦当劳"])

    assert res.primary != "麦当劳"
    assert "麦当劳" not in res.probabilities


def test_d1_config_and_url_normalization():
    from fork_cast.config import normalize_base_url, resolve_model_name, is_d1_model

    assert normalize_base_url("https://api.liquid.ai/decisions/v1/systemone", is_liquid=True) == "https://api.liquid.ai/decisions"
    assert normalize_base_url("https://api.liquid.ai/decisions/v1", is_liquid=True) == "https://api.liquid.ai/decisions"
    assert normalize_base_url("https://api.liquid.ai/decisions", is_liquid=True) == "https://api.liquid.ai/decisions"
    assert normalize_base_url("https://api.liquid.ai", is_liquid=True) == "https://api.liquid.ai/decisions"
    assert normalize_base_url("https://api.typesafe.ai/v1/systemone") == "https://api.typesafe.ai"

    assert resolve_model_name("d1") == "d1:free"
    assert resolve_model_name("d1:free") == "d1:free"
    assert resolve_model_name("jev") == "jev-latest"
    assert resolve_model_name("jev-latest") == "jev-latest"

    assert is_d1_model("d1") is True
    assert is_d1_model("d1:free") is True
    assert is_d1_model("jev-latest") is False


@pytest.mark.asyncio
async def test_engine_d1_mock_decision(tmp_path):
    cs = CandidateStorage(file_path=tmp_path / "candidates.json")
    hs = HistoryStorage(file_path=tmp_path / "history.json")
    cs.save_candidates(["牛肉拉面", "麦当劳"])

    engine = DecisionEngine(candidate_storage=cs, history_storage=hs, mock=True, model="d1:free")
    res = await engine.decide("想吃麦当劳快餐")

    assert res.model == "d1:free"
    assert res.verdict == VerdictType.DECISIVE_PICK
    assert res.primary == "麦当劳"


@pytest.mark.asyncio
async def test_engine_d1_wire_call(tmp_path):
    from unittest.mock import AsyncMock, patch, MagicMock

    cs = CandidateStorage(file_path=tmp_path / "candidates.json")
    hs = HistoryStorage(file_path=tmp_path / "history.json")
    cs.save_candidates(["牛肉拉面", "麦当劳"])

    engine = DecisionEngine(candidate_storage=cs, history_storage=hs, mock=False)

    fake_resp = MagicMock()
    fake_resp.answers = {
        "is_achievable": MagicMock(noul=0.95),
        "is_indifferent": MagicMock(noul=0.05),
        "candidate_choice": MagicMock(
            confidence=0.88,
            probabilities={"麦当劳": 0.85, "牛肉拉面": 0.15}
        )
    }

    with patch("fork_cast.engine.AsyncTypeSafeClient") as MockClient:
        mock_instance = MagicMock()
        mock_instance.system_one = AsyncMock(return_value=fake_resp)
        MockClient.return_value = mock_instance

        res = await engine.decide(
            craving="想吃麦当劳炸鸡",
            api_key="liquid_test_key",
            base_url="https://api.liquid.ai/decisions/v1/systemone",
            model="d1:free"
        )

        MockClient.assert_called_once_with(
            api_key="liquid_test_key",
            base_url="https://api.liquid.ai/decisions",
            timeout=60.0
        )
        assert mock_instance.system_one.call_args.kwargs["model"] == "d1:free"
        assert res.model == "d1:free"
        assert res.primary == "麦当劳"
