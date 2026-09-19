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

## 后端容器更新提醒

- 只要本次改动包含后端 Go 代码、后端配置、数据库迁移或其他会被 `new-api` 镜像打包的内容，完成改动说明时必须主动提醒开发者重新构建并重启后端容器：

  ```bash
  docker compose -f docker-compose.dev.yml up -d --build new-api
  ```

- 必须明确说明：如果开发者没有执行上述命令，正在运行的后端容器可能仍是旧版本，无法反映当前工作区的后端改动。
- 仅修改前端且前端使用开发服务器热更新时，不需要提醒重建 `new-api` 后端容器；如果前端由镜像提供，则另行提醒重建对应的前端服务。

## 上传 docker 镜像

```bash
# 先登录 dockerhub
docker login

# 构建镜像 - 别忘了更新版本号，此处 1.0.1 仅示例
docker build --platform linux/amd64 -t sonve/new-api:1.0.1 -t sonve/new-api:latest .

# 上传镜像 - 别忘了更新版本号，此处 1.0.1 仅示例
docker push sonve/new-api:1.0.1
docker push sonve/new-api:latest

# 服务器上拉取镜像
docker compose pull

# 服务器上构建镜像
docker compose up -d --no-build --force-recreate
```