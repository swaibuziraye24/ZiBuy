// ============================================
//   ZiBuy — PWA Install Button
//   Add <script src="install-btn.js"></script>
//   to every page before </body>
// ============================================

(function () {

  let deferredPrompt = null;

  // ── Create the floating button ─────────────
  const btn = document.createElement("div");
  btn.id = "zibuy-install-btn";
  btn.innerHTML = `
    <div style="
      position: fixed;
      bottom: 90px;
      right: 16px;
      z-index: 9400;
      display: none;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
    " id="install-wrap">

      <!-- Tooltip -->
      <div id="install-tooltip" style="
        background: #111827;
        color: white;
        font-size: 12px;
        font-weight: 700;
        padding: 8px 14px;
        border-radius: 10px;
        white-space: nowrap;
        box-shadow: 0 4px 16px rgba(0,0,0,0.2);
        animation: fadeInUp .3s ease;
        font-family: Arial, sans-serif;
      ">
        📲 Install ZiBuy App
        <div style="
          position: absolute;
          bottom: -6px;
          right: 22px;
          width: 12px;
          height: 12px;
          background: #111827;
          transform: rotate(45deg);
          border-radius: 2px;
        "></div>
      </div>

      <!-- FAB button -->
      <button id="install-fab" style="
        width: 56px;
        height: 56px;
        border-radius: 50%;
        border: none;
        background: #ff6600;
        color: white;
        font-size: 24px;
        cursor: pointer;
        box-shadow: 0 4px 20px rgba(255,102,0,0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform .15s, box-shadow .15s;
        font-family: Arial, sans-serif;
      ">
        ⬇️
      </button>

    </div>
  `;

  document.body.appendChild(btn);

  const wrap    = document.getElementById("install-wrap");
  const fab     = document.getElementById("install-fab");
  const tooltip = document.getElementById("install-tooltip");

  // ── Add CSS animation ──────────────────────
  const style = document.createElement("style");
  style.textContent = `
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes pulse {
      0%, 100% { box-shadow: 0 4px 20px rgba(255,102,0,0.45); }
      50%       { box-shadow: 0 4px 28px rgba(255,102,0,0.75); }
    }
    #install-fab:hover {
      transform: scale(1.08) !important;
      box-shadow: 0 6px 24px rgba(255,102,0,0.55) !important;
    }
    #install-fab:active {
      transform: scale(0.95) !important;
    }
  `;
  document.head.appendChild(style);

  // ── Catch the install prompt ───────────────
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showButton();
  });

  function showButton() {
    if (!wrap) return;
    wrap.style.display = "flex";
    fab.style.animation = "pulse 2.5s ease-in-out infinite";

    // Auto-hide tooltip after 4 seconds
    setTimeout(() => {
      if (tooltip) tooltip.style.display = "none";
    }, 4000);
  }

  // ── Click: trigger install prompt ─────────
  fab.addEventListener("click", async () => {
    if (!deferredPrompt) {
      // Already installed or browser doesn't support
      // Show manual instructions
      showManualInstructions();
      return;
    }

    fab.textContent   = "⏳";
    fab.style.animation = "none";

    deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;

    if (outcome === "accepted") {
      fab.textContent = "✅";
      fab.style.background = "#10b981";
      setTimeout(() => { wrap.style.display = "none"; }, 2000);
    } else {
      fab.textContent   = "⬇️";
      fab.style.animation = "pulse 2.5s ease-in-out infinite";
    }
  });

  // ── Already installed: hide button ─────────
  window.addEventListener("appinstalled", () => {
    if (wrap) wrap.style.display = "none";
    deferredPrompt = null;
  });

  // ── Manual instructions for iOS/unsupported ─
  function showManualInstructions() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,.6);
      z-index:99999;display:flex;align-items:flex-end;
      justify-content:center;padding:16px;
    `;

    const isInstalled = window.matchMedia("(display-mode: standalone)").matches;

    overlay.innerHTML = `
      <div style="
        background:white;border-radius:20px 20px 16px 16px;
        padding:24px;width:100%;max-width:420px;
        font-family:Arial,sans-serif;
        animation: fadeInUp .3s ease;
      ">
        <div style="text-align:center;margin-bottom:20px">
          <p style="font-size:36px;margin-bottom:8px">📲</p>
          <h2 style="font-size:18px;font-weight:800;color:#111827;margin:0 0 6px">
            ${isInstalled ? "Already Installed!" : "Install ZiBuy"}
          </h2>
          <p style="font-size:13px;color:#6b7280;margin:0">
            ${isInstalled
              ? "ZiBuy is already installed on your device."
              : isIOS
              ? "To install on iPhone/iPad:"
              : "To install on your device:"}
          </p>
        </div>

        ${!isInstalled ? `
          ${isIOS ? `
            <div style="background:#f3f4f6;border-radius:12px;padding:16px;margin-bottom:16px">
              <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#111827">Steps:</p>
              <p style="margin:0 0 8px;font-size:13px;color:#374151">1. Tap the <strong>Share</strong> button <span style="font-size:16px">⬆️</span> in Safari</p>
              <p style="margin:0 0 8px;font-size:13px;color:#374151">2. Scroll down and tap <strong>"Add to Home Screen"</strong></p>
              <p style="margin:0;font-size:13px;color:#374151">3. Tap <strong>"Add"</strong></p>
            </div>
          ` : `
            <div style="background:#f3f4f6;border-radius:12px;padding:16px;margin-bottom:16px">
              <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#111827">Steps:</p>
              <p style="margin:0 0 8px;font-size:13px;color:#374151">1. Tap the <strong>⋮ menu</strong> in Chrome</p>
              <p style="margin:0 0 8px;font-size:13px;color:#374151">2. Tap <strong>"Add to Home Screen"</strong> or <strong>"Install App"</strong></p>
              <p style="margin:0;font-size:13px;color:#374151">3. Tap <strong>"Install"</strong></p>
            </div>
          `}
        ` : ""}

        <button onclick="this.closest('div[style*=inset]').remove()" style="
          width:100%;padding:14px;border:none;
          border-radius:12px;background:#ff6600;
          color:white;font-size:15px;font-weight:800;
          cursor:pointer;font-family:Arial,sans-serif;
        ">
          ${isInstalled ? "✅ Got it!" : "Got it!"}
        </button>
      </div>
    `;

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
  }

  // ── On iOS show button always (no prompt API) ─
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;

  if (isIOS && !isStandalone) {
    showButton();
    fab.addEventListener("click", showManualInstructions, { once: false });
  }

})();