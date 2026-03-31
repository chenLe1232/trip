import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const importCleanupModule = async () => {
  const modulePath = pathToFileURL(path.join(process.cwd(), "lib", "upload-cleanup.ts")).href;
  return import(modulePath);
};

test("pruneUnusedUploads removes orphaned files and keeps referenced files", async () => {
  const { pruneUnusedUploads } = await importCleanupModule();
  const root = await mkdtemp(path.join(tmpdir(), "trip-upload-cleanup-"));
  const uploadDir = path.join(root, "uploads");
  await mkdir(uploadDir, { recursive: true });

  await writeFile(path.join(uploadDir, "keep-a.html"), "<h1>a</h1>", "utf8");
  await writeFile(path.join(uploadDir, "keep-b.html"), "<h1>b</h1>", "utf8");
  await writeFile(path.join(uploadDir, "orphan.html"), "<h1>old</h1>", "utf8");

  const removed = await pruneUnusedUploads(uploadDir, ["keep-a.html", "keep-b.html"]);
  const files = (await readdir(uploadDir)).sort();

  assert.deepEqual(removed, ["orphan.html"]);
  assert.deepEqual(files, ["keep-a.html", "keep-b.html"]);
  assert.equal(await readFile(path.join(uploadDir, "keep-a.html"), "utf8"), "<h1>a</h1>");
});
