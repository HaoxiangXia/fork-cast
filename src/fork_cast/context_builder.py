from datetime import datetime, timezone
from typing import List, Optional
from fork_cast.models import HistoryEntry


def build_state_context(
    craving: str,
    recent_history: List[HistoryEntry],
    exclusions: Optional[List[str]] = None
) -> str:
    """
    Assembles dynamic operational context (timestamp, recent meals, exclusions)
    alongside raw craving into Jev's evaluation state.
    """
    now = datetime.now()
    weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
    weekday_str = weekdays[now.weekday()]
    time_str = now.strftime("%H:%M")

    parts = [
        f"【当前就餐时间】：{weekday_str} {time_str}"
    ]

    if recent_history:
        # Show recent meals (up to 5 most recent)
        recent_desc = "；".join([
            f"{h.candidate} (于 {h.timestamp[:16].replace('T', ' ')})"
            for h in recent_history[-5:]
        ])
        parts.append(f"【防腻降权窗口记录】：{recent_desc}。特别约束：在防腻窗口内出现频次越高的品类，必须施加越严格的累加衰减降权；单次出现的品类施加常规避让，优先推荐窗口内未曾食用的品类。")
    else:
        parts.append("【防腻降权窗口记录】：防腻窗口内暂无就餐记录。")

    if exclusions:
        excl_str = "、".join(exclusions)
        parts.append(f"【临时排除名单】：用户明确要求本次绝对排除以下选项：{excl_str}。")

    parts.append(f"【用户即时诉求】：{craving.strip()}")

    return "\n".join(parts)
