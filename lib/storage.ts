import { promises as fs } from "node:fs";
import path from "node:path";
import { RouteConfig } from "./types";

const dataDir = path.join(process.cwd(), "data");
const uploadDir = path.join(dataDir, "uploads");
const dataFile = path.join(dataDir, "routes.json");

const ensureStorage = async () => {
  await fs.mkdir(uploadDir, { recursive: true });

  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, "[]", "utf-8");
  }
};

export const readRoutes = async (): Promise<RouteConfig[]> => {
  await ensureStorage();
  const raw = await fs.readFile(dataFile, "utf-8");

  try {
    const parsed = JSON.parse(raw) as RouteConfig[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const writeRoutes = async (routes: RouteConfig[]): Promise<void> => {
  await ensureStorage();
  await fs.writeFile(dataFile, JSON.stringify(routes, null, 2), "utf-8");
};

export const normalizePath = (value: string): string => {
  const withSlash = value.startsWith("/") ? value : `/${value}`;
  const compact = withSlash.replace(/\/{2,}/g, "/").trim();
  if (compact === "/") return "/";
  return compact.endsWith("/") ? compact.slice(0, -1) : compact;
};

export const writeUploadedHtml = async (fileName: string, html: string): Promise<string> => {
  await ensureStorage();
  const safeOriginal = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storedFileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeOriginal}`;
  await fs.writeFile(path.join(uploadDir, storedFileName), html, "utf-8");
  return storedFileName;
};

export const readUploadedHtml = async (storedFileName: string): Promise<string | null> => {
  try {
    const content = await fs.readFile(path.join(uploadDir, storedFileName), "utf-8");
    return content;
  } catch {
    return null;
  }
};

export const removeUploadedHtml = async (storedFileName: string): Promise<void> => {
  try {
    await fs.unlink(path.join(uploadDir, storedFileName));
  } catch {
    // ignore missing files
  }
};
