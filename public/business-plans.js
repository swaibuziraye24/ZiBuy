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

    const docRef = await addDoc(
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

   closeUpgradeModal();
    showPlanPaymentInstructions(p, price, docRef.id);
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


// ============================================
// PLAN PAYMENT INSTRUCTIONS MODAL
// ============================================
function showPlanPaymentInstructions(plan, price, subDocId) {
  const existing = document.getElementById("plan-payment-modal");
  if (existing) existing.remove();

  const ref = `PLAN-${subDocId.slice(0, 8).toUpperCase()}`;

  const modal = document.createElement("div");
  modal.id = "plan-payment-modal";
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.65);
    z-index:99999;display:flex;align-items:center;
    justify-content:center;padding:16px;overflow-y:auto
  `;

  modal.innerHTML = `
    <div style="background:white;border-radius:20px;padding:28px;max-width:480px;width:100%;animation:slideUp .3s ease;max-height:90vh;overflow-y:auto">

      <!-- Header -->
      <div style="text-align:center;margin-bottom:20px">
        <p style="font-size:40px;margin-bottom:8px">${plan.icon}</p>
        <h2 style="font-size:20px;font-weight:800;color:#111827;margin-bottom:4px">
          Activate ${plan.name} Plan
        </h2>
        <p style="font-size:28px;font-weight:900;color:#ff6600;margin:0">
          UGX ${Number(price).toLocaleString()}
        </p>
        <p style="font-size:13px;color:#6b7280;margin-top:4px">
          Pay using MTN or Airtel Money below
        </p>
      </div>

      <!-- MTN -->
      <div style="background:white;border:2px solid #ffcc00;border-radius:12px;padding:16px;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
          <div style="background:#ffcc00;border-radius:8px;padding:5px 10px;font-weight:900;font-size:13px;color:#111">MTN</div>
          <span style="font-weight:800;font-size:15px">MTN Mobile Money</span>
        </div>
        <ol style="padding-left:18px;color:#374151;line-height:2.3;font-size:13px;margin:0">
          <li>Dial <strong style="color:#ff6600">*165#</strong> on your MTN line</li>
          <li>Select <strong>Pay With Momo</strong></li>
          <li>Enter Merchant Code: <strong style="color:#ff6600;font-size:16px;letter-spacing:1px">27868095</strong></li>
          <li>Enter amount: <strong style="color:#ff6600">UGX ${Number(price).toLocaleString()}</strong></li>
          <li>Enter your PIN to confirm</li>
        </ol>
      </div>

      <!-- Airtel -->
      <div style="background:white;border:2px solid #ef4444;border-radius:12px;padding:16px;margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
          <div style="background:#ef4444;border-radius:8px;padding:5px 10px;font-weight:900;font-size:13px;color:white">AIRTEL</div>
          <span style="font-weight:800;font-size:15px">Airtel Money</span>
        </div>
        <ol style="padding-left:18px;color:#374151;line-height:2.3;font-size:13px;margin:0">
          <li>Dial <strong style="color:#ef4444">*185#</strong> on your Airtel line</li>
          <li>Select <strong>Send Money</strong></li>
          <li>Send to number: <strong style="color:#ef4444;font-size:16px">+256575996624</strong></li>
          <li>Enter amount: <strong style="color:#ef4444">UGX ${Number(price).toLocaleString()}</strong></li>
          <li>Enter your PIN to confirm</li>
        </ol>
      </div>

      <!-- Notice -->
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px;margin-bottom:16px;font-size:13px;color:#92400e">
        ⏱️ After paying, click <strong>"I've Paid"</strong> below. 
        Admin will verify your payment and activate your plan within <strong>1 hour</strong>.
      </div>

      <!-- Reference display -->
      <div style="background:#f9fafb;border-radius:10px;padding:12px;margin-bottom:16px;text-align:center">
        <p style="font-size:12px;color:#6b7280;margin:0 0 4px">Your payment reference</p>
        <p style="font-size:18px;font-weight:800;color:#ff6600;letter-spacing:1px;margin:0">${ref}</p>
        <p style="font-size:11px;color:#6b7280;margin:4px 0 0">Screenshot this for your records</p>
      </div>

      <!-- Reference input -->
      <div style="margin-bottom:14px">
        <label style="font-size:13px;font-weight:800;color:#111827;display:block;margin-bottom:8px">
          📋 Enter your transaction reference / ID
        </label>
        <input type="text" id="plan-txn-ref"
          placeholder="e.g. 1234567890 or REF123456"
          style="width:100%;padding:12px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box"
          onfocus="this.style.borderColor='#ff6600'"
          onblur="this.style.borderColor='#e5e7eb'"
        >
        <p style="font-size:12px;color:#6b7280;margin-top:6px">
          This is the confirmation ID you received on your phone after paying
        </p>
      </div>

      <!-- Buttons -->
      <div style="display:flex;flex-direction:column;gap:10px">
        <button onclick="confirmPlanPayment('${subDocId}', '${ref}', '${plan.id}', '${plan.name}', ${price})"
          style="background:#ff6600;color:white;border:none;padding:14px;border-radius:12px;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit;width:100%">
          📲 Send Reference to Admin WhatsApp
        </button>
        <button onclick="document.getElementById('plan-payment-modal').remove()"
          style="background:#f3f4f6;color:#6b7280;border:none;padding:12px;border-radius:12px;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit;width:100%">
          I'll pay later
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(modal);
}

// ── Seller confirms they have paid ──────────────
window.confirmPlanPayment = async function(subDocId, paymentRef, planId, planName, price) {
  const btn = event.target;

  // Get transaction reference from input
  const txnInput = document.getElementById("plan-txn-ref");
  const txnRef   = txnInput ? txnInput.value.trim() : "";

  if (!txnRef) {
    txnInput.style.borderColor = "#ef4444";
    txnInput.placeholder = "⚠️ Please enter your transaction reference first";
    txnInput.focus();
    return;
  }

  btn.textContent = "Opening WhatsApp...";
  btn.disabled    = true;

  try {
    // Save to Firestore with transaction reference
    await updateDoc(doc(db, "business_accounts", subDocId), {
      paymentRef,
      transactionRef:     txnRef,
      paymentConfirmedAt: new Date(),
      status:             "pending_payment"
    });

    document.getElementById("plan-payment-modal")?.remove();

    // Build WhatsApp message with all details
    const waMsg = encodeURIComponent(
      `Hello ZiBuy Admin 👋\n\n` +
      `I have paid for a *${planName} Plan* upgrade.\n\n` +
      `📋 *Payment Details:*\n` +
      `• Plan: *${planName}*\n` +
      `• Amount: *UGX ${Number(price).toLocaleString()}*\n` +
      `• My Reference Code: *${paymentRef}*\n` +
      `• Transaction ID: *${txnRef}*\n` +
      `• Email: *${currentUser.email}*\n\n` +
      `Please verify and activate my plan. Thank you! 🙏`
    );

    // Open admin WhatsApp
    window.open(`https://wa.me/256790548910?text=${waMsg}`, "_blank");

    // Show success screen
    const successModal = document.createElement("div");
    successModal.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.65);
      z-index:99999;display:flex;align-items:center;
      justify-content:center;padding:16px
    `;
    successModal.innerHTML = `
      <div style="background:white;border-radius:20px;padding:32px;max-width:400px;width:100%;text-align:center">
        <p style="font-size:52px;margin-bottom:12px">✅</p>
        <h2 style="font-size:20px;font-weight:800;color:#111827;margin-bottom:8px">
          Reference Sent!
        </h2>
        <p style="color:#6b7280;font-size:14px;line-height:1.7;margin-bottom:12px">
          Your transaction reference<br>
          <strong style="color:#ff6600;font-size:18px;letter-spacing:1px">${txnRef}</strong><br>
          has been sent to admin via WhatsApp.
        </p>
        <div style="background:#f9fafb;border-radius:10px;padding:12px;margin-bottom:16px;font-size:13px;text-align:left">
          <p style="margin:0 0 6px;font-weight:800;color:#111827">What happens next:</p>
          <p style="margin:0 0 4px;color:#374151">1. Admin verifies your Mobile Money payment</p>
          <p style="margin:0 0 4px;color:#374151">2. Your <strong>${planName}</strong> plan is activated</p>
          <p style="margin:0;color:#374151">3. You get a notification when it's live ✅</p>
        </div>
        <p style="font-size:12px;color:#6b7280;margin-bottom:20px">
          ⏱️ Usually activated within <strong>1 hour</strong>
        </p>
        <button onclick="this.closest('div').parentElement.remove();window.location.reload()"
          style="background:#ff6600;color:white;border:none;padding:14px;border-radius:12px;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit;width:100%">
          Done →
        </button>
      </div>
    `;
    document.body.appendChild(successModal);

  } catch (err) {
    console.error(err);
    alert("Failed. Please try again.");
    btn.textContent = "📲 Send Reference to Admin WhatsApp";
    btn.disabled    = false;
  }
};