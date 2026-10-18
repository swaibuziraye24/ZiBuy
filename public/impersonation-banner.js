// ============================================
//   ZiBuy — Impersonation Banner
//   Lets an admin view the site as a specific
//   user for support, with a clear way back.
// ============================================

import { auth } from "./firebase.js";
import { signInWithCustomToken, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

async function startImpersonationFromUrl() {
  const params = new URLSearchParams(location.search);
  const token = params.get("impersonate_token");
  if (!token) return;

  params.delete("impersonate_token");
  const cleanUrl = location.pathname + (params.toString() ? "?" + params.toString() : "");
  history.replaceState({}, "", cleanUrl);

  try {
    const cred = await signInWithCustomToken(auth, token);
    sessionStorage.setItem("zb_impersonating", cred.user.email || "this account");
  } catch (e) {
    console.error("Impersonation sign-in failed:", e);
  }
}

function showImpersonationBanner() {
  const email = sessionStorage.getItem("zb_impersonating");
  if (!email || document.getElementById("zb-impersonation-banner")) return;

  const bar = document.createElement("div");
  bar.id = "zb-impersonation-banner";
  bar.style.cssText =
    "position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#111827;color:#fff;" +
    "display:flex;align-items:center;justify-content:center;gap:10px;padding:8px 12px;" +
    "font-size:12px;font-weight:700;font-family:system-ui,-apple-system,sans-serif";
  bar.innerHTML = `
    👁️ Viewing as ${email.replace(/</g,"&lt;")}
    <button id="zb-impersonation-exit"
      style="background:#ff6600;color:#fff;border:none;padding:5px 12px;border-radius:7px;font-weight:800;font-size:12px;cursor:pointer">
      Return to Admin
    </button>`;
  document.body.prepend(bar);
  document.body.style.marginTop = bar.offsetHeight + "px";

  document.getElementById("zb-impersonation-exit")?.addEventListener("click", async () => {
    sessionStorage.removeItem("zb_impersonating");
    try { await signOut(auth); } catch (e) {}
    window.location.href = "admin.html";
  });
}

(async () => {
  await startImpersonationFromUrl();
  showImpersonationBanner();
})();