import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const seed = JSON.parse(fs.readFileSync(path.join(root, "data/projects.seed.json"), "utf8"));
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const write = (name, value) => fs.writeFileSync(path.join(root, name), value);

let spaces = read("spaces.html");
spaces = spaces
  .replace(/<span>\d+ BUILT · \d+ CONCEPTS<\/span>/, '<span data-project-summary>PROJECTS LOADING</span>')
  .replace(/시공 프로젝트 <span>\d+<\/span>/, '시공 프로젝트 <span data-built-count>--</span>')
  .replace(/CONCEPT <span>\d+<\/span>/, 'CONCEPT <span data-concept-count>--</span>')
  .replace(/(<section class="archive archive--built"[\s\S]*?<strong>)\d+(<\/strong><\/header><div class="archive-grid">)[\s\S]*?(<\/div><\/section>\s*<section class="archive archive--concept")/,
    '$1<span data-built-count>--</span>$2<p class="cms-list-loading" data-cms-loading>시공 프로젝트를 불러오는 중입니다.</p>$3')
  .replace(/(<section class="archive archive--concept"[\s\S]*?<strong>)\d+(<\/strong><\/header>\s*<div class="archive-grid">)[\s\S]*?(<\/div>\s*<\/section>)/,
    '$1<span data-concept-count>--</span>$2<p class="cms-list-loading" data-cms-loading>CONCEPT 프로젝트를 불러오는 중입니다.</p>$3')
  .replace('<div class="archive-grid"><p class="cms-list-loading" data-cms-loading>시공 프로젝트를 불러오는 중입니다.</p>',
    '<div class="archive-grid" data-project-grid="BUILT"><p class="cms-list-loading" data-cms-loading>시공 프로젝트를 불러오는 중입니다.</p>')
  .replace('<div class="archive-grid"><p class="cms-list-loading" data-cms-loading>CONCEPT 프로젝트를 불러오는 중입니다.</p>',
    '<div class="archive-grid" data-project-grid="CONCEPT"><p class="cms-list-loading" data-cms-loading>CONCEPT 프로젝트를 불러오는 중입니다.</p>')
  .replace('</head>', '<script src="./config.js"></script>\n<link rel="stylesheet" href="./cms/cms.css"/>\n</head>')
  .replace('</body>', '<script type="module" src="./cms/projects-render.js"></script>\n</body>');
write("spaces.html", spaces);

let index = read("index.html");
index = index
  .replace(/<div class="space-list">[\s\S]*?<\/div>\s*<\/section>\s*<section class="standard-section">/,
    '<div class="space-list" data-home-projects><p class="cms-list-loading" data-cms-loading>대표 프로젝트를 불러오는 중입니다.</p></div>\n</section>\n<section class="standard-section">')
  .replace('</head>', '<script src="./config.js"></script>\n<link rel="stylesheet" href="./cms/cms.css"/>\n</head>')
  .replace('</body>', '<script type="module" src="./cms/projects-render.js"></script>\n</body>');
write("index.html", index);

const redirect = (slug) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>PROJECT | YISO INTERIOR</title><script>location.replace("./project.html?slug=${encodeURIComponent(slug)}"+location.hash)</script></head><body><p><a href="./project.html?slug=${encodeURIComponent(slug)}">프로젝트 페이지로 이동</a></p></body></html>\n`;
for (const project of seed.projects) write(project.legacy_path, redirect(project.slug));

console.log("Converted home, project archive and legacy project URLs.");
