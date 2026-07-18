const TRUST_TIERS = {
  elite:  { label: "💎 Elite Trust",  color: "#5b21b6", bg: "#ede9fe" },
  gold:   { label: "🥇 Gold Trust",   color: "#b45309", bg: "#fef3c7" },
  silver: { label: "🥈 Silver Trust", color: "#475569", bg: "#f1f5f9" },
  bronze: { label: "🥉 Bronze Trust", color: "#92400e", bg: "#fed7aa" },
  new:    { label: "🌱 New Seller",   color: "#6b7280", bg: "#f3f4f6" }
};

export function trustBadgeHTML(tier, score, opts = {}) {
  const t = TRUST_TIERS[tier] || TRUST_TIERS.new;
  const showScore = opts.showScore !== false;
  return `<span class="trust-badge" style="display:inline-flex;align-items:center;gap:4px;
    background:${t.bg};color:${t.color};padding:3px 10px;border-radius:20px;
    font-size:11px;font-weight:800;white-space:nowrap">
    ${t.label}${showScore && score != null ? ` · ${score}` : ""}
  </span>`;
}

export async function renderTrustBadge(userId, targetElId, opts = {}) {
  if (!userId) return;
  const el = document.getElementById(targetElId);
  if (!el) return;

  try {
    const { db, doc, getDoc } = await import("./firebase.js");
    const snap = await getDoc(doc(db, "users", userId));
    if (!snap.exists()) return;

    const data = snap.data();
    if (!data.trustTier) return; // score not computed yet — brand new account

    el.innerHTML = trustBadgeHTML(data.trustTier, data.trustScore, opts);
  } catch (e) {
    console.warn("renderTrustBadge:", e.message);
  }
}