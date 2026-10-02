from enum import Enum
from typing import List, Dict, Optional
from pydantic import BaseModel, Field


class VerdictType(str, Enum):
    DECISIVE_PICK = "decisive_pick"
    DILEMMA_DUEL = "dilemma_duel"
    SOFT_PICK = "soft_pick"
    IMPASSE = "impasse"
    INDIFFERENCE = "indifference"
    BLIND_BOX = "blind_box"


class HistoryEntry(BaseModel):
    id: str
    timestamp: str
    candidate: str
    verdict_type: str
    craving: str


class DecisionRequest(BaseModel):
    craving: str = Field(..., description="Unstructured natural language input from user")
    exclusions: List[str] = Field(
        default_factory=list,
        description="Transient session exclusions (e.g. from revoked verdicts)"
    )
    candidates: Optional[List[str]] = Field(
        default=None,
        description="Client-provided candidate pool from LocalStorage"
    )
    recent_history: Optional[List["HistoryEntry"]] = Field(
        default=None,
        description="Client-provided recent meal history from LocalStorage"
    )
    api_key: Optional[str] = Field(
        default=None,
        description="Client-provided TypeSafe / Liquid API Key (BYOK)"
    )
    base_url: Optional[str] = Field(
        default=None,
        description="Client-provided custom Base URL for Jev / D1"
    )
    model: Optional[str] = Field(
        default=None,
        description="Client-provided decision model (e.g. jev-latest, d1:free)"
    )
    device_id: Optional[str] = Field(
        default=None,
        description="Client device UUID for Option C daily quota enforcement"
    )
    history_window_hours: Optional[int] = Field(
        default=None,
        description="Client-configured history lookback window in hours"
    )


class DecisionResponse(BaseModel):
    verdict: VerdictType
    primary: Optional[str] = None
    alternatives: List[str] = Field(default_factory=list)
    message: str
    probabilities: Dict[str, float] = Field(default_factory=dict)
    confidence: float = 0.0
    is_achievable: float = 1.0
    is_indifferent: float = 0.0
    auto_logged: bool = False
    history_entry_id: Optional[str] = None
    history_entry: Optional["HistoryEntry"] = None
    model: Optional[str] = Field(
        default=None,
        description="Decision model used for this evaluation (e.g. jev-latest, d1:free, mock)"
    )
    quota_remaining: Optional[int] = Field(
        default=None,
        description="Remaining free quota for today (Beijing time)"
    )
    quota_limit: Optional[int] = Field(
        default=None,
        description="Daily free quota limit"
    )




class BlindBoxResponse(BaseModel):
    candidate: str
    message: str


class RevokeResponse(BaseModel):
    revoked_candidate: str
    message: str
    remaining_history_count: int


class CandidateListResponse(BaseModel):
    candidates: List[str]
    total: int


class CandidateAddRequest(BaseModel):
    name: str


class QuotaStatusResponse(BaseModel):
    limit: int
    used: int
    remaining: int
    date: str
    byok_active: bool
