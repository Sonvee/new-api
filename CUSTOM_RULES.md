# CUSTOM_RULES.md — custom 分支维护规则

本文件仅适用于 `custom` 分支及其派生分支，用于保持二次开发与上游代码长期同步。

## 分支职责

- `main` 是上游同步分支，只允许同步 `upstream/main`，不承载任何定制代码。
- `custom` 是定制开发主分支，所有二次开发最终合并到 `custom`。
- `feature/*` 是短期功能分支，应从 `custom` 创建，并在功能完成后合并回 `custom`。
- 不得将 `custom` 或其定制提交合并回 `main`。

## 同步官方代码

`main` 只用于跟踪官方代码，`custom` 才是定制开发分支。不要把定制提交合并回 `main`。

### 更新本地 `main`

在 GitHub Fork 页面完成 **Sync fork** 后，再在本地获取远程最新代码：

```bash
git fetch origin --prune
git switch main
git pull --ff-only origin main
```

如果 `main` 有未提交修改，先停止操作并处理工作区，不要直接覆盖本地修改。

### 将官方更新带入 `custom`

个人维护或可以改写远程历史时，推荐使用 Rebase。同步前先确认工作区干净，并创建备份分支：

```bash
git switch custom
git status --short --branch
git branch backup/custom-before-sync-YYYYMMDD
git rebase origin/main
```

Rebase 会自动重放定制提交；只有官方代码与定制代码实际修改了同一处时，才需要手动解决冲突，不需要每次重新手工合并所有定制功能。

发生冲突时：

```bash
# 查看冲突文件
git status

# 编辑文件，保留官方更新并重新应用必要的定制逻辑
git add <已解决的文件>
git rebase --continue
```

如果确认本次同步不应继续：

```bash
git rebase --abort
```

Rebase 完成后，检查冲突标记并运行受影响的测试或构建：

```bash
git grep -n -E '^(<<<<<<<|=======|>>>>>>>)'
```

由于 Rebase 会改写 `custom` 的提交历史，推送时必须使用：

```bash
git push --force-with-lease origin custom
```

禁止使用裸 `git push --force`。

如果 `custom` 由多人共同维护且不能改写远程历史，则改用 Merge：

```bash
git switch custom
git fetch origin --prune
git merge origin/main
git push origin custom
```

Merge 会保留原有提交历史，但可能产生一个合并提交。无论使用 Rebase 还是 Merge，都应尽早同步官方更新，避免一次性积累大量冲突。

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