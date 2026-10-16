# 福利活动：拼手气红包开发计划

## 文档元信息

- 状态：已获开发授权；首版代码已落地，待开发者手动验证
- 关联 PRD：[08-welfare-activities-red-packet.md](../prd/08-welfare-activities-red-packet.md)
- 目标分支：`custom`
- 计划日期：2026-10-13
- 测试制度：禁止 AI 编写测试脚本或执行测试、构建、lint、类型检查和数据库验证；开发者可按文末手动验证建议执行。

## 1. 实现目标

在已有后台 `/system-settings/site/welfare-activities` 和前台 `/welfare-activities` 的占位页面上，完成拼手气红包的配置、分发、定时激活、并发领取、额度入账、福利活动流水和历史查询闭环。

实现必须保持现有项目的用户认证、AdminAuth、额度单位、钱包流水、分页、i18n 和三种主数据库兼容约束。

## 2. 建议实现边界

### 2.1 后端分层

- `model/`：定义活动期、固定红包、领取记录和查询方法；将唯一约束、索引、状态条件和锁定读取集中在模型层。
- 事务编排落在 `model/`：复用现有包内 `recordWalletLedgerTx` 和授信缓存同步工具，将金额生成、分发、状态推进、领取和 DTO 查询按职责拆文件；控制器不直接操作额度或库存。
- `controller/`：实现用户和管理员 HTTP 参数绑定、权限、错误转换、分页响应和脱敏输出。
- `router/api-router.go`：注册用户福利活动路由和 AdminAuth 管理路由，明确路由顺序，避免与 `/user/:id` 等通配路由冲突。
- `controller/system_task_handlers.go`：注册定时激活处理器。
- `model/main.go`：把新模型加入主数据库 `AutoMigrate`；必要的历史数据或索引迁移遵循现有迁移函数模式。
- `model/wallet_ledger.go`：新增统一的 `WalletLedgerTypeWelfareActivity` 常量；沿用 `SourceType`、`SourceId` 和 `IdempotencyKey` 关联红包领取。

### 2.2 前端分层

- `web/src/features/welfare-activities/`：新增 API、类型、查询 key、当前活动卡片、领取历史表格、期数筛选和倒计时逻辑。
- `web/src/features/system-settings/maintenance/welfare-activities-section.tsx`：组合草稿表单、活动列表、状态操作和后台领取记录。
- 复用 `SettingsSection`、React Hook Form、Zod、React Query、项目 `DataTable`、共享分页、ConfirmDialog、状态徽标、空状态和错误反馈组件。
- 使用 `@/lib/format` 和 `@/lib/currency` 处理额度输入与显示；任何日期格式化先经过 `toIntlLocale`，并明确使用 `Asia/Shanghai` 的展示语义。
- 所有文案使用 `useTranslation()`，并在 `web/src/i18n/locales/{en,zh,zh-TW,fr,ru,ja,vi}.json` 增加完整键值。

## 3. 数据模型设计

### 3.1 活动期

建议新增 `WelfareActivityIssue`，表名按现有模型命名规范落地为 `welfare_activity_issues`。核心字段：

- `id`：数据库主键。
- `issue_no`：全局递增且唯一的展示期数，只在正式分发时生成；草稿为 NULL。
- `activity_type`：第一版固定为 `red_packet`，为未来福利活动扩展保留区分字段。
- `status`：草稿使用 `draft`；已分发红包只使用 `scheduled`、`active`、`finished` 三种状态。
- `total_quota`、`packet_count`、`min_quota`：分发后锁定的内部整数配置；`min_quota` 至少为 1 个内部额度单位。
- `remaining_quota`、`remaining_count`：服务端维护的摘要计数，用于列表和当前活动快速展示；领取事务必须以固定红包记录为最终依据。
- `start_at`：Unix 时间戳，输入和展示统一按 `Asia/Shanghai` 解释。
- `created_by`、`dispatched_by`、`cancelled_by`：管理员或系统来源字段。
- `created_at`、`updated_at`、`dispatched_at`、`finished_at`、`cancelled_at`：审计时间。
- `cancel_reason` 或等价来源字段：记录人工结束、新期替换或系统切换原因。

索引和约束：`issue_no` 唯一；`status + start_at` 支持激活扫描；“最多一个 active/scheduled”由事务中首先更新固定协调行，再检查和切换活动状态来保证，不使用方言特有部分唯一索引。

### 3.2 固定红包

建议新增 `WelfareActivityRedPacket`，表名为 `welfare_activity_red_packets`：

- `id`：数据库主键。
- `issue_id`：所属期数，建立普通索引。
- `packet_index`：期内唯一序号。
- `quota`：固定内部整数额度。
- `claim_id`：未领取为 NULL，领取后唯一关联领取记录；用户和时间由领取记录保存。

唯一约束为 `(issue_id, packet_index)`。分发生成所有记录；旧期结束时，保留所有未领取记录，通过期状态阻止领取，避免切期时批量更新库存；结束不产生额度流水。

### 3.3 领取记录

建议新增 `WelfareActivityClaim`，表名为 `welfare_activity_claims`：

- `id`：数据库主键。
- `issue_id`、`packet_id`、`user_id`：期数、固定红包和用户关联。
- `quota`：实际发放额度，复制保存以保证历史不可变。
- `idempotency_key`：按“活动内部 ID + 用户 ID”生成的自然幂等键；数据库唯一，不接受客户端任意键。
- `created_at`：领取时间。
- `ledger_no`：关联钱包流水编号，便于审计和排查。

唯一约束为 `(issue_id, user_id)` 和 `packet_id`。前台查询使用 DTO 脱敏用户名，后台查询使用管理员 DTO；不要直接序列化完整 User。

### 3.4 固定协调计数表

`welfare_activity_issue_counters` 保存固定 ID=1 的协调行、下一个期号和写版本。所有状态写事务先更新该行再读取业务数据，覆盖“尚无活动可锁”的并发场景。初始化使用 GORM 冲突忽略，重复启动不重置期号。

## 4. 关键业务流程

### 4.1 创建和分发

1. 前端沿用已有显示单位转换工具，提交内部整数额度；控制器绑定整数配置。
2. 模型层再次校验正数、安全上限、至少一个单位的最小额度、1～10,000 份、总额至少覆盖每份一个内部单位，以及最小额度不超过平均额度；乘法边界用安全除法比较。
3. 分发时先为每份分配至少一个内部单位的保底额度；剩余额度通过随机切分点均匀拆分，保证每份可领取且总额精确一致。
4. 创建草稿时只保存配置，不分配 `issue_no`。
5. 锁外预生成固定金额；分发事务先更新协调行，重新核对草稿配置和预约期占用，再递增期号并批量写入红包。
6. 按 `start_at <= now` 选择 `scheduled` 或 `active`。
7. 如果直接 active，先按“新期替换旧期”的规则结束已有 active 期；整个切换和新期写入处于同一事务。
8. 分发成功后返回完整摘要；失败时草稿和红包生成回滚，期数不被消耗。

需要特别处理期数生成的数据库兼容性。优先使用独立的数据库序列模型或在事务内锁定并递增唯一计数记录，避免依赖 MySQL 自增、PostgreSQL sequence 或 SQLite 特有语法。

### 4.2 到点激活

1. 新增系统任务类型和 handler，周期沿用系统任务 runner 的 15 秒调度粒度。
2. 每次执行在事务内查找最早到点的 scheduled 期，并使用 `lockForUpdate(tx)` 或等价条件更新锁定它。
3. 结束已有 active 期，再把 scheduled 期更新为 active。
4. 新预约期具有完整库存；到点激活不发用户额度，真正领取才入账。
5. handler 必须是幂等的，重复运行只能看到已处理状态，不得重复发放额度。
6. 领取接口在同一规则下做时间兜底，避免后台任务延迟导致到点后页面长期不可领取。

### 4.3 并发领取

领取接口必须接受用户屏幕显示的 `issue_no`，禁止重试时自动领取后来的新期：

1. 开启带 10 秒请求超时的事务，第一条 SQL 更新固定协调行。
2. 检查到点预约切换，再读取指定期号和正常状态用户。
3. 已有该用户该期领取记录则返回原结果，即使该期已结束。
4. 未开始、已结束或无库存时返回明确业务错误；正常拒绝仍提交必要的到点切换，不发额度。
5. 按打乱后的固定序号选择一份未领取红包，创建唯一领取记录。
6. 检查钱包上限并条件增加额度，记录福利流水并关联 `ledger_no`，条件占用红包。
7. 同事务减少剩余份数和额度；最后一份要求剩余额度严格为零并结束活动。
8. 任何数据库写入失败整体回滚；提交后复用授信缓存增量同步，不覆盖缓存中的尚未落库预扣。

SQLite 不能照搬 MySQL/PostgreSQL 的 `FOR UPDATE`。按项目现有 `lockForUpdate(tx)` 和 SQLite 兼容路径实现；不要在业务调用点散落数据库方言 SQL。

## 5. API 设计

### 5.1 普通用户

- `GET /api/welfare-activities/current`
  - 返回 `server_time`、`issue`、`upcoming`；各期摘要包括状态、时间、剩余资源和本人领取。
- `GET /api/welfare-activities/issues?p=&page_size=`
  - 返回可查询期数摘要，限制最大页大小。
- `GET /api/welfare-activities/issues/:issue_no/claims?p=&page_size=`
  - 返回脱敏用户名、额度和领取时间。
- `POST /api/welfare-activities/current/claim`
  - 需要 `UserAuth`，请求 `{issue_no}`；返回 `claim` 和 `already_claimed`，余额由已有 self 接口刷新。

错误响应使用项目现有 `common.ApiError` / `common.NewMessage` 契约，至少区分：未到开抢时间、没有进行中活动、已领取、已抢完、活动已结束、参数非法和钱包额度上限。

### 5.2 管理员

- `GET /api/admin/welfare-activities?status=&p=&page_size=`
- `POST /api/admin/welfare-activities/drafts`
- `PUT /api/admin/welfare-activities/drafts/:id`
- `DELETE /api/admin/welfare-activities/drafts/:id`
- `POST /api/admin/welfare-activities/drafts/:id/dispatch`
- `POST /api/admin/welfare-activities/:id/cancel`
- `GET /api/admin/welfare-activities/issues/:issue_no/claims?p=&page_size=`

全部使用 `middleware.AdminAuth()`。分发和结束接口必须检查当前状态，重复操作返回幂等成功或明确业务错误；不能让管理员通过更新接口修改已锁定字段。

## 6. 前端实施步骤

### 6.1 共享 API 和类型

在 `web/src/features/welfare-activities/` 建立 feature 内部 API、类型和 query keys，统一处理：

- 分页响应的 `data` / `total` 结构；
- quota 内部值与展示值之间的转换；
- server time 与倒计时计算；
- 领取错误的业务提示和 query invalidation。

### 6.2 前台页面

用现有页面布局组件替换 `ComingSoon`，组合：

- 当前红包卡片；
- 倒计时和状态徽标；
- 抢红包按钮及请求态；
- 领取成功反馈；
- 期数选择器；
- 可分页 `DataTable`。

倒计时使用服务端返回的时间差作为基准，避免客户端时钟偏差。定时刷新只用于同步服务端状态，按钮提交前不假设本地倒计时已经准确结束。

### 6.3 后台页面

在现有 `SettingsSection` 内增加：

- 红包草稿表单：React Hook Form + Zod；
- 当前/历史活动列表；
- 分发、删除和结束确认操作；
- 后台领取记录抽屉或详情面板；
- 分页、状态徽标和错误反馈；管理列表 API 支持状态参数。

表单输入与 `/system-settings/billing/quota` 保持同一额度单位体验，避免管理员在两个页面看到不同换算语义。

### 6.4 i18n 和无障碍

- 所有新增用户可见文本使用英文源键，并同步七个 locale 文件。
- 按钮 disabled 时仍提供状态说明；倒计时使用可读文本，必要时增加 `aria-live` 反馈领取结果。
- 表格列标题、分页控件、筛选器和错误信息都走 i18n。

## 7. 数据库迁移和兼容性

- 将四个模型加入 `model/main.go` 的主库 `AutoMigrate`。
- 优先使用 GORM 字段类型、复合索引和唯一索引；避免 partial index、数据库触发器和方言专属 JSON 类型。
- 时间统一保存 Unix 秒，展示和输入使用 `Asia/Shanghai`。
- 状态和来源字段使用字符串，避免跨数据库枚举差异。
- 事务锁定通过项目共享 helper；原始 SQL 只有在 GORM 无法表达且提供 SQLite、MySQL、PostgreSQL 分支时才允许出现。
- 新流水类型只扩展 Go 常量和业务来源字段，不改变既有流水类型值。
- 未来需要补充迁移时，必须保持重复启动幂等；现阶段不修改历史表结构以外的业务数据。

## 8. 文件变更清单

### 后端预计新增或修改

- `model/welfare_activity.go`：活动期模型、状态常量、查询和状态推进事务。
- `model/welfare_activity_dispatch.go`：草稿、预生成金额、正式分发和定时切换事务。
- `model/welfare_activity_query.go`：当前摘要、分页历史和脱敏查询。
- `model/welfare_activity_claim.go`：领取记录模型、分页查询和幂等查询。
- `model/wallet_ledger.go`：新增福利活动流水类型。
- `model/main.go`：加入 AutoMigrate。
- `middleware/rate-limit.go`：复用用户限流器，福利领取固定 3 次/5 秒。
- `controller/welfare_activity.go`：用户接口和管理员接口。
- `controller/system_task_handlers.go`：注册福利活动定时 handler。
- `model/system_task.go` 或相邻调度文件：新增任务类型。
- `router/api-router.go`：注册路由。

具体是否合并模型文件，以现有项目编排和单文件职责为准；不应为了拆文件而重复 DTO、分页或锁定逻辑。

### 前端预计新增或修改

- `web/src/features/welfare-activities/api.ts`
- `web/src/features/welfare-activities/types.ts`
- `web/src/features/welfare-activities/lib/{format,draft-form}.ts`（query keys 与 API 同文件）
- `web/src/features/welfare-activities/hooks/*`
- `web/src/features/welfare-activities/components/*`
- `web/src/features/welfare-activities/index.tsx`
- `web/src/features/system-settings/maintenance/welfare-activities-section.tsx`、`site/index.tsx` 和共用设置页面框架
- `web/src/routes/_authenticated/system-settings/route.tsx`：仅福利指定路径允许普通管理员
- `web/src/features/billing-records/components/billing-records-table.tsx`：福利活动流水标签和筛选项
- `web/src/features/system-info/constants.ts`：福利定时任务标签
- `web/src/i18n/locales/{en,zh,zh-TW,fr,ru,ja,vi}.json`

开始编码前必须再次搜索共享组件和相邻 feature 的实现，若现有组件已经覆盖需求，则优先组合或扩展，不能重复造同类表格、分页、确认框或状态组件。

## 9. 手动验证建议

以下步骤由开发者执行，AI 不编写或执行测试脚本：

1. 在 SQLite、MySQL 和 PostgreSQL 环境分别启动一次，确认四张表、索引和流水类型初始化成功；再次启动确认迁移幂等。
2. 创建一个草稿，验证额度换算、份数边界、最小额度 0、最小额度不超过平均值、总额度覆盖每份一个内部单位和非法时间提示。
3. 用过去时间分发，确认立即进入 active；用未来时间分发，确认 scheduled、倒计时和到点激活。
4. 连续分发新期，确认旧 active 期被取消，旧期已领取记录保留且未领取红包不再可领。
5. 使用多个用户同时点击最后一个红包，确认只有一个成功，用户余额、红包记录和钱包流水数量一致。
6. 同一用户重复刷新和重复提交，确认不会获得两份额度，并能返回原领取结果或已领取状态。
7. 让额度入账或流水写入失败，确认红包占用和领取记录一起回滚。
8. 重启服务，确认 scheduled 期不会提前开放，到点后仍能激活；重复执行调度不会重复处理。
9. 在前台切换期数并翻页，确认普通用户只看到脱敏用户名；在后台确认管理员能看到完整记录。
10. 切换七种前端语言并检查额度、日期、状态、按钮、表格和错误提示。

## 10. 风险和处理

- **SQLite 并发语义差异**：优先复用项目已有事务和锁定兼容路径，必要时缩小事务并用唯一约束作为最终保护。
- **期数生成并发**：不能使用“读取最大值再加一”的无锁实现；必须由唯一计数记录或事务锁保护。
- **管理员连续操作**：分发、结束都用状态条件和事务处理，避免重复点击创建多个有效期。
- **额度展示单位**：前后端都沿用现有 quota/currency 工具，避免美元、人民币和内部单位混淆。
- **缓存与数据库不一致**：数据库提交是唯一事实来源，缓存更新放在提交后并允许下一次请求重新加载数据库值。
- **前端时间偏差**：服务端返回 `server_time`，倒计时按差值计算，领取接口再次验证绝对时间。

## 11. 开发顺序

1. 先完成模型、状态常量、流水类型和 AutoMigrate 接入。
2. 实现金额生成和分发事务，再实现激活任务。
3. 实现领取事务和错误契约，确认缓存更新位置。
4. 接入控制器和路由，补齐普通用户与管理员 DTO 脱敏边界。
5. 复用现有前端组件完成后台页面。
6. 完成前台当前卡片、倒计时、领取反馈和历史表格。
7. 同步七种 i18n 文案，检查 quota/currency/date 格式化。
8. 交由开发者按手动验证建议执行数据库、并发、恢复和页面验证。

开发授权后，如果修改了 Go、数据库或后端配置，完成时提醒开发者重建后端容器：

```text
docker compose -f docker-compose.dev.yml up -d --build new-api
```

## 12. 实现状态与交接约束（2026-10-13）

- 已完成首版后端、管理页、用户页、钱包流水类型、系统任务接入和七语言文案写入；未提交 Git。
- 新代码已执行 `gofmt -w` 和限定文件的 `oxfmt --write` 格式化；格式化不是测试或构建结果。
- 遵循已确认的禁止 AI 验证制度，未编写测试，未执行测试、构建、lint、类型检查、i18n:sync 或数据库验证，不能声称首版已经通过验收。
- 高并发正确性采用固定协调行串行化。短事务之外预生成随机金额；全局协调锁及数据库吞吐仍可能在大量用户同一时刻抢夺时形成瓶颈。真实容量、超时比例及三个数据库的锁语义必须由开发者实际验证。
- 补充人工验证：两个管理员同时分发不同草稿，只能留下一个允许的 active/scheduled 组合；草稿并发修改必须使旧配置的分发失败而不是错误入库；已发放响应丢失时用旧期号重试仍只存在一次余额增加和一条流水。
- 数据库验证应覆盖真实 SQLite、MySQL、PostgreSQL，以及全新数据库和代表性旧版数据库升级；至少重复启动两次，记录实际版本、命令和结果。目前尚无这些验证证据。
- UI 复用：使用共享 DataTablePage、ConfirmDialog、Dialog、Form、StatusBadge、EmptyState、LoadingState、ErrorState 与 CopyButton。未新增通用表格、分页、确认框或日历。
- 固定时区的能力缺口：现有 `web/src/components/datetime-picker.tsx` 只按浏览器时区读写，没有固定时区参数。本功能使用已有 Input 的 `datetime-local`，明确以 UTC+8 解析和 Asia/Shanghai 展示，不修改其他页面的日期选择语义。
- 授权控制仍由现有 UserAuth/AdminAuth、正常用户校验和写请求来源保护执行；前端仅对福利路径增加普通管理员入口。未修改登录、会话、密码或权限模型；相关路由越权与请求来源保护尚待开发者验证，不声明已通过 OWASP 安全验收。
