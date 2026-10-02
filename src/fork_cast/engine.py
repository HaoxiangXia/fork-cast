import random
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Optional
from typesafe_sdk import AsyncTypeSafeClient, Choice, Noul
from fork_cast.config import (
    TYPESAFE_API_KEY,
    JEV_MODEL,
    TYPESAFE_BASE_URL,
    LIQUID_API_KEY,
    D1_MODEL,
    LIQUID_BASE_URL,
    DEFAULT_MODEL,
    HISTORY_WINDOW_HOURS,
    is_d1_model,
    resolve_model_name,
    normalize_base_url,
)
from fork_cast.models import (
    VerdictType,
    DecisionResponse,
    HistoryEntry,
)
from fork_cast.storage import CandidateStorage, HistoryStorage
from fork_cast.context_builder import build_state_context
from fork_cast.copy_manager import copy_manager

class DecisionEngine:
    def __init__(
        self,
        candidate_storage: Optional[CandidateStorage] = None,
        history_storage: Optional[HistoryStorage] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        mock: bool = False
    ):
        self.candidate_storage = candidate_storage or CandidateStorage()
        self.history_storage = history_storage or HistoryStorage()
        self.api_key = api_key
        self.base_url = base_url
        self.model = model or DEFAULT_MODEL
        self.mock = mock

    def _create_history_entry(
        self,
        candidate: str,
        verdict_type: str,
        craving: str,
        persist_server: bool
    ) -> HistoryEntry:
        if persist_server:
            return self.history_storage.add_entry(
                candidate=candidate,
                verdict_type=verdict_type,
                craving=craving
            )
        return HistoryEntry(
            id=str(uuid.uuid4()),
            timestamp=datetime.now(timezone.utc).isoformat(),
            candidate=candidate.strip(),
            verdict_type=verdict_type,
            craving=craving.strip()
        )

    async def decide(
        self,
        craving: str,
        exclusions: Optional[List[str]] = None,
        candidates: Optional[List[str]] = None,
        recent_history: Optional[List[HistoryEntry]] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        history_window_hours: Optional[int] = None
    ) -> DecisionResponse:
        exclusions = [e.strip() for e in (exclusions or []) if e.strip()]
        persist_server = (candidates is None)

        if candidates is not None:
            all_candidates = [c.strip() for c in candidates if c.strip()]
        else:
            all_candidates = self.candidate_storage.load_candidates()

        active_model = resolve_model_name(model or self.model)
        is_d1 = is_d1_model(active_model)

        effective_pool = [c for c in all_candidates if c not in exclusions]

        if not effective_pool:
            return DecisionResponse(
                verdict=VerdictType.IMPASSE,
                primary=None,
                alternatives=[],
                message=copy_manager.get_message("empty"),
                auto_logged=False,
                model=active_model
            )

        if len(effective_pool) == 1:
            lone = effective_pool[0]
            entry = self._create_history_entry(lone, VerdictType.DECISIVE_PICK.value, craving, persist_server)
            return DecisionResponse(
                verdict=VerdictType.DECISIVE_PICK,
                primary=lone,
                alternatives=[],
                message=copy_manager.get_message("lone", lone=lone),
                probabilities={lone: 1.0},
                confidence=1.0,
                is_achievable=1.0,
                is_indifferent=0.0,
                auto_logged=True,
                history_entry_id=entry.id,
                history_entry=entry,
                model=active_model
            )

        if craving.strip() == "随便来个，吃啥都行无所谓" or "随便都行" in craving or "随便来个" in craving:
            chosen = random.choice(effective_pool)
            entry = self._create_history_entry(chosen, VerdictType.DECISIVE_PICK.value, craving, persist_server)
            return DecisionResponse(
                verdict=VerdictType.DECISIVE_PICK,
                primary=chosen,
                alternatives=[],
                message=f"随性就餐模式触发！直接为你随机锁定：【{chosen}】。尽情享用吧！",
                probabilities={chosen: 1.0},
                confidence=1.0,
                is_achievable=1.0,
                is_indifferent=1.0,
                auto_logged=True,
                history_entry_id=entry.id,
                history_entry=entry,
                model=active_model
            )

        hist_list = (
            recent_history
            if recent_history is not None
            else self.history_storage.get_recent_history(hours=history_window_hours or HISTORY_WINDOW_HOURS)
        )
        state = build_state_context(craving, hist_list, exclusions)

        # Resolve active API key
        if api_key and api_key.strip():
            active_key = api_key.strip()
        elif self.api_key:
            active_key = self.api_key.strip()
        elif is_d1:
            active_key = LIQUID_API_KEY or TYPESAFE_API_KEY
        else:
            active_key = TYPESAFE_API_KEY or LIQUID_API_KEY

        # Resolve active Base URL
        req_base_url = (base_url or "").strip()
        if req_base_url:
            active_base_url = normalize_base_url(req_base_url, is_liquid=is_d1 or ("liquid.ai" in req_base_url))
        elif self.base_url:
            active_base_url = normalize_base_url(self.base_url, is_liquid=is_d1 or ("liquid.ai" in self.base_url))
        elif is_d1 or (active_key and not any(active_key.startswith(p) for p in ["vck_", "vcl_", "vercel_"]) and not TYPESAFE_API_KEY and LIQUID_API_KEY):
            active_base_url = LIQUID_BASE_URL
        elif active_key and any(active_key.startswith(p) for p in ["vck_", "vcl_", "vercel_"]):
            active_base_url = "https://ai-gateway.vercel.sh/typesafe"
        else:
            active_base_url = TYPESAFE_BASE_URL

        if self.mock or not active_key:
            return await self._mock_decide(craving, state, effective_pool, persist_server, model=active_model)

        return await self._jev_decide(
            craving=craving,
            state=state,
            effective_pool=effective_pool,
            api_key=active_key,
            base_url=active_base_url,
            persist_server=persist_server,
            model=active_model
        )

    async def _jev_decide(
        self,
        craving: str,
        state: str,
        effective_pool: List[str],
        api_key: str,
        base_url: Optional[str] = None,
        persist_server: bool = True,
        model: Optional[str] = None
    ) -> DecisionResponse:
        active_model = model or self.model or JEV_MODEL
        client = AsyncTypeSafeClient(
            api_key=api_key,
            base_url=base_url or None,
            timeout=60.0
        )

        questions = {
            "is_achievable": Noul(
                instructions="用户的就餐诉求在现实中是否合理可行且不存在自相矛盾的冲突（例如既要极度油炸又要严格0热量0脂肪，或严格无辣但要求极辣等自相矛盾）"
            ),
            "is_indifferent": Noul(
                instructions="用户是否表达了完全无所谓、吃啥都行、没有偏好倾向、极其随意的态度"
            ),
            "candidate_choice": Choice(
                instructions="根据用户的诉求和上下文状态，从候选列表中选择最契合的就餐选项",
                criteria={c: None for c in effective_pool}
            )
        }

        try:
            response = await client.system_one(
                state=state,
                model=active_model,
                questions=questions
            )
        except Exception as e:
            print(f"[{active_model.upper()} API WARNING] Model API call failed ({type(e).__name__}: {e}). Falling back to simulation mode.")
            return await self._mock_decide(craving, state, effective_pool, persist_server, model=active_model)

        achievable_ans = response.answers.get("is_achievable")
        indifferent_ans = response.answers.get("is_indifferent")
        choice_ans = response.answers.get("candidate_choice")

        is_achievable = achievable_ans.noul if achievable_ans else 1.0
        is_indifferent = indifferent_ans.noul if indifferent_ans else 0.0

        confidence = choice_ans.confidence if choice_ans else 0.0
        probabilities = choice_ans.probabilities if choice_ans else {}

        # Fill missing candidates in probabilities if any
        for c in effective_pool:
            if c not in probabilities:
                probabilities[c] = 0.0

        return self._route_verdict(
            craving=craving,
            effective_pool=effective_pool,
            is_achievable=is_achievable,
            is_indifferent=is_indifferent,
            confidence=confidence,
            probabilities=probabilities,
            persist_server=persist_server,
            model=active_model
        )

    def _route_verdict(
        self,
        craving: str,
        effective_pool: List[str],
        is_achievable: float,
        is_indifferent: float,
        confidence: float,
        probabilities: Dict[str, float],
        persist_server: bool = True,
        model: Optional[str] = None
    ) -> DecisionResponse:
        # Gate 1: Check achievability (Impasse)
        if is_achievable < 0.20:
            return DecisionResponse(
                verdict=VerdictType.IMPASSE,
                primary=None,
                alternatives=[],
                message=copy_manager.get_message("impasse"),
                probabilities=probabilities,
                confidence=confidence,
                is_achievable=is_achievable,
                is_indifferent=is_indifferent,
                auto_logged=False,
                model=model
            )

        # Gate 2: Check indifference (Apathy -> Blind Box)
        if is_indifferent > 0.80:
            return DecisionResponse(
                verdict=VerdictType.INDIFFERENCE,
                primary=None,
                alternatives=[],
                message=copy_manager.get_message("indifference"),
                probabilities=probabilities,
                confidence=confidence,
                is_achievable=is_achievable,
                is_indifferent=is_indifferent,
                auto_logged=False,
                model=model
            )

        # Gate 3: Sort by probability
        sorted_items = sorted(probabilities.items(), key=lambda x: x[1], reverse=True)
        top1_name, top1_prob = sorted_items[0]
        top2_name, top2_prob = sorted_items[1] if len(sorted_items) > 1 else ("", 0.0)
        top3_name, top3_prob = sorted_items[2] if len(sorted_items) > 2 else ("", 0.0)

        margin = top1_prob - top2_prob
        n_pool = len(effective_pool)
        uniform_baseline = 1.0 / n_pool

        # Decision rule 1: Decisive Pick (Dominant candidate)
        # Conditions: high confidence and decisive margin over top 2
        if confidence >= 0.70 and margin >= 0.20:
            entry = self._create_history_entry(top1_name, VerdictType.DECISIVE_PICK.value, craving, persist_server)
            return DecisionResponse(
                verdict=VerdictType.DECISIVE_PICK,
                primary=top1_name,
                alternatives=[],
                message=copy_manager.get_message("decisive", primary=top1_name),
                probabilities=probabilities,
                confidence=confidence,
                is_achievable=is_achievable,
                is_indifferent=is_indifferent,
                auto_logged=True,
                history_entry_id=entry.id,
                history_entry=entry,
                model=model
            )

        # Decision rule 2: Dilemma Duel (Tied top contenders)
        # Conditions: tight margin and top 2 combined have significant weight
        if margin < 0.12 and (top1_prob + top2_prob) > (1.2 * 2 * uniform_baseline):
            contenders = [top1_name, top2_name]
            if top3_name and (top2_prob - top3_prob) < 0.05:
                contenders.append(top3_name)

            # Settle the duel winner
            winner = random.choice(contenders)
            entry = self._create_history_entry(winner, VerdictType.DILEMMA_DUEL.value, craving, persist_server)
            return DecisionResponse(
                verdict=VerdictType.DILEMMA_DUEL,
                primary=winner,
                alternatives=contenders,
                message=copy_manager.get_message("duel", contenders=" vs ".join(contenders), winner=winner),
                probabilities=probabilities,
                confidence=confidence,
                is_achievable=is_achievable,
                is_indifferent=is_indifferent,
                auto_logged=True,
                history_entry_id=entry.id,
                history_entry=entry,
                model=model
            )

        # Decision rule 3: Soft Pick (Moderate preference)
        # Suggest primary with alternative backup
        entry = self._create_history_entry(top1_name, VerdictType.SOFT_PICK.value, craving, persist_server)
        return DecisionResponse(
            verdict=VerdictType.SOFT_PICK,
            primary=top1_name,
            alternatives=[top2_name] if top2_name else [],
            message=copy_manager.get_message("soft", primary=top1_name, alternative=top2_name),
            probabilities=probabilities,
            confidence=confidence,
            is_achievable=is_achievable,
            is_indifferent=is_indifferent,
            auto_logged=True,
            history_entry_id=entry.id,
            history_entry=entry,
            model=model
        )

    async def _mock_decide(
        self,
        craving: str,
        state: str,
        effective_pool: List[str],
        persist_server: bool = True,
        model: Optional[str] = None
    ) -> DecisionResponse:
        """
        Deterministic mock engine for offline testing and verification.
        """
        # 1. Impasse test
        if any(kw in craving for kw in ["0卡0油", "0热量", "神仙也做不到", "既要油炸又要减脂"]):
            return self._route_verdict(
                craving=craving,
                effective_pool=effective_pool,
                is_achievable=0.05,
                is_indifferent=0.10,
                confidence=0.10,
                probabilities={c: 1.0 / len(effective_pool) for c in effective_pool},
                model=model
            )

        # 2. Indifference test
        if any(kw in craving for kw in ["随便", "都行", "不挑", "无所谓"]):
            return self._route_verdict(
                craving=craving,
                effective_pool=effective_pool,
                is_achievable=0.95,
                is_indifferent=0.92,
                confidence=0.10,
                probabilities={c: 1.0 / len(effective_pool) for c in effective_pool},
                model=model
            )

        # 3. Dynamic semantic and character overlap matching (works on any custom candidates)
        scores = {}
        for c in effective_pool:
            score = 0.05
            # Character overlap
            overlap = sum(1 for char in c if char in craving)
            if overlap > 0:
                score += overlap * 0.25

            # Semantic cuisine associations
            if any(w in craving for w in ["面", "粉", "汤", "热", "暖", "喝", "碳水"]) and any(w in c for w in ["面", "粉", "汤", "烫", "拉面", "米线"]):
                score += 0.40
            if any(w in craving for w in ["肉", "快餐", "汉堡", "炸鸡", "烤", "硬菜", "饱", "饭", "犒劳", "重口"]) and any(w in c for w in ["肉", "汉堡", "鸡", "牛", "饭", "排", "烧", "麦当劳"]):
                score += 0.45
            if any(w in craving for w in ["清淡", "减脂", "低卡", "不油", "轻食", "素", "消化"]) and any(w in c for w in ["沙拉", "素", "煮", "粥", "蔬", "轻食", "关东煮"]):
                score += 0.45
            if any(w in craving for w in ["辣", "川", "湘", "过瘾", "纠结", "对决"]) and any(w in c for w in ["辣", "烫", "川", "湘", "小面", "火锅"]):
                score += 0.40
            scores[c] = score

        # Normalize
        total = sum(scores.values())
        probabilities = {k: round(v / total, 4) for k, v in scores.items()}

        sorted_p = sorted(probabilities.values(), reverse=True)
        margin = sorted_p[0] - sorted_p[1] if len(sorted_p) > 1 else 1.0
        confidence = 0.85 if margin > 0.25 else 0.55

        return self._route_verdict(
            craving=craving,
            effective_pool=effective_pool,
            is_achievable=0.95,
            is_indifferent=0.05,
            confidence=confidence,
            probabilities=probabilities,
            persist_server=persist_server,
            model=model
        )
