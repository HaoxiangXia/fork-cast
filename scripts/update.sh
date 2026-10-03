#!/usr/bin/env bash
# ==============================================================================
# Fork-Cast (吃什么) 服务端自动更新脚本
# 功能：
#   1. 从 GitHub 仓库 main 分支拉取最新的 data/copy.json（带 JSON 格式校验与原子替换）
#   2. 拉取由 GitHub Action 自动构建的最新 Docker 镜像 (ghcr.io/haoxiangxia/fork-cast:latest)
#   3. 重建并平滑启动容器 (docker compose up -d)
#   4. 轮询健康检查接口 (/api/health) 确保更新成功
# ==============================================================================

set -euo pipefail

APP_DIR="/srv/fork-cast"
COPY_URL="https://raw.githubusercontent.com/HaoxiangXia/fork-cast/main/data/copy.json"
HEALTH_URL="http://127.0.0.1:8000/api/health"

# ANSI 颜色定义
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
BLUE="\033[0;34m"
NC="\033[0m"

log_info() { echo -e "${BLUE}[INFO]${NC} [$(date '+%Y-%m-%d %H:%M:%S')] $1"; }
log_succ() { echo -e "${GREEN}[OK]${NC}   [$(date '+%Y-%m-%d %H:%M:%S')] $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} [$(date '+%Y-%m-%d %H:%M:%S')] $1"; }
log_err()  { echo -e "${RED}[ERR]${NC}  [$(date '+%Y-%m-%d %H:%M:%S')] $1"; }

cd "${APP_DIR}"

log_info "========== 开始执行 Fork-Cast 服务自动更新 =========="

# ------------------------------------------------------------------------------
# 步骤 1: 拉取最新 copy.json 并做原子性校验替换
# ------------------------------------------------------------------------------
log_info "1/4 正在从 GitHub main 分支拉取最新 copy.json..."
mkdir -p "${APP_DIR}/data"

TMP_COPY="${APP_DIR}/data/copy.json.tmp"
if curl -fsSL "${COPY_URL}" -o "${TMP_COPY}"; then
  # 校验 JSON 格式是否有效
  if jq empty "${TMP_COPY}" 2>/dev/null; then
    mv -f "${TMP_COPY}" "${APP_DIR}/data/copy.json"
    log_succ "最新 copy.json 已安全同步并替换成功。"
  else
    log_warn "拉取的 copy.json 格式异常，已终止覆盖，保持使用宿主机现有配置。"
    rm -f "${TMP_COPY}"
  fi
else
  log_warn "从 GitHub 获取 copy.json 失败（可能受限于网络或频率），保持使用本地现有配置。"
  rm -f "${TMP_COPY}"
fi

# ------------------------------------------------------------------------------
# 步骤 2: 拉取 GitHub Action 构建的最新 Docker 镜像
# ------------------------------------------------------------------------------
log_info "2/4 正在拉取最新的 Docker 容器镜像..."
if docker compose pull; then
  log_succ "最新容器镜像拉取完成。"
else
  log_err "Docker 镜像拉取失败，请检查网络或 GHCR 访问权限。"
  exit 1
fi

# ------------------------------------------------------------------------------
# 步骤 3: 平滑重建并启动服务容器
# ------------------------------------------------------------------------------
log_info "3/4 正在平滑更新并重启服务容器..."
docker compose up -d --remove-orphans
log_succ "容器服务重建完成。"

# ------------------------------------------------------------------------------
# 步骤 4: 轮询健康检查接口验证服务状态
# ------------------------------------------------------------------------------
log_info "4/4 正在进行服务健康探针检查 (${HEALTH_URL})..."

MAX_RETRIES=15
RETRY_INTERVAL=1
SUCCESS=0

for ((i=1; i<=MAX_RETRIES; i++)); do
  HEALTH_RESP=$(curl -s -f --connect-timeout 2 "${HEALTH_URL}" 2>/dev/null || true)
  if [[ -n "${HEALTH_RESP}" ]] && echo "${HEALTH_RESP}" | jq -e '.status == "ok"' >/dev/null 2>&1; then
    log_succ "健康检查通过！服务已就绪并正常提供服务。"
    echo -e "${GREEN}>>> 线上服务状态:${NC} ${HEALTH_RESP}"
    SUCCESS=1
    break
  fi
  echo -ne "${YELLOW}>>> 等待容器启动就绪... (${i}/${MAX_RETRIES})${NC}\r"
  sleep "${RETRY_INTERVAL}"
done

echo ""

if [[ ${SUCCESS} -eq 1 ]]; then
  log_succ "========== Fork-Cast 服务更新全部圆满完成 =========="
  exit 0
else
  log_err "健康检查超时（15秒内未能探测到 status=ok）。"
  log_err ">>> 最近容器日志如下:"
  docker compose logs --tail=30
  exit 1
fi
