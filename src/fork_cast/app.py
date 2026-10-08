import hashlib
import random
from pathlib import Path
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, Response
from fastapi.staticfiles import StaticFiles


class CacheControlledStaticFiles(StaticFiles):
    def file_response(self, *args, **kwargs) -> Response:
        resp = super().file_response(*args, **kwargs)
        resp.headers["Cache-Control"] = "no-cache, must-revalidate"
        return resp
from fork_cast.models import (
    DecisionRequest,
    DecisionResponse,
    BlindBoxResponse,
    RevokeResponse,
    CandidateListResponse,
    CandidateAddRequest,
    HistoryEntry,
    QuotaStatusResponse,
)
from fork_cast.quota import quota_manager, get_beijing_today, QuotaManager
from fork_cast.storage import CandidateStorage, HistoryStorage
from fork_cast.engine import DecisionEngine
from fork_cast.copy_manager import copy_manager

STATIC_DIR = Path(__file__).resolve().parent / "static"
STATIC_INDEX = STATIC_DIR / "index.html"
DEMO_FLAT_HTML = Path(__file__).resolve().parent.parent.parent / "docs" / "demo-flat.html"
STATIC_FAVICON = STATIC_DIR / "favicon.ico"
REVALIDATE_HEADERS = {"Cache-Control": "no-cache, must-revalidate"}


def create_app(
    candidate_storage: Optional[CandidateStorage] = None,
    history_storage: Optional[HistoryStorage] = None,
    quota_manager_instance: Optional[QuotaManager] = None,
    mock: bool = False
) -> FastAPI:
    app = FastAPI(
        title="Fork-Cast API",
        description="Zero-tagging food decision engine powered by Jev System 1 model",
        version="0.1.0"
    )

    # Enable CORS for modern web clients
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    if STATIC_DIR.exists():
        app.mount("/static", CacheControlledStaticFiles(directory=STATIC_DIR), name="static")

    cs = candidate_storage or CandidateStorage()
    hs = history_storage or HistoryStorage()
    qm = quota_manager_instance or quota_manager
    engine = DecisionEngine(
        candidate_storage=cs,
        history_storage=hs,
        mock=mock
    )
    def get_asset_hashes() -> tuple[str, str]:
        css_file = STATIC_DIR / "css" / "style.css"
        css_v = hashlib.md5(css_file.read_bytes()).hexdigest()[:8] if css_file.exists() else "1"
        hasher = hashlib.md5()
        js_dir = STATIC_DIR / "js"
        if js_dir.exists():
            for js_file in sorted(js_dir.glob("*.js")):
                hasher.update(js_file.name.encode())
                hasher.update(js_file.read_bytes())
        js_v = hasher.hexdigest()[:8]
        return css_v, js_v

    @app.get("/", include_in_schema=False)
    def serve_frontend(request: Request):
        if not STATIC_INDEX.exists():
            return {"message": "Frontend static file not found"}

        raw_html = STATIC_INDEX.read_text(encoding="utf-8")
        css_v, js_v = get_asset_hashes()
        injected_html = raw_html.replace(
            'href="/static/css/style.css"',
            f'href="/static/css/style.css?v={css_v}"'
        ).replace(
            'src="/static/js/app.js"',
            f'src="/static/js/app.js?v={js_v}"'
        )

        etag = f'"{hashlib.md5(injected_html.encode("utf-8")).hexdigest()}"'
        headers = {
            "Cache-Control": "no-cache, must-revalidate",
            "ETag": etag
        }

        if request.headers.get("if-none-match") == etag:
            return Response(status_code=304, headers=headers)

        return HTMLResponse(content=injected_html, headers=headers)
    @app.get("/favicon.ico", include_in_schema=False)
    def serve_favicon():
        if STATIC_FAVICON.exists():
            return FileResponse(STATIC_FAVICON, media_type="image/x-icon")
        raise HTTPException(status_code=404, detail="Favicon not found")


    @app.get("/demo", include_in_schema=False)
    def serve_flat_demo():
        if DEMO_FLAT_HTML.exists():
            return FileResponse(DEMO_FLAT_HTML, headers=REVALIDATE_HEADERS)
        return {"message": "Flat demo static file not found"}

    @app.get("/api/health")
    def health_check():
        return {
            "status": "ok",
            "mock_mode": engine.mock or not bool(engine.api_key),
            "candidate_count": len(cs.load_candidates()),
            "history_count": len(hs.load_history())
        }

    @app.get("/api/copy")
    def get_copy_config():
        return copy_manager.load_copy()

    @app.get("/api/quota", response_model=QuotaStatusResponse)
    def get_quota_status(request: Request, device_id: Optional[str] = Query(default=None)):
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()
        elif request.client:
            client_ip = request.client.host
        else:
            client_ip = "127.0.0.1"
        dev_id = request.headers.get("X-Device-Id") or device_id or "unknown_dev"
        limit, used, remaining = qm.get_status(client_ip, dev_id)
        return QuotaStatusResponse(
            limit=limit,
            used=used,
            remaining=remaining,
            date=get_beijing_today(),
            byok_active=False
        )

    @app.post("/api/decide", response_model=DecisionResponse)
    async def decide_food(req: DecisionRequest, request: Request):
        if not req.craving.strip():
            raise HTTPException(status_code=400, detail="Craving text cannot be empty")

        # Extract client IP (X-Forwarded-For or client.host)
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()
        elif request.client:
            client_ip = request.client.host
        else:
            client_ip = "127.0.0.1"

        # Extract device ID from header or body
        dev_id = request.headers.get("X-Device-Id") or req.device_id or "unknown_dev"

        # Check if client provided a personal BYOK key
        has_byok = bool(req.api_key and req.api_key.strip())

        quota_rem = None
        quota_lim = qm.limit

        # Enforce quota only when using shared server key (non-BYOK and non-mock)
        if not has_byok and not engine.mock:
            allowed, used, remaining = qm.check_and_consume(client_ip, dev_id)
            if not allowed:
                raise HTTPException(
                    status_code=429,
                    detail=f"今日 {qm.limit} 次免费额度已用尽（北京时间次日重置）。请在设置中配置个人 API Key 继续使用！"
                )
            quota_rem = remaining
        else:
            # For BYOK or Mock, query status without consuming
            _, _, quota_rem = qm.get_status(client_ip, dev_id)

        decision = await engine.decide(
            craving=req.craving,
            exclusions=req.exclusions,
            candidates=req.candidates,
            recent_history=req.recent_history,
            api_key=req.api_key,
            base_url=req.base_url,
            model=req.model,
            history_window_hours=req.history_window_hours
        )

        decision.quota_remaining = quota_rem
        decision.quota_limit = quota_lim
        return decision
    @app.post("/api/blind-box", response_model=BlindBoxResponse)
    def draw_blind_box(
        exclusions: Optional[List[str]] = Query(default=None),
        candidates: Optional[List[str]] = Query(default=None)
    ):
        """
        Samples a candidate uniformly at random from client or server candidates.
        Exempt from History per ADR-0002.
        """
        all_candidates = candidates if candidates is not None else cs.load_candidates()
        excl_set = set(exclusions or [])
        available = [c.strip() for c in all_candidates if c.strip() and c.strip() not in excl_set]
        if not available:
            raise HTTPException(
                status_code=400,
                detail="候选池为空或所有候选均已被排除，无法开盲盒"
            )

        chosen = random.choice(available)
        msg = copy_manager.load_copy().get("engine_messages", {}).get(
            "blind_box_reveal", "盲盒揭晓！今天的随机美味是：【{chosen}】！"
        ).format(chosen=chosen)
        return BlindBoxResponse(
            candidate=chosen,
            message=msg
        )

    @app.post("/api/history/revoke", response_model=RevokeResponse)
    def revoke_last_decision():
        """
        Pops the most recent auto-logged candidate from History.
        """
        popped = hs.pop_last_entry()
        if not popped:
            raise HTTPException(status_code=404, detail="历史记录为空，无可撤销条目")

        remaining = hs.load_history()
        msg = copy_manager.load_copy().get("toasts", {}).get(
            "revoked", "已成功撤销【{candidate}】的用餐记录！"
        ).format(candidate=popped.candidate)
        return RevokeResponse(
            revoked_candidate=popped.candidate,
            message=msg,
            remaining_history_count=len(remaining)
        )

    @app.get("/api/history", response_model=List[HistoryEntry])
    def get_history(limit: int = 50):
        history = hs.load_history()
        return history[-limit:][::-1]

    @app.get("/api/candidates", response_model=CandidateListResponse)
    def list_candidates():
        candidates = cs.load_candidates()
        return CandidateListResponse(
            candidates=candidates,
            total=len(candidates)
        )

    @app.post("/api/candidates", response_model=CandidateListResponse)
    def add_candidate(req: CandidateAddRequest):
        try:
            candidates = cs.add_candidate(req.name)
            return CandidateListResponse(
                candidates=candidates,
                total=len(candidates)
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    @app.delete("/api/candidates/{name}", response_model=CandidateListResponse)
    def delete_candidate(name: str):
        try:
            candidates = cs.remove_candidate(name)
            return CandidateListResponse(
                candidates=candidates,
                total=len(candidates)
            )
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))

    return app


app = create_app()
