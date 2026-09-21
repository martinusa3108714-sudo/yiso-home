import { getProjectBySlug, getPublicProjects, projectUrl } from "./cms-client.js";

const root = document.getElementById("cms-project-root");
const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>';

function pairImages(images) {
  if (!images.length) return [];
  const remaining = [...images];
  const first = remaining.shift();
  const ratio = (image) => (Number(image.width) || 3) / (Number(image.height) || 2);
  const pairs = [];
  if (remaining.length) {
    const partner = remaining.reduce((best, candidate) =>
      Math.abs(Math.log(ratio(candidate) / ratio(first))) < Math.abs(Math.log(ratio(best) / ratio(first))) ? candidate : best
    , remaining[0]);
    remaining.splice(remaining.indexOf(partner), 1);
    pairs.push([first, partner]);
  } else pairs.push([first]);
  remaining.sort((a, b) => ratio(a) - ratio(b));
  for (let index = 0; index < remaining.length; index += 2) pairs.push(remaining.slice(index, index + 2));
  return pairs;
}

function galleryItem(project, image, index, built = false) {
  const number = String(index + 1).padStart(2, "0");
  const alt = image.alt_text || `${project.name} 프로젝트 이미지 ${number}`;
  const button = `<button class="gallery-item" type="button" data-number="${number}" data-lightbox-item data-src="${escapeHtml(image.image_url)}" data-alt="${escapeHtml(alt)}" aria-label="${escapeHtml(alt)} 확대 보기"><img ${image.width ? `width="${image.width}"` : ""} ${image.height ? `height="${image.height}"` : ""} src="${escapeHtml(image.image_url)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async"/></button>`;
  return built ? `<figure class="built-gallery-figure">${button}</figure>` : button;
}

function builtGallery(project) {
  let index = 0;
  return pairImages(project.images).map((pair) => {
    const columns = pair.map((image) => `minmax(0,${((Number(image.width) || 3) / (Number(image.height) || 2)).toFixed(6)}fr)`).join(" ");
    const items = pair.map((image) => galleryItem(project, image, index++, true)).join("");
    return `<div class="built-gallery-row${pair.length === 1 ? " is-single" : ""}" style="--gallery-columns:${columns}">${items}</div>`;
  }).join("");
}

function renderProject(project, projects) {
  const built = project.project_type === "BUILT";
  const sameType = projects.filter((item) => item.project_type === project.project_type);
  const currentIndex = sameType.findIndex((item) => item.slug === project.slug);
  const next = sameType[(currentIndex + 1) % sameType.length] || project;
  const count = project.images.length;
  const badge = built ? '<span class="built-badge">시공 · BUILT</span>' : '<span class="concept-badge concept-badge--hero">CONCEPT</span>';
  const kicker = built ? `BUILT PROJECT / ${project.year || ""}` : `SELECTED ${escapeHtml(project.category || "PROJECT")} / ${String(currentIndex + 1).padStart(2, "0")}`;
  const galleryClass = built ? "built-gallery-grid" : "project-gallery-grid";
  const gallery = built ? builtGallery(project) : project.images.map((image, index) => galleryItem(project, image, index)).join("");
  const meta = built
    ? [["TYPE", project.category], ["SCOPE", project.project_scope || "인테리어 시공"], ["YEAR", project.year], ["GALLERY", `${count} IMAGES`]]
    : [["TYPE", project.category], ["SCOPE", project.project_scope || "CONCEPT DESIGN STUDY"], ["REGION", project.location || "SOUTH KOREA"], ["GALLERY", `${count} IMAGES`]];
  document.body.className = `project-page cms-project-page project-${built ? "built" : "concept"} project-${project.slug}`;
  document.title = `${project.name} — ${built ? "시공 프로젝트" : "CONCEPT"} | YISO INTERIOR`;
  document.querySelector('meta[name="description"]')?.setAttribute("content", project.short_description || project.name);
  root.innerHTML = `
    <section class="project-hero" aria-labelledby="project-title">
      <img class="project-hero-image" src="${escapeHtml(project.cover_image_url)}" alt="${escapeHtml(project.cover_alt || project.name)}" fetchpriority="high"/>
      <div class="project-hero-shade"></div>
      <div class="project-hero-content">
        <div class="project-kicker-row"><p class="project-kicker">${kicker}</p>${badge}</div>
        <h1 id="project-title">${escapeHtml(project.name)}<span>${escapeHtml(project.name_en || "")}</span></h1>
        <div class="project-hero-bottom"><p>${escapeHtml(project.short_description || "")}</p><a class="project-scroll" href="#gallery">VIEW PROJECT <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg></a></div>
      </div>
    </section>
    <section class="project-intro" aria-labelledby="intro-title"><div class="project-intro-inner">
      <div class="project-intro-label"><span>01</span><span>PROJECT OVERVIEW</span></div>
      <div class="project-intro-copy"><h2 id="intro-title">${escapeHtml(project.intro_title || project.name)}</h2><p>${escapeHtml(project.detail_description || project.short_description || "")}</p>
        <dl class="project-meta">${meta.map(([key, value]) => `<div><dt>${key}</dt><dd>${escapeHtml(value ?? "-")}</dd></div>`).join("")}</dl>
      </div>
    </div></section>
    <section class="project-gallery-section" id="gallery" aria-labelledby="gallery-title"><div class="project-gallery-inner">
      <div class="project-gallery-head"><div><p>PROJECT GALLERY</p><h2 id="gallery-title">공간의 장면들</h2></div><span class="project-gallery-count">${String(count).padStart(2, "0")}</span></div>
      <div class="${galleryClass}">${gallery || '<p class="cms-empty">등록된 상세 이미지가 없습니다.</p>'}</div>
      ${built ? `<a class="built-back-link" href="./spaces.html#built-projects">시공 프로젝트 목록으로 ${arrow}</a>` : ""}
    </div></section>
    <a class="next-project" href="${projectUrl(next)}" aria-label="다음 프로젝트 ${escapeHtml(next.name)} 보기"><img src="${escapeHtml(next.cover_image_url)}" alt="${escapeHtml(next.cover_alt || next.name)}" loading="lazy" decoding="async"/><div class="next-project-content"><div><div class="next-project-label-row"><p>NEXT ${built ? "BUILT " : ""}PROJECT / ${String((currentIndex + 1) % sameType.length + 1).padStart(2, "0")}</p>${built ? '<span class="built-badge">시공 · BUILT</span>' : '<span class="concept-badge concept-badge--next">CONCEPT</span>'}</div><h2>${escapeHtml(next.name)}</h2></div>${arrow}</div></a>
    ${built ? "" : '<p class="concept-disclaimer"><em>This project is a conceptual design study created to explore YISO\'s spatial design direction.</em></p>'}`;
  initLightbox();
}

function initLightbox() {
  const dialog = document.getElementById("project-lightbox");
  const items = [...document.querySelectorAll("[data-lightbox-item]")];
  if (!dialog || !items.length) return;
  const image = dialog.querySelector(".lightbox-image");
  const status = dialog.querySelector(".lightbox-status");
  let current = 0;
  const show = (index) => {
    current = (index + items.length) % items.length;
    image.src = items[current].dataset.src;
    image.alt = items[current].dataset.alt || "";
    status.textContent = `${String(current + 1).padStart(2, "0")} / ${String(items.length).padStart(2, "0")}`;
  };
  items.forEach((item, index) => item.addEventListener("click", () => { show(index); dialog.showModal(); }));
  dialog.querySelector(".lightbox-close").addEventListener("click", () => dialog.close());
  dialog.querySelector(".lightbox-prev").addEventListener("click", () => show(current - 1));
  dialog.querySelector(".lightbox-next").addEventListener("click", () => show(current + 1));
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") show(current - 1);
    if (event.key === "ArrowRight") show(current + 1);
  });
}

async function main() {
  const slug = new URLSearchParams(location.search).get("slug");
  if (!slug) {
    root.innerHTML = '<div class="cms-error"><h1>프로젝트를 찾을 수 없습니다.</h1><p>프로젝트 주소가 올바른지 확인해 주세요.</p><a href="./spaces.html">프로젝트 목록으로</a></div>';
    return;
  }
  try {
    const [project, projects] = await Promise.all([getProjectBySlug(slug), getPublicProjects()]);
    if (!project) throw new Error("not-found");
    renderProject(project, projects);
    const script = document.createElement("script");
    script.src = "./site-motion.js";
    document.body.append(script);
  } catch (error) {
    console.error(error);
    root.innerHTML = '<div class="cms-error"><h1>프로젝트를 불러오지 못했습니다.</h1><p>잠시 후 다시 시도하거나 프로젝트 목록으로 돌아가 주세요.</p><a href="./spaces.html">프로젝트 목록으로</a></div>';
  }
}

main();
