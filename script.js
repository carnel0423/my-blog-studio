const STORAGE_KEY = "myBlogStudio.posts.v1";
const NO_TAG_LABEL = "タグなし";
const PUBLISHED_DATA_FILE_NAME = "published-data.json";
const PUBLISHED_DATA_REPO_PATH = `docs/${PUBLISHED_DATA_FILE_NAME}`;
const PUBLISH_CONFIG_KEY = "myBlogStudio.publishConfig.v1";
const DEFAULT_PUBLISH_TARGET = {
  owner: "carnel0423",
  repo: "my-blog-studio",
  branch: "main",
  path: PUBLISHED_DATA_REPO_PATH,
};

const els = {
  postList: document.getElementById("postList"),
  searchInput: document.getElementById("searchInput"),
  titleInput: document.getElementById("titleInput"),
  slugInput: document.getElementById("slugInput"),
  statusInput: document.getElementById("statusInput"),
  tagsInput: document.getElementById("tagsInput"),
  keyPointsInput: document.getElementById("keyPointsInput"),
  contentInput: document.getElementById("contentInput"),
  insertChapterBtn: document.getElementById("insertChapterBtn"),
  insertSectionBtn: document.getElementById("insertSectionBtn"),
  insertSubSectionBtn: document.getElementById("insertSubSectionBtn"),
  insertImportantBtn: document.getElementById("insertImportantBtn"),
  insertImageUrlBtn: document.getElementById("insertImageUrlBtn"),
  insertVideoUrlBtn: document.getElementById("insertVideoUrlBtn"),
  insertMediaFileBtn: document.getElementById("insertMediaFileBtn"),
  mediaFileInput: document.getElementById("mediaFileInput"),
  preview: document.getElementById("preview"),
  statusLine: document.getElementById("statusLine"),
  newPostBtn: document.getElementById("newPostBtn"),
  savePostBtn: document.getElementById("savePostBtn"),
  deletePostBtn: document.getElementById("deletePostBtn"),
  prePublishPreviewBtn: document.getElementById("prePublishPreviewBtn"),
  exportBtn: document.getElementById("exportBtn"),
  importBtn: document.getElementById("importBtn"),
  importInput: document.getElementById("importInput"),
  publishedViewBtn: document.getElementById("publishedViewBtn"),
  publishDataBtn: document.getElementById("publishDataBtn"),
  previewModal: document.getElementById("previewModal"),
  previewModalBody: document.getElementById("previewModalBody"),
  previewModalCancelBtn: document.getElementById("previewModalCancelBtn"),
  previewModalConfirmBtn: document.getElementById("previewModalConfirmBtn"),
};

const state = {
  posts: [],
  selectedId: null,
  filterText: "",
  slugEdited: false,
  pendingPublishConfirm: null,
  lastSavedSnapshot: "",
  hasUnsavedChanges: false,
  isPublishing: false,
};

if (isEditorRuntimeAllowed()) {
  init();
} else {
  renderEditorBlockedMessage();
}

function isEditorRuntimeAllowed() {
  if (typeof window === "undefined") {
    return true;
  }
  const protocol = String(window.location.protocol || "").toLowerCase();
  const hostname = String(window.location.hostname || "");
  const isHosted = protocol === "http:" || protocol === "https:";
  const isGithubPages = /(^|\.)github\.io$/i.test(hostname);
  return !(isHosted && isGithubPages);
}

function renderEditorBlockedMessage() {
  const shell = document.querySelector(".app-shell");
  if (!shell) {
    return;
  }
  shell.innerHTML = `
    <main style="min-height:60vh;display:grid;place-items:center;padding:24px;">
      <section style="width:min(720px,100%);background:#fff;border:1px solid #d2d7de;border-radius:8px;padding:18px;">
        <h1 style="margin:0 0 10px;font-size:20px;">編集画面は公開サイトでは無効です</h1>
        <p style="margin:0 0 8px;">第三者が操作できないよう、公開ドメイン上では編集機能を停止しています。</p>
        <p style="margin:0 0 12px;">編集はローカルの <code>studio.html</code> から行ってください。</p>
        <p style="margin:0;"><a class="btn" href="index.html">公開ページへ戻る</a></p>
      </section>
    </main>
  `;
}

function init() {
  state.posts = loadPosts();
  bindEvents();
  resetPublishButtonLabel();

  if (state.posts.length > 0) {
    selectPost(state.posts[0].id);
  } else {
    loadDraft(makeEmptyPost());
    renderPostList();
  }

  renderPreview();
}

function bindEvents() {
  els.searchInput.addEventListener("input", () => {
    state.filterText = els.searchInput.value.trim().toLowerCase();
    renderPostList();
  });

  els.titleInput.addEventListener("input", () => {
    if (!state.slugEdited) {
      els.slugInput.value = slugify(els.titleInput.value);
    }
    renderPreview();
  });

  els.slugInput.addEventListener("input", () => {
    state.slugEdited = true;
    updateUnsavedState();
  });

  els.statusInput.addEventListener("change", renderPreview);
  els.tagsInput.addEventListener("input", renderPreview);
  els.keyPointsInput.addEventListener("input", renderPreview);
  els.contentInput.addEventListener("input", renderPreview);
  els.insertChapterBtn.addEventListener("click", () => {
    insertLineIntoContent("## 章タイトル");
    setStatus("章タイトルを本文に挿入しました。");
  });
  els.insertSectionBtn.addEventListener("click", () => {
    insertLineIntoContent("### 節タイトル");
    setStatus("節タイトルを本文に挿入しました。");
  });
  els.insertSubSectionBtn.addEventListener("click", () => {
    insertLineIntoContent("#### 小節タイトル");
    setStatus("小節タイトルを本文に挿入しました。");
  });
  els.insertImportantBtn.addEventListener("click", () => {
    wrapSelectionInContent("!!", "!!", "重要テキスト");
    setStatus("重要マークを挿入しました。");
  });
  els.insertImageUrlBtn.addEventListener("click", () => {
    const url = askForMediaUrl("画像URLを入力してください（https://...）", "https://");
    if (!url) {
      return;
    }
    insertSnippetIntoContent(`![画像](${url})`);
    renderPreview();
    setStatus("画像を本文に挿入しました。");
  });
  els.insertVideoUrlBtn.addEventListener("click", () => {
    const url = askForMediaUrl("動画URLを入力してください（https://...）", "https://");
    if (!url) {
      return;
    }
    insertSnippetIntoContent(`@[video](${url})`);
    renderPreview();
    setStatus("動画を本文に挿入しました。");
  });
  els.insertMediaFileBtn.addEventListener("click", () => els.mediaFileInput.click());
  els.mediaFileInput.addEventListener("change", insertMediaFilesIntoContent);

  els.newPostBtn.addEventListener("click", () => {
    loadDraft(makeEmptyPost());
    state.selectedId = null;
    renderPostList();
    setStatus("新規下書きを作成しました。");
  });

  els.savePostBtn.addEventListener("click", () => saveCurrentPost(false));
  els.deletePostBtn.addEventListener("click", deleteCurrentPost);
  els.prePublishPreviewBtn.addEventListener("click", () => {
    const post = getFormPost();
    if (!post.title || !post.content.trim()) {
      setStatus("タイトルと本文を入力すると公開前プレビューを表示できます。");
      return;
    }
    openPublishPreviewModal({ post, confirmMode: false });
  });
  els.exportBtn.addEventListener("click", exportPosts);
  els.importBtn.addEventListener("click", () => els.importInput.click());
  els.importInput.addEventListener("change", importPostsFromFile);
  els.publishedViewBtn.addEventListener("click", openPublishedView);
  els.publishDataBtn.addEventListener("click", () => {
    void publishBlogNow();
  });

  els.previewModalCancelBtn.addEventListener("click", closePublishPreviewModal);
  els.previewModalConfirmBtn.addEventListener("click", () => {
    const action = state.pendingPublishConfirm;
    closePublishPreviewModal();
    if (typeof action === "function") {
      action();
    }
  });
  els.previewModal.addEventListener("click", (event) => {
    if (event.target === els.previewModal) {
      closePublishPreviewModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    const isSave = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s";
    if (isSave) {
      event.preventDefault();
      saveCurrentPost(false);
      return;
    }

    if (event.key === "Escape" && isPreviewModalOpen()) {
      closePublishPreviewModal();
    }
  });

  window.addEventListener("beforeunload", (event) => {
    if (!state.hasUnsavedChanges) {
      return;
    }
    event.preventDefault();
    event.returnValue = "";
  });
}

function loadPosts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item) => item && item.id && item.title != null && item.content != null)
      .map(normalizePostRecord)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  } catch (error) {
    console.error(error);
    setStatus("保存データの読み込みに失敗しました。");
    return [];
  }
}

function normalizePostRecord(item) {
  return {
    id: String(item.id),
    title: String(item.title || ""),
    slug: String(item.slug || slugify(item.title || "")),
    status: item.status === "published" ? "published" : "draft",
    tags: normalizeTags(item.tags),
    keyPoints: normalizeKeyPoints(item.keyPoints || item.highlights || item.importantPoints),
    content: String(item.content || ""),
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString(),
  };
}

function persistPosts() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.posts));
    return true;
  } catch (error) {
    console.error(error);
    setStatus("保存に失敗しました。画像/動画が大きすぎる可能性があります。");
    return false;
  }
}

function makeEmptyPost() {
  return {
    id: "",
    title: "",
    slug: "",
    status: "draft",
    tags: [],
    keyPoints: [],
    content: "",
    createdAt: "",
    updatedAt: "",
  };
}

function getFormPost() {
  return {
    id: state.selectedId || "",
    title: els.titleInput.value.trim(),
    slug: (els.slugInput.value.trim() || slugify(els.titleInput.value)).toLowerCase(),
    status: els.statusInput.value === "published" ? "published" : "draft",
    tags: parseTagsInput(els.tagsInput.value),
    keyPoints: parseKeyPointsInput(els.keyPointsInput.value),
    content: els.contentInput.value,
    createdAt: "",
    updatedAt: "",
  };
}

function getFormSnapshot() {
  const post = getFormPost();
  return JSON.stringify({
    id: post.id || "",
    title: post.title || "",
    slug: post.slug || "",
    status: post.status || "draft",
    tags: normalizeTags(post.tags),
    keyPoints: normalizeKeyPoints(post.keyPoints),
    content: post.content || "",
  });
}

function markCurrentFormAsSaved() {
  state.lastSavedSnapshot = getFormSnapshot();
  state.hasUnsavedChanges = false;
}

function updateUnsavedState() {
  if (!state.lastSavedSnapshot) {
    state.lastSavedSnapshot = getFormSnapshot();
    state.hasUnsavedChanges = false;
    return;
  }
  state.hasUnsavedChanges = getFormSnapshot() !== state.lastSavedSnapshot;
}

function loadDraft(post) {
  els.titleInput.value = post.title || "";
  els.slugInput.value = post.slug || "";
  els.statusInput.value = post.status || "draft";
  els.tagsInput.value = normalizeTags(post.tags).join(", ");
  els.keyPointsInput.value = normalizeKeyPoints(post.keyPoints).join("\n");
  els.contentInput.value = post.content || "";
  state.slugEdited = false;
  renderPreview();
  markCurrentFormAsSaved();
}

function selectPost(postId) {
  const target = state.posts.find((post) => post.id === postId);
  if (!target) {
    return;
  }
  state.selectedId = target.id;
  loadDraft(target);
  renderPostList();
  setStatus(`「${target.title || "無題"}」を読み込みました。`);
}

function saveCurrentPost(skipPublishPreview) {
  const formPost = getFormPost();

  if (!formPost.title) {
    setStatus("タイトルを入力してください。");
    els.titleInput.focus();
    return;
  }

  if (!formPost.content.trim()) {
    setStatus("本文を入力してください。");
    els.contentInput.focus();
    return;
  }

  const existingPost = state.selectedId
    ? state.posts.find((post) => post.id === state.selectedId)
    : null;
  const needsPublishPreview = shouldRequirePublishPreview(formPost, existingPost);

  if (!skipPublishPreview && needsPublishPreview) {
    openPublishPreviewModal({
      post: formPost,
      confirmMode: true,
      onConfirm: () => saveCurrentPost(true),
    });
    setStatus("公開前プレビューを表示しています。");
    return;
  }

  const now = new Date().toISOString();
  const targetIndex = existingPost
    ? state.posts.findIndex((post) => post.id === existingPost.id)
    : -1;

  if (targetIndex >= 0) {
    state.posts[targetIndex] = {
      ...state.posts[targetIndex],
      ...formPost,
      updatedAt: now,
    };
    state.selectedId = state.posts[targetIndex].id;
  } else {
    const created = {
      ...formPost,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    state.posts.unshift(created);
    state.selectedId = created.id;
  }

  state.posts.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  if (!persistPosts()) {
    return;
  }
  renderPostList();
  markCurrentFormAsSaved();
  setStatus(formPost.status === "published" ? "公開として保存しました。" : "下書きを保存しました。");
}

function shouldRequirePublishPreview(formPost, existingPost) {
  return formPost.status === "published" && (!existingPost || existingPost.status !== "published");
}

function deleteCurrentPost() {
  if (!state.selectedId) {
    loadDraft(makeEmptyPost());
    setStatus("未保存の下書きをクリアしました。");
    return;
  }

  const target = state.posts.find((post) => post.id === state.selectedId);
  if (!target) {
    return;
  }

  const accepted = window.confirm(`「${target.title || "無題"}」を削除しますか？`);
  if (!accepted) {
    return;
  }

  state.posts = state.posts.filter((post) => post.id !== state.selectedId);
  if (!persistPosts()) {
    return;
  }

  if (state.posts.length > 0) {
    selectPost(state.posts[0].id);
  } else {
    state.selectedId = null;
    loadDraft(makeEmptyPost());
    renderPostList();
  }

  setStatus("投稿を削除しました。");
}

function renderPostList() {
  const visiblePosts = state.posts.filter((post) => {
    if (!state.filterText) {
      return true;
    }
    const keyPointsText = (post.keyPoints || []).join(" ");
    const haystack = `${post.title} ${post.tags.join(" ")} ${keyPointsText} ${post.content}`.toLowerCase();
    return haystack.includes(state.filterText);
  });

  if (visiblePosts.length === 0) {
    els.postList.innerHTML = "<li class='post-meta'>該当する投稿がありません</li>";
    return;
  }

  const grouped = groupPostsByTag(visiblePosts);
  const html = grouped
    .map((group) => {
      const postItems = group.posts
        .map((post) => {
          const active = state.selectedId === post.id ? "active" : "";
          const statusLabel = post.status === "published" ? "公開" : "下書き";
          return `
            <li>
              <button class="post-item-btn ${active}" data-post-id="${escapeHtml(post.id)}">
                <p class="post-title">${escapeHtml(post.title || "無題")}</p>
                <p class="post-meta">${statusLabel} / ${formatDate(post.updatedAt)}</p>
              </button>
            </li>
          `;
        })
        .join("");

      return `
        <li class="tag-group">
          <div class="tag-group-head">
            <p class="tag-name">${escapeHtml(formatTagLabel(group.tag))}</p>
            <p class="tag-count">${group.posts.length}件</p>
          </div>
          <ul class="tag-posts">${postItems}</ul>
        </li>
      `;
    })
    .join("");

  els.postList.innerHTML = html;
  els.postList.querySelectorAll("[data-post-id]").forEach((btn) => {
    btn.addEventListener("click", () => selectPost(btn.dataset.postId));
  });
}

function groupPostsByTag(posts) {
  const map = new Map();

  posts.forEach((post) => {
    const tags = normalizeTags(post.tags);
    const tagList = tags.length > 0 ? tags : [NO_TAG_LABEL];

    tagList.forEach((tag) => {
      if (!map.has(tag)) {
        map.set(tag, []);
      }
      map.get(tag).push(post);
    });
  });

  return [...map.entries()]
    .map(([tag, groupedPosts]) => ({ tag, posts: groupedPosts }))
    .sort((a, b) => compareTagName(a.tag, b.tag));
}

function compareTagName(a, b) {
  if (a === NO_TAG_LABEL && b !== NO_TAG_LABEL) return 1;
  if (b === NO_TAG_LABEL && a !== NO_TAG_LABEL) return -1;
  return a.localeCompare(b, "ja");
}

function formatTagLabel(tag) {
  return tag === NO_TAG_LABEL ? NO_TAG_LABEL : `#${tag}`;
}

function renderPreview() {
  const post = getFormPost();
  const title = post.title || "無題";
  const tagsHtml = post.tags.length
    ? `<p class="post-meta"><strong>タグ:</strong> ${escapeHtml(post.tags.join(" / "))}</p>`
    : "";
  const keyPointsHtml = buildImportantSectionHtml(post.keyPoints);
  const bodyHtml = post.content.trim()
    ? markdownToHtml(post.content)
    : "<p>本文を入力するとここにプレビューが表示されます。</p>";
  const statusText = post.status === "published" ? "公開予定" : "下書き";

  els.preview.innerHTML = `
    <h1>${escapeHtml(title)}</h1>
    <p class="post-meta">${statusText}</p>
    ${tagsHtml}
    ${keyPointsHtml}
    <div class="article-body">${bodyHtml}</div>
  `;
  updateUnsavedState();
}

function openPublishPreviewModal({ post, confirmMode, onConfirm }) {
  const previewPost = {
    ...post,
    title: post.title || "無題",
    updatedAt: new Date().toISOString(),
  };
  els.previewModalBody.innerHTML = `
    <h1>${escapeHtml(previewPost.title)}</h1>
    <p class="post-meta">${confirmMode ? "公開保存前の最終確認" : "公開前の見え方プレビュー"}</p>
    ${previewPost.tags.length ? `<p class="post-meta"><strong>タグ:</strong> ${escapeHtml(previewPost.tags.join(" / "))}</p>` : ""}
    ${buildImportantSectionHtml(previewPost.keyPoints)}
    <div class="article-body">${markdownToHtml(previewPost.content)}</div>
  `;

  state.pendingPublishConfirm = typeof onConfirm === "function" ? onConfirm : null;
  els.previewModalConfirmBtn.hidden = !confirmMode;
  els.previewModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closePublishPreviewModal() {
  state.pendingPublishConfirm = null;
  els.previewModal.classList.add("hidden");
  document.body.style.overflow = "";
}

function isPreviewModalOpen() {
  return !els.previewModal.classList.contains("hidden");
}

function buildImportantSectionHtml(keyPoints) {
  const normalized = normalizeKeyPoints(keyPoints);
  if (normalized.length === 0) {
    return "";
  }

  const items = normalized.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  return `
    <section class="important-section">
      <h3>重要ポイント</h3>
      <ul>${items}</ul>
    </section>
  `;
}

function insertLineIntoContent(line) {
  insertSnippetIntoContent(String(line || ""));
  renderPreview();
}

function insertSnippetIntoContent(snippet) {
  const textarea = els.contentInput;
  const body = String(snippet || "").trim();
  if (!body) {
    return;
  }
  const start = typeof textarea.selectionStart === "number" ? textarea.selectionStart : textarea.value.length;
  const end = typeof textarea.selectionEnd === "number" ? textarea.selectionEnd : start;
  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(end);
  const leadBreak = before
    ? before.endsWith("\n\n")
      ? ""
      : before.endsWith("\n")
        ? "\n"
        : "\n\n"
    : "";
  const trailBreak = after
    ? after.startsWith("\n\n")
      ? ""
      : after.startsWith("\n")
        ? "\n"
        : "\n\n"
    : "";
  const mergedSnippet = `${leadBreak}${body}${trailBreak}`;
  const nextValue = `${before}${mergedSnippet}${after}`;
  const caret = before.length + mergedSnippet.length;

  textarea.value = nextValue;
  textarea.focus();
  if (typeof textarea.setSelectionRange === "function") {
    textarea.setSelectionRange(caret, caret);
  }
}

function wrapSelectionInContent(prefix, suffix, fallbackText) {
  const textarea = els.contentInput;
  const start = typeof textarea.selectionStart === "number" ? textarea.selectionStart : textarea.value.length;
  const end = typeof textarea.selectionEnd === "number" ? textarea.selectionEnd : start;
  const before = textarea.value.slice(0, start);
  const selected = textarea.value.slice(start, end);
  const after = textarea.value.slice(end);
  const targetText = selected || fallbackText;
  const wrapped = `${prefix}${targetText}${suffix}`;

  textarea.value = `${before}${wrapped}${after}`;
  const selectionStart = before.length + prefix.length;
  const selectionEnd = selectionStart + targetText.length;

  textarea.focus();
  if (typeof textarea.setSelectionRange === "function") {
    textarea.setSelectionRange(selectionStart, selectionEnd);
  }
  renderPreview();
}

function askForMediaUrl(message, initial) {
  if (typeof window === "undefined" || typeof window.prompt !== "function") {
    setStatus("URL入力がこの環境で利用できません。");
    return null;
  }
  const input = window.prompt(message, initial || "");
  if (!input) {
    return null;
  }
  const value = input.trim();
  if (!value) {
    return null;
  }
  if (!/^(https?:\/\/|data:|blob:)/i.test(value)) {
    setStatus("URLは https:// もしくは data:/blob: 形式を入力してください。");
    return null;
  }
  return value;
}

async function insertMediaFilesIntoContent(event) {
  const input = event.target;
  const files = Array.from(input.files || []);
  if (files.length === 0) {
    return;
  }

  let inserted = 0;
  for (const file of files) {
    if (!file || !file.type) {
      continue;
    }
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      continue;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const label = toSafeMdLabel(file.name || (file.type.startsWith("video/") ? "video" : "image"));
      if (file.type.startsWith("image/")) {
        insertSnippetIntoContent(`![${label}](${dataUrl})`);
      } else {
        insertSnippetIntoContent(`@[video:${label}](${dataUrl})`);
      }
      inserted += 1;
    } catch (error) {
      console.error(error);
    }
  }

  input.value = "";
  renderPreview();
  if (inserted > 0) {
    setStatus(`${inserted}件のメディアを本文に挿入しました。`);
  } else {
    setStatus("対応形式の画像/動画ファイルが見つかりませんでした。");
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("file read failed"));
    reader.readAsDataURL(file);
  });
}

function toSafeMdLabel(text) {
  return String(text || "media")
    .replace(/[\r\n\[\]\(\)]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "media";
}

function exportPosts() {
  if (state.posts.length === 0) {
    setStatus("出力できる投稿がありません。");
    return;
  }

  const data = JSON.stringify(state.posts, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  anchor.href = url;
  anchor.download = `my-blog-posts-${stamp}.json`;
  anchor.click();

  URL.revokeObjectURL(url);
  setStatus("JSONを出力しました。");
}

function importPostsFromFile(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!Array.isArray(parsed)) {
        throw new Error("array required");
      }

      const imported = parsed
        .filter((item) => item && item.id && item.title != null && item.content != null)
        .map(normalizePostRecord);

      const merged = new Map();
      [...state.posts, ...imported].forEach((post) => merged.set(post.id, post));
      state.posts = [...merged.values()].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

      if (!persistPosts()) {
        return;
      }
      if (!state.selectedId && state.posts.length > 0) {
        state.selectedId = state.posts[0].id;
      }
      if (state.selectedId) {
        selectPost(state.selectedId);
      }
      renderPostList();
      setStatus(`${imported.length}件を取り込みました。`);
    } catch (error) {
      console.error(error);
      setStatus("JSONの取り込みに失敗しました。");
    } finally {
      event.target.value = "";
    }
  };

  reader.readAsText(file, "utf-8");
}

function buildPublishedDataPayload() {
  const publishedPosts = state.posts
    .filter((post) => post.status === "published")
    .map((post) => ({
      id: String(post.id || ""),
      title: String(post.title || ""),
      slug: String(post.slug || slugify(post.title || "")),
      status: "published",
      tags: normalizeTags(post.tags),
      keyPoints: normalizeKeyPoints(post.keyPoints),
      content: String(post.content || ""),
      createdAt: post.createdAt || new Date().toISOString(),
      updatedAt: post.updatedAt || new Date().toISOString(),
    }))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    posts: publishedPosts,
  };
}

async function publishBlogNow() {
  if (state.isPublishing) {
    return;
  }

  const current = getFormPost();
  const hasCurrentContent = current.title || current.content.trim() || current.tags.length > 0 || current.keyPoints.length > 0;
  if (state.hasUnsavedChanges && hasCurrentContent) {
    const continuePublish = window.confirm("未保存の変更があります。公開の前に保存しますか？\n\n「OK」: 保存して公開\n「キャンセル」: 保存せずに公開");
    if (continuePublish) {
      saveCurrentPost(false);
      if (state.hasUnsavedChanges) {
        return;
      }
    }
  }

  if (!persistPosts()) {
    return;
  }

  const config = ensurePublishConfig();
  if (!config) {
    return;
  }

  const payload = buildPublishedDataPayload();
  const data = JSON.stringify(payload, null, 2);

  if (data.length > 950000) {
    setStatus("公開データが大きすぎます。画像/動画の埋め込みを減らしてから再公開してください。");
    return;
  }

  setPublishBusy(true);
  setStatus("公開処理を開始しています...");

  try {
    const result = await pushPublishedDataToGitHub(config, data);
    const publicUrl = buildPublicSiteUrl(config);
    setStatus(`公開しました（${payload.posts.length}件）。反映まで少し待って ${publicUrl} を確認してください。`);
    if (result?.commitUrl) {
      console.info("publish commit:", result.commitUrl);
    }
  } catch (error) {
    console.error(error);
    if (error instanceof PublishAuthError) {
      const reset = window.confirm("公開に失敗しました。GitHubトークン設定を更新しますか？");
      if (reset) {
        clearPublishConfig();
      }
    }
    setStatus(`公開に失敗しました: ${error.message}`);
  } finally {
    setPublishBusy(false);
  }
}

function setPublishBusy(isBusy) {
  state.isPublishing = isBusy;
  els.publishDataBtn.disabled = isBusy;
  els.publishDataBtn.textContent = isBusy ? "公開中..." : "🚀 公開";
}

function resetPublishButtonLabel() {
  if (!els.publishDataBtn) {
    return;
  }
  els.publishDataBtn.textContent = "🚀 公開";
}

function ensurePublishConfig() {
  const existing = loadPublishConfig();
  if (isValidPublishConfig(existing)) {
    return existing;
  }

  const owner = askNonEmptyValue("GitHubユーザー名を入力してください", existing?.owner || DEFAULT_PUBLISH_TARGET.owner);
  if (owner == null) {
    return null;
  }

  const repo = askNonEmptyValue("リポジトリ名を入力してください", existing?.repo || DEFAULT_PUBLISH_TARGET.repo);
  if (repo == null) {
    return null;
  }

  const branch = askNonEmptyValue("ブランチ名を入力してください", existing?.branch || DEFAULT_PUBLISH_TARGET.branch);
  if (branch == null) {
    return null;
  }

  const path = askNonEmptyValue("公開データのパスを入力してください", existing?.path || DEFAULT_PUBLISH_TARGET.path);
  if (path == null) {
    return null;
  }

  const token = askNonEmptyValue("GitHubトークンを入力してください（Contents: Read and write 権限）", "");
  if (token == null) {
    return null;
  }

  const next = { owner, repo, branch, path, token };
  savePublishConfig(next);
  return next;
}

function askNonEmptyValue(message, initialValue) {
  if (typeof window === "undefined" || typeof window.prompt !== "function") {
    return null;
  }

  const value = window.prompt(message, initialValue || "");
  if (value == null) {
    return null;
  }
  const cleaned = value.trim();
  if (!cleaned) {
    setStatus("空欄のままでは公開できません。");
    return null;
  }
  return cleaned;
}

function loadPublishConfig() {
  try {
    const raw = localStorage.getItem(PUBLISH_CONFIG_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return {
      owner: String(parsed.owner || "").trim(),
      repo: String(parsed.repo || "").trim(),
      branch: String(parsed.branch || "").trim(),
      path: String(parsed.path || "").trim(),
      token: String(parsed.token || "").trim(),
    };
  } catch (error) {
    console.error(error);
    return null;
  }
}

function savePublishConfig(config) {
  localStorage.setItem(PUBLISH_CONFIG_KEY, JSON.stringify(config));
}

function clearPublishConfig() {
  localStorage.removeItem(PUBLISH_CONFIG_KEY);
}

function isValidPublishConfig(config) {
  return Boolean(
    config
      && config.owner
      && config.repo
      && config.branch
      && config.path
      && config.token
  );
}

class PublishAuthError extends Error {}

async function pushPublishedDataToGitHub(config, data) {
  const sha = await fetchCurrentPublishedDataSha(config);
  const url = buildGitHubContentsApiUrl(config);
  const body = {
    message: `Publish blog update ${new Date().toISOString()}`,
    content: encodeUtf8ToBase64(data),
    branch: config.branch,
  };
  if (sha) {
    body.sha = sha;
  }

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = await parseJsonSafe(response);
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new PublishAuthError(extractGitHubErrorMessage(json, "認証エラーです。トークン権限を確認してください。"));
    }
    throw new Error(extractGitHubErrorMessage(json, "GitHubへの公開に失敗しました。"));
  }

  return {
    commitUrl: json?.commit?.html_url || "",
  };
}

async function fetchCurrentPublishedDataSha(config) {
  const url = `${buildGitHubContentsApiUrl(config)}?ref=${encodeURIComponent(config.branch)}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (response.status === 404) {
    return null;
  }

  const json = await parseJsonSafe(response);
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new PublishAuthError(extractGitHubErrorMessage(json, "認証エラーです。トークン権限を確認してください。"));
    }
    throw new Error(extractGitHubErrorMessage(json, "公開先ファイルの確認に失敗しました。"));
  }

  const sha = json && typeof json.sha === "string" ? json.sha.trim() : "";
  return sha || null;
}

function buildGitHubContentsApiUrl(config) {
  const owner = encodeURIComponent(config.owner);
  const repo = encodeURIComponent(config.repo);
  const path = encodeGitHubPath(config.path);
  return `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
}

function encodeGitHubPath(path) {
  return String(path || "")
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractGitHubErrorMessage(payload, fallback) {
  if (payload && typeof payload.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }
  return fallback;
}

function encodeUtf8ToBase64(text) {
  const bytes = new TextEncoder().encode(String(text || ""));
  const chunkSize = 0x8000;
  let binary = "";
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function downloadPublishedDataFile() {
  const payload = buildPublishedDataPayload();
  const data = JSON.stringify(payload, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = PUBLISHED_DATA_FILE_NAME;
  anchor.click();

  URL.revokeObjectURL(url);
  setStatus(`公開データを出力しました（${payload.posts.length}件）。`);
}

function openPublishedView() {
  const current = getFormPost();
  const hasCurrentContent = current.title || current.content.trim() || current.tags.length > 0 || current.keyPoints.length > 0;
  if (state.hasUnsavedChanges && hasCurrentContent) {
    const continueOpen = window.confirm("入力中の未保存変更があります。公開ビューを開く前に保存しますか？\n\n「OK」: 保存して開く\n「キャンセル」: 保存せずに開く");
    if (continueOpen) {
      saveCurrentPost(false);
      if (state.hasUnsavedChanges) {
        return;
      }
    }
  }

  if (!persistPosts()) {
    return;
  }

  const config = loadPublishConfig();
  const viewUrl = isValidPublishConfig(config)
    ? buildPublicSiteUrl(config)
    : new URL("index.html", window.location.href).toString();
  window.location.assign(viewUrl);
  setStatus("公開ビューを開きました。");
}

function buildPublicSiteUrl(config) {
  const owner = String(config.owner || "").trim().toLowerCase();
  const repo = encodeURIComponent(String(config.repo || "").trim());
  return `https://${owner}.github.io/${repo}/`;
}

function buildPublishedHtml(posts) {
  const grouped = groupPostsByPrimaryTag(posts);
  const sections = grouped
    .map((group) => {
      const cards = group.posts
        .map((post) => {
          const tags = post.tags.length ? `<p class="meta">#${escapeHtml(post.tags.join(" #"))}</p>` : "";
          return `
            <article class="post">
              <h3>${escapeHtml(post.title || "無題")}</h3>
              <p class="meta">${formatDate(post.updatedAt)}</p>
              ${tags}
              ${buildImportantSectionHtml(post.keyPoints)}
              <div class="article-body">${markdownToHtml(post.content)}</div>
            </article>
          `;
        })
        .join("");

      return `
        <section class="tag-section">
          <h2>${escapeHtml(formatTagLabel(group.tag))}</h2>
          <div class="post-grid">${cards}</div>
        </section>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>My Blog</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", system-ui, sans-serif;
      background: #f5f7f8;
      color: #1f2937;
      line-height: 1.75;
    }
    header {
      background: #ffffff;
      border-bottom: 1px solid #d2d7de;
      padding: 14px 18px;
      position: sticky;
      top: 0;
    }
    h1 { margin: 0; font-size: 18px; }
    main {
      max-width: 980px;
      margin: 20px auto;
      padding: 0 14px 20px;
      display: grid;
      gap: 18px;
    }
    .tag-section h2 {
      margin: 0 0 10px;
      font-size: 18px;
      line-height: 1.3;
    }
    .post-grid {
      display: grid;
      gap: 12px;
    }
    .post {
      background: #fff;
      border: 1px solid #d2d7de;
      border-radius: 8px;
      padding: 16px;
    }
    .post h3 {
      margin: 0 0 8px;
      font-size: 22px;
      line-height: 1.35;
    }
    .meta {
      margin: 0 0 10px;
      font-size: 13px;
      color: #6b7280;
    }
    .important-section {
      border: 1px solid #f1d599;
      background: #fff8e6;
      border-radius: 8px;
      padding: 10px;
      margin: 12px 0 10px;
    }
    .important-section h3 {
      margin: 0 0 8px;
      font-size: 14px;
    }
    .important-section ul {
      margin: 0;
      padding-left: 18px;
    }
    .article-body .body-head {
      border-left: 4px solid #8ea0b6;
      padding-left: 10px;
    }
    .article-body .body-head-1 {
      font-size: 25px;
      border-left-color: #0f766e;
      background: #f3fbf9;
      padding-top: 6px;
      padding-bottom: 6px;
    }
    .article-body .body-head-2 {
      font-size: 21px;
      border-left-color: #2563eb;
    }
    .article-body .body-head-3 {
      font-size: 18px;
      border-left-color: #6d28d9;
    }
    .article-body .body-head-4,
    .article-body .body-head-5,
    .article-body .body-head-6 {
      font-size: 16px;
    }
    .article-body .media-block {
      margin: 14px 0;
      border: 1px solid #d2d7de;
      border-radius: 8px;
      background: #f8fafc;
      padding: 10px;
    }
    .article-body .media-block img,
    .article-body .media-block video {
      display: block;
      width: 100%;
      max-width: 100%;
      border-radius: 6px;
      background: #000;
    }
    .article-body .media-block figcaption {
      margin-top: 8px;
      font-size: 12px;
      color: #4b5563;
    }
    pre {
      background: #111827;
      color: #f9fafb;
      border-radius: 8px;
      padding: 10px;
      overflow-x: auto;
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      background: #eef2f7;
      border-radius: 5px;
      padding: 0.1em 0.3em;
    }
    pre code {
      background: transparent;
      padding: 0;
      color: inherit;
    }
    .important-mark {
      background: #ffecb3;
      color: #4f3a00;
      padding: 0.03em 0.3em;
      border-radius: 4px;
    }
    blockquote {
      border-left: 3px solid #b3bdc8;
      margin: 0.9em 0;
      padding-left: 12px;
      color: #4b5563;
    }
  </style>
</head>
<body>
  <header><h1>My Blog</h1></header>
  <main>${sections}</main>
</body>
</html>`;
}

function groupPostsByPrimaryTag(posts) {
  const map = new Map();
  posts.forEach((post) => {
    const primary = normalizeTags(post.tags)[0] || NO_TAG_LABEL;
    if (!map.has(primary)) {
      map.set(primary, []);
    }
    map.get(primary).push(post);
  });
  return [...map.entries()]
    .map(([tag, groupedPosts]) => ({ tag, posts: groupedPosts }))
    .sort((a, b) => compareTagName(a.tag, b.tag));
}

function markdownToHtml(markdown) {
  const codeBlocks = [];
  let text = String(markdown || "");

  text = text.replace(/```([\s\S]*?)```/g, (_, code) => {
    const key = `%%CODE_${codeBlocks.length}%%`;
    codeBlocks.push(`<pre><code>${escapeHtml(code.trim())}</code></pre>`);
    return key;
  });

  const blocks = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  const htmlBlocks = blocks.map((block) => {
    if (/^%%CODE_\d+%%$/.test(block)) return block;

    if (block.startsWith("###### ")) return `<h6 class="body-head body-head-6">${inlineMd(block.slice(7))}</h6>`;
    if (block.startsWith("##### ")) return `<h5 class="body-head body-head-5">${inlineMd(block.slice(6))}</h5>`;
    if (block.startsWith("#### ")) return `<h4 class="body-head body-head-4">${inlineMd(block.slice(5))}</h4>`;
    if (block.startsWith("### ")) return `<h3 class="body-head body-head-3">${inlineMd(block.slice(4))}</h3>`;
    if (block.startsWith("## ")) return `<h2 class="body-head body-head-2">${inlineMd(block.slice(3))}</h2>`;
    if (block.startsWith("# ")) return `<h1 class="body-head body-head-1">${inlineMd(block.slice(2))}</h1>`;

    if (block.startsWith(">")) {
      const quoted = block
        .split("\n")
        .map((line) => inlineMd(line.replace(/^>\s?/, "")))
        .join("<br>");
      return `<blockquote>${quoted}</blockquote>`;
    }

    const listLines = block.split("\n");
    if (listLines.every((line) => /^[-*]\s+/.test(line.trim()))) {
      const items = listLines
        .map((line) => `<li>${inlineMd(line.replace(/^[-*]\s+/, ""))}</li>`)
        .join("");
      return `<ul>${items}</ul>`;
    }

    return `<p>${inlineMd(block).replaceAll("\n", "<br>")}</p>`;
  });

  let html = htmlBlocks.join("\n");
  codeBlocks.forEach((code, index) => {
    html = html.replace(`%%CODE_${index}%%`, code);
  });

  return html;
}

function inlineMd(text) {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/!!([^!]+)!!/g, '<mark class="important-mark">$1</mark>');
  html = html.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => {
    const caption = alt ? `<figcaption>${alt}</figcaption>` : "";
    return `<figure class="media-block image-block"><img src="${src}" alt="${alt}" loading="lazy">${caption}</figure>`;
  });
  html = html.replace(/@\[video(?::([^\]]+))?\]\(([^)\s]+)\)/gi, (_, caption, src) => {
    const safeCaption = caption ? `<figcaption>${caption}</figcaption>` : "";
    return `<figure class="media-block video-block"><video controls preload="metadata" src="${src}"></video>${safeCaption}</figure>`;
  });
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return html;
}

function normalizeTags(input) {
  const values = Array.isArray(input) ? input : [];
  const unique = new Map();
  values.forEach((tag) => {
    const cleaned = String(tag || "").trim();
    if (!cleaned) return;
    const key = cleaned.toLowerCase();
    if (!unique.has(key)) {
      unique.set(key, cleaned);
    }
  });
  return [...unique.values()];
}

function parseTagsInput(text) {
  return normalizeTags(String(text || "").split(","));
}

function normalizeKeyPoints(input) {
  if (Array.isArray(input)) {
    return input.map((line) => String(line || "").trim()).filter(Boolean);
  }
  if (typeof input === "string") {
    return parseKeyPointsInput(input);
  }
  return [];
}

function parseKeyPointsInput(text) {
  return normalizeKeyPoints(String(text || "").split(/\r?\n/));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function formatDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function setStatus(message) {
  els.statusLine.textContent = message;
}
