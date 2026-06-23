// ============================================
//   ZiBuy — Referral System
// ============================================

import { db, auth, collection, addDoc, getDocs,
  doc, getDoc, query, where, updateDoc } from "./firebase.js";
import { onAuthStateChanged } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ── Generate a short code from a UID ─────────
function makeCode(uid) {
  return "ZB" + uid.slice(0, 6).toUpperCase();
}

// ── Capture ref code from URL on every page load ─
export function captureReferralCode() {
  const ref = new URLSearchParams(location.search).get("ref");
  if (ref) {
    sessionStorage.setItem("zibuy_ref", ref);
  }
}

// ── Save referredBy when a new user registers ─
export async function attachReferral(newUserId) {
  const refCode = sessionStorage.getItem("zibuy_ref");
  if (!refCode) return;
  if (refCode === makeCode(newUserId)) return; // can't refer yourself

  try {
    // Find the referrer
    const snap = await getDocs(query(
      collection(db, "users"),
      where("referralCode", "==", refCode)
    ));
    if (snap.empty) return;

    const referrerDoc = snap.docs[0];

    // Save referredBy on the new user
    await updateDoc(doc(db, "users", newUserId), {
      referredBy: referrerDoc.id,
      referredByCode: refCode
    });

    // Record in referrals collection
    await addDoc(collection(db, "referrals"), {
      referrerId:   referrerDoc.id,
      referredId:   newUserId,
      status:       "pending",   // → "rewarded" once they post first ad
      createdAt:    new Date()
    });

    sessionStorage.removeItem("zibuy_ref");
    console.log("[REFERRAL] Linked to:", referrerDoc.id);
  } catch (e) {
    console.warn("[REFERRAL] attachReferral:", e.message);
  }
}

// ── Ensure user has a referral code (called on login) ─
export async function ensureReferralCode(userId) {
  try {
    const snap = await getDoc(doc(db, "users", userId));
    if (!snap.exists()) return;
    const data = snap.data();
    if (!data.referralCode) {
      await updateDoc(doc(db, "users", userId), {
        referralCode: makeCode(userId)
      });
    }
  } catch (e) {
    console.warn("[REFERRAL] ensureReferralCode:", e.message);
  }
}

// ── Check and reward referrer when referred user posts first ad ─
export async function checkReferralReward(posterId) {
  try {
    // Was this user referred?
    const userSnap = await getDoc(doc(db, "users", posterId));
    if (!userSnap.exists()) return;
    const userData = userSnap.data();
    if (!userData.referredBy) return;

    // Is there a pending referral?
    const refSnap = await getDocs(query(
      collection(db, "referrals"),
      where("referredId",  "==", posterId),
      where("status",      "==", "pending")
    ));
    if (refSnap.empty) return;

    const refDoc     = refSnap.docs[0];
    const referrerId = refDoc.data().referrerId;

    // Mark referral as rewarded
    await updateDoc(doc(db, "referrals", refDoc.id), {
      status:     "rewarded",
      rewardedAt: new Date()
    });

    // Give referrer a free 7-day boost credit
    await addDoc(collection(db, "boost_credits"), {
      userId:    referrerId,
      days:      7,
      reason:    "referral_reward",
      used:      false,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 days to use
    });

    // Notify referrer
    await addDoc(collection(db, "notifications"), {
      userId:    referrerId,
      type:      "referral_reward",
      title:     "🎉 Referral Reward Earned!",
      message:   "Your referred friend just posted their first ad. You earned a FREE 7-day boost!",
      relatedId: "boost_credits",
      read:      false,
      createdAt: new Date()
    });

    console.log("[REFERRAL] Reward given to:", referrerId);
  } catch (e) {
    console.warn("[REFERRAL] checkReferralReward:", e.message);
  }
}

// ── Load referral stats for dashboard ────────
export async function loadReferralStats(userId) {
  try {
    const [refSnap, creditSnap] = await Promise.all([
      getDocs(query(
        collection(db, "referrals"),
        where("referrerId", "==", userId)
      )),
      getDocs(query(
        collection(db, "boost_credits"),
        where("userId", "==", userId),
        where("used",   "==", false)
      ))
    ]);

    const referrals  = refSnap.docs.map(d => d.data());
    const rewarded   = referrals.filter(r => r.status === "rewarded").length;
    const pending    = referrals.filter(r => r.status === "pending").length;
    const credits    = creditSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const totalDays  = credits.reduce((s, c) => s + (c.days || 0), 0);

    return { referrals, rewarded, pending, credits, totalDays };
  } catch (e) {
    console.warn("[REFERRAL] loadReferralStats:", e.message);
    return { referrals: [], rewarded: 0, pending: 0, credits: [], totalDays: 0 };
  }
}

// ── Get shareable referral link ───────────────
export function getReferralLink(referralCode) {
  return `https://zibuy-5deae.web.app/index.html?ref=${referralCode}`;
}

// ── Apply a boost credit to a product ────────
export async function applyBoostCredit(creditId, productId, productName) {
  try {
    const creditSnap = await getDoc(doc(db, "boost_credits", creditId));
    if (!creditSnap.exists()) throw new Error("Credit not found");
    const credit = creditSnap.data();
    if (credit.used) throw new Error("Credit already used");

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + credit.days);

    // Apply boost to product
    await updateDoc(doc(db, "products", productId), {
      isPremium:        true,
      premiumExpiresAt: expiresAt,
      boostedByCredit:  true
    });

    // Mark credit as used
    await updateDoc(doc(db, "boost_credits", creditId), {
      used:       true,
      usedOn:     productId,
      usedAt:     new Date()
    });

    // Record in boost_requests so admin panel shows it
    await addDoc(collection(db, "boost_requests"), {
      productId,
      productName,
      userId:    credit.userId,
      days:      credit.days,
      price:     0,
      status:    "approved",
      source:    "referral_credit",
      createdAt: new Date(),
      expiresAt
    });

    return { success: true, days: credit.days };
  } catch (e) {
    console.warn("[REFERRAL] applyBoostCredit:", e.message);
    return { success: false, error: e.message };
  }
}