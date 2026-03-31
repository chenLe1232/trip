import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  normalizePath,
  readRoutes,
  removeUploadedHtml,
  writeRoutes,
  writeUploadedHtml
} from "@/lib/storage";

const reservedPaths = new Set(["/", "/admin", "/login"]);

export async function GET() {
  const routes = await readRoutes();
  return NextResponse.json({ routes });
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const pathValue = String(formData.get("path") ?? "");
  const upload = formData.get("file");

  if (!upload || !(upload instanceof File)) {
    return NextResponse.json({ message: "missing html file" }, { status: 400 });
  }

  const normalized = normalizePath(pathValue);
  if (
    !normalized.startsWith("/") ||
    normalized.startsWith("/api") ||
    normalized.startsWith("/_next") ||
    reservedPaths.has(normalized)
  ) {
    return NextResponse.json({ message: "invalid path" }, { status: 400 });
  }

  const html = await upload.text();
  if (!html.trim()) {
    return NextResponse.json({ message: "empty html content" }, { status: 400 });
  }

  const routes = await readRoutes();
  const found = routes.find((item) => item.path === normalized);
  const storedFileName = await writeUploadedHtml(upload.name || "uploaded.html", html);

  if (found) {
    await removeUploadedHtml(found.storedFileName);
    found.fileName = upload.name || "uploaded.html";
    found.storedFileName = storedFileName;
    found.updatedAt = new Date().toISOString();
  } else {
    routes.push({
      id: randomUUID(),
      path: normalized,
      fileName: upload.name || "uploaded.html",
      storedFileName,
      updatedAt: new Date().toISOString()
    });
  }

  await writeRoutes(routes);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ message: "missing id" }, { status: 400 });
  }

  const routes = await readRoutes();
  const found = routes.find((item) => item.id === id);
  if (!found) {
    return NextResponse.json({ message: "not found" }, { status: 404 });
  }

  await removeUploadedHtml(found.storedFileName);
  const next = routes.filter((item) => item.id !== id);
  await writeRoutes(next);
  return NextResponse.json({ ok: true });
}
