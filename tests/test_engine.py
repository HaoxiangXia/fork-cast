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
