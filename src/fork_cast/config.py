import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from project root
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"

CANDIDATES_FILE = DATA_DIR / "candidates.json"
HISTORY_FILE = DATA_DIR / "history.json"

TYPESAFE_API_KEY = (
    os.getenv("TYPESAFE_API_KEY") or
    os.getenv("AI_GATEWAY_API_KEY") or
    os.getenv("VERCEL_API_KEY") or
    ""
)
JEV_MODEL = os.getenv("JEV_MODEL", "jev-latest")

# Base URL for TypeSafe / Vercel AI Gateway (safely stripped of endpoint suffixes)
raw_base_url = os.getenv("TYPESAFE_BASE_URL", "").strip().rstrip("/")
for suffix in ["/v1/systemone", "/systemone", "/v1"]:
    if raw_base_url.endswith(suffix):
        raw_base_url = raw_base_url[:-len(suffix)].rstrip("/")
        break

TYPESAFE_BASE_URL = raw_base_url
if not TYPESAFE_BASE_URL:
    if any(TYPESAFE_API_KEY.startswith(prefix) for prefix in ["vck_", "vcl_", "vercel_"]):
        TYPESAFE_BASE_URL = "https://ai-gateway.vercel.sh/typesafe"
    else:
        TYPESAFE_BASE_URL = "https://api.typesafe.ai"

# History lookback window in hours for state context suppression
HISTORY_WINDOW_HOURS = int(os.getenv("HISTORY_WINDOW_HOURS", "48"))
