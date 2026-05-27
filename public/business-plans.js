// ============================================
//   ZiBuy — Business Plans & Account Levels
// ============================================

import {
  db, auth, collection, addDoc, getDocs,
  doc, getDoc, query, where, updateDoc
} from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ── Plan Definitions ────────────────────────
export const PLANS = {
  free: {
    id:        "free",
    name:      "Free",
    icon:      "🆓",
    tagline:   "Get started with the basics",
    color:     "#6b7280",
    badge:     "badge-free",
    monthly:   0,
    annual:    0,
    maxAds:    3,
    boosts:    0,
    adDays:    30,
    images:    3,
    verified:  false,
    priority:  false,
    support:   "Community",
    features: [
      { text: "<strong>3</strong> active ads", ok: true },
      { text: "30-day ad duration",            ok: true },
      { text: "3 images per ad",               ok: true },
      { text: "WhatsApp & Call button",         ok: true },
      { text: "Basic analytics",               ok: true },
      { text: "No ad boosts",                  ok: false },
      { text: "No verified badge",             ok: false },
    ]
  },
  bronze: {
    id:        "bronze",
    name:      "Bronze",
    icon:      "🥉",
    tagline:   "Perfect for small sellers",
    color:     "#92400e",
    badge:     "badge-bronze",
    monthly:   15000,
    annual:    144000,
    maxAds:    15,
    boosts:    2,
    adDays:    60,
    images:    5,
    verified:  false,
    priority:  false,
    support:   "Email",
    features: [
      { text: "<strong>15</strong> active ads",      ok: true },
      { text: "60-day ad duration",                  ok: true },
      { text: "5 images per ad",                     ok: true },
      { text: "<strong>2 free boosts</strong>/month", ok: true },
      { text: "Business profile page",               ok: true },
      { text: "Standard analytics",                  ok: true },
      { text: "No verified badge",                   ok: false },
    ]
  },
  silver: {
    id:        "silver",
    name:      "Silver",
    icon:      "🥈",
    tagline:   "For growing businesses",
    color:     "#475569",
    badge:     "badge-silver",
    monthly:   35000,
    annual:    336000,
    maxAds:    50,
    boosts:    8,
    adDays:    90,
    images:    8,
    verified:  true,
    priority:  false,
    support:   "Priority Email",
    features: [
      { text: "<strong>50</strong> active ads",       ok: true },
      { text: "90-day ad duration",                   ok: true },
      { text: "8 images per ad",                      ok: true },
      { text: "<strong>8 free boosts</strong>/month", ok: true },
      { text: "✅ Verified seller badge",              ok: true },
      { text: "Priority placement (partial)",         ok: true },
      { text: "Advanced analytics",                   ok: true },
    ]
  },
  gold: {
    id:        "gold",
    name:      "Gold",
    icon:      "🥇",
    tagline:   "For serious businesses",
    color:     "#b45309",
    badge:     "badge-gold",
    monthly:   75000,
    annual:    720000,
    maxAds:    Infinity,
    boosts:    25,
    adDays:    180,
    images:    15,
    verified:  true,
    priority:  true,
    support:   "24/7 WhatsApp",
    features: [
      { text: "<strong>Unlimited</strong> ads",        ok: true },
      { text: "180-day ad duration",                   ok: true },
      { text: "15 images per ad",                      ok: true },
      { text: "<strong>25 boosts</strong>/month",      ok: true },
      { text: "🥇 Gold verified badge",                ok: true },
      { text: "Top of search results",                 ok: true },
      { text: "Full analytics + export",               ok: true },
    ]
  }
};

// ── State ────────────────────────────────────
let currentUser      = null;
let currentPlan      = null;
let selectedPlanId   = null;
let billingCycle     = "monthly";
let userAdsCount     = 0;
let userBoostsCount  = 0;

// ── Auth ─────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    currentPlan = await fetchUserPlan(user.uid);
    renderCurrentBanner();
    await loadUsage();
  }
  renderPlans();
});

// ── Fetch user's active plan from Firestore ──
export async function fetchUserPlan(userId) {
  try {
    const snap = await getDocs(query(
      collection(db, "business_accounts"),
      where("userId",  "==", userId),
      where("status",  "==", "active")
    ));
    if (snap.empty) return PLANS.free;
    const data = snap.docs[0].data();
    return PLANS[data.plan] || PLANS.free;
  } catch (e) {
    console.error(e);
    return PLANS.free;
  }
}

// ── Load usage stats ─────────────────────────
async function loadUsage() {
  try {
    const adsSnap = await getDocs(query(
      collection(db, "products"),
      where("userId", "==", currentUser.uid),
      where("status", "==", "active")
    ));
    userAdsCount = adsSnap.size;

    const now   = new Date();
    const month = now.getMonth();
    const year  = now.getFullYear();
    const premSnap = await getDocs(query(
      collection(db, "premium_ads"),
      where("userId", "==", currentUser.uid)
    ));
    userBoostsCount = premSnap.docs.filter(d => {
      const cd = d.data().createdAt?.toDate?.();
      return cd && cd.getMonth() === month && cd.getFullYear() === year;
    }).length;

    renderUsage();
  } catch (e) {
    console.error(e);
  }
}

function renderUsage() {
  const sec = document.getElementById("usage-section");
  if (!sec) return;
  sec.style.display = "block";

  const plan    = currentPlan || PLANS.free;
  const maxAds  = plan.maxAds === Infinity ? 999 : plan.maxAds;
  const maxBoost = plan.boosts;

  const adPct   = Math.min((userAdsCount  / maxAds)   * 100, 100);
  const bstPct  = maxBoost > 0 ? Math.min((userBoostsCount / maxBoost) * 100, 100) : 0;

  document.getElementById("usage-ads-text").textContent =
    `${userAdsCount} / ${plan.maxAds === Infinity ? "∞" : maxAds}`;
  document.getElementById("usage-boost-text").textContent =
    `${userBoostsCount} / ${maxBoost}`;

  const adFill  = document.getElementById("usage-ads-fill");
  adFill.style.width = adPct + "%";
  adFill.className   = "usage-fill" + (adPct >= 100 ? " danger" : adPct >= 80 ? " warning" : "");

  const bFill   = document.getElementById("usage-boost-fill");
  bFill.style.width  = bstPct + "%";
  bFill.className    = "usage-fill" + (bstPct >= 100 ? " danger" : bstPct >= 80 ? " warning" : "");
}

// ── Current plan banner ───────────────────────
function renderCurrentBanner() {
  const banner = document.getElementById("current-plan-banner");
  if (!banner || !currentPlan) return;
  banner.style.display = "flex";

  document.getElementById("cp-icon").textContent  = currentPlan.icon;
  document.getElementById("cp-name").textContent  = currentPlan.name + " Plan";
  document.getElementById("cp-desc").textContent  = currentPlan.tagline;

  // Fetch expiry
  getDocs(query(
    collection(db, "business_accounts"),
    where("userId", "==", currentUser.uid),
    where("status", "==", "active")
  )).then(snap => {
    if (!snap.empty) {
      const exp = snap.docs[0].data().endDate?.toDate?.();
      document.getElementById("cp-expires").textContent =
        exp ? exp.toLocaleDateString("en-UG", { day:"numeric", month:"short", year:"numeric" }) : "—";
    } else {
      document.getElementById("cp-expires").textContent = "Free forever";
    }
  });
}

// ── Render plan cards ─────────────────────────
function renderPlans() {
  const grid = document.getElementById("plans-grid");
  if (!grid) return;

  const order = ["free","bronze","silver","gold"];
  grid.innerHTML = order.map(id => {
    const p     = PLANS[id];
    const price = billingCycle === "monthly" ? p.monthly : Math.round(p.annual / 12);
    const isCur = currentPlan?.id === id;
    const popular = id === "silver";

    return `
      <div class="plan-card${popular ? " popular" : ""}">
        ${popular ? '<div class="popular-chip">⭐ Most Popular</div>' : ""}
        <div class="plan-icon">${p.icon}</div>
        <div class="plan-name">${p.name}</div>
        <div class="plan-tagline">${p.tagline}</div>
        <div class="plan-price">
          ${price === 0
            ? '<span class="amount">Free</span>'
            : `<span class="currency">UGX</span><span class="amount">${price.toLocaleString()}</span><span class="period">/mo</span>`}
        </div>
        <div class="plan-price-annual">
          ${billingCycle === "annual" && price > 0
            ? `✅ Billed as UGX ${p.annual.toLocaleString()}/year`
            : billingCycle === "monthly" && p.annual > 0
            ? `💡 Save UGX ${(p.monthly * 12 - p.annual).toLocaleString()}/yr with annual`
            : ""}
        </div>
        <div class="plan-divider"></div>
        <ul class="plan-features">
          ${p.features.map(f => `
            <li>
              <span class="feat-check">${f.ok ? "✅" : "❌"}</span>
              <span class="feat-text">${f.text}</span>
            </li>`).join("")}
        </ul>
        ${isCur
          ? `<button class="plan-cta current-plan" disabled>✓ Current Plan</button>`
          : price === 0
          ? `<button class="plan-cta secondary" onclick="downgradeFree()">Switch to Free</button>`
          : `<button class="plan-cta${popular ? " primary" : " secondary"}" onclick="openUpgrade('${id}')">
               ${popular ? "⬆️ Upgrade Now" : "Select Plan"}
             </button>`
        }
      </div>`;
  }).join("");
}

// ── Billing toggle ────────────────────────────
window.setBilling = function(cycle) {
  billingCycle = cycle;
  document.getElementById("btn-monthly").classList.toggle("active", cycle === "monthly");
  document.getElementById("btn-annual").classList.toggle("active",  cycle === "annual");
  renderPlans();
};

// ── Open upgrade modal ────────────────────────
window.openUpgrade = function(planId) {
  if (!currentUser) {
    showToast("Please login to upgrade", "error");
    setTimeout(() => window.location.href = "index.html", 1500);
    return;
  }
  selectedPlanId = planId;
  const p     = PLANS[planId];
  const price = billingCycle === "monthly" ? p.monthly : p.annual;

  document.getElementById("um-icon").textContent      = p.icon;
  document.getElementById("um-plan-name").textContent = p.name + " Plan";
  document.getElementById("um-plan-desc").textContent = p.tagline;
  document.getElementById("um-price").textContent =
    `UGX ${price.toLocaleString()} / ${billingCycle === "monthly" ? "month" : "year"}`;

  document.getElementById("momo-field").style.display  = "none";
  document.getElementById("upgrade-modal").classList.add("open");
  document.getElementById("overlay").classList.add("active");
};

window.closeUpgradeModal = function() {
  document.getElementById("upgrade-modal").classList.remove("open");
  document.getElementById("overlay").classList.remove("active");
};

// ── Select payment method ─────────────────────
window.selectPayment = function(el, method) {
  document.querySelectorAll(".pay-method").forEach(m => m.classList.remove("selected"));
  el.classList.add("selected");
  document.getElementById("momo-field").style.display = "block";
};

// ── Process upgrade ───────────────────────────
window.processUpgrade = async function() {
  if (!selectedPlanId || !currentUser) return;

  const ZIBUY_WHATSAPP = "256790548910"; // ← replace with your number

  const btn = document.getElementById("pay-btn");
  btn.textContent = "Redirecting to WhatsApp…";
  btn.disabled = true;

  try {
    const p       = PLANS[selectedPlanId];
    const price   = billingCycle === "monthly" ? p.monthly : p.annual;
    const days    = billingCycle === "monthly" ? 30 : 365;
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);
    const refId   = "BP-" + Date.now();

    // Save pending plan record
    const oldSnap = await getDocs(query(
      collection(db, "business_accounts"),
      where("userId", "==", currentUser.uid),
      where("status", "==", "active")
    ));
    for (const d of oldSnap.docs) {
      await updateDoc(doc(db, "business_accounts", d.id), { status: "pending_payment" });
    }

    await addDoc(collection(db, "business_accounts"), {
      refId,
      userId:    currentUser.uid,
      email:     currentUser.email,
      plan:      selectedPlanId,
      billing:   billingCycle,
      price,
      status:    "pending_payment",
      startDate: new Date(),
      endDate,
      createdAt: new Date()
    });

    // Build WhatsApp message
    const msg = encodeURIComponent(
      `💼 *ZiBuy Business Plan Upgrade*\n\n` +
      `Reference: *${refId}*\n` +
      `Plan: *${p.icon} ${p.name}*\n` +
      `Billing: ${billingCycle === "monthly" ? "Monthly" : "Annual"}\n` +
      `Amount: *UGX ${price.toLocaleString()}*\n\n` +
      `Account: ${currentUser.email}\n\n` +
      `Please confirm payment to activate plan.`
    );

    closeUpgradeModal();
    window.open(`https://wa.me/${ZIBUY_WHATSAPP}?text=${msg}`, "_blank");

  } catch (err) {
    console.error(err);
    showToast("Request failed. Try again.", "error");
    btn.textContent = "Pay & Activate Plan";
    btn.disabled = false;
  }
};

// ── Downgrade to free ─────────────────────────
window.downgradeFree = async function() {
  if (!currentUser) return;
  if (!confirm("Downgrade to Free plan? Your current benefits will end immediately.")) return;

  try {
    const snap = await getDocs(query(
      collection(db, "business_accounts"),
      where("userId", "==", currentUser.uid),
      where("status", "==", "active")
    ));
    for (const d of snap.docs) {
      await updateDoc(doc(db, "business_accounts", d.id), { status: "expired" });
    }
    showToast("Downgraded to Free plan", "info");
    currentPlan = PLANS.free;
    setTimeout(() => window.location.reload(), 1200);
  } catch (e) {
    console.error(e);
    showToast("Failed to downgrade", "error");
  }
};

// ── Toast ─────────────────────────────────────
function showToast(msg, type = "info") {
  const c    = document.getElementById("toast-container");
  if (!c) return;
  const t    = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ── Helper: get current user plan (exported) ─
export async function getUserPlan(userId) {
  return await fetchUserPlan(userId);
}

// ── Helper: check if user can post ad ────────
export async function canPostAd(userId) {
  const plan  = await fetchUserPlan(userId);
  const snap  = await getDocs(query(
    collection(db, "products"),
    where("userId", "==", userId),
    where("status", "==", "active")
  ));
  const count = snap.size;
  const limit = plan.maxAds === Infinity ? 999999 : plan.maxAds;
  return {
    allowed: count < limit,
    count,
    limit,
    plan: plan.name
  };
}