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

    <button class="zbn-item ${page==='messages.html'?'active':''}"
      onclick="window.location.href='messages.html'">
      <span class="zbn-icon">💬</span>
      <span class="zbn-label">Messages</span>
    </button>

    <button class="zbn-item ${page==='dashboard.html'?'active':''}"
      onclick="window.location.href='dashboard.html'">
      <span class="zbn-icon">👤</span>
      <span class="zbn-label">Account</span>
    </button>
  `;
  document.body.appendChild(nav);

  // ── Back button on inner pages ──────────────
  if (!isHome) {
    const topbar = document.querySelector(".topbar, .admin-topbar");
    if (topbar && !document.getElementById("nav-back-btn")) {
      const back = document.createElement("button");
      back.id        = "nav-back-btn";
      back.className = "zbn-back-btn";
      back.innerHTML = `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>`;
      back.onclick   = () => {
        if (history.length > 1) {
          history.back();
        } else {
          window.location.href = "index.html";
        }
      };
      topbar.insertBefore(back, topbar.firstChild);
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


  // ── Unread messages badge ───────────────────
  import("./firebase.js").then(({ db, auth, collection, query, where }) => {
    import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js").then(({ onAuthStateChanged }) => {
      import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js").then(({ onSnapshot }) => {

        onAuthStateChanged(auth, (user) => {
          if (!user) return;

          // Messages unread dot
          const msgBtn = document.querySelector(".zbn-item:nth-child(4)");
          onSnapshot(query(
            collection(db, "messages"),
            where("participants", "array-contains", user.email),
            where("read", "==", false)
          ), (snap) => {
            const unread = snap.docs.filter(d => d.data().senderEmail !== user.email).length;
            if (msgBtn) {
              const dot = msgBtn.querySelector(".zbn-unread") || (() => {
                const d = document.createElement("span");
                d.className = "zbn-cart-dot zbn-unread";
                msgBtn.appendChild(d);
                return d;
              })();
              dot.textContent    = unread;
              dot.style.display  = unread > 0 ? "flex" : "none";
            }
          });

          // Notifications unread dot
          const notifBtn = document.querySelector(".zbn-item:nth-child(4)");
          onSnapshot(query(
            collection(db, "notifications"),
            where("userId", "==", user.uid),
            where("read", "==", false)
          ), (snap) => {
            const bell = document.getElementById("notifications-btn");
            if (bell) {
              bell.textContent = snap.size > 0
                ? `🔔 (${snap.size})`
                : "🔔 Notifications";
            }
          });
        });
      });
    });
  });

  // Sync after addToCart
  const _orig = window.addToCart;
  if (typeof _orig === "function") {
    window.addToCart = function(...args) {
      _orig.apply(this, args);
      syncCartBadge();
    };
  }

})();