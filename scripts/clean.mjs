import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

await fs.rm(path.join(root, "dist"), { recursive: true, force: true });
await fs.rm(path.join(root, ".eleventy-cache"), { recursive: true, force: true });

console.log("已清理 dist 和 .eleventy-cache");
