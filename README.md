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
