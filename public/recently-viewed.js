// ============================================
//   ZiBuy — Recently Viewed Products
//   Tracked locally per-device via localStorage —
//   works for guests and logged-in users alike,
//   zero extra Firestore reads to track a view.
// ============================================

const STORAGE_KEY = "zibuy_recently_viewed";
const MAX_ITEMS    = 20;

export function trackProductView(productId) {
  if (!productId) return;
  try {
    let list = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    list = list.filter(id => id !== productId); // de-dupe, move to front
    list.unshift(productId);
    list = list.slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    // localStorage unavailable (private browsing etc) — fail silently, never block the page
  }
}

function getRecentlyViewedIds(excludeId) {
  try {
    let list = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (excludeId) list = list.filter(id => id !== excludeId);
    return list;
  } catch (e) {
    return [];
  }
}

export async function renderRecentlyViewed(sectionId, containerId, excludeId) {
  const section   = document.getElementById(sectionId);
  const container = document.getElementById(containerId);
  if (!section || !container) return;

  const ids = getRecentlyViewedIds(excludeId).slice(0, 12);
  if (ids.length === 0) { section.style.display = "none"; return; }

  try {
    const { db, doc, getDoc } = await import("./firebase.js");

    const snaps = await Promise.all(
      ids.map(id => getDoc(doc(db, "products", id)).catch(() => null))
    );

    const products = [];
    snaps.forEach((snap, i) => {
      if (snap && snap.exists() && snap.data().status === "active") {
        products.push({ id: ids[i], ...snap.data() });
      }
    });

    if (products.length === 0) { section.style.display = "none"; return; }

    const esc = window.escapeHTML || ((s) => s); // safe fallback if app.js hasn't loaded yet

    section.style.display = "block";
    container.innerHTML = products.map(p => {
      const img   = p.images?.[0] || "";
      const price = Number(p.price || 0).toLocaleString();

      return `
        <div onclick="window.location.href='product.html?id=${p.id}'"
          style="flex:0 0 auto;width:140px;background:white;border-radius:12px;overflow:hidden;
          box-shadow:0 2px 8px rgba(0,0,0,0.06);cursor:pointer;scroll-snap-align:start;
          border:1px solid #f0f0f0;transition:.2s"
          onmouseover="this.style.borderColor='#ff6600'" onmouseout="this.style.borderColor='#f0f0f0'">
          <img src="${img}" alt="${esc(p.name)}"
            onerror="this.src='https://via.placeholder.com/140x120?text=ZiBuy'"
            style="width:100%;height:120px;object-fit:cover;background:#f3f4f6">
          <div style="padding:9px">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#111827;
              overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name)}</p>
            <p style="margin:0;color:#ff6600;font-weight:900;font-size:13px">UGX ${price}</p>
          </div>
        </div>`;
    }).join("");

  } catch (e) {
    console.warn("renderRecentlyViewed:", e.message);
    section.style.display = "none";
  }
}

export function clearRecentlyViewed() {
  localStorage.removeItem(STORAGE_KEY);
}