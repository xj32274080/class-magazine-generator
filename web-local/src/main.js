import mammoth from "mammoth/mammoth.browser";
import appCss from "./styles.css?raw";
import "./styles.css";
import {
  DEFAULT_COLUMNS,
  DEFAULT_PUBLICATION_SETTINGS,
  buildExcerpt,
  escapeAttr,
  escapeHtml,
  getPublishedArticles,
  normalizeSettings,
  renderMagazineView,
  renderPrintNewspaperView,
  renderStandaloneHtml,
  stripHtml
} from "./renderers.mjs";

const STORAGE_KEY = "class-magazine-web-local-v2";
const LEGACY_STORAGE_KEY = "class-magazine-web-local-v1";

const state = loadProject();
const app = document.querySelector("#app");

syncDocumentTitle();
render();

function render() {
  if (state.activeView === "magazine") {
    renderPublication(renderMagazineView({
      articles: state.articles,
      settings: state.publicationSettings,
      columns: state.columns,
      activeArticleId: state.activeArticleId
    }));
    bindPublicationEvents();
    return;
  }

  if (state.activeView === "print") {
    renderPublication(renderPrintExportPage(renderPrintNewspaperView({
      articles: state.articles,
      settings: state.publicationSettings,
      columns: state.columns
    })));
    bindPrintPageEvents();
    return;
  }

  app.innerHTML = `
    <header class="app-header">
      <div>
        <p>本地整理学生作文，生成在线杂志与打印报纸</p>
        <h1>班级作文报刊生成器</h1>
      </div>
      <nav aria-label="视图切换">
        ${navButton("manage", "管理")}
        ${navButton("magazine", "在线杂志")}
        ${navButton("print", "打印报纸")}
      </nav>
    </header>
    <main class="app-shell">
      <section class="privacy-banner">
        <strong>本地处理：</strong> 所有 .docx 只在当前浏览器中读取。页面不会上传作文、图片或学生信息。
      </section>
      <section class="toolbar">
        <input id="docxInput" class="file-input" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple>
        <button id="chooseDocx" type="button">选择 .docx</button>
        <button id="exportJson" type="button">导出项目 JSON</button>
        <input id="importJson" class="file-input" type="file" accept="application/json,.json">
        <button id="chooseJson" class="ghost-button" type="button">导入项目 JSON</button>
        <button id="exportHtml" type="button">导出杂志 HTML</button>
        <button id="clearAll" type="button" class="danger">清空本机数据</button>
      </section>
      <p class="status">${escapeHtml(state.status)}</p>
      ${renderSettingsPanel()}
      ${renderManage()}
    </main>
  `;

  bindAppShellEvents();
  bindSettingsEvents();
  bindEditorEvents();
}

function renderPublication(content) {
  app.innerHTML = `<div id="publication-root">${content}</div>`;
}

function renderPrintExportPage(newspaperHtml) {
  return `
    <div class="print-export-bar" aria-label="打印导出操作">
      <div>
        <strong>${escapeHtml(state.publicationSettings.magazineTitle)}</strong>
        <span>Chrome 打印预览会自动分页，目标打印机选择“另存为 PDF”。</span>
      </div>
      <div>
        <button id="backToManage" class="ghost-button" type="button">返回管理</button>
        <button id="exportPdf" type="button">导出为 PDF</button>
      </div>
    </div>
    <div class="print-preview-scroll">
      ${newspaperHtml}
    </div>
  `;
}

function navButton(view, label) {
  const active = state.activeView === view ? " aria-current=\"page\"" : "";
  return `<button data-view="${view}" type="button"${active}>${label}</button>`;
}

function renderSettingsPanel() {
  const settings = state.publicationSettings;
  return `
    <section class="settings-panel">
      <header>
        <span>Publication Settings</span>
        <h2>刊物设置</h2>
      </header>
      <div class="settings-grid">
        ${textInput("magazineTitle", "刊物名称", settings.magazineTitle)}
        ${textInput("magazineSubtitle", "英文小字或副标题", settings.magazineSubtitle)}
        ${textInput("schoolName", "学校", settings.schoolName)}
        ${textInput("className", "班级", settings.className)}
        ${textInput("issueTheme", "本期主题", settings.issueTheme)}
        ${textInput("issueNo", "期号", settings.issueNo)}
        ${textInput("issueDate", "日期", settings.issueDate, "date")}
        <label class="settings-wide">卷首语<textarea data-setting="editorNote" rows="4">${escapeHtml(settings.editorNote)}</textarea></label>
        <label><span>是否显示真实姓名</span><select data-setting="showRealName">
          <option value="true" ${settings.showRealName ? "selected" : ""}>显示</option>
          <option value="false" ${!settings.showRealName ? "selected" : ""}>不显示</option>
        </select></label>
        <label><span>默认署名方式</span><select data-setting="authorDisplayMode">
          <option value="realName" ${settings.authorDisplayMode === "realName" ? "selected" : ""}>真实姓名</option>
          <option value="nickname" ${settings.authorDisplayMode === "nickname" ? "selected" : ""}>昵称</option>
          <option value="anonymous" ${settings.authorDisplayMode === "anonymous" ? "selected" : ""}>匿名</option>
        </select></label>
      </div>
    </section>
  `;
}

function textInput(field, label, value, type = "text") {
  return `<label><span>${label}</span><input data-setting="${field}" type="${type}" value="${escapeAttr(value)}"></label>`;
}

function renderManage() {
  if (state.articles.length === 0) {
    return `<section class="empty"><h2>还没有作文</h2><p>点击“选择 .docx”，一次选择多篇作文即可开始。</p></section>`;
  }
  return `
    <section class="review-summary">
      <div><strong>${state.articles.length}</strong><span>已导入</span></div>
      <div><strong>${getPublishedArticles(state.articles).length}</strong><span>可发布</span></div>
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
        <label>显示署名<input data-field="displayAuthor" value="${escapeAttr(article.displayAuthor || "")}"></label>
        <label>栏目<select data-field="column">${state.columns.map((column) => `<option value="${escapeAttr(column)}" ${article.column === column ? "selected" : ""}>${escapeHtml(column)}</option>`).join("")}</select></label>
      </div>
      <label class="excerpt-field">摘要<input data-field="excerpt" value="${escapeAttr(article.excerpt || buildExcerpt(article))}"></label>
      <div class="checks">
        <label><input data-field="selected" type="checkbox" ${article.selected ? "checked" : ""}> 入选</label>
        <label><input data-field="anonymous" type="checkbox" ${article.anonymous ? "checked" : ""}> 匿名发布</label>
        <label><input data-field="privacyReview" type="checkbox" ${article.privacyReview ? "checked" : ""}> 隐私已审查</label>
      </div>
      <details><summary>正文预览</summary><div class="essay-preview">${article.html}</div></details>
    </article>
  `;
}

function bindAppShellEvents() {
  app.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  const docxInput = app.querySelector("#docxInput");
  const jsonInput = app.querySelector("#importJson");

  app.querySelector("#chooseDocx").addEventListener("click", () => docxInput.click());
  app.querySelector("#chooseJson").addEventListener("click", () => jsonInput.click());
  docxInput.addEventListener("change", async (event) => {
    await importDocxFiles([...event.target.files]);
    event.target.value = "";
  });
  jsonInput.addEventListener("change", importJson);
  app.querySelector("#exportJson").addEventListener("click", exportJson);
  app.querySelector("#exportHtml").addEventListener("click", exportHtml);
  app.querySelector("#clearAll").addEventListener("click", clearAll);
}

function bindSettingsEvents() {
  app.querySelectorAll("[data-setting]").forEach((input) => {
    input.addEventListener("change", () => {
      const field = input.dataset.setting;
      state.publicationSettings[field] = field === "showRealName" ? input.value === "true" : input.value;
      persist();
      syncDocumentTitle();
      updateStatusOnly("刊物设置已保存。");
    });
    input.addEventListener("input", () => {
      const field = input.dataset.setting;
      if (field === "showRealName") return;
      state.publicationSettings[field] = input.value;
      persist();
      syncDocumentTitle();
    });
  });
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

function bindPublicationEvents() {
  app.querySelectorAll("[data-read-article]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      state.activeArticleId = link.dataset.readArticle;
      history.pushState({ view: "magazine", articleId: state.activeArticleId }, "", `#article-${state.activeArticleId}`);
      render();
    });
  });
  app.querySelectorAll("[data-view-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      switchView(link.dataset.viewLink);
    });
  });
}

function bindPrintPageEvents() {
  const exportButton = app.querySelector("#exportPdf");
  const backButton = app.querySelector("#backToManage");
  exportButton?.addEventListener("click", () => window.print());
  backButton?.addEventListener("click", () => switchView("manage"));
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
  const failed = [];
  for (const file of docxFiles) {
    try {
      updateStatusOnly(`正在解析：${file.name}`);
      const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
      const article = extractArticle(result.value, file.name);
      imported.push({
        id: stableId(`${file.name}:${file.size}:${file.lastModified}`),
        sourceFile: file.name,
        title: article.title,
        author: article.author,
        displayAuthor: article.author,
        column: state.columns[0],
        excerpt: stripHtml(article.html).slice(0, 80),
        html: article.html,
        images: article.images,
        selected: false,
        anonymous: false,
        privacyReview: false,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      failed.push(`${file.name}：${error.message}`);
    }
  }

  const existing = new Map(state.articles.map((article) => [article.id, article]));
  for (const article of imported) existing.set(article.id, normalizeArticle({ ...existing.get(article.id), ...article }));
  state.articles = [...existing.values()];
  persist();
  setStatus([
    `已导入 ${imported.length} 篇作文`,
    skipped.length ? `跳过 ${skipped.length} 个非 .docx 文件` : "",
    failed.length ? `失败 ${failed.length} 个：${failed.join("；")}` : "",
    "默认不会发布，请逐篇勾选入选和隐私已审查。"
  ].filter(Boolean).join("。"));
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

function switchView(view) {
  state.activeView = view;
  state.activeArticleId = "";
  history.pushState({ view }, "", view === "manage" ? "#" : `#${view}`);
  syncDocumentTitle();
  render();
}

async function importJson(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const project = normalizeProject(data);
    state.articles = project.articles;
    state.columns = project.columns;
    state.publicationSettings = project.publicationSettings;
    persist();
    syncDocumentTitle();
    setStatus(`已导入项目 JSON：${state.articles.length} 篇。`);
  } catch (error) {
    setStatus(`项目 JSON 导入失败：${error.message}`);
  } finally {
    event.target.value = "";
  }
}

function exportJson() {
  downloadFile(`${fileSafeName(state.publicationSettings.magazineTitle)}-project.json`, JSON.stringify(projectSnapshot(), null, 2), "application/json");
}

function exportHtml() {
  downloadFile(`${fileSafeName(state.publicationSettings.magazineTitle)}.html`, renderStandaloneHtml({
    articles: state.articles,
    settings: state.publicationSettings,
    columns: state.columns,
    css: appCss
  }), "text/html");
}

function clearAll() {
  if (!confirm("确定清空当前浏览器里的作文数据和刊物设置吗？这不会删除你电脑上的 docx 文件。")) return;
  const fresh = normalizeProject({});
  state.articles = fresh.articles;
  state.columns = fresh.columns;
  state.publicationSettings = fresh.publicationSettings;
  state.activeView = "manage";
  state.activeArticleId = "";
  persist();
  syncDocumentTitle();
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projectSnapshot()));
}

function projectSnapshot() {
  return {
    publicationSettings: state.publicationSettings,
    columns: state.columns,
    articles: state.articles
  };
}

function loadProject() {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) return { ...normalizeProject(JSON.parse(current)), activeView: viewFromHash(), activeArticleId: articleFromHash(), status: "项目已从当前浏览器恢复。" };
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) return { ...normalizeProject({ articles: JSON.parse(legacy) }), activeView: viewFromHash(), activeArticleId: articleFromHash(), status: "已从旧版浏览器数据迁移。" };
  } catch {
    // Ignore corrupted local data and start fresh.
  }
  return { ...normalizeProject({}), activeView: viewFromHash(), activeArticleId: articleFromHash(), status: "选择 .docx 后，作文会在浏览器本地解析，不会上传。" };
}

function normalizeProject(project) {
  return {
    publicationSettings: normalizeSettings(project.publicationSettings),
    columns: Array.isArray(project.columns) && project.columns.length ? project.columns : DEFAULT_COLUMNS,
    articles: Array.isArray(project.articles) ? project.articles.map(normalizeArticle) : []
  };
}

function normalizeArticle(article) {
  return {
    id: article.id || stableId(`${article.title}:${article.author}:${article.sourceFile || ""}`),
    sourceFile: article.sourceFile || "",
    title: article.title || "未命名作文",
    author: article.author || "",
    displayAuthor: article.displayAuthor || article.author || "",
    column: article.column || DEFAULT_COLUMNS[0],
    excerpt: article.excerpt || stripHtml(article.html).slice(0, 80),
    html: article.html || "",
    images: Array.isArray(article.images) ? article.images : [],
    selected: Boolean(article.selected),
    anonymous: Boolean(article.anonymous),
    privacyReview: Boolean(article.privacyReview),
    updatedAt: article.updatedAt || new Date().toISOString()
  };
}

function syncDocumentTitle() {
  document.title = state.activeView === "manage" ? `管理 - ${state.publicationSettings.magazineTitle}` : state.publicationSettings.magazineTitle;
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

function viewFromHash() {
  if (location.hash.startsWith("#print")) return "print";
  if (location.hash.startsWith("#magazine") || location.hash.startsWith("#article-")) return "magazine";
  return "manage";
}

function articleFromHash() {
  return location.hash.startsWith("#article-") ? location.hash.replace("#article-", "") : "";
}

window.addEventListener("popstate", () => {
  state.activeView = viewFromHash();
  state.activeArticleId = articleFromHash();
  syncDocumentTitle();
  render();
});

function stableId(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = Math.imul(31, hash) + value.charCodeAt(i) | 0;
  return Math.abs(hash).toString(36);
}

function compactText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function fileSafeName(value) {
  return String(value || "class-magazine").replace(/[\\/:*?"<>|]+/g, "-").trim() || "class-magazine";
}
