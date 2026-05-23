# 班级作文报纸 / 在线杂志生成器

一个完全本地运行的班级作文发布工具。它用 Mammoth.js 批量读取 `input-docx/` 中的 `.docx` 作文，生成可编辑的文章 JSON；老师在本地管理页确认标题、作者、栏目、入选和匿名设置后，再用 Eleventy 生成在线杂志，并用 Paged.js 生成 A4 可打印报纸页。

## 项目结构

```text
class-magazine-generator/
  input-docx/              # 放入学生 .docx 作文
  data/
    articles.json          # 导入后生成，老师编辑的文章数据
    columns.json           # 栏目配置
    media/                 # 从 docx 提取的图片
  scripts/
    import-docx.mjs        # Mammoth.js 批量导入
    serve-admin.mjs        # 本地管理页与保存 API
    clean.mjs              # 清理生成目录
  admin/
    index.html             # 老师管理页面
    admin.css
    admin.js
  src/
    _data/                 # Eleventy 数据入口
    _includes/base.njk     # 页面基础模板
    assets/site.css
    index.njk              # 在线杂志首页
    articles.njk           # 文章详情页
    print.njk              # Paged.js A4 打印版
  dist/                    # npm run build 后生成
```

## 安装

```powershell
cd D:\codex-work\class-magazine-generator
npm install
```

## 使用流程

1. 把学生作文 `.docx` 放入 `input-docx/`。
2. 导入作文：

```powershell
npm run import
```

导入会生成 `data/articles.json`，并把 docx 内图片提取到 `data/media/`。默认所有作文 `selected=false`，不会直接发布。

3. 打开本地管理页：

```powershell
npm run admin
```

浏览器访问 `http://127.0.0.1:5177/admin/`。老师可以修改标题、作者、栏目，勾选是否入选、是否匿名、隐私是否已审查。

4. 生成在线杂志：

```powershell
npm run build
```

生成结果在 `dist/`。开发预览可运行：

```powershell
npm run dev
```

5. 打印报纸：

访问 `dist/print/index.html`，或开发预览中的 `/print/`。浏览器打印即可导出 PDF。打印版使用 A4、报头、栏目标题、双栏/三栏排版和页码。

## 文章 JSON 字段

`data/articles.json` 中每篇文章包含：

```json
{
  "title": "标题",
  "author": "作者",
  "column": "栏目",
  "html": "<p>正文 HTML</p>",
  "images": ["/media/example-1.png"],
  "selected": false,
  "anonymous": false,
  "privacyReview": false
}
```

项目还会保留 `id`、`sourceFile`、`updatedAt`，用于稳定生成文章页和重复导入时保留老师编辑。

## 隐私与发布规则

- 所有处理都在本机完成，不上传学生作文。
- 只有 `selected=true` 且 `privacyReview=true` 的文章会进入在线杂志和打印版。
- 勾选 `anonymous=true` 后，站点显示“匿名”，不会显示作者姓名。
- 发布前请人工检查：学生姓名、家庭住址、联系方式、家庭情况、同学矛盾、照片和其他可识别隐私。

## 核心技术依据

- Mammoth.js：负责把 `.docx` 转为 HTML，并通过 `convertImage` 提取内嵌图片。
- Express：只在本机 `127.0.0.1` 提供管理页和保存 JSON 的 API。
- Eleventy：从本地 JSON 数据生成静态在线杂志和文章详情页。
- Paged.js：在打印页加载 polyfill，配合 CSS `@page` 生成 A4 版式与页码。
