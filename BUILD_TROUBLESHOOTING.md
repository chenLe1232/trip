# Build Troubleshooting (Aliyun Codeup / 云效)

## 现象

如果在阿里云 Codeup/云效构建日志中看到类似报错：

- `Invariant: Expected relative import to start with "next/"`
- 路径中出现 `_next@15.x.x@next/dist/.../module.compiled`

这通常不是业务代码错误，而是**依赖安装器与 Next.js 15 的兼容性问题**。

## 根因

在部分环境中（尤其是未锁定依赖安装方式、未提交 lockfile 的场景），构建机会使用非标准的 node_modules 布局（例如 `_next@15.2.4@next`）。

Next.js 在构建时会校验内部相对导入路径，期望前缀是 `next/`，遇到上述目录命名后会触发 invariant 报错。

## 建议修复

1. **提交并使用 lockfile**（本仓库使用 npm，对应 `package-lock.json`）。
2. 在 CI 中显式使用：
   - `npm ci`
   - `npm run build`
3. 避免让平台回退到非标准安装器（或自动推断安装方式）。

## 关于 Codeup Webhook

如果你发现“Codeup Webhook 没有配置”，会导致：

- 代码推送后**可能不会自动触发**构建；
- 或触发链路不稳定，难以确认到底使用了哪个流水线模板/安装方式。

建议在 Codeup 仓库中补全 Webhook 到对应云效流水线，然后在流水线脚本里固定安装与构建命令（`npm ci && npm run build`）。


### 已提供的 Webhook 地址

你提供的 Codeup Webhook 地址为：

- `http://flow-openapi.aliyun.com/scm/webhook/LNInEMKX9Qe0HqAHny1F`

可在云效/Codeup 中将该地址配置为 push 事件触发器，确保每次提交后都走同一条流水线。

也可以在本地手动触发：

```bash
./scripts/trigger-codeup-webhook.sh
```

若需使用其他地址：

```bash
./scripts/trigger-codeup-webhook.sh <your_webhook_url>
```

## 额外说明

本仓库另有一个会导致构建失败的问题：`app/page.tsx` 中对 `/login` 使用了 `<a>`，会触发 Next ESLint 规则。已改为 `<Link>`。
