# Agent Interaction & Engineering Rules

## 1. 交互与交流原则
- **默认语言**：默认使用中文与用户交流，除非用户明确输入了使用其他语言对话。
- **工程师品味**：事实、结论与决策先行；拒绝任何空洞套话、客套寒暄与过度包装；给出最直接、可落地的技术方案。

---

## 2. 产品与前端设计规范
- **产品命名**：中文正式命名为 **“吃了吗”**，英文工程标识为 `fork-cast`。
- **移动端第一（Mobile-first）**：
  - 核心场景为手机端竖屏（375px~430px）快速操作，所有排版、间距、弹窗均以手机单手触控为第一基准。
  - 触控热区（Buttons/Chips）高度与防误触间距不低于 48px。
  - 输入框字号维持 16px，严禁引起 iOS Safari 唤起软键盘时的自动放大与页面抖动。
- **彻底去 AI 模板病（Anti-AI Slop）**：
  - 坚持复古近代大众食堂/餐券机的物理实体质感（Celadon Tile `#D1DCD6` + 铸铁边框 `#1E2721` + 拍板朱印 `#D73318`）。
  - 严禁加入背景氛围渐变斑点（Tell 06）、毛玻璃模糊（Tell 19）、空洞的大写副标（Tell 10）、装饰性 Emoji 堆砌（Tell 15）及泛滥的等宽字体（Tell 34）。
- **文案外部集中管理**：
  - 所有 UI 文本、按钮标签、提示语及决策输出模板统一在 `data/copy.json` 中配置，禁止在 Python 或 HTML/JS 代码中硬编码展示性文案。
  - 代码中必须保留深层合并（Deep Merge）兜底，确保即便用户在编辑 JSON 时漏掉键名，系统也绝不崩溃。

---

## 3. 核心决策模型与业务逻辑
- **决策底座**：采用 TypeSafe AI 原厂 Jev System 1 模型（非传统文本生成 LLM），并发评估三个原子原语：
  1. `candidate_choice` (`Choice`): 候选池单选，输出置信度（confidence）与全量概率分布（probabilities）；
  2. `is_achievable` (`Noul`): 诉求是否现实可行，低于 0.20 判定为 `Impasse`（驳回吐槽，不入历史）；
  3. `is_indifferent` (`Noul`): 用户是否完全无所谓/不挑，高于 0.80 判定为 `Indifference`（引导抽盲盒，不入历史）。
- **博弈与门控状态机**：
  - **Decisive Pick（拍板落定）**：Top-1 优势悬殊（confidence >= 0.70 & Margin >= 0.20），直接出票并隐式记入用餐历史；
  - **Dilemma Duel（终局对决）**：前 2~3 名概率咬紧（Margin < 0.12），启动 Canvas 轮盘对决，**单次终态，严禁复摇**，胜出者自动记入历史；
  - **Soft Pick（倾向建议）**：中间态，主推胜出者 + 推荐备选；
  - **Blind Box（盲盒摇骰）**：全池均匀随机，**永远不记入用餐历史，支持随时重抽**。
- **撤销闭环（Revocation）**：
  - 用户点击撤销，后端立即从 `History` 弹出刚才写入的记录；
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
