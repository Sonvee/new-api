# data-migrate

这是新旧版本 PostgreSQL 数据兼容迁移工具，不是前端页面，也不会随应用启动自动执行。

## 使用前提

1. 停止 `new-api` 应用容器，避免迁移期间写入数据库。
2. 将旧数据库恢复到新 PostgreSQL 实例。
3. 使用新版本既有 schema migration 准备目标 schema。
4. 完成数据库备份，并确认目标库没有新版本产生的业务数据。

工具只支持当前保存的 `legacy-main -> custom` 版本对，不支持 SQLite、MySQL 或任意历史版本组合。

## 执行方式

在仓库根目录执行：

```bash
go run ./cmd/data-migrate --mode=check --dsn "$DATABASE_URL"
go run ./cmd/data-migrate --mode=dry-run --dsn "$DATABASE_URL" --report data-migrate-dry-run.txt
go run ./cmd/data-migrate --mode=apply --dsn "$DATABASE_URL" --report data-migrate-apply.txt
go run ./cmd/data-migrate --mode=verify --dsn "$DATABASE_URL" --report data-migrate-verify.txt
```

也可以省略 `--dsn`，改用 `SQL_DSN` 环境变量。不要把包含密码的 DSN 写入公开脚本或提交到 Git。

如果数据库已经执行过 `legacy-main-to-custom-20260918`，新版本会识别旧迁移标记，仅补齐 `aff_history` 汇总字段并升级迁移标记，不会再次清理登录状态或重复导入账本。

## 一键迁移脚本

`migrate.sh` 适用于新服务器上的 Docker Compose 部署。它会自动完成：

1. 备份当前目标数据库；
2. 停止应用并重新创建目标数据库；
3. 恢复旧项目的 `pg_dump` SQL 文件；
4. 启动新版应用准备 schema，再停止应用；
5. 依次执行 `check`、`dry-run`、`apply`、`verify`；
6. 使用最终镜像重新启动应用。

旧服务器的 SQL 备份仍需先传输到新服务器。把 `migrate.sh` 上传到新服务器后执行：

```bash
chmod +x migrate.sh
./migrate.sh \
  --compose-dir /www/wwwroot/dk_project/new-api \
  --dump /root/new-api-legacy.sql
```

确认 dry-run 结果后，脚本会询问是否继续正式迁移。无人值守执行时才使用 `--yes`：

```bash
./migrate.sh \
  --compose-dir /www/wwwroot/dk_project/new-api \
  --dump /root/new-api-legacy.sql \
  --yes
```

脚本不会复制 PostgreSQL 原始存储卷，也不会自动从旧服务器传输备份文件；正式执行前必须确认备份文件正确。

## 从头开始迁移：最简步骤

1. 在旧服务器停止旧版应用：

   ```bash
   cd /旧项目目录
   docker compose stop new-api
   ```

2. 在旧服务器导出数据库：

   ```bash
   docker compose exec -T postgres pg_dump -U root -d new-api > /root/new-api-legacy.sql
   ```

3. 把下面两个文件上传到新服务器：

   ```text
   /root/new-api-legacy.sql
   cmd/data-migrate/migrate.sh
   ```

4. 在新服务器执行一键迁移：

   ```bash
   cd /www/wwwroot/dk_project/new-api
   chmod +x migrate.sh
   ./migrate.sh --dump /root/new-api-legacy.sql
   ```

5. 看到 `verify` 全部通过，并且新版应用正常启动后，迁移完成。

不要直接复制或替换 PostgreSQL 的 `/var/lib/docker/volumes/...` 存储卷。

## 当前已实现的迁移内容

> 这里列出的是当前工具已经实现并会实际执行的内容，不代表新旧源码之间的全部差异。其余同名同义表会随数据库恢复保留，但尚未全部建立专门的语义迁移规则。

- 补齐旧用户邀请关系；
- 根据邀请关系、奖励和佣金明细重建新版持久化统计字段，包括 `aff_history` 汇总字段；
- 将旧 `aff_quota` 合并回用户余额；
- 将旧 `quota_ledgers` 导入新版 `wallet_ledgers`，使用幂等键避免重复导入；
- 清理登录会话和一次性认证流程，并提升用户 `auth_version`；
- 在 `options` 表写入迁移版本标记；
- 所有正式数据变更在一个 PostgreSQL 事务中执行，失败时整体回滚。

当前尚未实现专门语义迁移的范围包括：

- `accounting_entries`、`audit_logs`、`external_identity_claims`、`login_encryption_keys`、`task_plugins` 的历史数据回填；这些表目前只做目标库非空检查；
- `manual_income_records`、`manual_expense_records` 到 `accounting_entries` 的转换；
- 其他同名业务表的逐字段语义校验和字段级转换；这些数据依赖旧库恢复和新 schema 保留。

AI 不代替开发者执行测试或生产迁移。正式执行前请先手动完成备份、`check` 和 `dry-run`，确认报告后再执行 `apply`，最后执行 `verify`。
