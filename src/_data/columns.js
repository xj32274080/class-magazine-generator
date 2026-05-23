const fs = require("node:fs");
const path = require("node:path");

module.exports = function () {
  const columnsPath = path.join(process.cwd(), "data", "columns.json");
  if (!fs.existsSync(columnsPath)) return [];
  return JSON.parse(fs.readFileSync(columnsPath, "utf8"));
};
