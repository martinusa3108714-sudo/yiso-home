import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const checks = [];
const check = (condition, message) => {
  if (condition) checks.push(message);
  else errors.push(message);
};
const exists = (relative) => fs.existsSync(path.join(root, relative));
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const seed = JSON.parse(read("data/projects.seed.json"));
const projects = seed.projects || [];
const built = projects.filter((project) => project.project_type === "BUILT");
const concept = projects.filter((project) => project.project_type === "CONCEPT");
const images = projects.flatMap((project) => project.images || []);
const slugs = projects.map((project) => project.slug);
const featured = projects.filter((project) => project.is_home_featured);

check(projects.length === 31, "seed 프로젝트 31개");
check(built.length === 16, "BUILT 프로젝트 16개");
check(concept.length === 15, "CONCEPT 프로젝트 15개");
check(images.length === 324, "상세 이미지 324개");
check(new Set(slugs).size === slugs.length, "slug 중복 없음");
check(featured.length === 3, "HOME 대표 프로젝트 3개");
check(new Set(featured.map((project) => project.home_order)).size === featured.length, "HOME 순서 중복 없음");

for (const project of projects) {
  check(Boolean(project.name && project.slug && project.project_type), `${project.slug}: 필수 데이터`);
  check(project.published === true, `${project.slug}: 초기 공개 상태`);
  const cover = String(project.cover_image_url || "").replace(/^\.\//, "");
  check(exists(cover), `${project.slug}: 대표 이미지 경로`);
  check(Boolean(project.images?.length), `${project.slug}: 상세 이미지 존재`);
  project.images.forEach((image, index) => {
    const source = String(image.source_path || image.image_url || "").replace(/^\.\//, "");
    check(exists(source), `${project.slug}: 이미지 ${index + 1} 경로`);
    check(image.sort_order === index + 1, `${project.slug}: 이미지 ${index + 1} 순서`);
  });
  check(exists(project.legacy_path), `${project.slug}: 기존 URL 호환 파일`);
  const legacy = read(project.legacy_path);
  check(legacy.includes(`project.html?slug=${project.slug}`), `${project.slug}: 동적 상세 리다이렉트`);
}

const htmlFiles = fs.readdirSync(root).filter((name) => name.endsWith(".html"));
htmlFiles.push("admin/index.html");
for (const htmlFile of htmlFiles) {
  const html = read(htmlFile);
  const base = path.dirname(htmlFile);
  for (const match of html.matchAll(/(?:href|src)=["']([^"'#?]+)(?:\?[^"']*)?["']/g)) {
    const reference = match[1];
    if (/^(?:https?:|mailto:|tel:|data:|blob:|\/\/)/i.test(reference)) continue;
    const resolved = path.normalize(path.join(base, reference));
    check(exists(resolved), `${htmlFile}: ${reference}`);
  }
}

const adminHtml = read("admin/index.html");
for (const id of [
  "loginView", "loginForm", "dashboardView", "projectList", "editorDialog",
  "projectForm", "imageFiles", "imageQueue", "deleteDialog", "migrationDialog",
]) {
  check(adminHtml.includes(`id="${id}"`), `관리자 UI #${id}`);
}

const config = read("config.js");
const executableConfig = config.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
check(!/(service_role|sb_secret_)/i.test(executableConfig), "공개 설정에 Secret/Service Role 키 없음");
const optimizer = read("cms/image-optimizer.js");
check(optimizer.includes('"image/webp"'), "브라우저 WebP 변환");
check(optimizer.includes("maxLongEdge: 2560"), "긴 변 2560px 제한");
check(optimizer.includes("quality: 0.86"), "WebP 품질 86%");
const adminScript = read("admin/admin.js");
check(adminScript.includes("coverDirty: false"), "대표 이미지 변경 상태 추적");
check(adminScript.includes("state.coverDirty = true"), "대표 이미지 재지정 감지");
check(adminScript.includes("cover-${Date.now()}-${crypto.randomUUID()"), "대표 이미지 캐시 방지 경로");
check(adminScript.includes('.select("id, cover_image_url, cover_storage_path")'), "대표 이미지 DB 저장 확인");
const dynamicProject = read("cms/project-dynamic.js");
const cmsCss = read("cms/cms.css");
check(dynamicProject.includes('class="project-title-en"'), "상세 영문명 전용 요소");
check(cmsCss.includes("word-spacing:.3em"), "상세 영문명 단어 간격");
check(cmsCss.includes("letter-spacing:.075em"), "상세 영문명 자간");
const schema = read("supabase/schema.sql");
check(schema.includes("enable row level security"), "RLS 활성화 SQL");
check(schema.includes("public.is_yiso_admin()"), "관리자 권한 정책");
check(schema.includes("allowed_mime_types = excluded.allowed_mime_types"), "Storage WebP 제한");
check(schema.includes("projects_home_featured_limit"), "HOME 최대 3개 DB 제한");

const result = {
  ok: errors.length === 0,
  checked: checks.length + errors.length,
  passed: checks.length,
  failed: errors.length,
  errors,
};
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exit(1);
