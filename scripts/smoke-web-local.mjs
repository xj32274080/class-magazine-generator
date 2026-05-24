import assert from "node:assert/strict";
import {
  DEFAULT_COLUMNS,
  normalizeSettings,
  renderPrintNewspaperView
} from "../web-local/src/renderers.mjs";

const html = renderPrintNewspaperView({
  settings: normalizeSettings({
    magazineTitle: "小荷文学报",
    magazineSubtitle: "LITTLE LOTUS",
    schoolName: "第一小学",
    className: "四年级一班",
    issueTheme: "观察与想象专刊",
    issueNo: "第 1 期",
    issueDate: "2026-05-24"
  }),
  columns: DEFAULT_COLUMNS,
  articles: [
    {
      id: "a1",
      title: "春天的校园",
      author: "李同学",
      displayAuthor: "李同学",
      column: DEFAULT_COLUMNS[0],
      html: "<p>春天来了，校园里的树叶变绿了。</p>",
      selected: true,
      privacyReview: true,
      anonymous: false
    }
  ]
});

assert.match(html, /小荷文学报/);
assert.doesNotMatch(html, /Browser Local Edition/);
assert.doesNotMatch(html, /班级作文生成器/);
assert.doesNotMatch(html, />管理</);
assert.doesNotMatch(html, /杂志预览/);
assert.doesNotMatch(html, /打印版/);
assert.match(html, /data-print-container/);

console.log("web-local smoke test passed");
