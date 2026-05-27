// ============================================
// ZiBuy — Business Plans & Account Levels
// ============================================

import {
  db,
  auth,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  updateDoc,
  doc
} from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ============================================
// PLAN DEFINITIONS
// ============================================

export const PLANS = {

  free: {
    id: "free",
    name: "Free",
    icon: "🆓",
    tagline: "Get started with the basics",
    monthly: 0,
    annual: 0,
    maxAds: 3,
    boosts: 0
  },

  bronze: {
    id: "bronze",
    name: "Bronze",
    icon: "🥉",
    tagline: "Perfect for small sellers",
    monthly: 15000,
    annual: 144000,
    maxAds: 15,
    boosts: 2
  },

  silver: {
    id: "silver",
    name: "Silver",
    icon: "🥈",
    tagline: "For growing businesses",
    monthly: 35000,
    annual: 336000,
    maxAds: 50,
    boosts: 8
  },

  gold: {
    id: "gold",
    name: "Gold",
    icon: "🥇",
    tagline: "For serious businesses",
    monthly: 75000,
    annual: 720000,
    maxAds: Infinity,
    boosts: 25
  }

};

// ============================================
// STATE
// ============================================

let currentUser = null;
let currentPlan = PLANS.free;
let selectedPlanId = null;
let billingCycle = "monthly";

// ============================================
// AUTH
// ============================================

onAuthStateChanged(auth, async(user) => {

  currentUser = user;

  if (user) {
    currentPlan = await fetchUserPlan(user.uid);
  }

  renderPlans();

});

// ============================================
// FETCH USER PLAN
// ============================================

export async function fetchUserPlan(userId) {

  try {

    const snapshot = await getDocs(
      query(
        collection(db, "business_accounts"),
        where("userId", "==", userId),
        where("status", "==", "active")
      )
    );

    if (snapshot.empty) {
      return PLANS.free;
    }

    const data = snapshot.docs[0].data();

    return PLANS[data.plan] || PLANS.free;

  }

  catch (err) {

    console.error("fetchUserPlan error:", err);

    return PLANS.free;

  }

}

// ============================================
// RENDER PLANS
// ============================================

function renderPlans() {

  const grid =
    document.getElementById("plans-grid");

  if (!grid) return;

  const order = [
    "free",
    "bronze",
    "silver",
    "gold"
  ];

  grid.innerHTML = order.map(id => {

    const p = PLANS[id];

    const price =
      billingCycle === "monthly"
      ? p.monthly
      : p.annual;

    const isCurrent =
      currentPlan?.id === id;

    return `

      <div class="plan-card">

        <div class="plan-icon">
          ${p.icon}
        </div>

        <h3 class="plan-name">
          ${p.name}
        </h3>

        <p class="plan-tagline">
          ${p.tagline}
        </p>

        <div class="plan-price">

          ${
            price === 0

            ? `
              <span class="amount">
                Free
              </span>
            `

            : `
              <span class="currency">
                UGX
              </span>

              <span class="amount">
                ${price.toLocaleString()}
              </span>

              <span class="period">
                /${billingCycle === "monthly" ? "mo" : "yr"}
              </span>
            `
          }

        </div>

        <ul class="plan-features">

          <li>
            ✅ ${p.maxAds === Infinity ? "Unlimited" : p.maxAds} Ads
          </li>

          <li>
            ✅ ${p.boosts} Boosts
          </li>

        </ul>

        ${
          isCurrent

          ? `
            <button class="plan-cta current-plan" disabled>
              ✓ Current Plan
            </button>
          `

          : `
            <button
              class="plan-cta"
              onclick="openUpgrade('${id}')"
            >
              Upgrade
            </button>
          `
        }

      </div>

    `;

  }).join("");

}

// ============================================
// BILLING SWITCH
// ============================================

function setBilling(cycle) {

  billingCycle = cycle;

  const monthlyBtn =
    document.getElementById("btn-monthly");

  const annualBtn =
    document.getElementById("btn-annual");

  if (monthlyBtn) {
    monthlyBtn.classList.toggle(
      "active",
      cycle === "monthly"
    );
  }

  if (annualBtn) {
    annualBtn.classList.toggle(
      "active",
      cycle === "annual"
    );
  }

  renderPlans();

}

// ============================================
// OPEN UPGRADE
// ============================================

function openUpgrade(planId) {

  if (!currentUser) {

    alert("Please login first");

    window.location.href = "index.html";

    return;

  }

  selectedPlanId = planId;

  const p = PLANS[planId];

  const price =
    billingCycle === "monthly"
    ? p.monthly
    : p.annual;

  const modal =
    document.getElementById("upgrade-modal");

  if (!modal) {
    alert("Upgrade modal not found");
    return;
  }

  document.getElementById("um-icon").textContent =
    p.icon;

  document.getElementById("um-plan-name").textContent =
    p.name;

  document.getElementById("um-plan-desc").textContent =
    p.tagline;

  document.getElementById("um-price").textContent =
    `UGX ${price.toLocaleString()}`;

  modal.classList.add("open");

}

// ============================================
// CLOSE MODAL
// ============================================

function closeUpgradeModal() {

  const modal =
    document.getElementById("upgrade-modal");

  if (modal) {
    modal.classList.remove("open");
  }

}

// ============================================
// PROCESS UPGRADE
// ============================================

async function processUpgrade() {

  if (!currentUser || !selectedPlanId) {
    return;
  }

  try {

    const p = PLANS[selectedPlanId];

    const price =
      billingCycle === "monthly"
      ? p.monthly
      : p.annual;

    const duration =
      billingCycle === "monthly"
      ? 30
      : 365;

    const endDate =
      new Date();

    endDate.setDate(
      endDate.getDate() + duration
    );

    await addDoc(
      collection(db, "business_accounts"),
      {
        userId: currentUser.uid,
        email: currentUser.email,
        plan: selectedPlanId,
        billingCycle,
        status: "pending_payment",
        price,
        startDate: new Date(),
        endDate,
        createdAt: new Date()
      }
    );

    const whatsapp =
      "256790548910";

    const msg =
      encodeURIComponent(
        `Hello ZiBuy Admin.%0A%0A` +
        `I want to upgrade my business plan.%0A%0A` +
        `Plan: ${p.name}%0A` +
        `Billing: ${billingCycle}%0A` +
        `Amount: UGX ${price.toLocaleString()}%0A%0A` +
        `Email: ${currentUser.email}`
      );

    window.open(
      `https://wa.me/${whatsapp}?text=${msg}`,
      "_blank"
    );

    alert(
      "✅ Upgrade request submitted"
    );

    closeUpgradeModal();

  }

  catch (err) {

    console.error(err);

    alert(
      "❌ Failed to process upgrade"
    );

  }

}

// ============================================
// DOWNGRADE
// ============================================

async function downgradeFree() {

  if (!currentUser) return;

  const ok =
    confirm(
      "Downgrade to free plan?"
    );

  if (!ok) return;

  try {

    const snapshot =
      await getDocs(
        query(
          collection(db, "business_accounts"),
          where("userId", "==", currentUser.uid),
          where("status", "==", "active")
        )
      );

    for (const d of snapshot.docs) {

      await updateDoc(
        doc(
          db,
          "business_accounts",
          d.id
        ),
        {
          status: "expired"
        }
      );

    }

    alert(
      "✅ Downgraded successfully"
    );

    location.reload();

  }

  catch (err) {

    console.error(err);

    alert(
      "❌ Failed to downgrade"
    );

  }

}

// ============================================
// GLOBAL FUNCTIONS
// ============================================

window.setBilling = setBilling;
window.openUpgrade = openUpgrade;
window.closeUpgradeModal = closeUpgradeModal;
window.processUpgrade = processUpgrade;
window.downgradeFree = downgradeFree;