import { notFound } from "next/navigation";
import { readRoutes, readUploadedHtml } from "@/lib/storage";

type Params = {
  slug?: string[];
};

export default async function HtmlRoutePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const pathname = `/${(slug ?? []).join("/")}`;
  const routes = await readRoutes();
  const matched = routes.find((item) => item.path === pathname);

  if (!matched) {
    notFound();
  }

  const html = await readUploadedHtml(matched.storedFileName);
  if (!html) {
    notFound();
  }

  return (
    <main className="h-dvh w-full">
      <iframe
        title={`Uploaded HTML preview for ${pathname}`}
        srcDoc={html}
        className="h-full w-full border-0"
      />
    </main>
  );
}
