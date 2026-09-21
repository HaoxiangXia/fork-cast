import random
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Optional
from typesafe_sdk import AsyncTypeSafeClient, Choice, Noul
from fork_cast.config import TYPESAFE_API_KEY, JEV_MODEL, TYPESAFE_BASE_URL
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
        model: str = JEV_MODEL,
        mock: bool = False
    ):
        self.candidate_storage = candidate_storage or CandidateStorage()
        self.history_storage = history_storage or HistoryStorage()
        self.api_key = api_key or TYPESAFE_API_KEY
        self.base_url = base_url or TYPESAFE_BASE_URL
        self.model = model
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
        base_url: Optional[str] = None
    ) -> DecisionResponse:
        exclusions = [e.strip() for e in (exclusions or []) if e.strip()]
        persist_server = (candidates is None)

        if candidates is not None:
            all_candidates = [c.strip() for c in candidates if c.strip()]
        else:
            all_candidates = self.candidate_storage.load_candidates()

        effective_pool = [c for c in all_candidates if c not in exclusions]

        if not effective_pool:
            return DecisionResponse(
                verdict=VerdictType.IMPASSE,
                primary=None,
                alternatives=[],
                message=copy_manager.get_message("empty"),
                auto_logged=False
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
                history_entry=entry
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
                history_entry=entry
            )

        hist_list = recent_history if recent_history is not None else self.history_storage.get_recent_history()
        state = build_state_context(craving, hist_list, exclusions)

        active_key = api_key.strip() if (api_key and api_key.strip()) else self.api_key
        active_base_url = base_url.strip() if (base_url and base_url.strip()) else self.base_url

        if active_base_url:
            raw_url = active_base_url.rstrip("/")
            for sfx in ["/v1/systemone", "/systemone", "/v1"]:
                if raw_url.endswith(sfx):
                    raw_url = raw_url[:-len(sfx)].rstrip("/")
                    break
            active_base_url = raw_url
        elif active_key:
            if any(active_key.startswith(p) for p in ["vck_", "vcl_", "vercel_"]):
                active_base_url = "https://ai-gateway.vercel.sh/typesafe"
            else:
                active_base_url = "https://api.typesafe.ai"

        if self.mock or not active_key:
            return await self._mock_decide(craving, state, effective_pool, persist_server)

        return await self._jev_decide(
            craving=craving,
            state=state,
            effective_pool=effective_pool,
            api_key=active_key,
            base_url=active_base_url,
            persist_server=persist_server
        )

    async def _jev_decide(
        self,
        craving: str,
        state: str,
        effective_pool: List[str],
        api_key: str,
        base_url: Optional[str] = None,
        persist_server: bool = True
    ) -> DecisionResponse:
        client = AsyncTypeSafeClient(
            api_key=api_key,
            base_url=base_url or None
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
                model=self.model,
                questions=questions
            )
        except Exception as e:
            print(f"[JEV API WARNING] Jev API call failed ({type(e).__name__}: {e}). Falling back to simulation mode.")
            return await self._mock_decide(craving, state, effective_pool, persist_server)

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
            persist_server=persist_server
        )

    def _route_verdict(
        self,
        craving: str,
        effective_pool: List[str],
        is_achievable: float,
        is_indifferent: float,
        confidence: float,
        probabilities: Dict[str, float],
        persist_server: bool = True
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
                auto_logged=False
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
                auto_logged=False
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
                history_entry=entry
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
                history_entry=entry
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
            history_entry=entry
        )

    async def _mock_decide(
        self,
        craving: str,
        state: str,
        effective_pool: List[str],
        persist_server: bool = True
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
                probabilities={c: 1.0 / len(effective_pool) for c in effective_pool}
            )

        # 2. Indifference test
        if any(kw in craving for kw in ["随便", "都行", "不挑", "无所谓"]):
            return self._route_verdict(
                craving=craving,
                effective_pool=effective_pool,
                is_achievable=0.95,
                is_indifferent=0.92,
                confidence=0.10,
                probabilities={c: 1.0 / len(effective_pool) for c in effective_pool}
            )

        # 3. Specific craving match
        scores = {}
        for c in effective_pool:
            score = 0.05
            if ("面" in craving or "热汤" in craving) and ("面" in c or "烫" in c):
                score += 0.40
            if ("快餐" in craving or "汉堡" in craving or "炸鸡" in craving) and ("麦当劳" in c):
                score += 0.60
            if ("米饭" in craving or "饱腹" in craving) and ("饭" in c or "黄焖鸡" in c):
                score += 0.45
            if ("清淡" in craving or "减脂" in craving) and ("沙拉" in c or "关东煮" in c):
                score += 0.50
            if ("纠结" in craving or "对决" in craving) and ("麻辣烫" in c or "重庆小面" in c):
                score = 0.35
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
            persist_server=persist_server
        )
