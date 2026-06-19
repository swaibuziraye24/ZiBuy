// ============================================
//   ZiBuy — Blog Listing Page
// ============================================

import { db, collection, getDocs, query, where } from "./firebase.js";

let allPosts = [];
let currentFilter = "all";

const CAT_LABELS = {
  "selling-tips":    "Selling Tips",
  "buying-guide":    "Buying Guide",
  "safety":          "Safety",
  "news":            "ZiBuy News",
  "success-stories": "Success Story"
};

loadBlogPosts();

async function loadBlogPosts() {
  try {
    const snap = await getDocs(query(
      collection(db, "blog_posts"),
      where("status", "==", "published")
    ));

    allPosts = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));

    renderBlog();
  } catch (err) {
    console.error("loadBlogPosts error:", err);
    document.getElementById("blog-grid").innerHTML = `
      <div class="blog-empty" style="grid-column:1/-1">
        <p class="icon">⚠️</p>
        <p>Failed to load blog posts</p>
      </div>`;
  }
}

function renderBlog() {
  const grid    = document.getElementById("blog-grid");
  const featSlot = document.getElementById("blog-featured-slot");

  let posts = currentFilter === "all"
    ? allPosts
    : allPosts.filter(p => p.category === currentFilter);

  if (posts.length === 0) {
    featSlot.innerHTML = "";
    grid.innerHTML = `
      <div class="blog-empty" style="grid-column:1/-1">
        <p class="icon">📰</p>
        <p style="font-size:16px;font-weight:700">No posts yet</p>
        <p style="font-size:13px">Check back soon for new articles!</p>
      </div>`;
    return;
  }

  // Featured = most recent post (only on "all" filter)
  let gridPosts = posts;
  if (currentFilter === "all" && posts.length > 0) {
    const featured = posts[0];
    gridPosts = posts.slice(1);

    featSlot.innerHTML = `
      <div class="blog-featured" onclick="window.location.href='blog-post.html?id=${featured.id}&slug=${createSlug(featured.title)}'">
        <div class="blog-featured-img">
          <img src="${featured.coverImage || ''}" alt="${featured.title}"
            onerror="this.src='https://via.placeholder.com/600x400?text=ZiBuy+Blog'">
        </div>
        <div class="blog-featured-body">
          <span class="blog-cat-badge">${CAT_LABELS[featured.category] || "Article"}</span>
          <h2>${featured.title}</h2>
          <p>${featured.excerpt || (featured.content || "").slice(0, 140) + "..."}</p>
          <div class="blog-meta">
            <div class="blog-author-avatar">${(featured.author || "Z")[0].toUpperCase()}</div>
            <span>${featured.author || "ZiBuy Team"}</span>
            <span>·</span>
            <span>${timeAgo(featured.createdAt)}</span>
          </div>
        </div>
      </div>
    `;
  } else {
    featSlot.innerHTML = "";
  }

  if (gridPosts.length === 0) {
    grid.innerHTML = "";
    return;
  }

  grid.innerHTML = gridPosts.map(p => `
    <div class="blog-card" onclick="window.location.href='blog-post.html?id=${p.id}&slug=${createSlug(p.title)}'">
      <div class="blog-card-img">
        <img src="${p.coverImage || ''}" alt="${p.title}"
          onerror="this.src='https://via.placeholder.com/400x300?text=ZiBuy+Blog'">
      </div>
      <div class="blog-card-body">
        <span class="blog-cat-badge">${CAT_LABELS[p.category] || "Article"}</span>
        <h3>${p.title}</h3>
        <p>${p.excerpt || (p.content || "").slice(0, 90) + "..."}</p>
        <div class="blog-meta">
          <div class="blog-author-avatar" style="width:22px;height:22px;font-size:10px">${(p.author || "Z")[0].toUpperCase()}</div>
          <span>${p.author || "ZiBuy Team"}</span>
          <span>·</span>
          <span>${timeAgo(p.createdAt)}</span>
        </div>
      </div>
    </div>
  `).join("");
}

window.filterBlog = function(cat, btn) {
  currentFilter = cat;
  document.querySelectorAll(".blog-filter-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderBlog();
};


function createSlug(text) {
  return (text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function timeAgo(ts) {
  const date = ts?.toDate?.() || (ts ? new Date(ts) : null);
  if (!date) return "";
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
  if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
  if (seconds < 604800) return Math.floor(seconds / 86400) + "d ago";
  return date.toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" });
}