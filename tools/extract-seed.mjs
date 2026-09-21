import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const clean = (value = "") =>
  value.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const attr = (html, name) => html.match(new RegExp(`${name}="([^"]*)"`, "i"))?.[1] || "";
const first = (html, re, fallback = "") => html.match(re)?.[1] || fallback;

const spaces = read("spaces.html");
const home = read("index.html");
const homeHrefs = [...home.matchAll(/<article class="space-card\b[\s\S]*?href="\.\/([^"]+)"[\s\S]*?<\/article>/g)]
  .map((match) => match[1]);
const cardBlocks = [...spaces.matchAll(/<article class="archive-card[\s\S]*?<\/article>/g)].map((m) => m[0]);

const projects = cardBlocks.map((card, index) => {
  const legacyPath = first(card, /href="\.\/([^"]+\.html)"/);
  const isBuilt = card.includes("archive-card--built");
  const slug = legacyPath
    .replace(/^project-built-/, "")
    .replace(/^project-/, "")
    .replace(/\.html$/, "");
  const detail = read(legacyPath);
  const h2 = first(card, /<h2>([\s\S]*?)<\/h2>/);
  const nameEn = clean(first(h2, /<small>([\s\S]*?)<\/small>/));
  const name = clean(h2.replace(/<small>[\s\S]*?<\/small>/, ""));
  const category = clean(first(card, /<div class="archive-card-head"><p><b>\d+<\/b>([\s\S]*?)<\/p>/));
  const shortDescription = clean(first(card, /<p class="archive-card-copy">([\s\S]*?)<\/p>/));
  const introTitle = clean(first(detail, /<h2 id="intro-title">([\s\S]*?)<\/h2>/));
  const detailDescription = clean(first(detail, /<div class="project-intro-copy">[\s\S]*?<p>([\s\S]*?)<\/p>/));
  const heroTag = first(detail, /<section class="project-hero"[\s\S]*?(<img\b[^>]*>)/)
    || first(detail, /<figure class="built-hero-figure">[\s\S]*?(<img\b[^>]*>)/);
  const coverImageUrl = attr(heroTag, "src");
  const coverAlt = attr(heroTag, "alt") || `${name} 대표 이미지`;
  const year = Number(first(detail, /BUILT PROJECT \/ (\d{4})/)
    || first(card, /YISO \/ (\d{4})/)
    || new Date().getFullYear());
  const meta = {};
  for (const match of detail.matchAll(/<div><dt>([^<]+)<\/dt><dd>([\s\S]*?)<\/dd><\/div>/g)) {
    meta[clean(match[1]).toUpperCase()] = clean(match[2]);
  }
  const imageMap = new Map();
  for (const match of detail.matchAll(/<button\b[^>]*data-lightbox-item[^>]*>[\s\S]*?<\/button>/g)) {
    const block = match[0];
    const imageUrl = attr(block, "data-src") || attr(first(block, /(<img\b[^>]*>)/), "src");
    if (!imageUrl || imageMap.has(imageUrl)) continue;
    const imgTag = first(block, /(<img\b[^>]*>)/);
    imageMap.set(imageUrl, {
      image_url: imageUrl,
      source_path: imageUrl,
      alt_text: attr(block, "data-alt") || attr(imgTag, "alt") || `${name} 프로젝트 이미지`,
      width: Number(attr(imgTag, "width")) || null,
      height: Number(attr(imgTag, "height")) || null,
      sort_order: imageMap.size + 1
    });
  }
  const homeIndex = homeHrefs.indexOf(legacyPath);
  return {
    id: `seed-${slug}`,
    name,
    name_en: nameEn,
    slug,
    project_type: isBuilt ? "BUILT" : "CONCEPT",
    year: isBuilt ? year : "",
    location: meta.REGION || "대한민국",
    category,
    short_description: shortDescription,
    intro_title: introTitle || shortDescription,
    detail_description: detailDescription || shortDescription,
    project_scope: meta.SCOPE || (isBuilt ? "인테리어 시공" : "CONCEPT DESIGN STUDY"),
    cover_image_url: coverImageUrl,
    cover_storage_path: null,
    cover_alt: coverAlt,
    published: true,
    is_home_featured: homeIndex >= 0,
    home_order: homeIndex >= 0 ? homeIndex + 1 : null,
    sort_order: index + 1,
    legacy_path: legacyPath,
    images: [...imageMap.values()]
  };
});

const payload = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  project_count: projects.length,
  projects
};
fs.mkdirSync(path.join(root, "data"), { recursive: true });
fs.writeFileSync(path.join(root, "data/projects.seed.json"), JSON.stringify(payload, null, 2) + "\n");
console.log(`Generated ${projects.length} projects and ${projects.reduce((sum, project) => sum + project.images.length, 0)} gallery images.`);
