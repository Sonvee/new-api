# CUSTOM_RULES.md — custom 分支维护规则

本文件仅适用于 `custom` 分支及其派生分支，用于保持二次开发与上游代码长期同步。

## 分支职责

- `main` 是上游同步分支，只允许同步 `upstream/main`，不承载任何定制代码。
- `custom` 是定制开发主分支，所有二次开发最终合并到 `custom`。
- `feature/*` 是短期功能分支，应从 `custom` 创建，并在功能完成后合并回 `custom`。
- 不得将 `custom` 或其定制提交合并回 `main`。

## 同步上游

先更新 `main`，再将更新带入 `custom`：

```bash
git fetch upstream
git switch main
git merge --ff-only upstream/main
git push origin main
```

个人维护 `custom` 时，优先使用 Rebase：

```bash
git fetch origin
git switch custom
git branch backup/custom-YYYYMMDD
git rebase origin/main
git push --force-with-lease origin custom
```

多人共同维护 `custom` 时，使用 Merge，避免改写共享历史：

```bash
git fetch origin
git switch custom
git merge origin/main
git push origin custom
```

上游更新应尽早同步，避免长期积累差异。每次同步后，至少运行受影响模块的测试或构建。

## 二次开发原则

- 优先新增独立文件、模块、Adapter、Middleware、Hook、插件或配置扩展点，减少直接修改上游核心文件。
- 必须修改上游文件时，只保留必要改动，不进行无关格式化、重命名、移动或大范围重构。
- 每个提交只包含一个明确目的；不要把依赖升级、格式化和业务改动混在同一提交中。
- 定制逻辑应集中在边界清晰的目录或模块中，避免散落到多个上游文件。
- 对上游文件的修改应使用清晰的提交信息，便于 Rebase 时逐个识别和解决冲突。
- 定制功能应尽量通过配置或 Feature Flag 控制，避免改变上游默认行为。

## 冲突处理

- 冲突时先理解上游变更目的，再重新应用定制逻辑；不得简单选择一侧覆盖另一侧。
- 解决冲突后检查受影响功能、API、数据库迁移和前端构建。
- Rebase 前应创建备份分支；推送改写后的 `custom` 历史时必须使用 `--force-with-lease`，不得使用裸 `--force`。
- 不得通过 `merge=ours` 等方式静默忽略上游对同一文件的更新。

## 发布基线

- 生产部署和测试环境应明确使用 `custom` 或其发布标签，不得默认使用 `main`。
- 发布前确认当前提交包含所需的上游同步和定制功能，并保留可回滚的提交或标签。
