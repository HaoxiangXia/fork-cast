# 吃什么 (Fork-Cast) 开发与本地预览指南

本文档介绍如何在本地启动、开发和预览 Fork-Cast 项目，包括前后端架构特性、热重载调试以及 Jev 与 D1 决策模型的开发联调。

---

## 1. 架构概览与前端设计

Fork-Cast 采用了**前后端一体化的极简无打包设计**：

- **前端架构**：
  - 前端位于 `src/fork_cast/static/index.html`，为纯原生单文件（HTML5 + 原生 CSS 变量 + Vanilla JS）。
  - **不需要安装 Node.js、npm、Vite 或 Webpack**，没有任何前端打包构建步骤。
  - FastAPI 在应用根路由 `/` 通过 `FileResponse` 直接托管该静态文件。
- **后端架构**：
  - 基于 Python 3.12+、FastAPI 与 `typesafe-sdk`。
  - 支持 **TypeSafe Jev** 与 **Liquid AI D1** 双决策模型并发原子判定与离线 Mock 兜底。

---

## 2. 快速启动与开发预览

### 2.1 依赖安装

项目基于现代化 Python 包管理工具 `uv`：

```bash
# 同步并安装项目及其开发依赖
uv sync
```

### 2.2 启动开发服务器（支持热重载）

使用以下任一命令启动后端服务：

```bash
# 推荐：开启 Uvicorn 自动重载模式（代码修改自动重启）
uv run uvicorn fork_cast.app:app --reload --port 8000

# 或显式指定源码目录：
uv run uvicorn --app-dir src fork_cast.app:app --reload --port 8000
```
或者通过环境变量开启重载并运行入口脚本：

```bash
RELOAD=true uv run python -m fork_cast.main
```

或者直接运行控制台可执行入口：

```bash
uv run fork-cast
```

### 2.3 访问与预览前端

服务启动后，在浏览器直接访问：

```text
http://127.0.0.1:8000
```

---

## 3. 前端修改与即时热重载工作流

由于前端是单文件 HTML，且由 FastAPI 动态提供：

1. **实时修改**：直接编辑 `src/fork_cast/static/index.html`。
2. **立即生效**：修改保存后，**在浏览器中按 `F5` 或 `Ctrl+R`（Mac 为 `Cmd+R`）刷新页面**，即可立刻看到最新界面与脚本效果。
3. **无需重启后端**：修改前端 HTML 文件无需重新运行 Python 命令。
4. **后端改动重载**：若修改了 `src/fork_cast/*.py` 后端代码，`--reload` 机制会自动检测文件变化并平滑重载进程。

---

## 4. 决策模型开发与联调 (Jev & D1)

本项目支持离线模拟与真实云端模型裁决两种开发模式。

### 4.1 离线 Mock 模拟模式（免配置 Key）

- 默认情况下，若不配置任何 API Key，系统会自动切入内置的仿真决策引擎。
- 能够完整跑通：
  - 诉求解析与匹配
  - 势均力敌对决 (`dilemma_duel`)
  - 极端矛盾驳回 (`impasse`，如“0卡0油炸鸡”)
  - 冷淡随意引导 (`indifference`，如“随便都行”)
  - 隐式历史入库与撤销链路

### 4.2 配置服务端密钥 (.env)

若需在本地联调真实模型服务，复制环境配置文件：

```bash
cp .env.example .env
```

在 `.env` 中按需填写算力密钥：

```dotenv
# 1. 接入 TypeSafe Jev 模型
TYPESAFE_API_KEY=your_typesafe_key
TYPESAFE_BASE_URL=https://api.typesafe.ai
JEV_MODEL=jev-latest

# 2. 接入 Liquid AI D1 模型
LIQUID_API_KEY=your_liquid_key
LIQUID_BASE_URL=https://api.liquid.ai/decisions
D1_MODEL=d1:free

# 3. 指定默认决策模型（可选：jev-latest 或 d1:free）
DEFAULT_MODEL=d1:free
```

### 4.3 浏览器端 BYOK（自备密钥）模式

在前端页面点击右上角 **「设置」**（机箱侧板）：
1. 在 **决策模型架构** 中一键切换 **Jev (TypeSafe)** 或 **D1 (Liquid AI)**。
2. 填入对应的 API Key（保存在用户浏览器 LocalStorage 中，每次决策以请求入参传递，不落盘服务器）。
3. 展开高级网关设置可自由切换官方直连或反向代理网关。

---

## 5. 接口调试与自动化测试

### 5.1 cURL 接口直接调用

#### 调用 Liquid AI D1 决策模型：
```bash
curl -X POST http://127.0.0.1:8000/api/decide \
  -H "Content-Type: application/json" \
  -d '{
    "craving": "下雨天想喝热腾腾的暖胃汤",
    "candidates": ["瓦罐汤", "牛肉拉面", "麦当劳"],
    "model": "d1:free",
    "api_key": "your_liquid_api_key"
  }'
```

#### 调用 TypeSafe Jev 决策模型：
```bash
curl -X POST http://127.0.0.1:8000/api/decide \
  -H "Content-Type: application/json" \
  -d '{
    "craving": "很累，想吃高热量汉堡炸鸡",
    "candidates": ["麦当劳", "轻食沙拉", "关东煮"],
    "model": "jev-latest",
    "api_key": "your_typesafe_api_key"
  }'
```

### 5.2 运行自动化测试

执行 pytest 自动化回归测试（包括模型网关规范化、D1 模拟裁决与端到端 API 测试）：

```bash
uv run pytest
```
