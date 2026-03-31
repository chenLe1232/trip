import { readdir, unlink } from "node:fs/promises";
import path from "node:path";

export const pruneUnusedUploads = async (uploadDir: string, referencedFiles: string[]): Promise<string[]> => {
  let files: string[];
  try {
    files = await readdir(uploadDir);
  } catch {
    return [];
  }

  const referenced = new Set(referencedFiles);
  const removed: string[] = [];

  for (const fileName of files) {
    if (referenced.has(fileName)) {
      continue;
    }

    try {
      await unlink(path.join(uploadDir, fileName));
      removed.push(fileName);
    } catch {
      // Ignore files that disappear between listing and deletion.
    }
  }

  return removed.sort();
};
