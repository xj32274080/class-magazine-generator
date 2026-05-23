import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import Eleventy from "@11ty/eleventy";

const root = process.cwd();
const app = express();
const port = Number(process.env.PORT ?? 5177);
const articlesPath = path.join(root, "data", "articles.json");
const columnsPath = path.join(root, "data", "columns.json");

app.use(express.json({ limit: "10mb" }));
app.use("/admin", express.static(path.join(root, "admin")));
app.use("/media", express.static(path.join(root, "data", "media")));

app.get("/", (_request, response) => response.redirect("/admin/"));

app.get("/api/articles", async (_request, response) => {
  const [articles, columns] = await Promise.all([
    readJson(articlesPath, []),
    readJson(columnsPath, [])
  ]);
  response.json({ articles, columns });
});

app.post("/api/articles", async (request, response) => {
  const articles = sanitizeArticles(request.body.articles);
  await fs.writeFile(articlesPath, `${JSON.stringify(articles, null, 2)}\n`, "utf8");
  response.json({ ok: true, count: articles.length });
});

app.post("/api/build", async (_request, response) => {
  try {
    const elev = new Eleventy("src", "dist", {
      configPath: path.join(root, ".eleventy.js")
    });
    const results = await elev.write();
    response.json({
      ok: true,
      count: results.length,
      message: `生成完成：${results.length} 个文件已写入 dist。`
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error.message,
      stack: error.stack
    });
  }
});

app.listen(port, "127.0.0.1", () => {
  console.log(`管理页已启动：http://127.0.0.1:${port}/admin/`);
  console.log("所有数据仅在本机读写。发布前请逐篇勾选“已审查并入选”。");
});

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

function sanitizeArticles(articles) {
  if (!Array.isArray(articles)) return [];
  return articles.map((article) => ({
    id: String(article.id ?? ""),
    sourceFile: String(article.sourceFile ?? ""),
    title: String(article.title ?? "").trim(),
    author: String(article.author ?? "").trim(),
    column: String(article.column ?? "佳作欣赏").trim(),
    html: String(article.html ?? ""),
    images: Array.isArray(article.images) ? article.images.map(String) : [],
    selected: Boolean(article.selected),
    anonymous: Boolean(article.anonymous),
    privacyReview: Boolean(article.privacyReview),
    updatedAt: new Date().toISOString()
  }));
}
