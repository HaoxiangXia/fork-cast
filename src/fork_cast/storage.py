import json
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Optional
from fork_cast.config import CANDIDATES_FILE, HISTORY_FILE, HISTORY_WINDOW_HOURS
from fork_cast.models import HistoryEntry


class CandidateStorage:
    def __init__(self, file_path: Path = CANDIDATES_FILE):
        self.file_path = file_path
        self._ensure_file()

    def _ensure_file(self) -> None:
        if not self.file_path.exists():
            self.file_path.parent.mkdir(parents=True, exist_ok=True)
            self.save_candidates([])

    def load_candidates(self) -> List[str]:
        self._ensure_file()
        with open(self.file_path, "r", encoding="utf-8") as f:
            try:
                data = json.load(f)
                if isinstance(data, list):
                    return [str(c).strip() for c in data if str(c).strip()]
                return []
            except json.JSONDecodeError:
                return []

    def save_candidates(self, candidates: List[str]) -> None:
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        # Deduplicate while preserving order
        seen = set()
        unique = []
        for c in candidates:
            c_clean = c.strip()
            if c_clean and c_clean not in seen:
                seen.add(c_clean)
                unique.append(c_clean)

        tmp_path = self.file_path.with_suffix(".tmp")
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(unique, f, ensure_ascii=False, indent=2)
        tmp_path.replace(self.file_path)

    def add_candidate(self, name: str) -> List[str]:
        clean = name.strip()
        if not clean:
            raise ValueError("Candidate name cannot be empty")
        candidates = self.load_candidates()
        if clean in candidates:
            raise ValueError(f"Candidate '{clean}' already exists")
        candidates.append(clean)
        self.save_candidates(candidates)
        return candidates

    def remove_candidate(self, name: str) -> List[str]:
        clean = name.strip()
        candidates = self.load_candidates()
        if clean not in candidates:
            raise ValueError(f"Candidate '{clean}' not found")
        candidates.remove(clean)
        self.save_candidates(candidates)
        return candidates


class HistoryStorage:
    def __init__(self, file_path: Path = HISTORY_FILE):
        self.file_path = file_path
        self._ensure_file()

    def _ensure_file(self) -> None:
        if not self.file_path.exists():
            self.file_path.parent.mkdir(parents=True, exist_ok=True)
            self.save_history([])

    def load_history(self) -> List[HistoryEntry]:
        self._ensure_file()
        with open(self.file_path, "r", encoding="utf-8") as f:
            try:
                data = json.load(f)
                if isinstance(data, list):
                    return [HistoryEntry(**item) for item in data]
                return []
            except (json.JSONDecodeError, Exception):
                return []

    def save_history(self, entries: List[HistoryEntry]) -> None:
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = self.file_path.with_suffix(".tmp")
        with open(tmp_path, "w", encoding="utf-8") as f:
            data = [e.model_dump() for e in entries]
            json.dump(data, f, ensure_ascii=False, indent=2)
        tmp_path.replace(self.file_path)

    def add_entry(self, candidate: str, verdict_type: str, craving: str) -> HistoryEntry:
        entries = self.load_history()
        entry = HistoryEntry(
            id=str(uuid.uuid4()),
            timestamp=datetime.now(timezone.utc).isoformat(),
            candidate=candidate.strip(),
            verdict_type=verdict_type,
            craving=craving.strip()
        )
        entries.append(entry)
        self.save_history(entries)
        return entry

    def pop_last_entry(self) -> Optional[HistoryEntry]:
        entries = self.load_history()
        if not entries:
            return None
        last_entry = entries.pop()
        self.save_history(entries)
        return last_entry

    def get_recent_history(self, hours: int = HISTORY_WINDOW_HOURS) -> List[HistoryEntry]:
        entries = self.load_history()
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(hours=hours)
        recent = []
        for e in entries:
            try:
                dt = datetime.fromisoformat(e.timestamp)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                if dt >= cutoff:
                    recent.append(e)
            except Exception:
                continue
        return recent
