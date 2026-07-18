// ============================================
//   ZiBuy — Global Navigation
//   Add <script type="module" src="nav.js">
//   to every HTML page's </body>
// ============================================

(function() {

  const page = location.pathname.split("/").pop() || "index.html";
  const isHome = page === "index.html" || page === "";

  // ── Bottom Nav ──────────────────────────────
  const nav = document.createElement("nav");
  nav.className = "zibuy-bottom-nav";
  nav.innerHTML = `
    <button class="zbn-item ${isHome ? "active" : ""}"
      onclick="window.location.href='index.html'">
      <span class="zbn-icon">🏠</span>
      <span class="zbn-label">Home</span>
    </button>

    <button class="zbn-item ${page==='shops.html'?'active':''}"
      onclick="window.location.href='shops.html'">
      <span class="zbn-icon">🏪</span>
      <span class="zbn-label">Shops</span>
    </button>

    <button class="zbn-item zbn-cart" onclick="typeof toggleCart==='function'?toggleCart():window.location.href='index.html#cart'">
      <span class="zbn-icon">🛒</span>
      <span class="zbn-label">Cart</span>
      <span class="zbn-cart-dot" id="nav-cart-count" style="display:none"></span>
    </button>

    <button class="zbn-item ${page==='dashboard.html' && location.search.includes('wishlist') ?'active':''}"
      onclick="window.location.href='dashboard.html?tab=wishlist'">
      <span class="zbn-icon">❤️</span>
      <span class="zbn-label">Wishlist</span>
    </button>

    <button class="zbn-item zbn-notif ${page==='notifications.html'?'active':''}"
      onclick="window.location.href='notifications.html'">
      <span class="zbn-icon">🔔</span>
      <span class="zbn-label">Alerts</span>
      <span class="zbn-cart-dot" id="nav-notif-count" style="display:none"></span>
    </button>

    <button class="zbn-item ${page==='dashboard.html' && !location.search.includes('wishlist') ?'active':''}"
      onclick="window.location.href='dashboard.html'">
      <span class="zbn-icon">👤</span>
      <span class="zbn-label">Dashboard</span>
    </button>
  `;
  document.body.appendChild(nav);

  // ── Back button on inner pages ──────────────
  if (!isHome && !document.getElementById("nav-back-btn")) {
    const topbar = document.querySelector(".topbar, .admin-topbar");

    const back = document.createElement("button");
    back.id        = "nav-back-btn";
    back.innerHTML = `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>`;

    // Track navigation history in sessionStorage
    const navStack = JSON.parse(sessionStorage.getItem("zibuy-nav") || "[]");
    const thisPage = location.href;

    if (navStack[navStack.length - 1] !== thisPage) {
      navStack.push(thisPage);
      sessionStorage.setItem("zibuy-nav", JSON.stringify(navStack));
    }

    back.onclick = () => {
      const stack = JSON.parse(sessionStorage.getItem("zibuy-nav") || "[]");
      stack.pop(); // remove current
      const prev = stack[stack.length - 1];
      sessionStorage.setItem("zibuy-nav", JSON.stringify(stack));

      if (prev) {
        window.location.href = prev;
      } else {
        window.location.href = "index.html";
      }
    };

    if (topbar) {
      // Page has a topbar (product.html, messages.html, etc.) — insert inline
      back.className = "zbn-back-btn";
      topbar.insertBefore(back, topbar.firstChild);
    } else {
      // No topbar on this page (e.g. shop.html) — float it top-left instead
      back.className = "zbn-back-btn zbn-back-floating";
      document.body.appendChild(back);
    }
  }

  // ── Cart badge sync ─────────────────────────
  function syncCartBadge() {
    const cart  = JSON.parse(localStorage.getItem("zibuy-cart") || "[]");
    const dot   = document.getElementById("nav-cart-count");
    if (!dot) return;
    if (cart.length > 0) {
      dot.textContent = cart.length;
      dot.style.display = "flex";
    } else {
      dot.style.display = "none";
    }
  }

  syncCartBadge();
  window.addEventListener("storage", syncCartBadge);

  // ── Notification badge sync ─────────────────
  async function syncNotifBadge() {
    const dot = document.getElementById("nav-notif-count");
    if (!dot) return;

    try {
      const { getAuth }       = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
      const { getFirestore, collection, query, where, getDocs } =
        await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) { dot.style.display = "none"; return; }

      const db = getFirestore();
      const snap = await getDocs(query(
        collection(db, "notifications"),
        where("userId", "==", user.uid),
        where("read", "==", false)
      ));

      if (snap.size > 0) {
        dot.textContent = snap.size > 9 ? "9+" : snap.size;
        dot.style.display = "flex";
      } else {
        dot.style.display = "none";
      }
    } catch (e) {
      // silent — page may not have firebase initialized yet
    }
  }

  syncNotifBadge();
  setInterval(syncNotifBadge, 30000); // refresh every 30s


  

  // Sync after addToCart
  const _orig = window.addToCart;
  if (typeof _orig === "function") {
    window.addToCart = function(...args) {
      _orig.apply(this, args);
      syncCartBadge();
    };
  }

})();