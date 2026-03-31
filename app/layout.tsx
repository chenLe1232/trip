import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HTML 后台路由管理",
  description: "上传 HTML 并按路由发布"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
