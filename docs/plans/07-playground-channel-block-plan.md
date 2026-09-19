# 游乐场渠道调用限制开发计划

## 文档元信息

- 状态：已实施，待开发者手动验证
- 创建日期：2026-09-19
- 关联 PRD：[游乐场渠道调用限制 PRD](../prd/07-playground-channel-block.md)
- 目标分支：`custom`
- 实施边界：只修改渠道额外设置、游乐场模型列表和游乐场请求选渠道相关逻辑，不改变其他调用路径

## 1. 已确认范围与决策

本计划实现以下已确认行为：

- 渠道创建/编辑面板的“其他设置”→“渠道额外设置”增加“禁止游乐场调用”开关，默认关闭。
- 配置持久化到现有 `channels.settings` JSON（对应 `ChannelOtherSettings`），缺失字段按 `false` 处理。
- 游乐场模型列表继续复用 `/api/user/models`，仅游乐场请求增加 `playground=true` 查询参数。
- 后端只有在请求明确属于游乐场时过滤禁止渠道；`/keys`、Dashboard、普通 API、任务插件及其他调用方不携带该参数或游乐场上下文，保持原行为。
- 游乐场模型列表和游乐场实际渠道选择均使用同一套渠道过滤判断。
- 分组列表不做过滤；某分组没有可用模型时仍显示分组，模型列表为空。
- 用户已选择：禁止 AI 编写测试脚本，也禁止 AI 执行测试、类型检查、lint、构建或其他程序验证。实现完成后由开发者本人手动验证，AI 只提供验证步骤和结果记录模板。

## 2. 总体实现思路

将“禁止游乐场调用”建模为现有渠道约束系统中的一个显式过滤条件，而不是修改 `abilities.enabled`、删除能力记录或改变全局缓存内容：

1. 在独立的 `relaykit/dto.ChannelOtherSettings` 增加布尔字段 `DisablePlayground`，保持 JSON 缺省值为 `false`。
2. 在渠道约束 DTO 和约束判断中增加 Playground 过滤类型。过滤条件只由 `/pg/chat/completions` 的游乐场请求上下文添加，因此现有渠道选择路径仍可复用内存缓存和数据库两条实现。
3. 游乐场模型列表接口收到 `playground=true` 时，使用同一过滤谓词过滤启用能力对应的渠道，再按现有顺序去重模型；未携带参数时继续调用现有模型列表逻辑。
4. 前端表单解析和写回 `settings` JSON，新增开关复用现有 `FormField`、`Switch`、分组布局和敏感字段禁用逻辑。
5. 游乐场 API 请求只增加 `playground=true`，不修改 `/keys` 和 Dashboard 使用的共享 `web/src/lib/api.ts` 用户模型请求。

## 3. 后端设计

### 3.1 渠道额外设置数据结构

修改 `relaykit/dto/channel_settings.go`：

- 在 `ChannelOtherSettings` 增加 `DisablePlayground bool`，JSON tag 为 `json:"disable_playground,omitempty"`。
- 不新增数据库列、不新增迁移；沿用 `channels.settings` 文本 JSON。
- 既有 JSON 缺失 `disable_playground` 时由 Go 零值解释为 `false`。
- 保持 `relaykit` 独立可构建；不得导入根模块包。

### 3.2 渠道过滤约束

修改 `dto/channel_constraints.go`、`model/channel_constraint.go`：

- 增加新的 `ChannelFilterKind`，语义为“禁止游乐场调用”过滤。
- `ChannelSatisfiesFilters`、内存缓存的 `filterCandidateIDs` 和数据库路径的 `filterAbilitiesByConstraints` 都必须识别该过滤类型。
- 过滤判断读取 `channel.GetOtherSettings().DisablePlayground`：为 `true` 时拒绝，缺失或 `false` 时通过。
- 将过滤类型纳入既有过滤评估顺序，确保首选渠道亲和性、普通选择、重试以及自动分组都使用相同结果。
- 不将该条件写入 `group2model2channels`、`abilities.enabled` 或全局分组模型缓存；全局缓存仍表示普通 API 可用能力。

### 3.3 游乐场请求上下文

修改 `middleware/distributor.go` 或与其相邻的现有游乐场请求处理位置：

- 识别现有 `/pg/chat/completions` 请求后，向 `service.GetChannelConstraints(c)` 添加 Playground 过滤条件。
- 保留已有 Playground 请求体解析、分组权限校验和 `ContextKeyUsingGroup` 更新逻辑。
- 确保添加过滤条件发生在首选渠道亲和性判断和 `CacheGetRandomSatisfiedChannel` 调用之前。
- 只对 `/pg/chat/completions` 生效；其他请求路径不得自动添加该条件。
- 如果客户端绕过模型列表仍提交仅由禁止渠道提供的模型，服务端应沿用现有无可用渠道错误路径，不得选中禁止渠道。

### 3.4 游乐场模型列表

修改 `model/ability.go`、`service/group.go`、`controller/user.go`：

- 保留现有 `GetGroupEnabledModels` 和 `GetGroupsEnabledModels` 的默认行为，避免影响 `/keys`、Dashboard 和其他调用方。
- 新增明确命名的 Playground 模型列表路径，例如 `GetGroupEnabledModelsForPlayground` / `GetPlaygroundGroupsEnabledModels`，内部查询启用能力后复用同一 Playground 过滤谓词。
- 在 `GetUserModels` 中解析 `playground=true`；仅当值为 `true` 时使用 Playground 专用模型聚合函数。
- `group`、`auto`、用户可用分组权限、模型去重和既有顺序规则保持不变。
- 不修改 `GetUserGroups` 或 `/api/user/self/groups`，保证无可用模型的分组仍返回。
- `playground` 未传、为其他值或由 `/keys` 等调用方访问时，返回结果必须保持原有逻辑。

### 3.5 后端接口契约

- 现有接口：`GET /api/user/models?group={group}`，行为不变。
- 新增可选参数：`playground=true`。
- 只有同时满足 `playground=true` 且渠道处于启用能力范围时，才排除 `disable_playground=true` 的渠道。
- 响应结构、成功字段、错误字段和权限校验不变。

## 4. 前端设计

### 4.1 渠道表单

修改：

- `web/src/features/channels/types.ts`
- `web/src/features/channels/lib/channel-form.ts`
- `web/src/features/channels/components/drawers/channel-mutate-drawer.tsx`

实施要求：

1. `ChannelOtherSettings` 增加 `disable_playground?: boolean`。
2. `ChannelFormValues` 增加 `disable_playground: boolean`。
3. 新建默认值设为 `false`。
4. 编辑时从 `channel.settings` 解析 `disable_playground === true`，否则为 `false`。
5. `buildSettingsJSON` 保留已有设置并写入该布尔值，不删除其他类型设置。
6. 在现有“Channel Extra Settings”区块的 `fieldset` 内增加一个 `FormField`，复用 `Switch`、`FormItem`、`FormLabel`、`FormDescription` 和现有 `sideDrawerSwitchItemClassName`。
7. 继续受 `sensitiveLocked` 控制，不另设权限逻辑；保存请求沿用既有渠道表单提交路径。
8. 文案必须使用 `t()`，至少包含用户指定的中文语义“禁止游乐场调用”，并通过项目 i18n 脚本同步 en、zh、zh-TW、fr、ja、ru、vi 七种语言。
9. 不新增重复的开关组件或自定义弹层控件；现有候选实现已在同一渠道编辑器中使用，直接复用即可。

### 4.2 游乐场模型请求

修改：

- `web/src/features/playground/api.ts`
- `web/src/features/playground/hooks/use-playground-options.ts`（仅在需要调整查询契约或 query key 时修改）

实施要求：

- `getUserModels(group)` 请求参数增加 `playground: true`。
- 查询 key 继续以当前分组区分；如 API 参数结构封装发生变化，确保切换分组会重新请求。
- 现有模型回退和当前模型清空逻辑保持不变：过滤后模型为空时不伪造模型，当前模型不可用时按现有逻辑清空。
- 不修改 `web/src/lib/api.ts` 中供 `/keys`、Dashboard 使用的 `getUserModels()`。
- 不修改分组请求；游乐场仍从现有分组接口获得完整分组列表。

### 4.3 国际化

- 使用现有扁平 locale key 约定。
- 新增 label 和必要的简短描述时，必须通过 `web/scripts/add-missing-keys.mjs` 写入所有 locale，再运行项目规定的 i18n 同步流程。
- 不直接手工编辑 `web/src/i18n/locales/*.json`。
- 具体翻译应保持“阻止该渠道被 Playground 选择”的含义，避免写入内部 JSON 字段名或价格等技术信息。

## 5. 文件影响范围

### 计划修改

- `relaykit/dto/channel_settings.go`
- `dto/channel_constraints.go`
- `model/channel_constraint.go`
- `model/ability.go`
- `model/channel_cache.go`（仅当共享缓存过滤辅助需要最小调整；不改变缓存的普通能力语义）
- `service/group.go`
- `service/channel_select.go`（仅当添加过滤条件的调用需要集中封装）
- `middleware/distributor.go`
- `controller/user.go`
- `web/src/features/channels/types.ts`
- `web/src/features/channels/lib/channel-form.ts`
- `web/src/features/channels/components/drawers/channel-mutate-drawer.tsx`
- `web/src/features/playground/api.ts`
- `web/src/i18n/static-keys.ts`（若当前项目的静态 key 提取流程要求登记）
- `web/src/i18n/locales/*.json`（仅通过 i18n 脚本生成）

### 不应修改

- `/keys` 和 Dashboard 的用户模型请求契约及其业务过滤逻辑。
- 全局 `abilities` 数据的启用状态、渠道分组字段、渠道状态、优先级和权重。
- `web/src/features/playground/components/input` 的模型/分组选择器结构；现有选择器已能处理模型空列表。
- 数据库 schema、迁移文件和 `relaykit` 对根模块的依赖关系。
- 受项目治理保护的 `new-api`、`QuantumNous` 等身份信息。

## 6. 实施步骤与完成判据

### Step 1：增加共享设置字段

- 修改 `relaykit/dto/channel_settings.go` 和前端对应类型。
- 完成判据：旧 JSON 缺失字段时读取为 `false`，新 JSON 可保存 `true`，不丢失已有设置。

### Step 2：接入统一渠道过滤

- 增加 Playground 过滤类型和判断逻辑，覆盖内存缓存与数据库选择路径。
- 在 `/pg/chat/completions` 处理前添加过滤约束。
- 完成判据：游乐场请求选择渠道时禁止渠道始终被排除；非游乐场请求未添加约束。

### Step 3：隔离游乐场模型列表

- 增加 Playground 专用模型聚合函数。
- 在 `GetUserModels` 中仅对 `playground=true` 使用该函数。
- 完成判据：同一模型存在允许/禁止渠道时仍返回；只有禁止渠道时不返回；分组接口不变。

### Step 4：完成渠道编辑器开关

- 接入表单 schema、默认值、编辑回显、保存序列化和“渠道额外设置”布局。
- 通过 i18n 脚本补齐七种语言。
- 完成判据：新建默认关闭、编辑可回显、切换后保存值稳定，敏感锁定状态与其他开关一致。

### Step 5：游乐场请求携带显式参数

- 修改 Playground 专用 `getUserModels` 请求，添加 `playground=true`。
- 完成判据：游乐场触发过滤，`/keys`、Dashboard 和其他共享调用不触发过滤。

### Step 6：开发者手动验证与交付记录

- AI 不编写测试脚本，不执行测试、类型检查、lint、格式化检查、构建或服务启动验证。
- 完成代码后向开发者提供手动验证矩阵和未执行检查清单；由开发者验证后自行记录结果。

## 7. 手动验证计划（由开发者执行）

### 7.1 配置与兼容性

1. 新建渠道：确认“禁止游乐场调用”默认关闭。
2. 开启并保存：重新编辑确认开关为开启；关闭并保存后确认恢复关闭。
3. 使用没有 `disable_playground` 的旧渠道 JSON：确认编辑面板显示关闭且其他设置不丢失。
4. 在敏感设置锁定账号下打开编辑器：确认该开关与其他敏感设置一样不可编辑；非敏感字段行为保持原状。

### 7.2 游乐场模型列表

准备同一用户分组下的多个启用渠道：

- 允许渠道和禁止渠道共同提供模型 1；
- 仅禁止渠道提供模型 2；
- 仅允许渠道提供模型 3；
- 一个分组下全部渠道均禁止。

逐项确认：

- 游乐场请求 `/api/user/models?group=...&playground=true` 返回模型 1、模型 3，不返回模型 2。
- 全部禁止的分组仍出现在 `/api/user/self/groups`，但其游乐场模型列表为空。
- 不带 `playground=true` 的 `/api/user/models` 仍返回原有模型集合。
- `/keys`、Dashboard 使用的模型列表仍包含原有模型，不受该配置影响。

### 7.3 实际调用隔离

1. 允许/禁止渠道同时提供同一模型时，在游乐场多次发起请求，确认日志或上游请求只落到允许渠道。
2. 直接提交一个仅由禁止渠道提供的模型到 `/pg/chat/completions`，确认服务端返回现有无可用渠道错误，不调用禁止渠道。
3. 检查首选渠道亲和性、重试和自动分组场景，确认不会绕过过滤回退到禁止渠道。
4. 使用普通 API 请求调用同一分组和模型，确认禁止配置不影响普通 API 路由。

### 7.4 数据库兼容性

由于本功能复用现有文本 JSON 字段和能力查询，开发者仍需按项目要求在实际 SQLite、MySQL 和 PostgreSQL 环境验证：

- 新旧渠道 JSON 均可读写；
- 启动/缓存刷新后配置生效；
- 模型列表与渠道选择结果一致；
- 不带 `playground=true` 的既有查询结果不变。

## 8. 风险与回滚

- **风险：缓存中的渠道设置未及时刷新**。沿用渠道更新后的既有缓存刷新路径；若发现旧缓存仍生效，先刷新渠道缓存再判断，不修改全局能力数据。
- **风险：模型列表和实际选择过滤不一致**。两处均复用 `ChannelSatisfiesFilters` 的 Playground 条件，并由手动验证覆盖内存缓存关闭/开启路径。
- **风险：共享 `/api/user/models` 误影响 `/keys` 或 Dashboard**。通过显式 `playground=true` 分支隔离，默认分支保留旧逻辑。
- **回滚：**删除前端参数和开关、移除 Playground 过滤条件即可恢复原行为；`channels.settings` 中遗留的未知 JSON 字段不影响旧代码读取。

## 9. 文档与验证状态

- PRD：已实现，见 `docs/prd/07-playground-channel-block.md`。
- 开发计划：已实施，待开发者手动验证。
- 测试制度：已确认禁止 AI 编写测试脚本和执行程序验证；本次实现未运行测试、typecheck、lint、build 或启动服务。
- 业务代码已修改；未启动开发服务、数据库或容器。
