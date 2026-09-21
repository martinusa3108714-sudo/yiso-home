const rootUrl = new URL("../", import.meta.url);
const config = window.YISO_CMS_CONFIG || {};
const configured =
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.supabaseUrl || "") &&
  /^(sb_publishable_|eyJ)/.test(config.supabasePublishableKey || "") &&
  !String(config.supabasePublishableKey).includes("REPLACE_ME");

let client;
let cache;
let createClient;

if (configured) {
  ({ createClient } = await import("https://esm.sh/@supabase/supabase-js@2.57.4"));
}

export const cmsConfig = config;
export const isCmsConfigured = configured;
export const siteAssetUrl = (value) => {
  if (!value) return "";
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  return new URL(String(value).replace(/^\.\//, ""), rootUrl).href;
};

export function getSupabase() {
  if (!configured) return null;
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }
  return client;
}

export function publicUrlForStoragePath(path) {
  const supabase = getSupabase();
  if (!supabase || !path) return "";
  return supabase.storage.from(config.storageBucket || "projects").getPublicUrl(path).data.publicUrl;
}

async function loadSeed() {
  const response = await fetch(new URL("data/projects.seed.json", rootUrl), { cache: "no-cache" });
  if (!response.ok) throw new Error("초기 프로젝트 데이터를 불러오지 못했습니다.");
  const payload = await response.json();
  return payload.projects.map(normalizeProject);
}

export async function loadSeedProjects() {
  return loadSeed();
}

function normalizeProject(project) {
  const images = [...(project.project_images || project.images || [])]
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    .map((image) => ({ ...image, image_url: siteAssetUrl(image.image_url) }));
  return {
    ...project,
    published: project.published ?? project.is_published ?? true,
    cover_image_url: siteAssetUrl(project.cover_image_url),
    images,
    project_images: images
  };
}

async function cmsIsReady(supabase) {
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "cms_ready")
    .maybeSingle();
  if (error) throw error;
  return data?.value === true || data?.value?.enabled === true;
}

export async function getPublicProjects({ refresh = false } = {}) {
  if (!refresh && cache) return cache;
  const supabase = getSupabase();
  if (supabase) {
    try {
      if (await cmsIsReady(supabase)) {
        const { data, error } = await supabase
          .from("projects")
          .select("*, project_images(*)")
          .eq("published", true)
          .order("sort_order", { ascending: true });
        if (error) throw error;
        cache = (data || []).map(normalizeProject);
        return cache;
      }
    } catch (error) {
      console.warn("YISO CMS fallback:", error.message);
    }
  }
  cache = await loadSeed();
  return cache;
}

export async function getProjectBySlug(slug) {
  const projects = await getPublicProjects();
  return projects.find((project) => project.slug === slug) || null;
}

export function projectUrl(project) {
  return `./project.html?slug=${encodeURIComponent(project.slug)}`;
}

export function clearCmsCache() {
  cache = null;
}
