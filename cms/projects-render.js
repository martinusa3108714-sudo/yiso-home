import { getPublicProjects, projectUrl } from "./cms-client.js";

const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>';

function archiveCard(project, index) {
  const typeClass = project.project_type === "BUILT" ? "archive-card--built" : `archive-card--${String(index + 1).padStart(2, "0")}`;
  const badge = project.project_type === "BUILT"
    ? '<span class="built-badge">시공 · BUILT</span>'
    : '<span class="concept-badge concept-badge--card">CONCEPT</span>';
  const label = project.project_type === "BUILT" ? String(project.year || "") : String(index + 1).padStart(2, "0");
  return `<article class="archive-card ${typeClass}">
    <a class="archive-card-link" href="${projectUrl(project)}" aria-label="${escapeHtml(project.name)} 프로젝트 상세 보기">
      <figure class="archive-image"><img src="${escapeHtml(project.cover_image_url)}" alt="${escapeHtml(project.cover_alt || project.name)}" loading="lazy" decoding="async"/><span>YISO / ${label}</span>${badge}</figure>
      <div class="archive-card-head"><p><b>${String(index + 1).padStart(2, "0")}</b>${escapeHtml(project.category || "PROJECT")}</p>${arrow}</div>
      <h2>${escapeHtml(project.name)}<small>${escapeHtml(project.name_en || "")}</small></h2>
      <p class="archive-card-copy">${escapeHtml(project.short_description || "")}</p>
    </a>
  </article>`;
}

function homeCard(project, index) {
  const variants = ["space-card--portrait", "space-card--landscape", "space-card--wide"];
  return `<article class="space-card ${variants[index] || variants[2]}">
    <a class="space-image-wrap project-card-link" href="${projectUrl(project)}" aria-label="${escapeHtml(project.name)} 프로젝트 상세 보기">
      <img src="${escapeHtml(project.cover_image_url)}" alt="${escapeHtml(project.cover_alt || project.name)}" class="space-image" loading="lazy" decoding="async"/>
      <span class="image-corner" aria-hidden="true">YISO / ${String(index + 1).padStart(2, "0")}</span>
      ${project.project_type === "BUILT" ? '<span class="built-badge">시공 · BUILT</span>' : '<span class="concept-badge concept-badge--card">CONCEPT</span>'}
    </a>
    <div class="space-copy">
      <div class="space-meta"><span>${String(index + 1).padStart(2, "0")}</span><span>${escapeHtml(project.category || "PROJECT")}</span></div>
      <h3>${escapeHtml(project.name)}</h3>
      <p>${escapeHtml(project.short_description || "")}</p>
      <a class="project-link" href="${projectUrl(project)}">프로젝트 보기 ${arrow}</a>
    </div>
  </article>`;
}

async function render() {
  try {
    const projects = await getPublicProjects();
    const built = projects.filter((project) => project.project_type === "BUILT");
    const concept = projects.filter((project) => project.project_type === "CONCEPT");
    const builtGrid = document.querySelector("[data-project-grid='BUILT']");
    const conceptGrid = document.querySelector("[data-project-grid='CONCEPT']");
    if (builtGrid) builtGrid.innerHTML = built.map(archiveCard).join("");
    if (conceptGrid) conceptGrid.innerHTML = concept.map(archiveCard).join("");
    document.querySelectorAll("[data-built-count]").forEach((node) => { node.textContent = String(built.length).padStart(2, "0"); });
    document.querySelectorAll("[data-concept-count]").forEach((node) => { node.textContent = String(concept.length).padStart(2, "0"); });
    const summary = document.querySelector("[data-project-summary]");
    if (summary) summary.textContent = `${String(built.length).padStart(2, "0")} BUILT · ${String(concept.length).padStart(2, "0")} CONCEPTS`;
    const home = document.querySelector("[data-home-projects]");
    if (home) {
      const featured = projects.filter((project) => project.is_home_featured)
        .sort((a, b) => (a.home_order || 99) - (b.home_order || 99)).slice(0, 3);
      home.innerHTML = featured.map(homeCard).join("");
    }
    document.documentElement.classList.add("cms-ready");
  } catch (error) {
    console.error(error);
    document.querySelectorAll("[data-cms-loading]").forEach((node) => {
      node.textContent = "프로젝트를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
    });
  }
}

render();
