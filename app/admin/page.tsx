"use client";

import { ChangeEvent, DragEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RouteConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

type ApiRoutesResponse = {
  routes: RouteConfig[];
};

type RouteDetailResponse = {
  route: RouteConfig;
  html: string;
};

export default function AdminPage() {
  const router = useRouter();
  const [pathValue, setPathValue] = useState("/demo");
  const [file, setFile] = useState<File | null>(null);
  const [routes, setRoutes] = useState<RouteConfig[]>([]);
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [dragActive, setDragActive] = useState(false);

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

  const isHtmlFile = (selected: File): boolean => {
    const lowerName = selected.name.toLowerCase();
    return lowerName.endsWith(".html") || selected.type === "text/html";
  };

  const setSelectedFile = (selected: File | null) => {
    if (!selected) {
      return;
    }

    if (!isHtmlFile(selected)) {
      setStatus("仅支持上传 .html 文件");
      setFile(null);
      return;
    }

    setFile(selected);
    setStatus(`已选择文件 ${selected.name}`);
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(event.target.files?.[0] ?? null);
  };

  const onDropFile = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragActive(false);
    setSelectedFile(event.dataTransfer.files?.[0] ?? null);
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

  const deleteRoute = async (id: string, path: string) => {
    const confirmed = window.confirm(`确定删除路由 ${path} 吗？\n删除后将无法恢复。`);
    if (!confirmed) {
      return;
    }

    const res = await fetch(`/api/routes?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      setStatus("删除失败");
      return;
    }

    if (previewId === id) {
      setPreviewId(null);
      setPreviewHtml("");
    }

    setStatus("路由和本地文件已删除");
    await loadRoutes();
  };

  const togglePreview = async (id: string) => {
    if (previewId === id) {
      setPreviewId(null);
      setPreviewHtml("");
      return;
    }

    setPreviewing(true);
    const res = await fetch(`/api/routes?id=${id}`, { cache: "no-store" });
    setPreviewing(false);

    if (!res.ok) {
      setStatus("读取配置内容失败");
      return;
    }

    const data = (await res.json()) as RouteDetailResponse;
    setPreviewId(data.route.id);
    setPreviewHtml(data.html);
  };

  const copyPreviewHtml = async () => {
    if (!previewHtml) {
      setStatus("当前没有可复制的 HTML 内容");
      return;
    }

    try {
      await navigator.clipboard.writeText(previewHtml);
      setStatus("HTML 已复制到剪贴板");
    } catch {
      setStatus("复制失败，请检查浏览器剪贴板权限");
    }
  };

  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">HTML 后台管理</h1>
        <Button onClick={logout} type="button" variant="outline">
          退出登录
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>上传配置</CardTitle>
          <CardDescription>支持点击或拖拽上传，仅允许 HTML 文件。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-2">
            <Label
              htmlFor="upload"
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDropFile}
              className={cn(
                "flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-4 text-center text-sm",
                dragActive ? "border-zinc-900 bg-zinc-50" : "border-zinc-300"
              )}
            >
              <span className="font-medium">拖拽 HTML 文件到这里</span>
              <span className="mt-1 text-xs text-zinc-500">或点击选择（仅 .html）</span>
              <Input id="upload" type="file" accept=".html,text/html" onChange={onFileChange} className="hidden" />
            </Label>
            <p className="text-xs text-zinc-500">已选：{file?.name ?? "未选择文件"}</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="path">访问路径（例如 /about）</Label>
            <Input id="path" value={pathValue} onChange={(e) => setPathValue(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={uploading} onClick={saveRoute} type="button">
              {uploading ? "保存中..." : "保存路由"}
            </Button>
            {status ? <p className="text-sm text-zinc-600">{status}</p> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>已配置路由</CardTitle>
          <CardDescription>支持打开、查看配置内容、删除（带二次确认）。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {routes.map((item) => (
            <div key={item.id} className="rounded-lg border p-4">
              <p className="font-medium">{item.path}</p>
              <p className="text-sm text-zinc-500">原文件：{item.fileName}</p>
              <p className="text-xs text-zinc-500">服务器文件：{item.storedFileName}</p>
              <p className="text-xs text-zinc-500">更新时间：{item.updatedAt}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }))} href={item.path} target="_blank">
                  访问
                </Link>
                <a
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  href={`/api/routes/download?id=${item.id}`}
                >
                  下载 HTML
                </a>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={previewing}
                  onClick={() => togglePreview(item.id)}
                >
                  {previewId === item.id ? "收起内容" : "查看配置内容"}
                </Button>
                <Button type="button" variant="destructive" size="sm" onClick={() => deleteRoute(item.id, item.path)}>
                  删除（需确认）
                </Button>
              </div>
              {previewId === item.id ? (
                <div className="mt-3 space-y-2">
                  <div className="flex justify-end">
                    <Button type="button" variant="outline" size="sm" onClick={copyPreviewHtml}>
                      复制 HTML
                    </Button>
                  </div>
                  <pre className="max-h-72 overflow-auto rounded-md border bg-zinc-950 p-3 text-xs text-zinc-100">
                    {previewHtml}
                  </pre>
                </div>
              ) : null}
            </div>
          ))}
          {routes.length === 0 ? <p className="text-sm text-zinc-500">暂无路由配置</p> : null}
        </CardContent>
      </Card>
    </main>
  );
}
