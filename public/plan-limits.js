// ============================================
//  ZiBuy — Plan Limits & Benefits Enforcement
//  Single source of truth for what each plan
//  unlocks, matching business-plans.html table
// ============================================

import { db, auth, collection, getDocs, query, where, doc } from "./firebase.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Matches PLANS in plans-data.js + compare table.
// Live-synced from the SAME Firestore doc as plans-data.js, so a single
// admin edit updates ad-posting limits AND boost limits together.
export const PLAN_LIMITS = {
  free:   { maxAds: 3,        boosts: 0,  duration: 30,  maxImages: 3,  autoVerified: false },
  bronze: { maxAds: 15,       boosts: 2,  duration: 60,  maxImages: 5,  autoVerified: false },
  silver: { maxAds: 50,       boosts: 8,  duration: 90,  maxImages: 8,  autoVerified: true  },
  gold:   { maxAds: Infinity, boosts: 25, duration: 180, maxImages: 15, autoVerified: true  }
};

onSnapshot(doc(db, "plan_config", "current"), (snap) => {
  if (!snap.exists()) return;
  const data = snap.data();

  ["free", "bronze", "silver", "gold"].forEach(planId => {
    const override = data[planId];
    if (!override) return;

    // Note the field-name mapping: plans-data.js calls these
    // "images"/"adDays", this file calls them "maxImages"/"duration"
    if (override.maxAds != null)  PLAN_LIMITS[planId].maxAds     = override.maxAds === "unlimited" ? Infinity : Number(override.maxAds);
    if (override.boosts != null)  PLAN_LIMITS[planId].boosts     = Number(override.boosts);
    if (override.images != null)  PLAN_LIMITS[planId].maxImages  = Number(override.images);
    if (override.adDays != null)  PLAN_LIMITS[planId].duration   = Number(override.adDays);
    if (override.autoVerified != null) PLAN_LIMITS[planId].autoVerified = !!override.autoVerified;
  });
}, (err) => {
  console.warn("plan_config sync failed in plan-limits.js:", err.message);
});

// ── Get current user's active plan id ──────────
export async function getCurrentPlanId(uid) {
  try {
    const snap = await getDocs(query(
      collection(db, "business_accounts"),
      where("userId", "==", uid),
      where("status", "==", "active")
    ));
    if (snap.empty) return "free";

    const sub = snap.docs[0].data();
    const end = sub.endDate?.toDate?.();
    if (end && new Date() > end) return "free";
    return sub.plan || "free";
  } catch (e) {
    console.warn("getCurrentPlanId error:", e.code);
    return "free";
  }
}

// ── Get full limits object for current user ─────
export async function getMyLimits(uid) {
  const planId = await getCurrentPlanId(uid);
  return { planId, ...(PLAN_LIMITS[planId] || PLAN_LIMITS.free) };
}

// ── Count user's currently active ads ───────────
export async function countActiveAds(uid) {
  try {
    const snap = await getDocs(query(
      collection(db, "products"),
      where("userId", "==", uid),
      where("status", "==", "active")
    ));
    return snap.size;
  } catch (e) {
    console.warn("countActiveAds error:", e.code);
    return 0;
  }
}

// ── Count boosts used THIS calendar month ───────
export async function countBoostsThisMonth(uid) {
  try {
    const snap = await getDocs(query(
      collection(db, "boost_requests"),
      where("userId", "==", uid)
    ));
    const now = new Date();
    let count = 0;
    snap.forEach(d => {
      const data = d.data();
      if (data.status === "pending" || data.status === "approved") {
        const created = data.requestedAt?.toDate?.() || data.createdAt?.toDate?.();
        if (created && created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear()) {
          count++;
        }
      }
    });
    return count;
  } catch (e) {
    console.warn("countBoostsThisMonth error:", e.code);
    return 0;
  }
}

// ── Check before posting a new ad ───────────────
// Returns { allowed: bool, reason: string|null, limits }
export async function checkCanPostAd() {
  const user = auth.currentUser;
  if (!user) return { allowed: false, reason: "Please login to post an ad", limits: PLAN_LIMITS.free };

  const limits = await getMyLimits(user.uid);
  const activeCount = await countActiveAds(user.uid);

  if (activeCount >= limits.maxAds) {
    return {
      allowed: false,
      reason: `You've reached your ${limits.planId.toUpperCase()} plan limit of ${limits.maxAds} active ads. Upgrade your plan to post more.`,
      limits
    };
  }

  return { allowed: true, reason: null, limits };
}

// ── Check before requesting a boost ─────────────
export async function checkCanBoost() {
  const user = auth.currentUser;
  if (!user) return { allowed: false, reason: "Please login to boost", limits: PLAN_LIMITS.free };

  const limits = await getMyLimits(user.uid);

  if (limits.boosts === 0) {
    return {
      allowed: false,
      reason: `Free plan doesn't include monthly boosts. You can still pay per-boost, or upgrade to Bronze for 2 free boosts/month.`,
      limits
    };
  }

  const used = await countBoostsThisMonth(user.uid);
  if (used >= limits.boosts) {
    return {
      allowed: false,
      reason: `You've used all ${limits.boosts} boosts included in your ${limits.planId.toUpperCase()} plan this month. Upgrade for more, or pay per-boost.`,
      limits
    };
  }

  return { allowed: true, reason: null, limits, remaining: limits.boosts - used };
}

// ── Ad expiry date based on plan ────────────────
export function getAdExpiryDate(planId) {
  const days = (PLAN_LIMITS[planId] || PLAN_LIMITS.free).duration;
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  return expiry;
}

// ── Max images allowed based on plan ────────────
export function getMaxImages(planId) {
  return (PLAN_LIMITS[planId] || PLAN_LIMITS.free).maxImages;
}