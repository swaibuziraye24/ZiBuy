// ============================================
//   ZiBuy — Ban Guard
//   Shows a full-screen "account banned" page
//   to any logged-in user who is currently banned
// ============================================

import { db, auth, doc, getDoc } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const ADMIN_EMAIL      = "swaibuziraye22@gmail.com";
const SUPPORT_WHATSAPP = "256789157512";
const SUPPORT_EMAIL    = "zitechnologies3@gmail.com";

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showBanScreen(data, user) {
  if (document.getElementById("zb-ban-screen")) return;

  const until = data.bannedUntil?.toDate ? data.bannedUntil.toDate() : null;
  let durationText;
  if (until) {
    const days = Math.max(1, Math.ceil((until - new Date()) / 86400000));
    const dateTxt = until.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
    durationText = `Your ban ends on ${dateTxt} (${days} day${days === 1 ? "" : "s"} left).`;
  } else {
    durationText = "This ban is permanent unless our support team lifts it.";
  }

  const reason = (data.banReason && String(data.banReason).trim()) || "Violation of ZiBuy policies.";

  const waMsg = encodeURIComponent(
    `Hello ZiBuy Support, my account is banned.\n` +
    `Email: ${user.email}\n` +
    `User ID: ${user.uid}\n` +
    `Reason shown: ${reason}\n` +
    `Please help me understand what happened and what I must do to get my account restored.`
  );
  const mailSubject = encodeURIComponent("ZiBuy account ban - help request");
  const mailBody = encodeURIComponent(
    `Hello ZiBuy Support,\n\nMy account is banned.\nEmail: ${user.email}\nUser ID: ${user.uid}\nReason shown: ${reason}\n\nPlease help me understand what happened and how to get my account restored.`
  );

  const overlay = document.createElement("div");
  overlay.id = "zb-ban-screen";
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:2147483647;background:#111827;color:#fff;" +
    "display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;" +
    "font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif";

  overlay.innerHTML = `
    <div style="background:#fff;color:#111827;border-radius:20px;max-width:440px;width:100%;padding:28px 24px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.5)">
      <div style="font-size:52px;line-height:1">🚫</div>
      <h1 style="font-size:22px;font-weight:800;margin:12px 0 6px">Your account is banned</h1>
      <p style="font-size:14px;color:#374151;margin:0 0 16px;font-weight:600">${esc(durationText)}</p>

      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:12px 14px;text-align:left;margin-bottom:16px">
        <div style="font-size:11px;font-weight:800;color:#991b1b;text-transform:uppercase;margin-bottom:4px">Reason</div>
        <div style="font-size:14px;color:#111827;line-height:1.45">${esc(reason)}</div>
      </div>

      <p style="font-size:13px;color:#4b5563;line-height:1.5;margin:0 0 18px">
        If you think this is a mistake, or you want to know what to do so your account is restored and this doesn't happen again, contact ZiBuy Support. We will guide you.
      </p>

      <a href="https://wa.me/${SUPPORT_WHATSAPP}?text=${waMsg}" target="_blank" rel="noopener"
        style="display:block;background:#25d366;color:#fff;text-decoration:none;font-weight:800;font-size:15px;padding:13px;border-radius:12px;margin-bottom:10px">
        💬 Contact Support on WhatsApp
      </a>
      <a href="mailto:${SUPPORT_EMAIL}?subject=${mailSubject}&body=${mailBody}"
        style="display:block;background:#f3f4f6;color:#111827;text-decoration:none;font-weight:700;font-size:14px;padding:12px;border-radius:12px;margin-bottom:10px">
        ✉️ Email Support
      </a>
      <button id="zb-ban-logout"
        style="width:100%;background:none;border:none;color:#6b7280;font-size:13px;font-weight:700;cursor:pointer;padding:8px">
        Log out
      </button>
    </div>
  `;

  document.documentElement.style.overflow = "hidden";
  document.body.appendChild(overlay);

  document.getElementById("zb-ban-logout")?.addEventListener("click", async () => {
    try { await signOut(auth); } catch (e) {}
    location.href = "index.html";
  });
}

function hideBanScreen() {
  document.getElementById("zb-ban-screen")?.remove();
  document.documentElement.style.overflow = "";
}

onAuthStateChanged(auth, async (user) => {
  if (!user) { hideBanScreen(); return; }
  if (user.email === ADMIN_EMAIL) return;

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) return;

    const data  = snap.data();
    const until = data.bannedUntil?.toDate ? data.bannedUntil.toDate() : null;
    const active = data.banned === true && (!until || until > new Date());

    if (active) showBanScreen(data, user);
    else hideBanScreen();
  } catch (e) {
    console.warn("Ban check failed:", e);
  }
});