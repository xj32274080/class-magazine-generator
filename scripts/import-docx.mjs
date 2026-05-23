import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";
import { JSDOM } from "jsdom";
import slugify from "slugify";

const root = process.cwd();
const inputDir = path.join(root, "input-docx");
const dataDir = path.join(root, "data");
const mediaDir = path.join(dataDir, "media");
const articlesPath = path.join(dataDir, "articles.json");

const DEFAULT_COLUMN = "佳作欣赏";

await fs.mkdir(inputDir, { recursive: true });
await fs.mkdir(mediaDir, { recursive: true });
await fs.mkdir(dataDir, { recursive: true });

const previousArticles = await readJson(articlesPath, []);
const previousBySource = new Map(previousArticles.map((article) => [article.sourceFile, article]));

const inputFiles = await fs.readdir(inputDir);
const legacyDocFiles = inputFiles
  .filter((file) => file.toLowerCase().endsWith(".doc") && !file.startsWith("~$"))
  .sort((a, b) => a.localeCompare(b, "zh-CN"));
const docxFiles = inputFiles
  .filter((file) => file.toLowerCase().endsWith(".docx") && !file.startsWith("~$"))
  .sort((a, b) => a.localeCompare(b, "zh-CN"));

const imported = [];

for (const fileName of docxFiles) {
  const sourcePath = path.join(inputDir, fileName);
  const sourceFile = path.relative(root, sourcePath).replaceAll("\\", "/");
  const baseName = path.basename(fileName, path.extname(fileName));
  const id = makeStableId(sourceFile);
  const imagePaths = [];
  let imageIndex = 0;

  const result = await mammoth.convertToHtml(
    { path: sourcePath },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        imageIndex += 1;
        const extension = contentTypeToExtension(image.contentType);
        const safeBase = slugify(baseName, { lower: true, strict: true }) || id;
        const outputName = `${safeBase}-${imageIndex}.${extension}`;
        const outputPath = path.join(mediaDir, outputName);
        const encoded = await image.read("base64");
        await fs.writeFile(outputPath, Buffer.from(encoded, "base64"));
        const publicPath = `/media/${outputName}`;
        imagePaths.push(publicPath);
        return { src: publicPath };
      })
    }
  );

  const extracted = extractArticle(result.value, baseName);
  const previous = previousBySource.get(sourceFile) ?? {};

  imported.push({
    id,
    sourceFile,
    title: previous.title ?? extracted.title,
    author: previous.author ?? extracted.author,
    column: previous.column ?? DEFAULT_COLUMN,
    html: extracted.html,
    images: imagePaths,
    selected: previous.selected ?? false,
    anonymous: previous.anonymous ?? false,
    privacyReview: previous.privacyReview ?? false,
    updatedAt: new Date().toISOString()
  });

  if (result.messages.length > 0) {
    console.warn(`导入 ${fileName} 时有提示：`);
    for (const message of result.messages) console.warn(`- ${message.message}`);
  }
}

await fs.writeFile(articlesPath, `${JSON.stringify(imported, null, 2)}\n`, "utf8");

console.log(`已导入 ${imported.length} 篇作文到 data/articles.json`);
console.log("默认 selected=false，请老师在管理页确认后再发布。");
if (legacyDocFiles.length > 0) {
  console.warn(`发现 ${legacyDocFiles.length} 个 .doc 文件未导入。Mammoth.js 只支持 .docx，请用 Word/WPS 另存为 .docx 后再运行 npm run import：`);
  for (const file of legacyDocFiles) console.warn(`- ${file}`);
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

function makeStableId(value) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 12);
}

function contentTypeToExtension(contentType = "") {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("svg")) return "svg";
  return "jpg";
}

function extractArticle(html, fallbackTitle) {
  const dom = new JSDOM(`<main>${html}</main>`);
  const document = dom.window.document;
  const main = document.querySelector("main");
  const blocks = [...main.querySelectorAll("h1,h2,h3,p")];

  let title = firstText(blocks.find((node) => /^H[1-3]$/.test(node.tagName))) || "";
  let author = "";

  for (const node of blocks.slice(0, 5)) {
    const text = firstText(node);
    const authorMatch = text.match(/^(?:作者|姓名|学生|小作者)\s*[:：]\s*(.+)$/);
    if (authorMatch) {
      author = authorMatch[1].trim();
      node.remove();
      continue;
    }
    if (!title && text.length > 0 && text.length <= 40) {
      title = text;
      node.remove();
      continue;
    }
    if (title && /^H[1-3]$/.test(node.tagName) && text === title) {
      node.remove();
    }
  }

  if (!author) {
    const fileMatch = fallbackTitle.match(/[-_－—]\s*([^-_－—]+)$/);
    author = fileMatch ? fileMatch[1].trim() : "";
  }

  return {
    title: title || fallbackTitle,
    author,
    html: main.innerHTML.trim()
  };
}

function firstText(node) {
  return node?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}
