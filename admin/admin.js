import {
  cmsConfig,
  getSupabase,
  isCmsConfigured,
  loadSeedProjects,
  publicUrlForStoragePath,
  siteAssetUrl,
} from "../cms/cms-client.js";
import { formatBytes, optimizeImage } from "../cms/image-optimizer.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const supabase = getSupabase();
const imageOptions = {
  maxLongEdge: Number(cmsConfig.imageMaxLongEdge) || 2560,
  quality: Number(cmsConfig.imageWebpQuality) || 0.86,
};

const views = {
  login: $("#loginView"),
  dashboard: $("#dashboardView"),
};

const state = {
  session: null,
  projects: [],
  editingProject: null,
  imageItems: [],
  coverKey: null,
  removedImageIds: new Set(),
  removedStoragePaths: new Set(),
  projectDragSlug: null,
  imageDragKey: null,
  busy: false,
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function setMessage(target, message = "", tone = "") {
  const element = typeof target === "string" ? $(target) : target;
  if (!element) return;
  element.textContent = message;
  element.dataset.tone = tone;
  element.hidden = !message;
}

function setBusy(isBusy, label = "저장 중...") {
  state.busy = isBusy;
  $$('[data-busy-action]').forEach((button) => {
    button.disabled = isBusy;
    button.setAttribute("aria-busy", String(isBusy));
  });
}

function showView(name) {
  Object.entries(views).forEach(([key, element]) => {
    element.hidden = key !== name;
  });
}

async function ensureAdmin(userId) {
  const { data, error } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function loadProjects() {
  const { data, error } = await supabase
    .from("projects")
    .select("*, project_images(*)")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  state.projects = (data || []).map((project) => ({
    ...project,
    project_images: [...(project.project_images || [])].sort(
      (a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0),
    ),
  }));
  renderProjectList();
}

function projectTypeLabel(type) {
  return type === "CONCEPT" ? "CONCEPT" : "BUILT";
}

function renderProjectList() {
  const list = $("#projectList");
  const count = $("#projectCount");
  count.textContent = `${state.projects.length} PROJECTS`;
  if (!state.projects.length) {
    list.innerHTML = '<div class="admin-empty">아직 등록된 프로젝트가 없습니다.</div>';
    return;
  }

  list.innerHTML = state.projects
    .map(
      (project) => `
        <article class="project-row" draggable="true" data-slug="${escapeHtml(project.slug)}">
          <button class="drag-handle" type="button" aria-label="프로젝트 순서 변경">⋮⋮</button>
          <img class="project-thumb" src="${escapeHtml(project.cover_image_url)}" alt="" loading="lazy">
          <div class="project-row-main">
            <strong>${escapeHtml(project.name)}</strong>
            <span>${escapeHtml(project.year || "—")} · ${escapeHtml(projectTypeLabel(project.project_type))}</span>
          </div>
          <div class="project-badges">
            <button class="status-badge ${project.published ? "is-on" : ""}" type="button" data-action="toggle-published" aria-pressed="${project.published}">
              ${project.published ? "공개" : "비공개"}
            </button>
            ${project.is_home_featured ? '<span class="status-badge is-home">HOME</span>' : ""}
          </div>
          <div class="project-row-actions">
            <a class="icon-button" href="../project.html?slug=${encodeURIComponent(project.slug)}" target="_blank" rel="noopener">보기</a>
            <button class="icon-button order-button" type="button" data-action="move-up" aria-label="앞으로 이동">↑</button>
            <button class="icon-button order-button" type="button" data-action="move-down" aria-label="뒤로 이동">↓</button>
            <button class="icon-button" type="button" data-action="edit">수정</button>
            <button class="icon-button danger" type="button" data-action="delete">삭제</button>
          </div>
        </article>
      `,
    )
    .join("");

  $$(".project-row", list).forEach((row) => {
    row.addEventListener("dragstart", () => {
      state.projectDragSlug = row.dataset.slug;
      row.classList.add("is-dragging");
    });
    row.addEventListener("dragend", () => {
      row.classList.remove("is-dragging");
      state.projectDragSlug = null;
    });
    row.addEventListener("dragover", (event) => event.preventDefault());
    row.addEventListener("drop", async (event) => {
      event.preventDefault();
      const sourceSlug = state.projectDragSlug;
      const targetSlug = row.dataset.slug;
      if (!sourceSlug || sourceSlug === targetSlug) return;
      const sourceIndex = state.projects.findIndex((item) => item.slug === sourceSlug);
      const targetIndex = state.projects.findIndex((item) => item.slug === targetSlug);
      const [moved] = state.projects.splice(sourceIndex, 1);
      state.projects.splice(targetIndex, 0, moved);
      renderProjectList();
      await persistProjectOrder();
    });

    row.addEventListener("click", async (event) => {
      const action = event.target.closest("[data-action]")?.dataset.action;
      const project = state.projects.find((item) => item.slug === row.dataset.slug);
      if (!action || !project || state.busy) return;
      if (action === "edit") openEditor(project);
      if (action === "delete") openDeleteDialog(project);
      if (action === "toggle-published") await togglePublished(project);
      if (action === "move-up") await moveProject(project.slug, -1);
      if (action === "move-down") await moveProject(project.slug, 1);
    });
  });
}

async function moveProject(slug, direction) {
  const current = state.projects.findIndex((project) => project.slug === slug);
  const target = current + direction;
  if (current < 0 || target < 0 || target >= state.projects.length) return;
  [state.projects[current], state.projects[target]] = [state.projects[target], state.projects[current]];
  renderProjectList();
  await persistProjectOrder();
}

async function persistProjectOrder() {
  setMessage("#dashboardMessage", "프로젝트 순서를 저장하고 있습니다.");
  try {
    const updates = state.projects.map((project, index) =>
      supabase.from("projects").update({ sort_order: index + 1 }).eq("id", project.id),
    );
    const results = await Promise.all(updates);
    const failed = results.find(({ error }) => error);
    if (failed) throw failed.error;
    state.projects.forEach((project, index) => {
      project.sort_order = index + 1;
    });
    setMessage("#dashboardMessage", "프로젝트 순서를 저장했습니다.", "success");
  } catch (error) {
    setMessage("#dashboardMessage", `순서를 저장하지 못했습니다: ${friendlyError(error)}`, "error");
    await loadProjects();
  }
}

async function togglePublished(project) {
  const nextPublished = !project.published;
  const payload = { published: nextPublished };
  if (!nextPublished) {
    payload.is_home_featured = false;
    payload.home_order = null;
  }
  const { error } = await supabase.from("projects").update(payload).eq("id", project.id);
  if (error) {
    setMessage("#dashboardMessage", `공개 상태를 변경하지 못했습니다: ${friendlyError(error)}`, "error");
    return;
  }
  await loadProjects();
}

function emptyEditorState() {
  state.editingProject = null;
  state.imageItems.forEach((item) => item.pending && URL.revokeObjectURL(item.preview));
  state.imageItems = [];
  state.coverKey = null;
  state.removedImageIds.clear();
  state.removedStoragePaths.clear();
}

function openEditor(project = null) {
  emptyEditorState();
  state.editingProject = project ? structuredClone(project) : null;
  const form = $("#projectForm");
  form.reset();
  $("#editorTitle").textContent = project ? "EDIT PROJECT" : "NEW PROJECT";
  $("#projectId").value = project?.id || "";
  $("#projectName").value = project?.name || "";
  $("#projectNameEn").value = project?.name_en || "";
  $("#projectSlug").value = project?.slug || "";
  delete $("#projectSlug").dataset.edited;
  $("#projectSlug").readOnly = Boolean(project);
  $("#projectType").value = project?.project_type || "BUILT";
  $("#projectYear").value = project?.year || "";
  $("#projectLocation").value = project?.location || "";
  $("#projectCategory").value = project?.category || "";
  $("#projectShortDescription").value = project?.short_description || "";
  $("#projectIntroTitle").value = project?.intro_title || "";
  $("#projectDetailDescription").value = project?.detail_description || "";
  $("#projectScope").value = project?.project_scope || "";
  $("#projectPublished").checked = project ? Boolean(project.published) : true;
  $("#projectHomeFeatured").checked = Boolean(project?.is_home_featured);
  $("#projectHomeOrder").value = project?.home_order || "";
  $("#projectSortOrder").value = project?.sort_order || state.projects.length + 1;

  if (project?.cover_image_url) {
    const coverMatch = project.project_images?.find(
      (image) =>
        image.image_url === project.cover_image_url ||
        image.storage_path === project.cover_storage_path,
    );
    if (!coverMatch) {
      state.imageItems.push({
        key: `cover-${project.id}`,
        id: null,
        image_url: project.cover_image_url,
        storage_path: project.cover_storage_path,
        preview: project.cover_image_url,
        pending: false,
        gallery: false,
        alt_text: `${project.name} 대표 이미지`,
      });
      state.coverKey = `cover-${project.id}`;
    }
  }

  (project?.project_images || []).forEach((image) => {
    const key = `existing-${image.id}`;
    state.imageItems.push({
      ...image,
      key,
      preview: image.image_url,
      pending: false,
      gallery: true,
    });
    if (
      image.image_url === project.cover_image_url ||
      image.storage_path === project.cover_storage_path
    ) {
      state.coverKey = key;
    }
  });
  if (!state.coverKey && state.imageItems.length) state.coverKey = state.imageItems[0].key;
  renderImageQueue();
  setMessage("#editorMessage");
  $("#editorDialog").showModal();
}

function closeEditor() {
  if (state.busy) return;
  $("#editorDialog").close();
  emptyEditorState();
}

function renderImageQueue() {
  const queue = $("#imageQueue");
  if (!state.imageItems.length) {
    queue.innerHTML = '<div class="image-empty">JPG 또는 PNG 이미지를 선택해주세요.<br>선택 즉시 브라우저에서 WebP로 변환됩니다.</div>';
    return;
  }
  queue.innerHTML = state.imageItems
    .map(
      (item, index) => `
        <article class="image-item ${state.coverKey === item.key ? "is-cover" : ""}" draggable="${item.gallery}" data-key="${escapeHtml(item.key)}">
          <img src="${escapeHtml(item.preview)}" alt="" loading="lazy">
          <div class="image-index">${item.gallery ? String(state.imageItems.filter((candidate) => candidate.gallery).findIndex((candidate) => candidate.key === item.key) + 1).padStart(2, "0") : "COVER"}</div>
          <div class="image-meta">
            <strong>${state.coverKey === item.key ? "대표 이미지" : item.gallery ? "상세 이미지" : "대표 전용"}</strong>
            <span>${item.pending ? `${item.width}×${item.height} · ${formatBytes(item.blob.size)}` : "업로드 완료"}</span>
          </div>
          <div class="image-actions">
            <button type="button" data-image-action="cover">대표 설정</button>
            ${item.gallery ? '<button type="button" data-image-action="left" aria-label="앞으로 이동">←</button><button type="button" data-image-action="right" aria-label="뒤로 이동">→</button>' : ""}
            <button type="button" data-image-action="remove" class="danger">삭제</button>
          </div>
        </article>
      `,
    )
    .join("");

  $$(".image-item", queue).forEach((element) => {
    const key = element.dataset.key;
    element.addEventListener("dragstart", () => {
      state.imageDragKey = key;
      element.classList.add("is-dragging");
    });
    element.addEventListener("dragend", () => {
      state.imageDragKey = null;
      element.classList.remove("is-dragging");
    });
    element.addEventListener("dragover", (event) => event.preventDefault());
    element.addEventListener("drop", (event) => {
      event.preventDefault();
      moveImage(state.imageDragKey, key);
    });
    element.addEventListener("click", (event) => {
      const action = event.target.closest("[data-image-action]")?.dataset.imageAction;
      if (!action) return;
      if (action === "cover") state.coverKey = key;
      if (action === "remove") removeImage(key);
      if (action === "left") shiftImage(key, -1);
      if (action === "right") shiftImage(key, 1);
      renderImageQueue();
    });
  });
}

function galleryItems() {
  return state.imageItems.filter((item) => item.gallery);
}

function moveImage(sourceKey, targetKey) {
  if (!sourceKey || sourceKey === targetKey) return;
  const source = state.imageItems.find((item) => item.key === sourceKey);
  const target = state.imageItems.find((item) => item.key === targetKey);
  if (!source?.gallery || !target?.gallery) return;
  const from = state.imageItems.indexOf(source);
  const to = state.imageItems.indexOf(target);
  state.imageItems.splice(from, 1);
  state.imageItems.splice(to, 0, source);
  renderImageQueue();
}

function shiftImage(key, direction) {
  const gallery = galleryItems();
  const item = gallery.find((candidate) => candidate.key === key);
  const current = gallery.indexOf(item);
  const target = current + direction;
  if (!item || target < 0 || target >= gallery.length) return;
  const other = gallery[target];
  const itemIndex = state.imageItems.indexOf(item);
  const otherIndex = state.imageItems.indexOf(other);
  [state.imageItems[itemIndex], state.imageItems[otherIndex]] = [
    state.imageItems[otherIndex],
    state.imageItems[itemIndex],
  ];
}

function removeImage(key) {
  const item = state.imageItems.find((candidate) => candidate.key === key);
  if (!item) return;
  if (item.id) state.removedImageIds.add(item.id);
  if (item.storage_path) state.removedStoragePaths.add(item.storage_path);
  if (item.pending) URL.revokeObjectURL(item.preview);
  state.imageItems = state.imageItems.filter((candidate) => candidate.key !== key);
  if (state.coverKey === key) state.coverKey = state.imageItems[0]?.key || null;
}

async function addSelectedFiles(files) {
  const accepted = [...files].filter((file) => /image\/(jpeg|png|webp)/.test(file.type));
  if (!accepted.length) {
    setMessage("#editorMessage", "JPG, PNG 또는 WebP 이미지를 선택해주세요.", "error");
    return;
  }
  setMessage("#editorMessage", `${accepted.length}장의 이미지를 WebP로 최적화하고 있습니다.`);
  $("#imageFiles").disabled = true;
  try {
    for (const file of accepted) {
      const optimized = await optimizeImage(file, imageOptions);
      const key = `pending-${crypto.randomUUID()}`;
      state.imageItems.push({
        key,
        pending: true,
        gallery: true,
        blob: optimized.blob,
        preview: URL.createObjectURL(optimized.blob),
        width: optimized.width,
        height: optimized.height,
        alt_text: file.name.replace(/\.[^.]+$/, ""),
        originalName: file.name,
      });
      if (!state.coverKey) state.coverKey = key;
      renderImageQueue();
    }
    setMessage("#editorMessage", "WebP 변환을 완료했습니다. 대표 이미지와 순서를 확인해주세요.", "success");
  } catch (error) {
    setMessage("#editorMessage", `이미지 변환에 실패했습니다: ${friendlyError(error)}`, "error");
  } finally {
    $("#imageFiles").disabled = false;
    $("#imageFiles").value = "";
  }
}

async function uploadBlob(path, blob, upsert = false) {
  const { error } = await supabase.storage.from(cmsConfig.storageBucket).upload(path, blob, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert,
  });
  if (error) throw error;
  return { path, url: publicUrlForStoragePath(path) };
}

function formPayload() {
  const isHome = $("#projectHomeFeatured").checked;
  return {
    name: $("#projectName").value.trim(),
    name_en: $("#projectNameEn").value.trim(),
    slug: slugify($("#projectSlug").value),
    project_type: $("#projectType").value,
    year: $("#projectYear").value.trim(),
    location: $("#projectLocation").value.trim(),
    category: $("#projectCategory").value.trim(),
    short_description: $("#projectShortDescription").value.trim(),
    intro_title: $("#projectIntroTitle").value.trim(),
    detail_description: $("#projectDetailDescription").value.trim(),
    project_scope: $("#projectScope").value.trim(),
    published: $("#projectPublished").checked,
    is_home_featured: isHome,
    home_order: isHome ? Number($("#projectHomeOrder").value || 0) || null : null,
    sort_order: Number($("#projectSortOrder").value || state.projects.length + 1),
  };
}

function validatePayload(payload) {
  if (!payload.name) throw new Error("프로젝트명을 입력해주세요.");
  if (!payload.slug) throw new Error("영문 URL slug를 입력해주세요.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.slug)) {
    throw new Error("slug는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.");
  }
  if (!payload.year) throw new Error("연도를 입력해주세요.");
  if (!state.imageItems.length || !state.coverKey) throw new Error("대표 이미지를 지정해주세요.");
  if (!galleryItems().length) throw new Error("상세 이미지를 한 장 이상 등록해주세요.");
  if (payload.is_home_featured && !payload.published) {
    throw new Error("HOME 대표 프로젝트는 공개 상태여야 합니다.");
  }
  if (payload.is_home_featured && ![1, 2, 3].includes(payload.home_order)) {
    throw new Error("HOME 표시 순서는 1, 2, 3 중 하나를 선택해주세요.");
  }
  const conflictingHome = state.projects.find(
    (project) =>
      project.is_home_featured &&
      Number(project.home_order) === payload.home_order &&
      project.id !== state.editingProject?.id,
  );
  if (payload.is_home_featured && conflictingHome) {
    throw new Error(`HOME ${payload.home_order}번은 '${conflictingHome.name}'에서 사용 중입니다.`);
  }
}

function snapshotProject(project) {
  if (!project) return null;
  const copy = { ...project };
  delete copy.project_images;
  delete copy.created_at;
  delete copy.updated_at;
  return copy;
}

async function saveProject(event) {
  event.preventDefault();
  if (state.busy) return;
  const payload = formPayload();
  const uploadedPaths = [];
  const uploadedItemKeys = [];
  let insertedProjectId = null;
  const original = snapshotProject(state.editingProject);

  try {
    validatePayload(payload);
    setBusy(true);
    setMessage("#editorMessage", "최적화된 이미지를 업로드하고 프로젝트를 저장하고 있습니다.");

    for (let index = 0; index < state.imageItems.length; index += 1) {
      const item = state.imageItems[index];
      if (!item.pending) continue;
      const sequence = String(Math.max(1, galleryItems().findIndex((candidate) => candidate.key === item.key) + 1)).padStart(2, "0");
      const path = `${payload.slug}/details/${sequence}-${crypto.randomUUID().slice(0, 8)}.webp`;
      const uploaded = await uploadBlob(path, item.blob);
      uploadedPaths.push(path);
      uploadedItemKeys.push(item.key);
      Object.assign(item, {
        pending: false,
        storage_path: uploaded.path,
        image_url: uploaded.url,
      });
    }

    const coverItem = state.imageItems.find((item) => item.key === state.coverKey);
    if (!coverItem?.image_url) throw new Error("대표 이미지 업로드에 실패했습니다.");
    const coverChanged =
      !state.editingProject ||
      coverItem.image_url !== state.editingProject.cover_image_url ||
      coverItem.storage_path !== state.editingProject.cover_storage_path;
    if (coverChanged) {
      const coverBlob = coverItem.blob || (await fetch(coverItem.image_url)).blob();
      const coverPath = state.editingProject
        ? `${payload.slug}/cover-${crypto.randomUUID().slice(0, 8)}.webp`
        : `${payload.slug}/cover.webp`;
      const coverUpload = await uploadBlob(coverPath, coverBlob, true);
      uploadedPaths.push(coverPath);
      payload.cover_image_url = coverUpload.url;
      payload.cover_storage_path = coverUpload.path;
      const oldCoverPath = state.editingProject?.cover_storage_path;
      if (oldCoverPath && oldCoverPath !== coverUpload.path) {
        state.removedStoragePaths.add(oldCoverPath);
      }
    } else {
      payload.cover_image_url = coverItem.image_url;
      payload.cover_storage_path = coverItem.storage_path || null;
    }
    payload.cover_alt = `${payload.name} 대표 이미지`;

    let projectId = state.editingProject?.id;
    if (projectId) {
      const { error } = await supabase.from("projects").update(payload).eq("id", projectId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from("projects").insert(payload).select("id").single();
      if (error) throw error;
      projectId = data.id;
      insertedProjectId = data.id;
    }

    const ordered = galleryItems();
    for (let index = 0; index < ordered.length; index += 1) {
      const item = ordered[index];
      const imagePayload = {
        project_id: projectId,
        image_url: item.image_url,
        storage_path: item.storage_path || null,
        alt_text: item.alt_text || `${payload.name} 상세 이미지 ${index + 1}`,
        width: item.width || null,
        height: item.height || null,
        sort_order: index + 1,
      };
      if (item.id) {
        const { error } = await supabase.from("project_images").update(imagePayload).eq("id", item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("project_images").insert(imagePayload);
        if (error) throw error;
      }
    }

    if (state.removedImageIds.size) {
      const { error } = await supabase
        .from("project_images")
        .delete()
        .in("id", [...state.removedImageIds]);
      if (error) throw error;
    }

    if (state.removedStoragePaths.size) {
      const activePaths = new Set(state.imageItems.map((item) => item.storage_path).filter(Boolean));
      const removable = [...state.removedStoragePaths].filter((path) => !activePaths.has(path));
      if (removable.length) await supabase.storage.from(cmsConfig.storageBucket).remove(removable);
    }

    setMessage("#dashboardMessage", `'${payload.name}' 프로젝트를 저장했습니다.`, "success");
    $("#editorDialog").close();
    emptyEditorState();
    await loadProjects();
  } catch (error) {
    if (insertedProjectId) {
      await supabase.from("projects").delete().eq("id", insertedProjectId);
    } else if (original?.id) {
      await supabase.from("projects").update(original).eq("id", original.id);
    }
    if (uploadedPaths.length) await supabase.storage.from(cmsConfig.storageBucket).remove(uploadedPaths);
    state.imageItems.forEach((item) => {
      if (!uploadedItemKeys.includes(item.key)) return;
      item.pending = true;
      delete item.image_url;
      delete item.storage_path;
    });
    setMessage("#editorMessage", `저장하지 못했습니다: ${friendlyError(error)}`, "error");
  } finally {
    setBusy(false);
  }
}

function openDeleteDialog(project) {
  $("#deleteProjectName").textContent = project.name;
  $("#confirmDelete").dataset.projectId = project.id;
  $("#deleteDialog").showModal();
}

async function deleteProject() {
  if (state.busy) return;
  const projectId = $("#confirmDelete").dataset.projectId;
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;
  setBusy(true, "삭제 중...");
  try {
    const paths = new Set(
      [project.cover_storage_path, ...(project.project_images || []).map((image) => image.storage_path)].filter(Boolean),
    );
    const { error } = await supabase.from("projects").delete().eq("id", project.id);
    if (error) throw error;
    let storageWarning = "";
    if (paths.size) {
      const { error: storageError } = await supabase.storage
        .from(cmsConfig.storageBucket)
        .remove([...paths]);
      if (storageError) storageWarning = " 이미지 파일 정리는 재시도가 필요합니다.";
    }
    $("#deleteDialog").close();
    setMessage("#dashboardMessage", `'${project.name}' 프로젝트를 삭제했습니다.${storageWarning}`, storageWarning ? "error" : "success");
    await loadProjects();
  } catch (error) {
    setMessage("#dashboardMessage", `삭제하지 못했습니다: ${friendlyError(error)}`, "error");
  } finally {
    setBusy(false);
  }
}

async function login(event) {
  event.preventDefault();
  setMessage("#loginMessage", "로그인하고 있습니다.");
  $("#loginButton").disabled = true;
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: $("#loginEmail").value.trim(),
      password: $("#loginPassword").value,
    });
    if (error) throw error;
    if (!(await ensureAdmin(data.user.id))) {
      await supabase.auth.signOut();
      throw new Error("이 계정에는 YISO 관리자 권한이 없습니다.");
    }
    state.session = data.session;
    $("#adminEmail").textContent = data.user.email || "";
    showView("dashboard");
    await loadProjects();
  } catch (error) {
    setMessage("#loginMessage", friendlyError(error), "error");
  } finally {
    $("#loginButton").disabled = false;
  }
}

async function logout() {
  await supabase.auth.signOut();
  state.session = null;
  state.projects = [];
  showView("login");
}

async function migrateExistingProjects() {
  if (state.busy) return;
  const progress = $("#migrationProgress");
  const status = $("#migrationStatus");
  setBusy(true, "이전 중...");
  progress.value = 0;
  status.textContent = "기존 프로젝트 목록을 불러오고 있습니다.";
  try {
    const seed = await loadSeedProjects();
    const existingSlugs = new Set(state.projects.map((project) => project.slug));
    let completed = 0;
    let imported = 0;
    const skipped = [];

    for (const project of seed) {
      if (existingSlugs.has(project.slug)) {
        skipped.push(project.slug);
        completed += 1;
        progress.value = (completed / seed.length) * 100;
        continue;
      }
      status.textContent = `${completed + 1}/${seed.length} · ${project.name} 이미지 최적화 및 업로드`;
      const uploadedPaths = [];
      let newProjectId = null;
      try {
        const coverResponse = await fetch(siteAssetUrl(project.cover_image_path || project.cover_image_url));
        if (!coverResponse.ok) throw new Error(`대표 이미지를 읽지 못했습니다 (${coverResponse.status}).`);
        const coverOptimized = await optimizeImage(await coverResponse.blob(), imageOptions);
        const coverPath = `${project.slug}/cover.webp`;
        const coverUpload = await uploadBlob(coverPath, coverOptimized.blob, true);
        uploadedPaths.push(coverPath);

        const projectPayload = {
          name: project.name,
          name_en: project.name_en,
          slug: project.slug,
          project_type: project.project_type,
          year: String(project.year || ""),
          location: project.location,
          category: project.category,
          short_description: project.short_description,
          intro_title: project.intro_title,
          detail_description: project.detail_description,
          project_scope: project.project_scope,
          cover_image_url: coverUpload.url,
          cover_storage_path: coverUpload.path,
          cover_alt: project.cover_alt || `${project.name} 대표 이미지`,
          published: project.published,
          is_home_featured: project.is_home_featured,
          home_order: project.home_order,
          sort_order: project.sort_order,
        };
        const { data: inserted, error: insertError } = await supabase
          .from("projects")
          .insert(projectPayload)
          .select("id")
          .single();
        if (insertError) throw insertError;
        newProjectId = inserted.id;

        const imageRows = [];
        for (let imageIndex = 0; imageIndex < project.images.length; imageIndex += 1) {
          const image = project.images[imageIndex];
          status.textContent = `${completed + 1}/${seed.length} · ${project.name} · ${imageIndex + 1}/${project.images.length}`;
          const response = await fetch(siteAssetUrl(image.source_path));
          if (!response.ok) throw new Error(`상세 이미지 ${imageIndex + 1}을 읽지 못했습니다.`);
          const optimized = await optimizeImage(await response.blob(), imageOptions);
          const imagePath = `${project.slug}/${String(imageIndex + 1).padStart(2, "0")}.webp`;
          const uploaded = await uploadBlob(imagePath, optimized.blob, true);
          uploadedPaths.push(imagePath);
          imageRows.push({
            project_id: newProjectId,
            image_url: uploaded.url,
            storage_path: uploaded.path,
            alt_text: image.alt_text || `${project.name} 상세 이미지 ${imageIndex + 1}`,
            width: optimized.width,
            height: optimized.height,
            sort_order: imageIndex + 1,
          });
        }
        if (imageRows.length) {
          const { error: imagesError } = await supabase.from("project_images").insert(imageRows);
          if (imagesError) throw imagesError;
        }
        imported += 1;
      } catch (error) {
        if (newProjectId) await supabase.from("projects").delete().eq("id", newProjectId);
        if (uploadedPaths.length) await supabase.storage.from(cmsConfig.storageBucket).remove(uploadedPaths);
        throw new Error(`${project.name}: ${friendlyError(error)}`);
      }
      completed += 1;
      progress.value = (completed / seed.length) * 100;
    }

    const { data: saved, error: checkError } = await supabase.from("projects").select("slug");
    if (checkError) throw checkError;
    const savedSlugs = new Set((saved || []).map((project) => project.slug));
    const missing = seed.filter((project) => !savedSlugs.has(project.slug));
    if (missing.length) throw new Error(`${missing.length}개 프로젝트가 누락되어 CMS 전환을 보류했습니다.`);

    const { error: settingError } = await supabase
      .from("site_settings")
      .upsert({ key: "cms_ready", value: true }, { onConflict: "key" });
    if (settingError) throw settingError;
    status.textContent = `완료: ${imported}개 이전, ${skipped.length}개 기존 데이터 유지. 이제 홈페이지가 Supabase 데이터를 사용합니다.`;
    setMessage("#dashboardMessage", "기존 프로젝트 이전과 CMS 전환을 완료했습니다.", "success");
    await loadProjects();
  } catch (error) {
    status.textContent = `이전 중단: ${friendlyError(error)} 다시 실행하면 이미 완료된 프로젝트는 건너뜁니다.`;
  } finally {
    setBusy(false);
  }
}

function friendlyError(error) {
  const message = error?.message || String(error || "알 수 없는 오류");
  if (/Failed to fetch|NetworkError/i.test(message)) return "네트워크 연결을 확인한 뒤 다시 시도해주세요.";
  if (/JWT|session|refresh token/i.test(message)) return "로그인이 만료되었습니다. 다시 로그인해주세요.";
  if (/duplicate key|unique constraint/i.test(message)) return "같은 slug 또는 표시 순서가 이미 사용 중입니다.";
  if (/row-level security|permission denied/i.test(message)) return "관리자 권한을 확인해주세요.";
  return message;
}

function bindEvents() {
  $("#loginForm").addEventListener("submit", login);
  $("#logoutButton").addEventListener("click", logout);
  $("#newProjectButton").addEventListener("click", () => openEditor());
  $("#closeEditor").addEventListener("click", closeEditor);
  $("#cancelEditor").addEventListener("click", closeEditor);
  $("#projectForm").addEventListener("submit", saveProject);
  $("#projectName").addEventListener("input", (event) => {
    if (!state.editingProject && !$("#projectSlug").dataset.edited) {
      $("#projectSlug").value = slugify(event.target.value);
    }
  });
  $("#projectSlug").addEventListener("input", (event) => {
    event.target.dataset.edited = "true";
    event.target.value = slugify(event.target.value);
  });
  $("#imageFiles").addEventListener("change", (event) => addSelectedFiles(event.target.files));
  $("#cancelDelete").addEventListener("click", () => $("#deleteDialog").close());
  $("#confirmDelete").addEventListener("click", deleteProject);
  $("#migrationButton").addEventListener("click", () => $("#migrationDialog").showModal());
  $("#closeMigration").addEventListener("click", () => !state.busy && $("#migrationDialog").close());
  $("#startMigration").addEventListener("click", migrateExistingProjects);
}

async function bootstrap() {
  bindEvents();
  if (!isCmsConfigured()) {
    showView("login");
    setMessage(
      "#loginMessage",
      "Supabase 연결 정보가 아직 설정되지 않았습니다. CMS_SETUP.md 순서대로 config.js를 설정해주세요.",
      "error",
    );
    $("#loginButton").disabled = true;
    return;
  }

  const { data } = await supabase.auth.getSession();
  if (data.session && (await ensureAdmin(data.session.user.id))) {
    state.session = data.session;
    $("#adminEmail").textContent = data.session.user.email || "";
    showView("dashboard");
    await loadProjects();
  } else {
    if (data.session) await supabase.auth.signOut();
    showView("login");
  }

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || !session) {
      state.session = null;
      showView("login");
    }
  });
}

bootstrap().catch((error) => {
  showView("login");
  setMessage("#loginMessage", `관리자 페이지를 시작하지 못했습니다: ${friendlyError(error)}`, "error");
});
