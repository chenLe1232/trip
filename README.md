# Trip 路由跳转管理（Next.js）

一个基于 **Next.js 15** 的轻量项目，用于在管理后台维护“路径 -> 目标地址/上传 HTML”规则，并在访问对应路径时进行跳转或返回页面内容。

## 功能简介

- 后台登录（默认账号密码见下文）
- 新增/编辑/删除路由规则
- 支持目标地址跳转
- 支持上传 HTML 并按路径返回
- 路由规则持久化到本地 `data/routes.json`

## 技术栈

- Next.js 15
- React 19
- TypeScript

## 本地开发

### 1) 安装依赖

```bash
npm ci
```

### 2) 启动开发环境

```bash
npm run dev
```

默认地址：`http://localhost:3000`

### 3) 登录后台

后台地址：`/login`

默认账号：

- 用户名：`admin`
- 密码：`123456`

> 建议上线前修改默认账号密码（见 `lib/auth.ts`）。

---

## 部署说明（你问的“这个项目怎么部署”）

下面给你两种最常见方式：

### 方案 A：Linux 服务器（手动 / 云主机）

适合阿里云 ECS、腾讯云 CVM、裸机等。

#### 前置要求

- Node.js 20+
- npm 10+
- 可写目录（用于 `data/routes.json` 和 `data/uploads`）

#### 部署步骤

```bash
# 1) 拉代码
git clone <your-repo-url>
cd trip

# 2) 安装依赖
npm ci

# 3) 构建
npm run build

# 4) 启动生产服务
npm run start
```

默认监听 `3000` 端口，可结合 Nginx 做反向代理。

#### systemd（可选）

可将 `npm run start` 配置成 systemd 服务，保证开机自启与异常重启。

---

### 方案 B：阿里云 Codeup / 云效流水线

项目已包含与此场景相关的排障文档：`BUILD_TROUBLESHOOTING.md`。

#### 推荐流水线命令

```bash
npm ci
npm run build
npm run start
```

#### 关键注意事项

- 一定要提交并使用 `package-lock.json`
- 流水线里固定使用 `npm ci`，避免安装器不一致导致 Next.js 15 构建异常
- 确认 Codeup Webhook 已正确配置

如果需要手动触发 webhook：

```bash
./scripts/trigger-codeup-webhook.sh
```

---

## 数据与持久化

本项目会在运行时写入：

- `data/routes.json`
- `data/uploads/*`

因此生产环境请确保：

1. 进程对 `data/` 有写权限
2. 容器化部署时将 `data/` 挂载为持久卷（否则重启后数据可能丢失）

## 常见问题

- 若构建报错涉及 `next/dist/...` 相对导入 invariant，请先看：`BUILD_TROUBLESHOOTING.md`
- 若 push 后没有自动构建，优先检查 Codeup Webhook 配置

## 项目脚本

```bash
npm run dev     # 开发
npm run build   # 生产构建
npm run start   # 启动生产服务
npm run lint    # 代码检查
```

---

## Docker 启动与部署（推荐服务器方式）

### 1) 准备 Docker 服务

你的服务器是用 systemd 管理 Docker，可先执行：

```bash
systemctl start docker
systemctl enable docker
```

### 2) 首次启动项目容器

```bash
docker compose build --pull
docker compose up -d
```

访问：`http://<服务器IP>:3000`

### 3) 目录说明

- `Dockerfile`：Next.js standalone 生产镜像构建
- `docker-compose.yml`：容器启动与端口映射（`3000:3000`）
- `data/` 挂载到容器 `/app/data`，用于持久化路由和上传文件

## 定时拉取远端代码并自动重启 Docker（PM2）

已提供脚本：

- `scripts/deploy-update.sh`：拉取远端代码；有变更则 `docker compose down/build/up -d`
- `scripts/pm2-auto-update.sh`：循环调用 `deploy-update.sh`
- `ecosystem.config.cjs`：PM2 启动配置

### PM2 启动方式

```bash
# 安装 PM2（若尚未安装）
npm i -g pm2

# 启动自动部署任务
pm2 start ecosystem.config.cjs

# 设置开机自启
pm2 startup
pm2 save
```

### 常用参数

可以在 `ecosystem.config.cjs` 里修改：

- `DEPLOY_BRANCH`：要跟踪的分支（默认 `main`）
- `DEPLOY_REMOTE`：远端名（默认 `origin`）
- `INTERVAL_SECONDS`：轮询间隔秒数（默认 `300`）
