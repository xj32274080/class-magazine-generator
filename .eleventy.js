const path = require("node:path");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "data/media": "media" });
  eleventyConfig.addPassthroughCopy({
    "node_modules/pagedjs/dist/paged.polyfill.js": "assets/vendor/paged.polyfill.js"
  });

  eleventyConfig.addFilter("displayAuthor", (article) => {
    if (!article || article.anonymous) return "匿名";
    return article.author || "未署名";
  });

  eleventyConfig.addFilter("whereColumn", (articles, column) => {
    return (articles || []).filter((article) => article.column === column);
  });

  eleventyConfig.addFilter("readingMinutes", (article) => {
    const text = String(article?.html ?? "").replace(/<[^>]+>/g, "");
    return Math.max(1, Math.ceil(text.length / 500));
  });

  return {
    dir: {
      input: "src",
      output: "dist",
      includes: "_includes",
      data: "_data"
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
    pathPrefix: "/"
  };
};
