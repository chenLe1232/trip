import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { readRoutes } from "@/lib/storage";
import { cn } from "@/lib/utils";

export default async function Home() {
  const routes = await readRoutes();

  return (
    <main className="min-h-screen bg-white">
      <header className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur">
        <nav className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-3">
          <span className="mr-1 text-sm font-semibold">Trip</span>
          <Link className={cn(buttonVariants({ variant: "ghost", size: "sm" }))} href="#home">
            首页
          </Link>
          <Link className={cn(buttonVariants({ variant: "ghost", size: "sm" }))} href="#uploaded">
            上传页面
          </Link>
          <Link className={cn(buttonVariants({ variant: "ghost", size: "sm" }))} href="#about">
            关于
          </Link>
        </nav>
      </header>

      <section id="home" className="mx-auto w-full max-w-6xl px-4 pb-10 pt-20">
        <p className="mb-3 inline-flex rounded-full border px-3 py-1 text-xs text-zinc-500">Route Publishing</p>
        <h1 className="text-4xl font-semibold tracking-tight">上传 HTML，一键按路径发布</h1>
        <p className="mt-3 max-w-2xl text-sm text-zinc-500">
          已上传的路由会自动展示在下方菜单中，便于访问和验证。
        </p>
      </section>

      <section id="uploaded" className="mx-auto w-full max-w-6xl px-4 pb-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold tracking-tight">已上传页面菜单</h2>
          <span className="text-sm text-zinc-500">共 {routes.length} 个</span>
        </div>

        {routes.length === 0 ? (
          <p className="text-sm text-zinc-500">暂无上传页面，请前往管理后台上传。</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {routes.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <CardDescription>路径</CardDescription>
                  <CardTitle>{item.path}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-zinc-500">源文件：{item.fileName}</p>
                  <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }))} href={item.path}>
                    打开页面
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section id="about" className="mx-auto w-full max-w-6xl px-4 pb-16">
        <h2 className="text-2xl font-semibold tracking-tight">说明</h2>
        <p className="mt-3 text-sm text-zinc-500">
          后台支持上传、查看和删除路由配置。删除时会二次确认，并同时删除服务器上的对应文件。
        </p>
      </section>
    </main>
  );
}
