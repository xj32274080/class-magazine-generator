const state = {
  articles: [],
  columns: [],
  search: "",
  column: "",
  selectedOnly: false
};

const list = document.querySelector("#articleList");
const template = document.querySelector("#articleTemplate");
const statusBox = document.querySelector("#statusBox");
const saveButton = document.querySelector("#saveButton");
const buildButton = document.querySelector("#buildButton");
const searchInput = document.querySelector("#searchInput");
const columnFilter = document.querySelector("#columnFilter");
const selectedOnly = document.querySelector("#selectedOnly");

await load();

saveButton.addEventListener("click", save);
buildButton.addEventListener("click", build);
searchInput.addEventListener("input", () => {
  state.search = searchInput.value.trim().toLowerCase();
  render();
});
columnFilter.addEventListener("change", () => {
  state.column = columnFilter.value;
  render();
});
selectedOnly.addEventListener("change", () => {
  state.selectedOnly = selectedOnly.checked;
  render();
});

async function load() {
  const response = await fetch("/api/articles");
  const data = await response.json();
  state.articles = data.articles;
  state.columns = data.columns;
  for (const column of state.columns) {
    const option = document.createElement("option");
    option.value = column;
    option.textContent = column;
    columnFilter.append(option);
  }
  render();
}

function render() {
  list.replaceChildren();
  const articles = state.articles.filter((article) => {
    const haystack = `${article.title} ${article.author} ${article.column}`.toLowerCase();
    if (state.search && !haystack.includes(state.search)) return false;
    if (state.column && article.column !== state.column) return false;
    if (state.selectedOnly && !article.selected) return false;
    return true;
  });

  if (articles.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "没有匹配的作文。请先把 .docx 放入 input-docx 后运行 npm run import。";
    list.append(empty);
    return;
  }

  for (const article of articles) {
    const node = template.content.firstElementChild.cloneNode(true);
    bindTextInput(node, article, "title");
    bindTextInput(node, article, "author");
    bindColumnSelect(node, article);
    bindCheckbox(node, article, "selected");
    bindCheckbox(node, article, "anonymous");
    bindCheckbox(node, article, "privacyReview");
    node.querySelector(".preview").innerHTML = article.html;
    list.append(node);
  }
}

function bindTextInput(node, article, field) {
  const input = node.querySelector(`[data-field="${field}"]`);
  input.value = article[field] ?? "";
  input.addEventListener("input", () => {
    article[field] = input.value;
  });
}

function bindColumnSelect(node, article) {
  const select = node.querySelector('[data-field="column"]');
  for (const column of state.columns) {
    const option = document.createElement("option");
    option.value = column;
    option.textContent = column;
    select.append(option);
  }
  select.value = article.column;
  select.addEventListener("change", () => {
    article.column = select.value;
  });
}

function bindCheckbox(node, article, field) {
  const input = node.querySelector(`[data-field="${field}"]`);
  input.checked = Boolean(article[field]);
  input.addEventListener("change", () => {
    article[field] = input.checked;
  });
}

async function save() {
  saveButton.disabled = true;
  setStatus("正在保存...");
  try {
    const response = await fetch("/api/articles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ articles: state.articles })
    });
    const result = await response.json();
    setStatus(response.ok ? `已保存 ${result.count} 篇。` : JSON.stringify(result, null, 2));
    return response.ok;
  } catch (error) {
    setStatus(`保存失败：${error.message}`);
    return false;
  } finally {
    saveButton.disabled = false;
  }
}

async function build() {
  buildButton.disabled = true;
  setStatus("正在生成 dist...");
  try {
    const saved = await save();
    if (!saved) return;
    setStatus("保存完成，正在生成网站...");
    const response = await fetch("/api/build", { method: "POST" });
    const result = await response.json();
    setStatus(result.ok ? result.message : `生成失败：${result.message}`);
  } catch (error) {
    setStatus(`生成失败：${error.message}`);
  } finally {
    buildButton.disabled = false;
  }
}

function setStatus(message) {
  statusBox.hidden = false;
  statusBox.textContent = message;
}
