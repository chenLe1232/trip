import { NextRequest, NextResponse } from "next/server";
import { readRoutes, readUploadedHtml } from "@/lib/storage";

const buildContentDisposition = (fileName: string) => {
  const fallback = fileName.replace(/[^a-zA-Z0-9._-]/g, "_") || "download.html";
  const encoded = encodeURIComponent(fileName || "download.html");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
};

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ message: "missing id" }, { status: 400 });
  }

  const routes = await readRoutes();
  const found = routes.find((item) => item.id === id);
  if (!found) {
    return NextResponse.json({ message: "not found" }, { status: 404 });
  }

  const html = await readUploadedHtml(found.storedFileName);
  if (!html) {
    return NextResponse.json({ message: "html not found" }, { status: 404 });
  }

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": buildContentDisposition(found.fileName),
      "Cache-Control": "no-store"
    }
  });
}
