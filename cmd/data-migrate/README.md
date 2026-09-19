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

## 当前已实现的迁移内容

> 这里列出的是当前工具已经实现并会实际执行的内容，不代表新旧源码之间的全部差异。其余同名同义表会随数据库恢复保留，但尚未全部建立专门的语义迁移规则。

- 补齐旧用户邀请关系；
- 根据邀请关系、奖励和佣金明细重建新版持久化统计字段；
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
