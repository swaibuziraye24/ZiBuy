import { db, doc, getDoc } from "./firebase.js";

export async function renderEarnedBadge(userId, targetElId) {
  const el = document.getElementById(targetElId);
  if (!el || !userId) return;

  try {
    const snap = await getDoc(doc(db, "users", userId));
    if (!snap.exists() || !snap.data().earnedVerification) return;

    el.innerHTML = `<span style="display:inline-flex;align-items:center;gap:4px;
      background:linear-gradient(135deg,#fbbf24,#f59e0b);color:white;padding:3px 10px;
      border-radius:20px;font-size:11px;font-weight:800;white-space:nowrap;
      box-shadow:0 1px 4px rgba(245,158,11,0.4)">
      🏆 Trusted Seller
    </span>`;
  } catch (e) { console.warn("renderEarnedBadge:", e.message); }
}