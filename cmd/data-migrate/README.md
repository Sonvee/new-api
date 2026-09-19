# 数据迁移

## 使用步骤

### 1. 旧服务器导出数据库

```bash
cd /旧项目目录
docker compose stop new-api
docker compose exec -T postgres pg_dump -U root -d new-api > /root/new-api-legacy.sql
```

### 2. 上传文件到新服务器

上传以下两个文件：

```text
/root/new-api-legacy.sql
cmd/data-migrate/migrate.sh
```

将 `migrate.sh` 放到新服务器项目根目录：

```text
/www/wwwroot/dk_project/new-api/migrate.sh
```

### 3. 新服务器执行迁移

```bash
cd /www/wwwroot/dk_project/new-api
chmod +x migrate.sh
./migrate.sh --dump /root/new-api-legacy.sql
```

### 4. 完成标准

看到 `verify` 全部通过，并且新版应用正常启动，迁移完成。

不要直接复制或替换 PostgreSQL 存储卷。
