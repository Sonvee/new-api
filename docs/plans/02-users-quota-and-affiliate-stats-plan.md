# 用户管理页邀请佣金与全站额度统计开发计划

## 文档元信息

- 状态：已实现，待开发者手动验证
- 对应 PRD：[`docs/prd/02-users-quota-and-affiliate-stats.md`](../prd/02-users-quota-and-affiliate-stats.md)
- 计划范围确认日期：2026-09-15
- 实施边界：仅修改用户管理统计 API、用户列表相关前端类型/API/展示、共享数据表工具栏的必要扩展和七语言翻译；不修改邀请结算、额度扣减和数据库 schema。
- 验证边界：AI 禁止编写测试脚本、运行测试、运行类型检查、运行 lint、运行构建验证或执行任何测试验证；所有测试和验证由开发者本人手动完成。

## 1. 总体实现方案

1. 后端在现有 `/api/user` 管理员路由组中增加 `GET /api/user/stats/quota`，复用 `AdminAuth`。
2. 模型层用一次数据库无关的 GORM 聚合查询分别汇总所有用户的 `quota` 和 `used_quota`，在 Go 中计算 `total_quota = remaining_quota + used_quota`，以 `int64` 返回，避免分页用户列表或日志表参与统计。
3. 用户列表前端补充 `aff_valid_count`、`aff_commission_quota` 类型字段，并在现有“邀请信息”列中追加激活人数、复用 `formatQuota` 追加佣金展示。
4. 用户列表通过独立 React Query 请求加载统计数据；统计失败或加载期间将统计盒子内容显示为 `—`，不影响用户列表查询。
5. 共享 `DataTableToolbar` 增加一个仅负责布局的 `afterFilters` 插槽，放在所有筛选 chip 之后。用户页按现有筛选顺序渲染后，该插槽自然位于“角色”筛选项右侧；不复制搜索、筛选、重置和移动端面板逻辑。
6. 统计金额复用 `formatQuota` 和系统货币设置；新增 UI 文案通过 `add-missing-keys.mjs` 写入 en、zh、zh-TW、fr、ja、ru、vi，再运行 `bun run i18n:sync`。

## 2. 目标文件与职责

### 2.1 后端

- `model/user_stats.go`（新增）
  - 定义统计结果结构和 `GetUserQuotaStats` 查询函数。
  - 使用 `DB.Model(&User{}).Select(...)` 聚合 `quota`、`used_quota`；空表通过 `COALESCE` 返回 0；扫描字段使用 `int64`。
  - 不引入 raw SQL 拼接，不修改模型字段和迁移。
- `controller/user_stats.go`（新增）
  - 定义 `GetUserQuotaStats` 控制器。
  - 调用模型查询并通过 `common.ApiSuccess` 返回 `total_quota`、`remaining_quota`。
  - 查询失败记录服务端错误并使用项目统一安全错误响应，不返回数据库内部细节。
- `router/api-router.go`
  - 在现有 `adminRoute` 中注册 `GET /stats/quota`，确保继承 `AdminAuth`。
  - 路由放在用户 ID 通配路由附近但保持路径可读，不改变现有 `/api/user/`、`/api/user/search` 和其他管理接口。

### 2.2 前端

- `web/src/features/users/types.ts`
  - 在 `User` schema 增加可选的 `aff_valid_count`、`aff_commission_quota` 字段，按现有后端用户列表响应约定建模。
  - 新增 `UserQuotaStats` 类型，字段为 `total_quota: number` 和 `remaining_quota: number`。
- `web/src/features/users/api.ts`
  - 新增 `getUserQuotaStats()`，调用 `GET /api/user/stats/quota`，复用统一 `api` 实例和 `requireServerSuccess`。
- `web/src/features/users/components/users-columns.tsx`
  - 读取 `aff_valid_count`、`aff_commission_quota`。
  - 调整邀请信息空状态判定，使激活人数或非零佣金不会被隐藏。
  - 按邀请人数、激活人数、收益、佣金的顺序展示，继续使用 `formatQuota`、`LongText` 和当前列布局。
- `web/src/features/users/components/users-quota-stats.tsx`（新增）
  - 负责统计盒子展示，不负责请求。
  - 接收统计数据、加载状态和错误状态；固定保留盒子尺寸/布局，加载和错误状态展示 `—`。
  - 使用现有 Tailwind、语义化文本和竖向分割线，兼容自动换行。
- `web/src/features/users/components/users-table.tsx`
  - 增加独立统计 React Query，使用独立的 `['users', 'quota-stats', refreshTrigger]` query key，并在用户列表刷新后同步刷新统计。
  - 将 `UsersQuotaStats` 通过 `DataTablePage.toolbarProps.afterFilters` 注入默认工具栏。
  - 统计请求不得纳入用户列表分页、筛选、排序 query key，也不得让统计失败抛出到列表查询。
- `web/src/components/data-table/toolbar/toolbar.tsx`
  - 为 `DataTableToolbarProps` 增加 `afterFilters?: ReactNode`。
  - 在桌面默认布局、带 `leftActions` 布局和移动端可折叠布局中，将插槽渲染在 `filterChips` 之后。
  - 保持无插槽时现有所有调用点的输出和行为不变。

### 2.3 国际化

- `web/scripts/add-missing-keys.mjs`（临时，验证后删除）
  - 为新增用户界面文案写入七种语言的翻译，至少覆盖：`Commission`、`Total Site Quota`、`Remaining Site Quota`。
  - 如果实现复用现有 `Earnings`、`Invited {{count}} users`、`Inviter`、`Role` 等 key，则不重复新增；新增 `Activated {{count}} users`。
- `web/src/i18n/locales/*.json`
  - 仅由脚本写入和同步，不手工编辑。

## 3. API 契约与权限

### 3.1 请求

```text
GET /api/user/stats/quota
```

- 无请求体和查询参数。
- 必须通过现有管理员认证；普通用户、未登录请求和权限不足请求不能进入成功处理。

### 3.2 成功响应

```json
{
  "success": true,
  "message": "",
  "data": {
    "total_quota": 10000000,
    "remaining_quota": 5000000
  }
}
```

- `remaining_quota = SUM(users.quota)`。
- `total_quota = SUM(users.quota) + SUM(users.used_quota)`。
- 空表返回两个 0。
- JSON 字段顺序不作为契约。

### 3.3 失败响应

- 认证失败沿用现有 `AdminAuth` 响应。
- 数据库查询失败使用项目统一错误响应，调用方不得看到 SQL 或连接信息。
- 前端将统计查询失败降级为 `—`，用户列表仍按原流程显示或报错。

## 4. 复用与取舍

- 复用 `AdminAuth`，不新增权限常量或一套独立管理员判定。
- 复用 `getUsers` / `searchUsers` 的 API 模块组织、React Query、`requireServerSuccess` 和统一 `api` 实例。
- 复用 `formatQuota`，不自行实现货币/Token 换算。
- 复用 `DataTableToolbar`、`DataTablePage.toolbarProps` 和现有 filter chip；新增 `afterFilters` 是因为当前公共工具栏没有“筛选项之后”的插槽，`preActions` 位于右侧操作区，不能满足“角色右侧”的位置要求。不会另起一套用户页工具栏。
- 不新增第三方依赖、不改数据库 schema、不引入独立缓存。

## 5. 实施步骤

### 步骤 1：完成后端聚合统计

- 修改/新增 `model/user_stats.go`、`controller/user_stats.go`、`router/api-router.go`。
- 验证：管理员可访问准确路径；聚合结果按确认口径返回；空表返回 0；数据库错误经过统一错误处理；非管理员请求被拒绝。

### 步骤 2：补充用户列表激活人数和佣金字段展示

- 修改 `web/src/features/users/types.ts`、`web/src/features/users/components/users-columns.tsx`。
- 验证：邀请信息按顺序显示邀请人数、激活人数、收益和佣金；激活人数或佣金非零且其他邀请字段为空时仍能显示；空状态不出现 `undefined`、`NaN`。

### 步骤 3：扩展共享工具栏并接入统计盒子

- 修改 `web/src/components/data-table/toolbar/toolbar.tsx`，新增 `UsersQuotaStats` 并接入 `users-table.tsx`。
- 验证：统计盒子位于角色筛选项右侧，使用竖分割线；加载/失败显示 `—`；统计请求失败不阻塞列表；移动端可换行且不隐藏统计数据。

### 步骤 4：补充 i18n，并交付手动验证清单

- 通过 `add-missing-keys.mjs` 新增/更新七语言文案，运行 `bun run i18n:sync`，删除临时脚本。
- AI 不新增或修改任何测试脚本。
- 向开发者交付手动验证清单：佣金展示、佣金-only 数据、管理员/非管理员接口权限、空用户数据、聚合口径、统计加载/失败降级、桌面端位置、移动端换行和七种 locale。

### 步骤 5：整理后端手动验证清单

- AI 不编写测试文件、不执行自动化测试或数据库验证。
- 开发者本人手动使用 SQLite、MySQL、PostgreSQL 验证管理员成功、非管理员拒绝、空数据、精确聚合、大于 32 位结果以及同一数据集下的三数据库兼容性。
- 开发者自行记录实际数据库版本、操作步骤和结果。

## 6. 开发者手动测试与验证清单

### 6.1 前端手动检查

- AI 不执行任何前端测试、类型检查、lint、构建或其他测试验证。
- 开发者本人手动验证：佣金展示、统计盒子位置、加载/失败显示 `—`、桌面端和移动端换行、用户列表不受统计请求失败影响，以及七种语言文案。

### 6.2 后端手动检查

- AI 不执行 Go 测试、构建、格式检查或其他后端验证。
- 开发者本人手动验证接口路径、管理员权限、错误响应、聚合结果和列表原有行为。

### 6.3 数据库手动验证矩阵

- 开发者本人手动在 SQLite、MySQL、PostgreSQL 中验证空表、单用户、多用户、`total_quota > 2^32` 的聚合。
- 开发者记录实际数据库版本、操作步骤和结果。
- 本次不改 schema，因此不需要迁移验证；仍需由开发者手动确认聚合表达式和 `int64` 扫描在三种方言下可用。

## 7. 风险、回滚与后续

- 风险：全站聚合每次用户页加载会读取用户表；查询无过滤条件且只做两列聚合，按现有页面需求不新增缓存。若后续数据量证明有压力，另行更新 PRD 评估缓存或汇总表。
- 风险：统计值和用户列表可能在不同请求时刻读取，页面允许短暂不一致；本次不增加跨请求事务或锁。
- 风险：移动端筛选栏空间有限；通过 `flex-wrap` 保留统计盒子，不隐藏数据。
- 回滚：删除统计路由/查询/组件和 `afterFilters` 调用即可；共享 `afterFilters` 插槽保留也不会改变未使用调用点行为，但优先随功能一起回滚。
- 后续：不增加按角色/状态/组过滤统计、不增加趋势图和历史快照。

## 8. 完成判定

- 所有 PRD 验收标准均有对应实现；无未确认项。
- AI 仅交付代码和手动验证清单，不编写测试脚本、不执行测试验证。
- 开发者本人完成前端、后端及 SQLite/MySQL/PostgreSQL 手动验证，并自行记录结果。
