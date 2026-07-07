import { promises as fs } from "node:fs";
import path from "node:path";

export async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readJsonIfExists(filePath, fallback) {
  if (!(await pathExists(filePath))) return fallback;
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

export async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function listFiles(dirPath, predicate = () => true) {
  if (!(await pathExists(dirPath))) return [];

  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) return listFiles(entryPath, predicate);
      if (entry.isFile() && predicate(entryPath)) return [entryPath];
      return [];
    }),
  );

  return files.flat().sort();
}
