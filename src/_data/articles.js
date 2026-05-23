const fs = require("node:fs");
const path = require("node:path");

module.exports = function () {
  const articlesPath = path.join(process.cwd(), "data", "articles.json");
  if (!fs.existsSync(articlesPath)) return [];
  return JSON.parse(fs.readFileSync(articlesPath, "utf8"));
};
