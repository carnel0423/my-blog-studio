const STORAGE_KEY = "myBlogStudio.posts.v1";
const NO_TAG_LABEL = "タグなし";
const PUBLISHED_DATA_PATH = "published-data.json";

const els = {
  root: document.getElementById("publishedRoot"),
  updated: document.getElementById("publishedUpdated"),
};

initPublishedView();

async function initPublishedView() {
  const source = await loadPublishedSource();
  const publishedPosts = source.posts
    .filter((post) => post.status === "published")
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  if (publishedPosts.length === 0) {
    const hint = source.kind === "publishedDataFile"
      ? "編集画面で公開データを出力し、リポジトリの published-data.json を更新すると表示されます。"
      : "まだ公開データが配信されていません。編集画面から公開データを出力して反映してください。";

    els.root.innerHTML = `
      <section class="empty-state">
        <p>公開投稿がまだありません。</p>
        <p>${hint}</p>
      </section>
    `;
    return;
  }

  const grouped = groupPostsByPrimaryTag(publishedPosts);
  const sections = grouped
    .map((group) => {
      const postCards = group.posts
        .map((post) => {
          const tagLine = post.tags.length > 0 ? `#${escapeHtml(post.tags.join(" #"))}` : "";
          return `
            <article class="post-card">
              <h3>${escapeHtml(post.title || "無題")}</h3>
              <p class="meta">${formatDate(post.updatedAt)}</p>
              ${tagLine ? `<p class="meta">${tagLine}</p>` : ""}
              ${buildImportantSectionHtml(post.keyPoints)}
              <div class="article-body">${markdownToHtml(post.content)}</div>
            </article>
          `;
        })
        .join("");

      return `
        <section class="tag-section">
          <h2 class="tag-heading">${escapeHtml(formatTagLabel(group.tag))}</h2>
          <div class="post-list-grid">${postCards}</div>
        </section>
      `;
    })
    .join("");

  const latest = publishedPosts[0]?.updatedAt || source.generatedAt;
  els.root.innerHTML = sections;
  els.updated.textContent = `最終更新: ${formatDate(latest) || "-"}`;
}

async function loadPublishedSource() {
  const fromPublishedDataFile = await loadPostsFromPublishedDataFile();
  if (fromPublishedDataFile) {
    return fromPublishedDataFile;
  }
  return {
    kind: "localStorage",
    generatedAt: "",
    posts: loadPostsFromLocalStorage(),
  };
}

async function loadPostsFromPublishedDataFile() {
  try {
    const response = await fetch(PUBLISHED_DATA_PATH, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    const parsed = await response.json();
    const normalized = normalizePublishedDataPayload(parsed);
    return {
      kind: "publishedDataFile",
      generatedAt: normalized.generatedAt,
      posts: normalized.posts,
    };
  } catch (error) {
    console.warn("published-data.json の読み込みをスキップしました。", error);
    return null;
  }
}

function normalizePublishedDataPayload(input) {
  if (Array.isArray(input)) {
    return {
      generatedAt: "",
      posts: input
        .filter((item) => item && item.id && item.title != null && item.content != null)
        .map(normalizePublicPost),
    };
  }

  const posts = input && Array.isArray(input.posts) ? input.posts : [];
  const generatedAt = input && typeof input.generatedAt === "string" ? input.generatedAt : "";
  return {
    generatedAt,
    posts: posts
      .filter((item) => item && item.id && item.title != null && item.content != null)
      .map(normalizePublicPost),
  };
}

function loadPostsFromLocalStorage() {
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
      .map(normalizePublicPost);
  } catch (error) {
    console.error(error);
    return [];
  }
}

function normalizePublicPost(item) {
  return {
    id: String(item.id),
    title: String(item.title || ""),
    slug: String(item.slug || ""),
    status: item.status === "published" ? "published" : "draft",
    tags: normalizeTags(item.tags),
    keyPoints: normalizeKeyPoints(item.keyPoints || item.highlights || item.importantPoints),
    content: String(item.content || ""),
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString(),
  };
}

function groupPostsByPrimaryTag(posts) {
  const map = new Map();
  posts.forEach((post) => {
    const primaryTag = normalizeTags(post.tags)[0] || NO_TAG_LABEL;
    if (!map.has(primaryTag)) {
      map.set(primaryTag, []);
    }
    map.get(primaryTag).push(post);
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

function normalizeKeyPoints(input) {
  if (Array.isArray(input)) {
    return input.map((line) => String(line || "").trim()).filter(Boolean);
  }
  if (typeof input === "string") {
    return input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  }
  return [];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
