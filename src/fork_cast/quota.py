import os
import json
import threading
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, Tuple, Optional
from fork_cast.config import DATA_DIR

BEIJING_TZ = timezone(timedelta(hours=8))
DEFAULT_DAILY_LIMIT = int(os.getenv("DAILY_FREE_LIMIT", "10"))
QUOTA_FILE = DATA_DIR / "quota.json"


def get_beijing_today() -> str:
    """Returns today's date in Beijing time (UTC+8) as YYYYMMDD string."""
    return datetime.now(BEIJING_TZ).strftime("%Y%m%d")


class QuotaManager:
    """
    Thread-safe quota manager that enforces daily rate limits based on
    Beijing date, client IP, and device UUID (Option C).
    """

    def __init__(
        self,
        limit: int = DEFAULT_DAILY_LIMIT,
        file_path: Optional[Path] = None
    ):
        self.limit = limit
        self.file_path = file_path if file_path is not None else QUOTA_FILE
        self._lock = threading.Lock()
        self._data: Dict[str, Dict[str, int]] = {}
        self._load()

    def _cleanup_old_dates(self, current_date: str) -> None:
        """Evicts dates prior to today to bound memory and file size."""
        expired = [d for d in list(self._data.keys()) if d < current_date]
        for d in expired:
            del self._data[d]

    def _load(self) -> None:
        if self.file_path and self.file_path.exists():
            try:
                with open(self.file_path, "r", encoding="utf-8") as f:
                    self._data = json.load(f)
            except Exception:
                self._data = {}

    def _save(self) -> None:
        if not self.file_path:
            return
        try:
            self.file_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.file_path, "w", encoding="utf-8") as f:
                json.dump(self._data, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    def get_identifier(self, client_ip: str, device_id: str) -> str:
        ip = (client_ip or "unknown").strip()
        dev = (device_id or "unknown").strip()
        return f"{ip}:{dev}"

    def check_and_consume(self, client_ip: str, device_id: str) -> Tuple[bool, int, int]:
        """
        Attempts to consume 1 free quota unit.
        Returns: (allowed: bool, used: int, remaining: int)
        """
        today = get_beijing_today()
        ident = self.get_identifier(client_ip, device_id)
        with self._lock:
            self._cleanup_old_dates(today)
            if today not in self._data:
                self._data[today] = {}
            current_used = self._data[today].get(ident, 0)
            if current_used >= self.limit:
                return False, current_used, 0

            current_used += 1
            self._data[today][ident] = current_used
            self._save()
            remaining = max(0, self.limit - current_used)
            return True, current_used, remaining

    def get_status(self, client_ip: str, device_id: str) -> Tuple[int, int, int]:
        """
        Queries status without consuming.
        Returns: (limit: int, used: int, remaining: int)
        """
        today = get_beijing_today()
        ident = self.get_identifier(client_ip, device_id)
        with self._lock:
            current_used = self._data.get(today, {}).get(ident, 0)
            remaining = max(0, self.limit - current_used)
            return self.limit, current_used, remaining


quota_manager = QuotaManager()
