#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'EOF'
用法：
  migrate.sh --dump /path/to/new-api-legacy.sql [选项]

说明：
  在新服务器的 Docker Compose 项目上执行完整迁移：
  备份当前数据库 -> 恢复旧库 -> 启动应用准备新版 schema ->
  停止应用 -> check -> dry-run -> apply -> verify -> 启动应用。

选项：
  --dump PATH           旧数据库的 pg_dump SQL 文件，必填
  --compose-dir PATH    docker-compose.yml 所在目录，默认当前目录
  --compose-file NAME   Compose 文件名，默认 docker-compose.yml
  --db-service NAME     PostgreSQL service 名称，默认 postgres
  --app-service NAME    应用 service 名称，默认 new-api
  --db-user NAME        PostgreSQL 用户，默认 root
  --db-name NAME        PostgreSQL 数据库，默认 new-api
  --yes                 跳过所有确认；仍然会先备份当前数据库
  -h, --help            显示帮助

注意：
  该脚本会删除并重新创建目标数据库。请确认 --dump 是正确的旧库备份。
  脚本不复制 PostgreSQL 原始存储卷，也不负责从旧服务器传输备份文件。
EOF
}

die() {
  echo "[ERROR] $*" >&2
  exit 1
}

log() {
  echo "[INFO] $*"
}

compose_dir="$(pwd)"
compose_file="docker-compose.yml"
db_service="postgres"
app_service="new-api"
db_user="root"
db_name="new-api"
legacy_dump=""
assume_yes=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dump)
      [[ $# -ge 2 ]] || die "--dump 缺少参数"
      legacy_dump="$2"
      shift 2
      ;;
    --compose-dir)
      [[ $# -ge 2 ]] || die "--compose-dir 缺少参数"
      compose_dir="$2"
      shift 2
      ;;
    --compose-file)
      [[ $# -ge 2 ]] || die "--compose-file 缺少参数"
      compose_file="$2"
      shift 2
      ;;
    --db-service)
      [[ $# -ge 2 ]] || die "--db-service 缺少参数"
      db_service="$2"
      shift 2
      ;;
    --app-service)
      [[ $# -ge 2 ]] || die "--app-service 缺少参数"
      app_service="$2"
      shift 2
      ;;
    --db-user)
      [[ $# -ge 2 ]] || die "--db-user 缺少参数"
      db_user="$2"
      shift 2
      ;;
    --db-name)
      [[ $# -ge 2 ]] || die "--db-name 缺少参数"
      db_name="$2"
      shift 2
      ;;
    --yes)
      assume_yes=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      die "未知参数：$1"
      ;;
  esac
done

[[ -n "$legacy_dump" ]] || {
  usage >&2
  die "必须指定 --dump"
}

command -v docker >/dev/null 2>&1 || die "未找到 docker"

compose_dir="$(cd "$compose_dir" 2>/dev/null && pwd)" || die "Compose 目录不存在"
compose_path="$compose_dir/$compose_file"
[[ -f "$compose_path" ]] || die "找不到 Compose 文件：$compose_path"

if [[ "$legacy_dump" != /* ]]; then
  legacy_dump="$compose_dir/$legacy_dump"
fi
[[ -s "$legacy_dump" ]] || die "备份文件不存在或为空：$legacy_dump"
[[ "$db_name" =~ ^[A-Za-z0-9_-]+$ ]] || die "数据库名称包含不支持的字符：$db_name"

cd "$compose_dir"
compose=(docker compose -f "$compose_file")
services="$("${compose[@]}" config --services)"
grep -Fxq "$db_service" <<<"$services" || die "Compose 中不存在数据库 service：$db_service"
grep -Fxq "$app_service" <<<"$services" || die "Compose 中不存在应用 service：$app_service"

report_dir="$compose_dir/data/data-migrate-reports"
mkdir -p "$report_dir"
timestamp="$(date +%Y%m%d-%H%M%S)"

confirm() {
  local message="$1"
  if "$assume_yes"; then
    return
  fi
  [[ -t 0 ]] || die "非交互执行必须指定 --yes"
  read -r -p "$message [y/N] " answer
  [[ "$answer" == "y" || "$answer" == "Y" ]] || die "用户取消"
}

wait_for_postgres() {
  local attempt
  for attempt in $(seq 1 60); do
    if "${compose[@]}" exec -T "$db_service" pg_isready -U "$db_user" -d postgres >/dev/null 2>&1; then
      return
    fi
    sleep 2
  done
  die "PostgreSQL 未在限定时间内就绪"
}

wait_for_app() {
  local attempt container_id status health recent_logs
  for attempt in $(seq 1 90); do
    container_id="$("${compose[@]}" ps -q "${app_service}" | tr -d '\r')"
    if [[ -n "$container_id" ]]; then
      status="$(docker inspect --format '{{.State.Status}}' "$container_id")"
      health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id")"
      if [[ "$status" == "exited" || "$status" == "dead" ]]; then
        "${compose[@]}" logs --no-color --tail=80 "$app_service" >&2 || true
        die "应用容器启动失败"
      fi
      if [[ "$health" == "healthy" ]]; then
        return
      fi
      if [[ "$health" == "none" && "$status" == "running" ]]; then
        recent_logs="$("${compose[@]}" logs --no-color --tail=30 "$app_service" 2>/dev/null || true)"
        if grep -Eq 'New API.*started|SV API.*ready' <<<"$recent_logs"; then
          return
        fi
      fi
    fi
    sleep 2
  done
  "${compose[@]}" logs --no-color --tail=80 "$app_service" >&2 || true
  die "应用未在限定时间内就绪"
}

run_migration_mode() {
  local mode="$1"
  local output_file="$report_dir/${timestamp}-${mode}.log"
  local container_report="/data/data-migrate-reports/${timestamp}-${mode}.txt"

  log "运行 data-migrate --mode=$mode"
  if ! "${compose[@]}" run --rm --no-deps \
    --entrypoint /data-migrate \
    "$app_service" \
    "--mode=$mode" \
    "--report=$container_report" 2>&1 | tee "$output_file"; then
    die "data-migrate --mode=$mode 执行失败，详见：$output_file"
  fi
}

confirm "即将覆盖数据库 $db_name，是否继续？"

log "停止应用，避免迁移期间写入数据"
"${compose[@]}" stop "$app_service" >/dev/null

log "确保 PostgreSQL 正在运行"
"${compose[@]}" up -d "$db_service" >/dev/null
wait_for_postgres

current_backup="$report_dir/${timestamp}-before-restore.sql"
current_backup_error="$report_dir/${timestamp}-before-restore.error.log"
log "备份当前数据库：$current_backup"
if ! "${compose[@]}" exec -T "$db_service" pg_dump -U "$db_user" -d "$db_name" \
  >"$current_backup" 2>"$current_backup_error"; then
  die "当前数据库备份失败，详见：$current_backup_error"
fi
[[ -s "$current_backup" ]] || die "当前数据库备份为空：$current_backup"

log "删除并重新创建目标数据库"
"${compose[@]}" exec -T "$db_service" psql -v ON_ERROR_STOP=1 -U "$db_user" -d postgres \
  -c "DROP DATABASE \"$db_name\" WITH (FORCE);"
"${compose[@]}" exec -T "$db_service" psql -v ON_ERROR_STOP=1 -U "$db_user" -d postgres \
  -c "CREATE DATABASE \"$db_name\";"

restore_log="$report_dir/${timestamp}-restore.log"
log "恢复旧数据库：$legacy_dump"
if ! "${compose[@]}" exec -T "$db_service" psql -v ON_ERROR_STOP=1 -U "$db_user" -d "$db_name" \
  <"$legacy_dump" >"$restore_log" 2>&1; then
  die "旧数据库恢复失败，详见：$restore_log"
fi

log "启动应用一次，让新版代码准备 schema"
"${compose[@]}" up -d --force-recreate "$app_service" >/dev/null
wait_for_app

log "停止应用，开始执行数据迁移"
"${compose[@]}" stop "$app_service" >/dev/null

run_migration_mode check
run_migration_mode dry-run

confirm "dry-run 已完成，是否执行正式迁移？"
run_migration_mode apply
run_migration_mode verify

log "启动最终应用容器"
"${compose[@]}" up -d --force-recreate "$app_service" >/dev/null
wait_for_app

log "迁移完成"
log "当前数据库备份：$current_backup"
log "迁移报告目录：$report_dir"
"${compose[@]}" ps