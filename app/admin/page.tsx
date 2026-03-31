"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RouteConfig } from "@/lib/types";

type ApiRoutesResponse = {
  routes: RouteConfig[];
};

export default function AdminPage() {
  const router = useRouter();
  const [pathValue, setPathValue] = useState("/demo");
  const [file, setFile] = useState<File | null>(null);
  const [routes, setRoutes] = useState<RouteConfig[]>([]);
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState(false);

  const loadRoutes = async () => {
    const res = await fetch("/api/routes", { cache: "no-store" });
    if (!res.ok) {
      setStatus("读取路由失败，请重新登录");
      return;
    }

    const data = (await res.json()) as ApiRoutesResponse;
    setRoutes(data.routes);
  };

  useEffect(() => {
    loadRoutes();
  }, []);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    if (selected) {
      setStatus(`已选择文件 ${selected.name}`);
    }
  };

  const saveRoute = async () => {
    if (!file) {
      setStatus("请先选择 HTML 文件");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.set("path", pathValue);
    formData.set("file", file);

    const res = await fetch("/api/routes", {
      method: "POST",
      body: formData
    });

    setUploading(false);

    if (!res.ok) {
      setStatus("保存失败，请检查路径是否合法或文件内容是否为空");
      return;
    }

    setStatus(`路由 ${pathValue} 已保存，文件已落盘到服务器本地`);
    setFile(null);
    await loadRoutes();
  };

  const deleteRoute = async (id: string) => {
    const res = await fetch(`/api/routes?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      setStatus("删除失败");
      return;
    }

    setStatus("路由和本地文件已删除");
    await loadRoutes();
  };

  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <main className="container">
      <div className="row-between">
        <h1>HTML 后台管理</h1>
        <button onClick={logout} type="button">
          退出登录
        </button>
      </div>

      <section className="panel form">
        <label>
          上传 HTML 文件
          <input type="file" accept=".html,text/html" onChange={onFileChange} />
        </label>
        <p className="meta">已选：{file?.name ?? "未选择文件"}</p>
        <label>
          访问路径（例如 /about）
          <input value={pathValue} onChange={(e) => setPathValue(e.target.value)} />
        </label>
        <button disabled={uploading} onClick={saveRoute} type="button">
          {uploading ? "保存中..." : "保存路由"}
        </button>
        {status ? <p className="status">{status}</p> : null}
      </section>

      <section className="panel">
        <h2>已配置路由</h2>
        <div className="routes">
          {routes.map((item) => (
            <article key={item.id} className="route-item">
              <p>
                <strong>{item.path}</strong> ← 原文件：{item.fileName}
              </p>
              <p className="small">服务器文件：{item.storedFileName}</p>
              <p className="small">更新时间：{item.updatedAt}</p>
              <div className="row-buttons">
                <a href={item.path} target="_blank" rel="noreferrer">
                  访问
                </a>
                <button type="button" onClick={() => deleteRoute(item.id)}>
                  删除文件和路由
                </button>
              </div>
            </article>
          ))}
          {routes.length === 0 ? <p>暂无路由配置</p> : null}
        </div>
      </section>
    </main>
  );
}
