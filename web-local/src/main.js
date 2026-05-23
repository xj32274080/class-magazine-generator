import mammoth from "mammoth/mammoth.browser";
import appCss from "./styles.css?raw";
import "./styles.css";

const COLUMNS = ["校园生活", "成长故事", "自然观察", "想象天地", "读后感", "佳作欣赏"];
const STORAGE_KEY = "class-magazine-web-local-v1";

const state = {
  articles: loadArticles(),
  activeView: "manage",
  status: "选择 .docx 后，作文会在浏览器本地解析，不会上传。"
};

const app = document.querySelector("#app");

render();

function render() {
  app.innerHTML = `
    <header class="app-header">
      <div>
        <p>Browser Local Edition</p>
        <h1>班级作文杂志生成器</h1>
      </div>
      <nav aria-label="视图切换">
        ${navButton("manage", "管理")}
        ${navButton("magazine", "杂志预览")}
        ${navButton("print", "打印版")}
      </nav>
    </header>
    <main class="shell">
      <section class="privacy-banner">
        <strong>本地处理：</strong> 所有 .docx 只在当前浏览器中读取。页面不会上传作文、图片或学生信息。
      </section>
      <section class="toolbar">
        <label class="file-picker"><input id="docxInput" type="file" accept=".docx" multiple><span>选择 .docx</span></label>
        <button id="exportJson" type="button">导出项目 JSON</button>
        <label class="ghost-picker"><input id="importJson" type="file" accept="application/json,.json"><span>导入项目 JSON</span></label>
        <button id="exportHtml" type="button">导出杂志 HTML</button>
        <button id="clearAll" type="button" class="danger">清空本机数据</button>
      </section>
      <p class="status">${escapeHtml(state.status)}</p>
      ${state.activeView === "manage" ? renderManage() : ""}
      ${state.activeView === "magazine" ? renderMagazine() : ""}
      ${state.activeView === "print" ? renderPrint() : ""}
    </main>
  `;

  bindGlobalEvents();
  if (state.activeView === "manage") bindEditorEvents();
}

function navButton(view, label) {
  const active = state.activeView === view ? " aria-current=\"page\"" : "";
  return `<button data-view="${view}" type="button"${active}>${label}</button>`;
}

function bindGlobalEvents() {
  app.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeView = button.dataset.view;
      render();
    });
  });

  app.querySelector("#docxInput").addEventListener("change", async (event) => {
    await importDocxFiles([...event.target.files]);
  });
  app.querySelector("#exportJson").addEventListener("click", exportJson);
  app.querySelector("#importJson").addEventListener("change", importJson);
  app.querySelector("#exportHtml").addEventListener("click", exportHtml);
  app.querySelector("#clearAll").addEventListener("click", clearAll);
}

async function importDocxFiles(files) {
  const docxFiles = files.filter((file) => file.name.toLowerCase().endsWith(".docx"));
  const skipped = files.filter((file) => !file.name.toLowerCase().endsWith(".docx"));
  if (docxFiles.length === 0) {
    setStatus("没有可导入的 .docx 文件。旧版 .doc 请先用 Word/WPS 另存为 .docx。");
    return;
  }

  setStatus(`正在本地解析 ${docxFiles.length} 个 .docx...`);
  const imported = [];
  for (const file of docxFiles) {
    const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    const article = extractArticle(result.value, file.name);
    imported.push({
      id: stableId(`${file.name}:${file.size}:${file.lastModified}`),
      sourceFile: file.name,
      title: article.title,
      author: article.author,
      column: "佳作欣赏",
      html: article.html,
      images: article.images,
      selected: false,
      anonymous: false,
      privacyReview: false,
      updatedAt: new Date().toISOString()
    });
  }

  const existing = new Map(state.articles.map((article) => [article.id, article]));
  for (const article of imported) existing.set(article.id, { ...existing.get(article.id), ...article });
  state.articles = [...existing.values()];
  persist();
  setStatus(`已导入 ${imported.length} 篇作文${skipped.length ? `；跳过 ${skipped.length} 个非 .docx 文件` : ""}。默认不会发布，请逐篇勾选入选和隐私已审查。`);
}

function extractArticle(html, fileName) {
  const document = new DOMParser().parseFromString(`<main>${html}</main>`, "text/html");
  const main = document.querySelector("main");
  const blocks = [...main.querySelectorAll("h1,h2,h3,p")];
  const fallbackTitle = fileName.replace(/\.docx$/i, "");
  let title = "";
  let author = "";

  for (const node of blocks.slice(0, 6)) {
    const text = compactText(node.textContent);
    const authorMatch = text.match(/^(?:作者|姓名|学生|小作者)\s*[:：]\s*(.+)$/);
    if (authorMatch) {
      author = authorMatch[1].trim();
      node.remove();
      continue;
    }
    if (!title && (/^H[1-3]$/.test(node.tagName) || text.length <= 40)) {
      title = text;
      node.remove();
      continue;
    }
  }

  if (!title) title = fallbackTitle;
  if (!author) {
    const match = fallbackTitle.match(/[-_－—]\s*([^-_－—]+)$/);
    author = match ? match[1].trim() : "";
  }

  return {
    title,
    author,
    html: main.innerHTML.trim(),
    images: [...main.querySelectorAll("img")].map((image) => image.src)
  };
}

function renderManage() {
  if (state.articles.length === 0) {
    return `<section class="empty"><h2>还没有作文</h2><p>点击“选择 .docx”，一次选择多篇作文即可开始。</p></section>`;
  }
  return `
    <section class="review-summary">
      <div><strong>${state.articles.length}</strong><span>已导入</span></div>
      <div><strong>${publishedArticles().length}</strong><span>可发布</span></div>
      <div><strong>${state.articles.filter((item) => item.anonymous).length}</strong><span>匿名</span></div>
    </section>
    <section class="editor-list">${state.articles.map(renderEditor).join("")}</section>
  `;
}

function renderEditor(article, index) {
  return `
    <article class="editor-card" data-index="${index}">
      <div class="editor-fields">
        <label>标题<input data-field="title" value="${escapeAttr(article.title)}"></label>
        <label>作者<input data-field="author" value="${escapeAttr(article.author)}"></label>
        <label>栏目<select data-field="column">${COLUMNS.map((column) => `<option value="${column}" ${article.column === column ? "selected" : ""}>${column}</option>`).join("")}</select></label>
      </div>
      <div class="checks">
        <label><input data-field="selected" type="checkbox" ${article.selected ? "checked" : ""}> 入选</label>
        <label><input data-field="anonymous" type="checkbox" ${article.anonymous ? "checked" : ""}> 匿名发布</label>
        <label><input data-field="privacyReview" type="checkbox" ${article.privacyReview ? "checked" : ""}> 隐私已审查</label>
      </div>
      <details><summary>正文预览</summary><div class="essay-preview">${article.html}</div></details>
    </article>
  `;
}

function bindEditorEvents() {
  app.querySelectorAll(".editor-card").forEach((card) => {
    const article = state.articles[Number(card.dataset.index)];
    card.querySelectorAll("[data-field]").forEach((input) => {
      input.addEventListener("change", () => {
        article[input.dataset.field] = input.type === "checkbox" ? input.checked : input.value;
        article.updatedAt = new Date().toISOString();
        persist();
        updateStatusOnly("已保存到当前浏览器。");
      });
      input.addEventListener("input", () => {
        if (input.type === "checkbox") return;
        article[input.dataset.field] = input.value;
        persist();
      });
    });
  });
}

function renderMagazine() {
  const articles = publishedArticles();
  return `
    <section class="cover"><div><p>老师审定版</p><h2>班级作文在线杂志</h2><span>${articles.length} 篇入选作品</span></div></section>
    <section class="column-nav">${COLUMNS.filter((column) => articles.some((article) => article.column === column)).map((column) => `<a href="#${column}">${column}</a>`).join("")}</section>
    ${articles.length === 0 ? "<section class=\"empty\"><h2>暂无可发布文章</h2><p>请先勾选“入选”和“隐私已审查”。</p></section>" : ""}
    ${COLUMNS.map((column) => renderColumn(column, articles)).join("")}
  `;
}

function renderColumn(column, articles) {
  const items = articles.filter((article) => article.column === column);
  if (items.length === 0) return "";
  return `
    <section class="mag-section" id="${column}">
      <header><h2>${column}</h2><span>${items.length} 篇</span></header>
      <div class="cards">
        ${items.map((article) => `
          <article class="mag-card">
            ${article.images[0] ? `<img src="${article.images[0]}" alt="">` : ""}
            <p>${displayAuthor(article)}</p>
            <h3>${escapeHtml(article.title)}</h3>
            <div class="excerpt">${escapeHtml(stripHtml(article.html).slice(0, 120))}...</div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderPrint() {
  const articles = publishedArticles();
  return `
    <section class="print-actions"><button type="button" onclick="window.print()">浏览器打印 / 另存 PDF</button></section>
    <main class="newspaper">
      <header class="masthead"><p>Class Writing Gazette</p><h1>班级作文报</h1><div>本地生成 · 已审查入选作品</div></header>
      ${COLUMNS.map((column) => renderPrintColumn(column, articles)).join("")}
    </main>
  `;
}

function renderPrintColumn(column, articles) {
  const items = articles.filter((article) => article.column === column);
  if (items.length === 0) return "";
  return `
    <section class="print-section">
      <h2><span>${column}</span></h2>
      ${items.map((article) => `
        <article class="print-article">
          <h3>${escapeHtml(article.title)}</h3>
          <p class="byline">${displayAuthor(article)}</p>
          <div class="print-article__body">${article.html}</div>
        </article>
      `).join("")}
    </section>
  `;
}

function publishedArticles() {
  return state.articles.filter((article) => article.selected && article.privacyReview);
}

function displayAuthor(article) {
  if (article.anonymous) return "匿名";
  return article.author || "未署名";
}

function exportJson() {
  downloadFile("class-magazine-project.json", JSON.stringify({ articles: state.articles }, null, 2), "application/json");
}

async function importJson(event) {
  const file = event.target.files[0];
  if (!file) return;
  const data = JSON.parse(await file.text());
  state.articles = Array.isArray(data) ? data : data.articles ?? [];
  persist();
  setStatus(`已导入项目 JSON：${state.articles.length} 篇。`);
}

function exportHtml() {
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>班级作文在线杂志</title><style>${appCss}</style></head><body>${renderMagazine()}${renderPrint()}</body></html>`;
  downloadFile("class-magazine.html", html, "text/html");
}

function clearAll() {
  if (!confirm("确定清空当前浏览器里的作文数据吗？这不会删除你电脑上的 docx 文件。")) return;
  state.articles = [];
  persist();
  setStatus("已清空当前浏览器保存的数据。");
}

function downloadFile(fileName, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.articles));
}

function loadArticles() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function setStatus(message) {
  state.status = message;
  render();
}

function updateStatusOnly(message) {
  state.status = message;
  const status = app.querySelector(".status");
  if (status) status.textContent = message;
}

function stableId(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = Math.imul(31, hash) + value.charCodeAt(i) | 0;
  return Math.abs(hash).toString(36);
}

function compactText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function stripHtml(html) {
  const document = new DOMParser().parseFromString(html, "text/html");
  return compactText(document.body.textContent);
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("\"", "&quot;");
}
