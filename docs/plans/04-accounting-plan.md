# 记账页面开发计划

## 文档元信息

- **状态**：已实施，待开发者手动验证
- **创建日期**：2026-09-16
- **实施日期**：2026-09-17
- **关联 PRD**：[记账页面 PRD](../prd/04-accounting.md)
- **目标分支**：`custom`（禁止合并到 `main`）
- **实现范围**：后端模型与管理员 API、数据库迁移、`/accounting` 前端页面、i18n、聚合统计及必要验证

## 1. 总体实现思路

采用独立的记账模块，尽量将定制代码集中在新的后端 `accounting` 模型/控制器与前端 `features/accounting` 目录中，仅在路由注册、主库迁移和 i18n 等必要入口做小范围修改。

页面通过 React Query 并行获取：

1. 当前 Tab 的服务端分页数据；
2. 当前时间范围内的收入、支出和毛利润汇总；
3. 现有 `/api/user/stats/quota` 返回的全站剩余额度。

全站剩余额度不传入时间筛选。净利润仅在“全部”范围下，由毛利润与全站剩余额度按需求直接进行数值相减；其他范围显示 `-`。

## 2. 关键技术决策

### 2.1 数据模型

新增统一的人工账单表 `accounting_entries`，以 `kind` 区分线下收入和支出，避免建立两套结构近似的表。

建议字段：

| 字段 | 类型/约束 | 用途 |
| --- | --- | --- |
| `id` | 由 GORM 生成的主键 | 账单标识 |
| `kind` | varchar，索引 | `offline_income` 或 `expense` |
| `payment_method` | varchar(50) | 复用账单记录的付款方式值 |
| `amount_cents` | int64，正数 | 人民币分，避免浮点金额误差 |
| `user_id` | 可空整数，索引 | 线下收入必填，支出为空 |
| `target` | varchar(255) | 支出目标；线下收入为空 |
| `create_time` | int64，索引 | 管理员可编辑的业务创建时间 |

约束与规范化：

- 金额输入在服务端用十进制定点方式解析为分，必须大于 0、最多两位小数，且不超过 `99,999,999,999` 分。
- `offline_income` 必须有有效用户 ID，且用户必须存在；`target` 清空。
- `expense` 必须有非空支出目标；`user_id` 置空。
- 付款方式只允许 `wxpay`、`alipay`、`stripe`、`creem`、`waffo`、`waffo_pancake`。
- 删除使用 GORM 硬删除，不增加 `DeletedAt` 软删除字段。
- 在 `model/main.go` 的主库 `AutoMigrate` 清单中加入新模型；不修改日志数据库。

### 2.2 线上收入口径

新增管理员范围的线上收入查询，不改变现有用户个人 `/billing-records` API：

- 充值：`top_ups.status = success`、`amount > 0`，并排除存在 `admin_topup` 钱包流水的管理员补单。
- 订阅：`subscription_orders.status = success`，排除 `payment_provider = balance` 或 `payment_method = balance` 的钱包余额购买。
- 两类数据按 `create_time desc, id desc` 合并排序后服务端分页。
- 返回账单单号、消费类型、付款方式、实际支付、用户 ID、用户名称和创建时间。
- 用户名称显示规则：优先 `display_name`，为空时回退到 `username`；第二行固定显示用户 ID。

### 2.3 金额与统计

- 后端列表与统计响应使用“分”为内部聚合单位，避免人工账单出现浮点累加误差。
- 线上订单现有 `Money float64` 在记账查询边界统一按两位小数转换为分，再参与汇总和输出。
- 统计汇总接口返回：线上收入、线下收入、总收入、总支出、毛利润；均为分。
- 全站剩余额度继续调用现有 `/api/user/stats/quota`，前端使用系统配置的 `quotaPerUnit` 换算为美元数值，但固定使用 `$` 展示，不跟随站点额度显示模式。
- 净利润仅在“全部”范围计算：将毛利润分与全站剩余额度美元数值按两位小数转为分后直接相减，不做汇率转换。
- 新增记账页面专用金额格式函数，人民币符号固定为 `¥` 且负号位于符号后，例如 `¥-50.00`；美元固定为 `$`。

### 2.4 API 契约

在 `/api/accounting` 下注册仅允许管理员访问的路由组，统一使用 `middleware.AdminAuth()`：

| 方法与路径 | 行为 |
| --- | --- |
| `GET /api/accounting/online-income` | 查询所有用户的成功线上收入，支持分页和时间范围 |
| `GET /api/accounting/entries?kind=...` | 查询线下收入或支出，支持分页和时间范围 |
| `POST /api/accounting/entries` | 新增线下收入或支出 |
| `PUT /api/accounting/entries/:id` | 编辑指定人工账单，禁止通过请求改变其既有 kind |
| `DELETE /api/accounting/entries/:id` | 硬删除人工账单 |
| `GET /api/accounting/stats` | 返回时间范围内的五项人民币聚合数据 |

公共查询参数：

- `p`、`page_size`：服务端分页；
- `start_time`、`end_time`：Unix 秒；“全部”时不传；
- 开始时间不得晚于结束时间。

写入请求：

- `kind`、`payment_method`、`amount`、`create_time`；
- 线下收入额外要求 `user_id`；
- 支出额外要求 `target`；
- `amount` 采用十进制字符串，服务端负责精确解析、范围检查和错误返回。

错误处理：

- 无效 ID、无效时间范围、付款方式不支持、金额格式或范围不合法、用户不存在、记录不存在均返回明确但不泄露内部数据库信息的错误。
- 前端通过项目现有 `requireServerSuccess`、`createServerError` 和 `handleServerError` 路径展示错误；表单校验错误尽量映射到对应字段。

### 2.5 前端结构与组件复用

保留 `web/src/features/accounting/index.tsx` 为页面编排入口，并在同一 feature 内拆分职责：

- `api.ts`：记账 API 调用；
- `types.ts`：API、Tab、筛选和表单类型；
- `constants.ts`：Tab、付款方式、快速范围和时间粒度配置；
- `lib/schema.ts`：React Hook Form + Zod 表单校验；
- `lib/format.ts`：记账专用人民币/美元格式化和净利润计算；
- `components/accounting-stats.tsx`：七项统计卡片；
- `components/accounting-toolbar.tsx`：Tab、添加账单和筛选按钮；
- `components/accounting-filter-dialog.tsx`：参考模型筛选弹窗；
- `components/accounting-table.tsx`：按 Tab 组织 DataTable；
- `components/accounting-entry-dialog.tsx`：新增/编辑人工账单；
- `components/accounting-delete-dialog.tsx`：组合现有 `ConfirmDialog` 完成二次确认。

复用结论：

- 页面骨架继续使用 `SectionPageLayout fixedContent`；当前 `Main` 的默认行为已是内容区全宽，不增加页面级 `max-w-*` 容器。
- Tab 使用现有 `@/components/ui/tabs`。
- 表格、移动端列表、加载/空状态和分页使用 `DataTablePage` 与 `useDataTable`。
- 表单弹层使用 `@/components/dialog`，输入控件使用现有 UI 组件和 `DateTimePicker`。
- 删除确认复用 `@/components/confirm-dialog`，不在 feature 内重写 AlertDialog。
- 图标使用项目已安装的 Lucide 图标；图标按钮提供可访问名称和 tooltip。
- 统计卡片复用钱包统计栏的视觉语言（图标徽章、标签、等宽数字、边框），但因七项数据需要响应式布局，新增记账专用组件而不修改钱包的三项业务组件。

### 2.6 页面状态和交互

- 默认 Tab：线上收入。
- 默认范围：全部；默认时间粒度：天。
- 快速范围：全部、最近 24 小时、最近 7 天、最近 30 天。
- 保留自定义开始/结束时间；用户手动修改时间后取消快速范围选中状态。
- 时间粒度仅保存于筛选状态，为后续统计分析使用，本期不改变表格分组。
- 应用或重置筛选后，所有表格分页回到第一页，并重新请求统计与当前列表。
- “添加账单”只在线下收入和支出 Tab 显示；打开时根据当前 Tab 固定账单类型。
- 新增表单的创建时间默认为打开弹窗时的当前时间；编辑时回填原值。
- 新增、编辑或删除成功后关闭弹窗、提示成功，并失效当前列表和统计查询。
- 统计分析 Tab 显示项目通用空状态，说明该功能将在后续提供；不发起无用途的图表请求。

### 2.7 国际化

- 所有新增 UI 文案使用 `useTranslation()` 和英文键。
- 按 `i18n-translate` 技能要求，通过临时 `web/scripts/add-missing-keys.mjs` 一次性写入 en、zh、zh-TW、fr、ja、ru、vi 七种语言，禁止直接编辑 locale JSON。
- 执行 `bun run i18n:sync` 后删除临时脚本，并检查缺失键和翻译同步报告。

## 3. 预计文件影响范围

### 后端新增

- `model/accounting.go`
- `controller/accounting.go`

### 后端必要修改

- `model/main.go`：注册主库迁移模型；
- `router/api-router.go`：注册管理员记账 API 路由。

### 前端新增/重构

- `web/src/features/accounting/index.tsx`
- `web/src/features/accounting/api.ts`
- `web/src/features/accounting/types.ts`
- `web/src/features/accounting/constants.ts`
- `web/src/features/accounting/lib/schema.ts`
- `web/src/features/accounting/lib/format.ts`
- `web/src/features/accounting/components/*`

### i18n 必要修改

- `web/scripts/add-missing-keys.mjs`：临时生成后删除；
- `web/src/i18n/locales/{en,zh,zh-TW,fr,ja,ru,vi}.json`：仅由脚本写入；
- `web/src/i18n/static-keys.ts`：仅当动态配置键无法被扫描时登记。

## 4. 实施顺序与完成判据

1. **建立后端数据模型与迁移**  
   完成判据：新表由 GORM 在三种数据库方言下可创建，重复迁移不产生结构漂移；人工金额以分存储。
2. **实现模型查询和统计逻辑**  
   完成判据：线上口径排除管理员补单和余额订阅；人工账单 CRUD、用户校验、分页、排序、时间过滤和五项汇总结果正确。
3. **注册管理员 API 并实现请求校验**  
   完成判据：所有接口位于 AdminAuth 路由组，错误输入被服务端拒绝，非管理员不能调用。
4. **建立前端 API、类型、表单 schema 和格式化逻辑**  
   完成判据：金额、筛选、分页和错误合同具有明确类型；人民币负号格式及全站美元展示符合 PRD。
5. **实现统计栏、工具栏和筛选弹窗**  
   完成判据：七项卡片响应式显示；Tab、条件按钮显隐、快速范围、自定义范围和粒度状态正确。
6. **实现三张表与人工账单维护弹窗**  
   完成判据：线上、线下、支出字段及分页正确；新增/编辑/硬删除完成后列表和统计同步刷新；用户双行显示。
7. **实现统计分析空状态并完成 i18n**  
   完成判据：统计分析不展示未约定内容；所有新增文案在七种语言中有键值且同步报告无新增缺失。
8. **完成静态代码审查并提供开发者手动验证清单**  
   完成判据：只修改计划内文件，无无关重构；AI 不编写测试脚本、不运行任何测试或验证命令，并向开发者列出必须手动完成的检查。

## 5. 测试与验证制度

### 5.1 已确认限制

用户已明确选择“禁止 AI 进行测试验证的过程”：

- AI 不编写、生成或修改任何测试脚本、测试文件或测试 fixture；
- AI 不运行测试、类型检查、Lint、格式检查、构建、i18n 校验、数据库迁移验证或浏览器/E2E 验证；
- AI 完成业务代码后，只能提供手动验证建议，不得代替开发者执行；
- 未经开发者后续明确改变该决定，不得以项目原有测试要求为由自行运行验证。

### 5.2 开发者必须手动完成的验证建议

以下检查仍是该功能达到项目交付标准所必需的，但全部由开发者本人执行：

#### 后端行为

- 成功充值、成功线上订阅被计入，失败/待支付、管理员补单和余额订阅被排除；
- 合并列表按时间与 ID 稳定排序，分页总数正确；
- 线下收入必须关联存在的用户，响应返回名称与 ID；
- 支出目标必填，编辑不能跨类别修改；
- 金额拒绝 0、负数、超过两位小数、超上限和非数字；
- 时间范围过滤、全部范围及非法范围行为正确；
- 新增、编辑、硬删除后统计同步变化；
- 空数据汇总返回 0，不返回 null 或 NaN；
- 非管理员不能调用任何记账 API。

#### 三数据库兼容与迁移

必须使用真实 SQLite、MySQL 和 PostgreSQL 实例验证：

1. 空数据库首次迁移；
2. 再次启动/迁移，确认幂等；
3. 使用最新发布版本生成并包含代表性用户、充值和订阅数据的数据库升级到当前代码；
4. 再次迁移，确认旧数据、索引及新表均正常；
5. 执行人工账单 CRUD、时间过滤和统计聚合。

建议记录准确数据库版本，其中 MySQL 必须不低于 5.7.8，PostgreSQL 必须不低于 9.6。开发者未完成该矩阵前，不应将本功能认定为已验证数据库兼容。

#### 前端行为

- 默认线上收入 Tab、默认全部范围；
- 添加账单按钮只在线下收入和支出显示；
- 筛选弹窗没有“仅限管理员”，快速范围和粒度选项完整；
- 非全部范围净利润显示 `-`，全部范围按规则计算；
- 负净利润显示为 `¥-...`；
- 用户名称/ID双行、分页、加载、错误和空状态正确；
- 表单默认当前时间，金额和用户 ID 校验正确；
- 删除必须经过确认，取消时不发请求；
- 图标按钮具有可访问名称，Tab 和弹窗可用键盘操作；
- 七种前端语言均有完整且自然的新增翻译。

#### 建议命令

开发者可按实际环境手动执行：

- Go 文件格式化及后端构建/目标测试；
- `cd web && bun run typecheck`；
- `cd web && bun run lint`；
- `cd web && bun run i18n:sync`；
- `cd web && bun run build`；
- 使用隔离 DSN 执行 SQLite/MySQL/PostgreSQL 的迁移和行为验证。

AI 在最终实现交付中必须明确标记这些检查为“未由 AI 执行”。

## 6. 迁移、发布与回滚

- 新增表迁移属于向前兼容变更，不修改现有充值、订阅、钱包流水或用户表结构。
- 回滚应用版本时，新表可保留，不影响旧版本运行；若确需清理数据，必须由开发者单独执行显式数据库操作，本实现不提供自动删表回滚。
- 当前位于 `custom` 分支，定制改动只能合并回 `custom`，不得进入 `main`。
- 因包含 Go、数据库迁移和后端 API 改动，完成后需要开发者重新构建并重启后端容器：

  `docker compose -f docker-compose.dev.yml up -d --build new-api`

  未执行该命令时，运行中的后端容器可能仍是旧版本，无法体现本次改动。

## 7. 风险与边界

- 现有线上订单金额存为 `float64`；本功能只在记账查询边界按两位小数转换为分，不在本次范围迁移既有订单字段。
- 全站剩余额度使用美元数值与人民币毛利润直接相减是产品明确规则，不视为会计汇率换算。
- 统计分析 Tab 本期只有空状态；时间粒度虽然进入筛选状态，但不触发图表查询。
- 不新增第三方依赖，不修改 `/billing-records`、`/wallet` 或 `/users` 的公开行为。
- 硬删除不可恢复；前端确认弹窗是必要防误操作措施，但后端仍按已确认规则实际删除。

## 8. 测试制度决策

- **状态**：已确认。
- **决定日期**：2026-09-16。
- **用户选择**：禁止 AI 编写测试脚本及执行任何测试验证。AI 仅实现业务代码，并在交付时提供开发者手动验证建议。
