// ============================================
//   ZiBuy — Single Blog Post Page
// ============================================

import { db, doc, getDoc, collection, getDocs, query, where } from "./firebase.js";
import { updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const CAT_LABELS = {
  "selling-tips":    "Selling Tips",
  "buying-guide":    "Buying Guide",
  "safety":          "Safety",
  "news":            "ZiBuy News",
  "success-stories": "Success Story"
};

const params = new URLSearchParams(window.location.search);
const postId = params.get("id");

function createSlug(text) {
  return (text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

loadPost();

async function loadPost() {
  const wrap = document.getElementById("post-wrap");
  if (!postId) {
    wrap.innerHTML = `<div style="text-align:center;padding:80px 20px;color:#9ca3af">Post not found</div>`;
    return;
  }

  try {
    const snap = await getDoc(doc(db, "blog_posts", postId));

    if (!snap.exists()) {
      wrap.innerHTML = `
        <div style="text-align:center;padding:80px 20px;color:#9ca3af">
          <p style="font-size:48px;margin-bottom:16px">😕</p>
          <p style="font-size:16px;font-weight:700;color:#111827">Article not found</p>
          <a href="blog.html" style="color:#ff6600;font-weight:700;display:inline-block;margin-top:12px">← Back to Blog</a>
        </div>`;
      return;
    }

    const post = snap.data();
    document.title = `${post.title} — ZiBuy Blog`;

    document.getElementById("seo-title").textContent =
  `${post.title} — ZiBuy Blog`;

document
  .getElementById("seo-description")
  ?.setAttribute(
    "content",
    post.excerpt || ""
  );

document
  .getElementById("og-title")
  ?.setAttribute(
    "content",
    post.title
  );

document
  .getElementById("og-description")
  ?.setAttribute(
    "content",
    post.excerpt || ""
  );

document
  .getElementById("og-image")
  ?.setAttribute(
    "content",
    post.coverImage || ""
  );

document
  .getElementById("og-url")
  ?.setAttribute(
    "content",
    window.location.href
  );

  document
  .getElementById("canonical-url")
  ?.setAttribute("href", window.location.href)
  ;

// SEO description
const description =
  post.excerpt ||
  (post.content || "")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);

// Update meta description
const metaDesc = document.querySelector('meta[name="description"]');
if (metaDesc) metaDesc.setAttribute("content", description);

// Open Graph tags
const ogTitle = document.querySelector('meta[property="og:title"]');
const ogDesc  = document.querySelector('meta[property="og:description"]');
const ogImg   = document.querySelector('meta[property="og:image"]');
const ogUrl   = document.querySelector('meta[property="og:url"]');

if (ogTitle) ogTitle.setAttribute("content", post.title);
if (ogDesc) ogDesc.setAttribute("content", description);
if (ogImg) {
  ogImg.setAttribute(
    "content",
    post.coverImage ||
    "https://zibuy-5deae.web.app/icons/icon-512.png"
  );
}

if (ogUrl)
  ogUrl.setAttribute(
    "content",
    window.location.href
  );

// Twitter tags
const twTitle = document.querySelector('meta[name="twitter:title"]');
const twDesc  = document.querySelector('meta[name="twitter:description"]');
const twImg   = document.querySelector('meta[name="twitter:image"]');

if (twTitle) twTitle.setAttribute("content", post.title);
if (twDesc) twDesc.setAttribute("content", description);

if (twImg) {
  twImg.setAttribute(
    "content",
    post.coverImage ||
    "https://zibuy-5deae.web.app/icons/icon-512.png"
  );
}

    // Track view count
    updateDoc(doc(db, "blog_posts", postId), { views: increment(1) }).catch(() => {});

    wrap.innerHTML = `
      <a href="blog.html" class="post-back">← All Posts</a>

      <span class="post-cat-badge">${CAT_LABELS[post.category] || "Article"}</span>
      <h1 class="post-title">${post.title}</h1>

      <div class="post-meta">
        <div class="post-author-avatar">${(post.author || "Z")[0].toUpperCase()}</div>
        <div class="post-meta-info">
          <p>${post.author || "ZiBuy Team"}</p>
<p>
  ${fmtDate(post.createdAt)}
  · ${getReadingTime(post.content)}
  · ${post.views || 0} views
</p>
        </div>
      </div>

      ${post.coverImage ? `
        <img class="post-cover" src="${post.coverImage}" alt="${post.title}"
          onerror="this.style.display='none'">
      ` : ""}

      <div class="post-content">
        ${formatContent(post.content || "")}
      </div>

        <div class="post-share">
  <h3>📢 Share This Article</h3>

  <div class="share-buttons">

    <button onclick="shareWhatsApp()">
      WhatsApp
    </button>

    <button onclick="shareFacebook()">
      Facebook
    </button>

    <button onclick="shareTwitter()">
      X
    </button>

    <button onclick="copyArticleLink()">
      Copy Link
    </button>

  </div>
</div>

<div class="post-cta">
  <h3>🛍️ Ready to Buy or Sell?</h3>
  <p>Join thousands of Ugandans trading safely on ZiBuy</p>
  <a href="index.html">Visit ZiBuy →</a>
</div>

      <div class="post-related" id="related-posts"></div>
    `;

    loadRelated(post.category);

  } catch (err) {
    console.error("loadPost error:", err);
    wrap.innerHTML = `<div style="text-align:center;padding:80px 20px;color:red">Failed to load article</div>`;
  }
}

// Converts simple markdown-like content into HTML
function formatContent(text) {
  if (!text) return "";

  return text
    .split("\n\n")
    .map(block => {
      block = block.trim();
      if (!block) return "";

      // Headings
      if (block.startsWith("## "))  return `<h2>${block.slice(3)}</h2>`;
      if (block.startsWith("### ")) return `<h3>${block.slice(4)}</h3>`;

      // Bullet list
      if (block.split("\n").every(l => l.trim().startsWith("- "))) {
        const items = block.split("\n").map(l => `<li>${l.trim().slice(2)}</li>`).join("");
        return `<ul>${items}</ul>`;
      }

      // Numbered list
      if (block.split("\n").every(l => /^\d+\.\s/.test(l.trim()))) {
        const items = block.split("\n").map(l => `<li>${l.trim().replace(/^\d+\.\s/, "")}</li>`).join("");
        return `<ol>${items}</ol>`;
      }

      // Bold **text**
      const withBold = block.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

      return `<p>${withBold.replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}

async function loadRelated(category) {
  const container = document.getElementById("related-posts");
  if (!container || !category) return;

  try {
    const snap = await getDocs(query(
      collection(db, "blog_posts"),
      where("category", "==", category),
      where("status", "==", "published")
    ));

    const related = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => p.id !== postId)
      .slice(0, 3);

    if (related.length === 0) { container.innerHTML = ""; return; }

    container.innerHTML = `
      <h3>📚 Related Articles</h3>
      <div class="post-related-grid">
        ${related.map(p => `
          <div class="post-related-card" onclick="window.location.href='blog-post.html?id=${p.id}&slug=${createSlug(p.title)}'">
            <img src="${p.coverImage || ''}" alt="${p.title}"
              onerror="this.src='https://via.placeholder.com/300x150?text=ZiBuy'">
            <p>${p.title}</p>
          </div>
        `).join("")}
      </div>
    `;
  } catch (e) { console.warn("loadRelated:", e.message); }
}

function getReadingTime(text) {
  const words = (text || "").trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}

function fmtDate(ts) {
  const d = ts?.toDate?.() || (ts ? new Date(ts) : null);
  if (!d) return "";
  return d.toLocaleDateString("en-UG", { day: "numeric", month: "long", year: "numeric" });
}

window.shareWhatsApp = function () {
  const url = encodeURIComponent(window.location.href);
  const text = encodeURIComponent(document.title);

  window.open(
    `https://wa.me/?text=${text}%20${url}`,
    "_blank"
  );
};

window.shareFacebook = function () {
  const url = encodeURIComponent(window.location.href);

  window.open(
    `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    "_blank"
  );
};

window.shareTwitter = function () {
  const url = encodeURIComponent(window.location.href);
  const text = encodeURIComponent(document.title);

  window.open(
    `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
    "_blank"
  );
};

window.copyArticleLink = async function () {
  try {
    await navigator.clipboard.writeText(window.location.href);
    alert("✅ Link copied");
  } catch {
    alert("❌ Failed to copy link");
  }
};