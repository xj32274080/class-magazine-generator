export const DEFAULT_COLUMNS = ["本期佳作", "童言童趣", "观察日记", "想象天地", "修改之星", "老师点评"];

export const DEFAULT_PUBLICATION_SETTINGS = {
  magazineTitle: "班级作文报",
  magazineSubtitle: "CLASS WRITING GAZETTE",
  schoolName: "",
  className: "",
  issueTheme: "",
  issueNo: "",
  issueDate: "",
  editorNote: "",
  showRealName: true,
  authorDisplayMode: "realName"
};

export function normalizeSettings(settings = {}) {
  return {
    ...DEFAULT_PUBLICATION_SETTINGS,
    ...settings
  };
}

export function getPublishedArticles(articles = []) {
  return articles.filter((article) => article.selected && article.privacyReview);
}

export function getDisplayAuthor(article, settings) {
  if (article.anonymous || !settings.showRealName || settings.authorDisplayMode === "anonymous") return "匿名";
  if (settings.authorDisplayMode === "nickname") return article.displayAuthor || article.author || "未署名";
  return article.author || article.displayAuthor || "未署名";
}

export function buildExcerpt(article) {
  return article.excerpt || stripHtml(article.html).slice(0, 80);
}

export function renderMagazineView({ articles, settings, columns, activeArticleId = "" }) {
  const published = getPublishedArticles(articles);
  const activeArticle = published.find((article) => article.id === activeArticleId);
  const meta = [settings.schoolName, settings.className, settings.issueDate].filter(Boolean).join(" · ");

  if (activeArticle) {
    return renderArticleReader(activeArticle, settings);
  }

  return `
    <main class="publication publication--magazine">
      <section class="magazine-cover">
        <div class="magazine-cover__mark">${escapeHtml(settings.magazineSubtitle || "CLASS WRITING GAZETTE")}</div>
        <h1>${escapeHtml(settings.magazineTitle)}</h1>
        ${settings.issueTheme ? `<p class="magazine-cover__theme">${escapeHtml(settings.issueTheme)}</p>` : ""}
        ${meta ? `<p class="magazine-cover__meta">${escapeHtml(meta)}</p>` : ""}
        ${settings.issueNo ? `<p class="magazine-cover__issue">${escapeHtml(settings.issueNo)}</p>` : ""}
        ${settings.editorNote ? `<div class="editor-note">${escapeHtml(settings.editorNote)}</div>` : ""}
      </section>

      <nav class="magazine-toc" aria-label="栏目目录">
        ${columnsWithArticles(columns, published).map((column) => `<a href="#${escapeAttr(column)}">${escapeHtml(column)}</a>`).join("")}
      </nav>

      ${published.length === 0 ? `<section class="publication-empty"><h2>暂无入选作品</h2><p>请回到管理端勾选“入选”和“隐私已审查”。</p></section>` : ""}
      ${columns.map((column) => renderMagazineColumn(column, published, settings)).join("")}
    </main>
  `;
}

export function renderPrintNewspaperView({ articles, settings, columns }) {
  const published = getPublishedArticles(articles);
  const meta = [settings.schoolName, settings.className, settings.issueDate, settings.issueNo].filter(Boolean).join(" · ");

  return `
    <main class="publication newspaper" data-print-container style="--print-title: '${escapeAttr(settings.magazineTitle)}'">
      <header class="newspaper-masthead">
        <p>${escapeHtml(settings.magazineSubtitle || "CLASS WRITING GAZETTE")}</p>
        <h1>${escapeHtml(settings.magazineTitle)}</h1>
        ${settings.issueTheme ? `<div class="newspaper-theme">${escapeHtml(settings.issueTheme)}</div>` : ""}
        ${meta ? `<div class="newspaper-meta">${escapeHtml(meta)}</div>` : ""}
      </header>
      ${published.length === 0 ? `<section class="publication-empty"><h2>暂无入选作品</h2></section>` : ""}
      ${columns.map((column) => renderPrintColumn(column, published, settings)).join("")}
    </main>
  `;
}

export function renderStandaloneHtml({ articles, settings, columns, css }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(settings.magazineTitle)}</title>
  <style>${css}</style>
</head>
<body>
  ${renderMagazineView({ articles, settings, columns })}
  ${renderPrintNewspaperView({ articles, settings, columns })}
</body>
</html>`;
}

function renderMagazineColumn(column, articles, settings) {
  const items = articles.filter((article) => article.column === column);
  if (items.length === 0) return "";
  return `
    <section class="magazine-section" id="${escapeAttr(column)}">
      <header>
        <span>Column</span>
        <h2>${escapeHtml(column)}</h2>
      </header>
      <div class="magazine-card-grid">
        ${items.map((article) => renderArticleCard(article, settings)).join("")}
      </div>
    </section>
  `;
}

function renderArticleCard(article, settings) {
  return `
    <article class="magazine-card">
      <div class="column-stamp">${escapeHtml(article.column)}</div>
      <h3>${escapeHtml(article.title)}</h3>
      <p class="magazine-card__author">${escapeHtml(getDisplayAuthor(article, settings))}</p>
      <p>${escapeHtml(buildExcerpt(article))}</p>
      <a href="#article-${escapeAttr(article.id)}" data-read-article="${escapeAttr(article.id)}">阅读全文</a>
    </article>
  `;
}

function renderArticleReader(article, settings) {
  return `
    <main class="publication article-reader">
      <a class="reader-back" href="#magazine" data-view-link="magazine">返回目录</a>
      <article>
        <header>
          <p>${escapeHtml(article.column)}</p>
          <h1>${escapeHtml(article.title)}</h1>
          <div>${escapeHtml(getDisplayAuthor(article, settings))}</div>
        </header>
        <div class="article-reader__body">${article.html}</div>
      </article>
    </main>
  `;
}

function renderPrintColumn(column, articles, settings) {
  const items = articles.filter((article) => article.column === column);
  if (items.length === 0) return "";
  return `
    <section class="print-section">
      <h2><span>${escapeHtml(column)}</span></h2>
      ${items.map((article) => `
        <article class="print-article">
          <h3>${escapeHtml(article.title)}</h3>
          <p class="byline">${escapeHtml(getDisplayAuthor(article, settings))} · ${escapeHtml(article.column)}</p>
          <div class="print-article__body">${article.html}</div>
        </article>
      `).join("")}
    </section>
  `;
}

function columnsWithArticles(columns, articles) {
  return columns.filter((column) => articles.some((article) => article.column === column));
}

export function stripHtml(html) {
  return String(html ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function escapeAttr(value) {
  return escapeHtml(value).replaceAll("\"", "&quot;");
}
