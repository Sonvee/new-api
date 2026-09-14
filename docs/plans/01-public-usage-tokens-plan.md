# 公共 Token 用量接口开发计划

## 文档元信息

- 状态：已实现，待开发者验证
- 对应 PRD：[`docs/prd/01-public-usage-tokens.md`](../prd/01-public-usage-tokens.md)
- 计划范围确认日期：2026-09-14

## 1. 实现目标

实现免认证的 `GET /api/public/usage/tokens`，按照项目当前统一时区解析必填的 `start_date`、`end_date`，统计主数据库 `quota_data.token_used` 聚合中的全站 Token 总和，并返回 PRD 约定的统一 JSON 响应。

## 2. 总体方案与边界

### 2.1 总体思路

1. 在现有 `/api` 路由组下新增 `/public/usage/tokens` 路由，不挂载 `UserAuth`、`TokenAuth` 或管理员权限中间件。
2. 复用 `/api` 路由组现有的 gzip、请求清理、访问审计和全局 API 限流能力；不新增独立限流和缓存。
3. 控制器负责参数校验、日期转换和统一响应；模型层负责从主数据库 `quota_data` 查询 Token 汇总。
4. 使用日历边界计算：开始时间为当天 `00:00:00`，结束时间使用次日 `00:00:00` 的排他边界，查询条件采用 `created_at >= start` 且 `created_at < endExclusive`，从而完整覆盖结束日期并避免 `23:59:59` 精度问题。

### 2.2 不应触碰的边界

- 不修改用户认证、Token 鉴权或现有 `/api/usage/token` 行为。
- 不改变现有日志统计函数的调用契约；新增公共统计查询应读取 `quota_data`，不得回退到 `logs` 表。
- 不新增数据库表、迁移、定时任务、缓存配置、前端页面或第三方依赖。
- 不返回用户、Token、模型、渠道或原始日志明细。

## 3. 目标文件与职责

### 3.1 `router/api-router.go`

- 在 `SetApiRouter` 的 `/api` 路由组中注册 `GET /public/usage/tokens`。
- 路由必须位于任何需要用户或管理员认证的子路由之外。
- 继续继承 `/api` 路由组已有的 `GlobalAPIRateLimit` 等公共中间件。

### 3.2 `controller/public_usage.go`（新增）

- 定义公共响应数据结构，`total_tokens` 使用 `int64`，保证示例级别及更大统计值不会因 32 位整数截断。
- 校验：
  - `start_date`、`end_date` 均存在；
  - 严格使用 `YYYY-MM-DD` 格式解析；
  - 使用项目当前进程统一时区（`time.Local`）进行自然日解析；
  - `start_date <= end_date`；
  - 日期范围最多 365 个自然日（含首尾）；
  - 任一日期不得晚于项目当前日期；
  - 将日期转换为 Unix 秒级时间戳，结束时间转换为次日零点排他边界。
- 查询失败时记录服务端日志并返回安全的通用错误信息，不直接暴露数据库错误内容。
- 成功时通过 `common.ApiSuccess` 返回 `start_date`、`end_date` 原值及 `total_tokens`；无数据时返回 `total_tokens: 0`。
- 参数错误通过 `common.ApiError` 返回，保持 HTTP 200 和 `success: false` 的现有项目约定。

### 3.3 `model/usedata.go`

- 增加面向公共统计的 `quota_data` Token 汇总查询能力，查询主数据库的 `quota_data` 表：
  - `created_at >= startTimestamp`；
  - `created_at < endTimestampExclusive`；
  - 汇总 `COALESCE(SUM(token_used), 0)`；
  - 结果扫描为 `int64`，返回数据库错误。
- 保持 SQL 使用 GORM 参数绑定，不拼接用户输入；使用现有主数据库抽象，兼容 SQLite、MySQL 和 PostgreSQL。

### 3.4 `model/log.go` 与 `model/usedata.go`

- 消费日志和任务消费记录写入 `quota_data` 的链路始终启用，不再以 `DataExportEnabled` 作为 Token 聚合数据的写入条件。
- `UpdateQuotaData` 始终刷新内存聚合缓存，保证公共统计数据持续落盘；`DataExportEnabled` 不再影响 Token 统计数据的持久化。

## 4. API 契约

### 4.1 成功请求

```text
GET /api/public/usage/tokens?start_date=2026-07-01&end_date=2026-09-13
```

统计范围为项目时区下的 `[2026-07-01 00:00:00, 2026-09-13 23:59:59]`，日期字段原样回显：

```json
{
  "data": {
    "end_date": "2026-09-13",
    "start_date": "2026-07-01",
    "total_tokens": 17952374936
  },
  "message": "",
  "success": true
}
```

JSON 字段顺序不作为契约要求。

### 4.2 失败请求

- 缺少参数、格式错误、日期逆序、超过 365 天或未来日期：调用 `common.ApiError` 返回 `success: false`，使用面向调用方的参数错误消息。
- 主数据库查询失败：记录内部错误，向调用方返回不包含 SQL、连接串或数据库内部信息的通用查询失败消息。
- 所有业务成功/失败响应均保持 HTTP 200。

## 5. 实施步骤

### 步骤 1：保证并读取持久化 Token 聚合

- 修改 `model/log.go` 和 `model/usedata.go`。
- 让消费记录始终进入 `quota_data` 聚合并持久化；新增可返回 `int64` 和 `error` 的 `quota_data.token_used` 汇总函数。
- 完成判定：公共统计不读取 `logs`，空结果为 0，数据库错误可被调用方感知，关闭 `DataExportEnabled` 也不会停止 Token 聚合。

### 步骤 2：实现控制器和参数校验

- 新增 `controller/public_usage.go`。
- 实现日期解析、项目时区自然日边界、365 天限制、未来日期限制和安全错误响应。
- 完成判定：合法请求能生成正确的查询区间；所有约定非法输入均不会触发数据库查询；成功响应字段与 PRD 一致。

### 步骤 3：注册公共路由

- 修改 `router/api-router.go`。
- 注册准确路径，并确认该路由未挂载认证中间件、仍继承 `/api` 的全局限流。
- 完成判定：未携带认证信息的合法请求可路由到控制器，现有认证路由注册和行为不变。

### 步骤 4：增加聚焦回归测试

- 新增一个聚焦测试文件，优先覆盖本功能的可观察契约，避免在 controller、model、router 分散重复测试。
- 覆盖：合法日期范围和结束日包含、空结果为 0、缺参、格式错误、逆序日期、超过 365 天、未来日期、结果使用大于 32 位的 `int64`、不要求认证的路由行为。
- 使用项目现有测试数据库初始化方式；JSON 断言使用 `common.Unmarshal`，测试断言使用 `require`/`assert`。
- 完成判定：测试能稳定区分成功数据、参数失败和数据库查询错误，不依赖 sleep、随机压力或实现私有细节。

## 6. 验证计划

### 6.1 代码级最小验证

- `gofmt` 格式化所有修改的 Go 文件。
- 运行新增聚焦测试及其所在包的测试。
- 运行 `go test ./controller ./model ./router`（若聚焦测试暴露共享初始化或包级回归，再扩大范围）。
- 运行 `go build ./...` 验证根模块编译。

### 6.2 数据库兼容性验证

该变更新增 `quota_data` 汇总查询并调整其持久化链路，必须使用真实实例验证，而非仅依赖 mock 或单一方言：

- SQLite：验证有数据、无数据、边界日期和大数汇总。
- MySQL：使用项目支持范围内的实例验证相同场景。
- PostgreSQL：使用项目支持范围内的实例验证相同场景。
- 记录实际数据库版本、执行命令和结果；本功能不新增 schema，因此不需要迁移幂等性验证，但仍需确认现有 `quota_data.token_used` 字段可承载累计值。

### 6.3 手工 API 验证

在已有开发服务由开发者自行运行后，使用无认证请求验证：

- 合法日期范围返回统一成功结构；
- 结束日期当天的 `quota_data` 聚合数据被计入；
- 无消费日志返回 `total_tokens: 0`；
- 非法日期返回 `success: false` 且 HTTP 200；
- 不携带 `Authorization` 也不会返回认证失败。

本计划阶段不启动、停止或重启服务、数据库或容器。

## 7. 风险与回滚

- 风险：公共接口会增加主数据库 `quota_data` 查询压力；已通过 365 天上限和现有全局限流控制，不添加未经确认的缓存。
- 风险：历史上 `DataExportEnabled` 关闭期间可能没有 `quota_data` 聚合记录，无法从现有数据恢复；实现后新产生的消费数据将持续聚合。
- 风险：项目日志时间戳为 Unix 秒，使用次日零点排他查询可避免结束日的秒级边界遗漏。
- 风险：`SUM` 返回值在不同驱动中的扫描类型可能不同；通过 `int64` 响应模型和三数据库验证发现并修正兼容问题。

## 8. 后续事项

- 本次不提供按用户、模型、渠道或 Token 的公开明细。
- 本次不提供缓存、独立限流配置、定时汇总和前端展示；如后续需要，必须先更新 PRD 再实施。
