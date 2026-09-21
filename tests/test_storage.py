import pytest
from datetime import datetime, timezone, timedelta
from fork_cast.storage import CandidateStorage, HistoryStorage


def test_candidate_storage_crud(tmp_path):
    f = tmp_path / "candidates.json"
    storage = CandidateStorage(file_path=f)

    # Initial empty
    assert storage.load_candidates() == []

    # Add candidates
    storage.add_candidate("牛肉拉面")
    storage.add_candidate("麦当劳")
    assert storage.load_candidates() == ["牛肉拉面", "麦当劳"]

    # Duplicate rejection
    with pytest.raises(ValueError, match="already exists"):
        storage.add_candidate("牛肉拉面")

    # Empty rejection
    with pytest.raises(ValueError, match="cannot be empty"):
        storage.add_candidate("   ")

    # Remove
    storage.remove_candidate("麦当劳")
    assert storage.load_candidates() == ["牛肉拉面"]

    # Non-existent remove
    with pytest.raises(ValueError, match="not found"):
        storage.remove_candidate("不存在的菜")


def test_history_storage_operations(tmp_path):
    f = tmp_path / "history.json"
    storage = HistoryStorage(file_path=f)

    assert storage.load_history() == []

    # Add entry
    e1 = storage.add_entry(
        candidate="牛肉拉面",
        verdict_type="decisive_pick",
        craving="想吃热汤面"
    )
    assert e1.candidate == "牛肉拉面"
    assert len(storage.load_history()) == 1

    e2 = storage.add_entry(
        candidate="黄焖鸡",
        verdict_type="soft_pick",
        craving="来点米饭"
    )
    assert len(storage.load_history()) == 2

    # Pop last entry (Revocation)
    popped = storage.pop_last_entry()
    assert popped.candidate == "黄焖鸡"
    assert len(storage.load_history()) == 1

    popped2 = storage.pop_last_entry()
    assert popped2.candidate == "牛肉拉面"
    assert len(storage.load_history()) == 0

    assert storage.pop_last_entry() is None


def test_history_recent_window(tmp_path):
    f = tmp_path / "history.json"
    storage = HistoryStorage(file_path=f)

    # Add old entry (72 hours ago)
    old_time = (datetime.now(timezone.utc) - timedelta(hours=72)).isoformat()
    recent_time = (datetime.now(timezone.utc) - timedelta(hours=10)).isoformat()

    entries = [
        {"id": "1", "timestamp": old_time, "candidate": "老饭馆", "verdict_type": "decisive_pick", "craving": "old"},
        {"id": "2", "timestamp": recent_time, "candidate": "新拉面", "verdict_type": "decisive_pick", "craving": "new"}
    ]
    import json
    with open(f, "w", encoding="utf-8") as fp:
        json.dump(entries, fp)

    recent = storage.get_recent_history(hours=48)
    assert len(recent) == 1
    assert recent[0].candidate == "新拉面"
