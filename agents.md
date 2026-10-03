# Agent Interaction & Engineering Rules

## 1. 交互与交流原则
- **默认语言**：默认使用中文与用户交流，除非用户明确输入了使用其他语言对话。
- **工程师品味**：事实、结论与决策先行；拒绝任何空洞套话、客套寒暄与过度包装；给出最直接、可落地的技术方案。

---

## 2. 产品与前端设计规范
- **产品命名**：中文正式命名为 **“吃什么”**，英文工程标识为 `fork-cast`。
- **移动端第一（Mobile-first）**：
  - 核心场景为手机端竖屏（375px~430px）快速操作，所有排版、间距、弹窗均以手机单手触控为第一基准。
  - 触控热区（Buttons/Chips）高度与防误触间距不低于 48px。
  - 输入框字号维持 16px，严禁引起 iOS Safari 唤起软键盘时的自动放大与页面抖动。
- **彻底去 AI 模板病（Anti-AI Slop）**：
  - 坚持复古近代大众食堂/餐券机的物理实体质感（Celadon Tile `#D1DCD6` + 铸铁边框 `#1E2721` + 拍板朱印 `#D73318`）。
  - 严禁加入背景氛围渐变斑点（Tell 06）、毛玻璃模糊（Tell 19）、空洞的大写副标（Tell 10）、装饰性 Emoji 堆砌（Tell 15）及泛滥的等宽字体（Tell 34）。
- **文案外部集中管理**：
  - 所有 UI 文本、按钮标签、提示语及决策输出模板统一在 `data/copy.json` 中配置，禁止在 Python 或 HTML/JS 代码中硬编码展示性文案。
  - 代码中必须保留深层合并（Deep Merge）兜底，确保即便用户在编辑 JSON 时漏掉键名，系统也绝不崩溃（由 `copy_manager.py` 实现）。
  - **文案各节点职责划分（Section Responsibilities）**：
    - `brand`：品牌与全局元信息，包含主标题（`name`）、副标题（`subtitle`）与页脚版权声明（`footer`）。
    - `nav`：顶部导航栏快捷入口按钮文本（`blind_box`, `settings`）。
    - `input`：诉求投币口区域文案，包含输入框标签（`label`）、占位符（`placeholder`）、灵感垫片快捷标签列表（`quick_label`, `quick_tags`）、拍板按钮（`slap_button`）、多内核裁决等待文案（`slap_loading_jev`, `slap_loading_d1`）、出票导槽标识（`dispenser_slot`）与临时排除名单前缀（`exclusion_prefix`）。
    - `ticket`：餐券票据核心要素：
      - `header_brand`：餐券抬头专属品牌；
      - `stamps`：物理印章印记，包含拍板落定（`decisive`）、倾向建议（`soft`）、神仙难救（`impasse`）、盲盒邀约（`indifference`）及势均力敌（`duel`）；
      - `labels`：多模型校准置信度标签（`confidence_jev`, `confidence_d1`）、候选分布前缀（`distribution`）与备选前缀（`alternatives_prefix`）；
      - `actions`：票据底部操作按钮文案（`eat`, `revoke`, `refocus`, `draw_blind_box`, `accept_duel`, `view_duel`）。
    - `engine_messages`：后端决策引擎输出文案模板（采用 Python `str.format` 插值语法，支持 `{primary}`, `{alternative}`, `{contenders}`, `{winner}`, `{lone}` 等变量），覆盖 `impasse`, `indifference`, `decisive`, `duel`, `soft`, `lone`, `empty`。
    - `modals`：独立模态弹窗系统规范：
      - `welcome`：首次访问欢迎弹窗，说明产品理念、核心亮点（公共免费算力、BYOK 算力、个性化候选池）及跳转入口；
      - `settings`：机箱侧板配置弹窗，包含算力凭据（`group_credentials`）、防腻回溯窗口（`group_history_window`）、候选池与就餐历史分组及就绪按钮；
      - `pool`：个人常吃清单弹窗，包含说明、添加输入框占位符及恢复默认菜单按钮；
      - `blind_box`：盲盒摇号抽签弹窗，强调随性之选、随时重抽与不计入历史原则；
      - `duel`：双雄终局对决弹窗，包含毫厘决胜标语、终局胜出印章及不可复掷决斗启动与接受按钮。
    - `toasts`：前端即时轻量交互反馈通知消息（涵盖选定、撤销、恢复、增删、输入校验、网络故障、额度耗尽提示 `quota_exhausted`、防腻窗口变更 `history_hours_set`、模型切换 `model_switched` 等）。
  - **文案标准契约定义（Canonical Reference Contract）**：
    以下为 `data/copy.json` 的完整基准配置结构，作为后续 Agent 开发与配置维护的强制契约：
```json
{
  "brand": {
    "name": "吃什么",
    "subtitle": "解决每日人生难题：今天吃什么？",
    "footer": "吃什么 · 随性就餐决策 · SYSTEM 1 MODEL"
  },
  "nav": {
    "blind_box": "盲盒",
    "settings": "设置"
  },
  "input": {
    "label": "诉求投币口",
    "placeholder": "“胃口平淡想喝碗清汤”、“刚健身完需要高蛋白低脂”、“下雨天想吃点重口味辣的”...",
    "quick_label": "灵感垫片:",
    "quick_tags": [
      { "label": "热汤碳水", "text": "今天好累，想吃热汤碳水炸弹" },
      { "label": "清淡易消化", "text": "胃有点不适，吃点清淡好消化的，拒绝油炸和辣" },
      { "label": "来顿好的犒劳", "text": "辛苦了来顿好的硬菜犒劳自己，预算充足有肉就行" },
      { "label": "随便都行", "text": "随便来个，吃啥都行无所谓" }
    ],
    "slap_button": "拍 板 决 策",
    "slap_loading_jev": "正在调动 JEV 裁决...",
    "slap_loading_d1": "正在调动 D1 裁决...",
    "dispenser_slot": "▼ 出票导槽 ▼",
    "exclusion_prefix": "临时排除:"
  },
  "ticket": {
    "header_brand": "吃什么 · 专属餐券",
    "stamps": {
      "decisive": "拍板落定",
      "soft": "倾向建议",
      "impasse": "神仙难救",
      "indifference": "盲盒邀约",
      "duel": "势均力敌"
    },
    "labels": {
      "confidence_jev": "JEV 校准置信度",
      "confidence_d1": "D1 校准置信度",
      "distribution": "候选分布:",
      "alternatives_prefix": "备选:"
    },
    "actions": {
      "eat": "去吃！",
      "revoke": "撤销并排除",
      "refocus": "重新整理需求",
      "draw_blind_box": "直接抽个盲盒",
      "accept_duel": "接受对决，去吃！",
      "view_duel": "查看对决轮盘"
    }
  },
  "engine_messages": {
    "impasse": "你的要求神仙也做不到，现实中无此类菜品，先喝杯温水重新整理思路吧。",
    "indifference": "检测到你今天毫无特定偏好，建议启动均等分布盲盒摇号！",
    "decisive": "不用纠结了，今天就是【{primary}】！",
    "duel": "双雄难分伯仲，终局落定【{winner}】！天意单次裁决，拒绝反复掷骰，去吃吧！",
    "soft": "为你推荐【{primary}】，如果今天不顺路也可以选【{alternative}】。",
    "lone": "候选池中仅剩唯一选择，不用纠结了，今天就是【{lone}】！",
    "empty": "没有可用的候选就餐选项（所有候选均已被排除或候选池为空）。"
  },
  "modals": {
    "welcome": {
      "title": "欢迎使用 · 吃什么",
      "subtitle": "零标签随性决策",
      "desc": "基于 System 1 概率决策模型，直接输入大白话快速拍板吃什么。",
      "points": {
        "quota_title": "每天 10 次公共免费算力",
        "quota_desc": "系统默认提供每日 10 次免费决策额度（北京时间每日零点自动刷新）。",
        "byok_title": "支持自备个人 Key（无限制）",
        "byok_desc": "可在设置中填入你的 TypeSafe 或 Liquid API Key，直连私有算力，无限制极速调用。",
        "pool_title": "个性化常吃候选池",
        "pool_desc": "在设置中增删你平时常吃的菜品或店名，模型会自动常识推导，越用越顺手。"
      },
      "btn_dismiss": "知道了，开始拍板",
      "btn_settings": "先配置常吃清单与 Key"
    },
    "settings": {
      "title": "个人设置与菜单",
      "group_credentials": "决策内核与算力凭据",
      "group_credentials_desc": "支持 Jev 与 D1 决策模型。系统默认提供每日 10 次公共免费算力；填入个人 Key 无限制极速调用。",
      "group_history_window": "防腻回溯窗口",
      "group_history_window_desc": "此时间段内吃过的菜品会被自动降权防腻，避免连续几天重复吃同一样。",
      "group_pool": "个人候选池 (常吃清单)",
      "group_history": "本机就餐历史",
      "btn_save": "完成并就绪"
    },
    "pool": {
      "title": "个人候选池 (常吃清单)",
      "desc": "维护平时常吃常买的菜品清单。Jev / D1 大模型常识会自动解析属性，无需给菜品打标签。",
      "placeholder": "新增菜品 / 餐馆名",
      "btn_add": "添加",
      "btn_reset": "恢复默认 8 款推荐菜单"
    },
    "blind_box": {
      "title": "LUCKY DRAW · 盲盒神签",
      "tag": "不计入历史",
      "desc": "从当前有效常吃候选池中均等随机摇号，彻底打消选择疲劳。",
      "drum_idle": "点击摇号",
      "settle_badge": "天 意 已 决 · 绝 不 反 悔",
      "hint": "随性之选 · 随时可重新抽签",
      "btn_roll": "抽取盲盒",
      "btn_accept": "去吃这道菜！",
      "btn_close": "收起关闭"
    },
    "duel": {
      "title": "DILEMMA DUEL · 双雄终局对决",
      "tagline": "势均力敌 · 毫厘决胜 · 单次终局绝不复掷",
      "winner_stamp": "终 局 胜 出",
      "btn_spin": "启动双雄决战轮盘",
      "btn_accept": "遵从决斗结果，去吃！"
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
    "revoke_failed": "撤销失败",
    "quota_exhausted": "今日 10 次免费额度已用尽（北京时间次日重置）。请在设置中配置个人 API Key 继续使用！",
    "history_hours_set": "已将防腻回溯窗口设为 {hours} 小时",
    "model_switched": "已切换至 {model} 决策内核"
  }
}
```

---

## 3. 核心决策模型与业务逻辑
- **决策底座：System 1 概率决策模型（TypeSafe Jev & Liquid AI D1）**：
  - 架构上抽象为统一协议的 System 1 非生成式概率决策内核（非传统文本生成 LLM），支持 **TypeSafe Jev**（`jev-latest`）与 **Liquid AI D1**（`d1:free`）双模型。
  - 通过 `typesafe-sdk` 统一底层传输通道（支持 Base URL 与 API Key 动态解析规范化），前端可随时无缝切换决策模型。
  - 单次单请求并发评估三个原子原语（Parallel Primitives）：
    1. `candidate_choice` (`Choice`): 候选池单选，输出置信度（confidence）与全量概率分布（probabilities）；
    2. `is_achievable` (`Noul`): 诉求是否现实可行，低于 0.20 判定为 `Impasse`（驳回吐槽，不入历史）；
    3. `is_indifferent` (`Noul`): 用户是否完全无所谓/不挑，高于 0.80 判定为 `Indifference`（引导抽盲盒，不入历史）。
- **防腻降权窗口（Suppression Window）**：
  - **用户自定义时域**：用户可在设置中自由配置防腻回溯窗口时限（默认 48 小时，支持前端与请求级动态设定小时数），后端将时域内的就餐记录动态组装为 `State Context` 注入评估状态。
  - **累加疲劳惩罚（Cumulative Fatigue Penalties）**：在防腻窗口期内，同一候选选项被选中的频次越高，施加的累加衰减降权（compounded suppression penalty）越严苛；仅单次出现的候选执行常规避让，模型自适应倾斜推荐窗口期内未曾食用的品类。
  - **全池饱和软着陆（Graceful Degradation）**：当候选池全部选项在当前防腻窗口中均存在就餐记录（全池饱和）时，防腻机制执行柔性平滑衰减，**绝不因历史饱和触发 Impasse 误拒**，保障在任意饱和度下系统依然能稳定产出相对最优推荐。
- **公共免费算力与 BYOK 隔离（Free Quota & BYOK Isolation · Option C）**：
  - **每日免费配额（Option C）**：服务端针对未配置个人 Key 的请求提供每日 **10 次公共免费算力**（`Free Quota`）。该配额为跨模型统一池（跨 Jev 与 D1 共享），防止通过切换模型规避限流。
  - **双因子绑定与重置机制**：配额严格绑定至 **客户端公网 IP + 客户端设备 UUID（`device_id`）** 联合标识，按**北京时间（UTC+8）每日零点（00:00）**自动重置。`device_id` 严格保持物理浏览器实例单机本地化（Node-Local），禁止纳入配置备份导出与跨机导入，彻底封死多设备池化滥用。
  - **BYOK 豁免与无限制通道**：用户在设置中填入自备的个人 API Key（TypeSafe 或 Liquid AI Key）即激活 BYOK 模式。BYOK 请求全量直连私有算力，无条件绕过公共免费额度扣减，享有无限制极速调用。
  - **BYOK 严格故障隔离（Strict Failure Isolation）**：用户自备 Key 鉴权失败、额度用尽或触发上游限流时，系统必须立即报错熔断（Fail Fast），**严禁静默回退降级为消耗公共服务器免费配额**，确保公共算力开销安全与凭据故障责任完全透明隔离。
- **博弈与门控状态机**：
  - **Decisive Pick（拍板落定）**：Top-1 优势悬殊（confidence >= 0.70 & Margin >= 0.20），直接出票并隐式记入用餐历史；
  - **Dilemma Duel（终局对决）**：前 2~3 名概率咬紧（Margin < 0.12），启动 Canvas 轮盘对决，**单次终态，严禁复摇**，胜出者自动记入历史；
  - **Soft Pick（倾向建议）**：中间态，主推胜出者 + 推荐备选；
  - **Blind Box（盲盒摇骰）**：全池均匀随机，**永远不记入用餐历史，支持随时重抽**。
- **撤销闭环（Revocation）**：
  - 用户点击撤销，后端立即从 `History` 仅弹出刚才写入的最后一条记录（保留窗口内更早的历史记录）；
  - 界面退回并保留原输入文本，同时将该菜品加入临时 `Session Exclusion`（临时排除名单），不再参与当轮决策。

---

## 4. 服务器运维与部署红线（Critical Guardrails）
- **服务器属性**：云端主机（`admin@43.129.242.112`）为**非私有多业务共享服务器**。
- **绝对隔离红线**：
  - **严禁对宿主机上正在运行的任何既有服务（尤其是 `radio-association` 容器与 `wuxie.luciangray.net` 站点）产生任何影响、网络冲突或端口侵占**。
- **文件系统规范（Linux FHS）**：
  - 严禁在家目录（`$HOME`）散落配置文件或构建容器。
  - 项目全局常驻于标准服务目录 **`/srv/fork-cast/`**（属主 `admin:admin`），与现有的 `/srv/astrbot/` 平级规范管理。
- **端口与网络边界**：
  - `fork-cast` 独占且仅监听 `127.0.0.1:8000`，与 `radio-association`（5000 端口）保持绝对物理端口隔离。
- **域名与反向代理（Caddy）**：
  - 绑定的独立子域名为 **`eat.march7th.codes`**（A 记录已解析至该服务器 IP）。
  - 反代配置仅允许在 `/etc/caddy/Caddyfile` 最末尾追加独立域名块，严禁修改或重写上方已有的 `wuxie.luciangray.net` 配置块。
  - 生效配置仅允许使用 `sudo systemctl reload caddy`（内存热重载），严禁重启（restart）或停止（stop）Caddy 服务。
