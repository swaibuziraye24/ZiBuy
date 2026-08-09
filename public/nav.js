// ============================================
//   ZiBuy — Global Navigation
//   Add <script type="module" src="nav.js">
//   to every HTML page's </body>
// ============================================

(function() {

  const page = location.pathname.split("/").pop() || "index.html";
  const isHome = page === "index.html" || page === "";

  // ── Track real login state so protected buttons never guess ──
  let _navCurrentUser = null;
  let _navAuthReady   = false;
  let _authWaiters    = [];

  import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js").then(({ getAuth, onAuthStateChanged }) => {
    const authInstance = getAuth();
    onAuthStateChanged(authInstance, (user) => {
      _navCurrentUser = user;
      _navAuthReady   = true;
      _authWaiters.forEach(fn => fn(user));
      _authWaiters = [];
    });
  }).catch(() => { _navAuthReady = true; });

  window.goToProtectedPage = function(url) {
    const proceed = (user) => {
      if (user) {
        window.location.href = url;
        return;
      }
      try { sessionStorage.setItem("zibuy_post_login_redirect", url); } catch(e) {}

      if (typeof window.openAuthModal === "function") {
        window.openAuthModal();
      } else {
        // This page doesn't carry the login modal — send them
        // to the homepage, which will open it automatically
        window.location.href = "index.html?auth=1";
      }
    };

    if (_navAuthReady) {
      proceed(_navCurrentUser);
    } else {
      _authWaiters.push(proceed);
      // Safety net in case the auth listener is unusually slow
      setTimeout(() => { if (!_navAuthReady) { _navAuthReady = true; proceed(_navCurrentUser); } }, 2500);
    }
  };

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
      onclick="window.goToProtectedPage('dashboard.html?tab=wishlist')">
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
      onclick="window.goToProtectedPage('dashboard.html')">
      <span class="zbn-icon">👤</span>
      <span class="zbn-label">Dashboard</span>
    </button>

    <button class="zbn-item" onclick="window.openMoreMenu()">
      <span class="zbn-icon">☰</span>
      <span class="zbn-label">More</span>
    </button>
  `;
  document.body.appendChild(nav);

  // ── "More" menu — reaches every secondary page from anywhere ──
  window.openMoreMenu = function() {
    const existing = document.getElementById("more-menu-sheet");
    if (existing) { existing.remove(); return; }

    const links = [
      { icon: "ℹ️", label: "About ZiBuy", href: "about.html" },
      { icon: "🛡️", label: "Safety Tips", href: "safety.html" },
      { icon: "📢", label: "Advertise With Us", href: "advertise.html" },
      { icon: "💼", label: "Post a Job", href: "post-ad.html?category=seeking-work" },
      { icon: "❓", label: "FAQ", href: "faq.html" },
      { icon: "📞", label: "Contact Us", href: "contact.html" },
      { icon: "🚩", label: "Report Abuse", href: "report.html" },
      { icon: "🆘", label: "Support", href: "support.html" },
      { icon: "📄", label: "Terms & Conditions", href: "terms.html" },
      { icon: "🔒", label: "Privacy Policy", href: "privacy.html" },
    ];

    const overlay = document.createElement("div");
    overlay.id = "more-menu-sheet";
    overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;
      display:flex;align-items:flex-end;justify-content:center`;
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    overlay.innerHTML = `
      <div style="background:white;width:100%;max-width:520px;border-radius:20px 20px 0 0;
        padding:10px 8px calc(16px + env(safe-area-inset-bottom));max-height:75vh;overflow-y:auto;
        box-shadow:0 -4px 20px rgba(0,0,0,0.15)">
        <div style="width:40px;height:4px;background:#e5e7eb;border-radius:4px;margin:6px auto 14px"></div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;padding:0 8px">
          ${links.map(l => `
            <a href="${l.href}" style="display:flex;align-items:center;gap:10px;padding:14px 12px;
              border-radius:12px;text-decoration:none;color:#111827;font-weight:700;font-size:13.5px;
              background:#f9fafb">
              <span style="font-size:18px">${l.icon}</span>
              <span>${l.label}</span>
            </a>
          `).join("")}
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
  };

  // ── Back button on inner pages ──────────────
  // Uses the browser's REAL back navigation (same as the phone's own
  // back gesture/button) instead of a hand-built history list — this
  // avoids full page reloads on every tap, and can never point at a
  // stale/wrong page since there's no manual list to go out of sync.
  if (!isHome && !document.getElementById("nav-back-btn")) {
    const topbar = document.querySelector(".topbar, .admin-topbar");

    const back = document.createElement("button");
    back.id        = "nav-back-btn";
    back.innerHTML = `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>`;

    back.onclick = () => {
      // Only trust real browser history if we actually arrived here
      // by clicking through the site itself — not via a shared link,
      // bookmark, or notification tap, which have no real "back" to go to
      const cameFromZiBuy = document.referrer && document.referrer.includes(window.location.host);

      if (cameFromZiBuy && window.history.length > 1) {
        history.back();
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