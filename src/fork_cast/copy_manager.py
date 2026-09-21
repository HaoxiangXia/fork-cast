import json
from pathlib import Path
from typing import Any, Dict
from fork_cast.config import BASE_DIR

COPY_FILE = BASE_DIR / "data" / "copy.json"

DEFAULT_COPY: Dict[str, Any] = {
    "brand": {
        "name": "吃了吗",
        "subtitle": "JEV 决策引擎",
        "footer": "吃了吗 · 零标签随性就餐决策 · TYPESAFE JEV"
    },
    "nav": {
        "blind_box": "盲盒",
        "settings": "设置"
    },
    "input": {
        "label": "诉求投币口",
        "placeholder": "“今天好累不想动脑子，想吃点热腾腾的碳水炸弹治愈一下...”",
        "quick_label": "灵感垫片:",
        "quick_tags": [
            {"label": "热汤碳水", "text": "加班好累，想吃热汤碳水炸弹"},
            {"label": "清淡易消化", "text": "胃有点不适，吃点清淡好消化的，拒绝油炸和辣"},
            {"label": "随性都行", "text": "随便来个，吃啥都行无所谓"}
        ],
        "slap_button": "拍 板 决 策",
        "slap_loading": "正在调动 JEV 裁决...",
        "dispenser_slot": "▼ 出票导槽 ▼",
        "exclusion_prefix": "临时排除:"
    },
    "ticket": {
        "header_brand": "吃了吗 · 专属餐券",
        "stamps": {
            "decisive": "拍板落定",
            "soft": "倾向建议",
            "impasse": "神仙难救",
            "indifference": "盲盒邀约"
        },
        "labels": {
            "confidence": "JEV 校准置信度",
            "distribution": "候选分布:",
            "alternatives_prefix": "备选:"
        },
        "actions": {
            "eat": "去吃！",
            "revoke": "撤销并排除",
            "refocus": "重新整理需求",
            "draw_blind_box": "直接抽个盲盒"
        }
    },
    "engine_messages": {
        "impasse": "你的要求神仙也做不到，自相矛盾了，先喝杯热水冷静一下吧。",
        "indifference": "检测到你今天完全不挑、毫无偏好，建议直接使用「开盲盒」功能碰碰运气！",
        "decisive": "不用纠结了，今天就是【{primary}】！",
        "duel": "势均力敌！在【{contenders}】中决出胜者：【{winner}】！",
        "soft": "为你推荐【{primary}】，如果今天不顺路也可以选【{alternative}】。",
        "lone": "候选池中仅剩唯一选择，不用纠结了，今天就是【{lone}】！",
        "empty": "没有可用的候选就餐选项（所有候选均已被排除或候选池为空）。"
    },
    "modals": {
        "pool": {
            "title": "个人候选池 (常吃清单)",
            "desc": "维护平时常吃常买的菜品清单。Jev 大模型常识会自动解析属性，无需给菜品打标签。",
            "placeholder": "新增菜品 / 餐馆名",
            "btn_add": "添加"
        },
        "blind_box": {
            "title": "盲盒抽选",
            "drum_text": "随机",
            "drum_done": "完成",
            "settle_badge": "天意已决，绝不反悔",
            "tag": "免记入历史 · 随时重抽",
            "btn_roll": "摇一个",
            "btn_close": "收起"
        },
        "duel": {
            "title": "DILEMMA DUEL · 终局对决",
            "desc": "势均力敌！轮盘一转定乾坤，单次终态绝不复摇。",
            "winner_label": "对决胜出：",
            "btn_spin": "启动对决轮盘",
            "btn_accept": "接受对决，去吃！"
        }
    },
    "toasts": {
        "accepted": "已选定：【{candidate}】",
        "revoked": "已撤销【{candidate}】，本次已临时排除",
        "restored": "已恢复【{candidate}】",
        "added": "已添加【{candidate}】到候选池",
        "removed": "已移除【{candidate}】",
        "input_empty": "请先输入几句就餐想法",
        "network_error": "网络错误，请检查服务",
        "blind_box_failed": "盲盒抽取失败",
        "revoke_failed": "撤销失败"
    }
}


def deep_merge(base: dict, override: dict) -> dict:
    merged = dict(base)
    for k, v in override.items():
        if k in merged and isinstance(merged[k], dict) and isinstance(v, dict):
            merged[k] = deep_merge(merged[k], v)
        else:
            merged[k] = v
    return merged


class CopyManager:
    def __init__(self, file_path: Path = COPY_FILE):
        self.file_path = file_path

    def load_copy(self) -> Dict[str, Any]:
        if not self.file_path.exists():
            return DEFAULT_COPY
        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return deep_merge(DEFAULT_COPY, data)
                return DEFAULT_COPY
        except Exception:
            return DEFAULT_COPY
    def get_message(self, key: str, **kwargs) -> str:
        copy_data = self.load_copy()
        templates = copy_data.get("engine_messages", DEFAULT_COPY["engine_messages"])
        tmpl = templates.get(key, DEFAULT_COPY["engine_messages"].get(key, ""))
        try:
            return tmpl.format(**kwargs)
        except Exception:
            return tmpl


copy_manager = CopyManager()
