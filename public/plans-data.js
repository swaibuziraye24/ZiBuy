// ============================================
// ZiBuy — Shared Plan Data
// Live-synced from Firestore plan_config/current
// so admin can edit limits without a redeploy.
// This object stays intact as the fallback/default
// if Firestore is unreachable or not yet configured.
// ============================================

import { db, doc } from "./firebase.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const PLANS = {

  free: {
    id: "free",
    name: "Free",
    maxAds: 3,
    boosts: 0,
    images: 3,
    adDays: 30,
    priority: 1
  },

  bronze: {
    id: "bronze",
    name: "Bronze",
    maxAds: 15,
    boosts: 2,
    images: 5,
    adDays: 60,
    priority: 2
  },

  silver: {
    id: "silver",
    name: "Silver",
    maxAds: 50,
    boosts: 8,
    images: 8,
    adDays: 90,
    priority: 3
  },

  gold: {
    id: "gold",
    name: "Gold",
    maxAds: Infinity,
    boosts: 25,
    images: 15,
    adDays: 180,
    priority: 4
  }

};

// ── Live sync: admin edits in the panel flow here automatically ──
onSnapshot(doc(db, "plan_config", "current"), (snap) => {
  if (!snap.exists()) return; // no config saved yet — keep defaults above
  const data = snap.data();

  ["free", "bronze", "silver", "gold"].forEach(planId => {
    const override = data[planId];
    if (!override) return;

    // Mutate the existing object in place (not reassign) so every file
    // that already imported PLANS keeps seeing live updates
    if (override.maxAds != null) PLANS[planId].maxAds = override.maxAds === "unlimited" ? Infinity : Number(override.maxAds);
    if (override.boosts != null) PLANS[planId].boosts = Number(override.boosts);
    if (override.images != null) PLANS[planId].images = Number(override.images);
    if (override.adDays != null) PLANS[planId].adDays = Number(override.adDays);
  });
}, (err) => {
  console.warn("plan_config sync failed, using built-in defaults:", err.message);
});