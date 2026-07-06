import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export function createLocalStore({ root = ".cache" } = {}) {
  async function ensureRoot() {
    await mkdir(root, { recursive: true });
  }

  function keyToPath(key) {
    return join(root, `${key.replace(/[^a-zA-Z0-9_.:-]/g, "_")}.json`);
  }

  async function getJson(key) {
    try {
      return JSON.parse(await readFile(keyToPath(key), "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  }

  async function putJson(key, value) {
    await ensureRoot();
    await writeFile(keyToPath(key), JSON.stringify(value, null, 2));
    return value;
  }

  return { getJson, putJson };
}
