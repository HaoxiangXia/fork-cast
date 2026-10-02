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

def normalize_base_url(url: str, is_liquid: bool = False) -> str:
    cleaned = (url or "").strip().rstrip("/")
    if not cleaned:
        return ""
    for suffix in ["/v1/systemone", "/systemone", "/v1"]:
        if cleaned.endswith(suffix):
            cleaned = cleaned[:-len(suffix)].rstrip("/")
            break
    if (is_liquid or "liquid.ai" in cleaned) and cleaned == "https://api.liquid.ai":
        cleaned = "https://api.liquid.ai/decisions"
    return cleaned

# Base URL for TypeSafe / Vercel AI Gateway (safely stripped of endpoint suffixes)
TYPESAFE_BASE_URL = normalize_base_url(os.getenv("TYPESAFE_BASE_URL", ""))
if not TYPESAFE_BASE_URL:
    if any(TYPESAFE_API_KEY.startswith(prefix) for prefix in ["vck_", "vcl_", "vercel_"]):
        TYPESAFE_BASE_URL = "https://ai-gateway.vercel.sh/typesafe"
    else:
        TYPESAFE_BASE_URL = "https://api.typesafe.ai"

# Liquid AI & D1 model configuration
LIQUID_API_KEY = os.getenv("LIQUID_API_KEY", "").strip()
D1_MODEL = os.getenv("D1_MODEL", "d1:free").strip()

LIQUID_BASE_URL = normalize_base_url(os.getenv("LIQUID_BASE_URL", ""), is_liquid=True)
if not LIQUID_BASE_URL:
    LIQUID_BASE_URL = "https://api.liquid.ai/decisions"

# Default model: can be explicitly set via DEFAULT_MODEL or DECISION_MODEL,
# or defaults to d1:free if LIQUID_API_KEY is configured without TYPESAFE_API_KEY, else JEV_MODEL
DEFAULT_MODEL = (
    os.getenv("DEFAULT_MODEL")
    or os.getenv("DECISION_MODEL")
    or (D1_MODEL if (LIQUID_API_KEY and not TYPESAFE_API_KEY) else JEV_MODEL)
)

def is_d1_model(model: str | None) -> bool:
    if not model:
        return False
    m = model.strip().lower()
    return m == "d1" or m.startswith("d1:") or "d1" in m

def resolve_model_name(model: str | None) -> str:
    if not model or not model.strip():
        return DEFAULT_MODEL
    m = model.strip()
    if m.lower() == "d1":
        return D1_MODEL
    if m.lower() == "jev":
        return JEV_MODEL
    return m
# History lookback window in hours for state context suppression
HISTORY_WINDOW_HOURS = int(os.getenv("HISTORY_WINDOW_HOURS", "48"))

# Hard capacity cap for candidate pool
CANDIDATE_POOL_CAP = int(os.getenv("CANDIDATE_POOL_CAP", "36"))
