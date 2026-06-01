// ============================================
//   ZiBuy — Admin Panel
// ============================================

import {
  db, auth, collection, getDocs, doc,
  getDoc, query, where, updateDoc, deleteDoc, addDoc
} from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
const PLAN_LIMITS = {
  free: {
    maxAds: 3,
    boosts: 0,
    adDays: 30,
    images: 3,

    businessProfile: false,
    support: "Community"
  },

  bronze: {
    maxAds: 15,
    boosts: 2,
    adDays: 60,
    images: 5,

    businessProfile: true,
    support: "Email"
  },

  silver: {
    maxAds: 50,
    boosts: 8,
    adDays: 90,
    images: 8,

    businessProfile: true,
    support: "Priority Email"
  },

  gold: {
    maxAds: 999999,
    boosts: 25,
    adDays: 180,
    images: 15,

    businessProfile: true,
    support: "24/7 WhatsApp",

    customBadge: true,
    priorityPlacement: true
  }
};

const ADMIN_EMAIL = "swaibuziraye22@gmail.com"; // ← your admin email

// ── Raw data caches ───────────────────────────
let allUsers       = [];
let allSubs        = [];
let allBoosts      = [];
let allAds         = [];
let allOrders      = [];
let allPremiumAds  = [];
let allVerifs      = [];
let allReports     = [];

// ── Auth guard ────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  const emailDisplay = document.getElementById("admin-email-display");

  if (!user) {
    window.location.href = "index.html";
    return;
  }

  if (user.email !== ADMIN_EMAIL) {
    alert("Access denied. Admins only.");
    await signOut(auth);
    window.location.href = "index.html";
    return;
  }

  if (emailDisplay) {
    emailDisplay.textContent = user.email;
  }

  await loadAll();
});

window.adminLogout = () => signOut(auth).then(() => window.location.href = "index.html");


window.showSection = function(name, btn) {

  // hide all sections
  document.querySelectorAll(".admin-section")
    .forEach(section => {
      section.classList.remove("active");
    });

  // remove active class from sidebar buttons
  document.querySelectorAll(".admin-nav-item")
    .forEach(button => {
      button.classList.remove("active");
    });

  // show selected section
  const activeSection =
    document.getElementById(`section-${name}`);

  if (activeSection) {
    activeSection.classList.add("active");
  }

  // activate clicked button
  if (btn) {
    btn.classList.add("active");
  }
};

// ── Load everything in parallel ───────────────
async function loadAll() {
  await Promise.all([
    loadUsers(),
    loadSubscriptions(),
    loadBoosts(),
    loadAds(),
    loadOrders(),
    loadPremiumAds(),
    loadVerifications(),
    loadReports()
  ]);
  renderOverview();
}

// ══════════════════════════════════════════════
//  OVERVIEW
// ══════════════════════════════════════════════
function renderOverview() {
  const paidPlans   = allSubs.filter(s => s.status === "active").length;
  const pendingBoosts = allBoosts.filter(b => b.status === "pending").length;
  const activeAds   = allAds.filter(a => a.status === "active").length;

  document.getElementById("kpi-users").textContent   = allUsers.length;
  document.getElementById("kpi-paid").textContent    = paidPlans;
  document.getElementById("kpi-ads").textContent     = activeAds;
  document.getElementById("kpi-boosts").textContent  = pendingBoosts;
  document.getElementById("kpi-orders").textContent  = allOrders.length;

  const pending = document.getElementById("pending-actions");

  const pendingSubs   = allSubs.filter(s => s.status === "pending_payment");
  const pendingBoostList = allBoosts.filter(b => b.status === "pending");

  if (pendingSubs.length === 0 && pendingBoostList.length === 0) {
    pending.innerHTML = `<p style="color:#16a34a;font-weight:700">✅ No pending actions</p>`;
    return;
  }

  pending.innerHTML = `
    ${pendingSubs.length > 0 ? `
      <div style="background:#fef3c7;border-radius:10px;padding:14px;margin-bottom:10px">
        <p style="font-weight:800;color:#92400e;margin:0 0 4px">⏳ ${pendingSubs.length} subscription(s) awaiting payment confirmation</p>
        <button class="action-btn btn-approve" onclick="showSection('subscriptions',null)">Review →</button>
      </div>` : ""}
    ${pendingBoostList.length > 0 ? `
      <div style="background:#dbeafe;border-radius:10px;padding:14px">
        <p style="font-weight:800;color:#1e40af;margin:0 0 4px">⭐ ${pendingBoostList.length} boost request(s) awaiting approval</p>
        <button class="action-btn btn-approve" onclick="showSection('boosts',null)">Review →</button>
      </div>` : ""}
  `;
}

// ══════════════════════════════════════════════
//  USERS & PLANS
// ══════════════════════════════════════════════
async function loadUsers() {
  try {
    const snap = await getDocs(collection(db, "users"));
    allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderUsers(allUsers);
  } catch (e) { console.error(e); }
}

function renderUsers(users) {
  const tbody = document.getElementById("users-table-body");
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">No users found</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const plan     = u.plan || "free";
    const verified = u.isSellerVerified ? "✅ Yes" : "—";
    const banned   = u.banned ? "banned" : "active";

    return `
      <tr>
        <td><span style="font-weight:700">${u.email || u.id}</span></td>
        <td><span class="plan-chip chip-${plan}">${planEmoji(plan)} ${plan}</span></td>
        <td id="ads-count-${u.id}">—</td>
        <td>${verified}</td>
        <td>
          <span class="plan-chip ${u.banned ? 'chip-expired' : 'chip-approved'}">
            ${banned}
          </span>
        </td>
        <td>
          <select class="plan-select" onchange="changeUserPlan('${u.id}', this.value)">
            <option value="">— Change Plan —</option>
            <option value="free"   ${plan==="free"   ?"selected":""}>🆓 Free</option>
            <option value="bronze" ${plan==="bronze" ?"selected":""}>🥉 Bronze</option>
            <option value="silver" ${plan==="silver" ?"selected":""}>🥈 Silver</option>
            <option value="gold"   ${plan==="gold"   ?"selected":""}>🥇 Gold</option>
          </select>
        </td>
        <td>
          ${u.banned
            ? `<button class="action-btn btn-unban" onclick="toggleBan('${u.id}', false)">Unban</button>`
            : `<button class="action-btn btn-ban"   onclick="toggleBan('${u.id}', true)">Ban</button>`}
        </td>
      </tr>`;
  }).join("");

  // Load ad counts async
  users.forEach(u => loadUserAdCount(u.id));
}

async function loadUserAdCount(userId) {
  try {
    const snap = await getDocs(query(
      collection(db, "products"),
      where("userId", "==", userId),
      where("status", "==", "active")
    ));
    const el = document.getElementById(`ads-count-${userId}`);
    if (el) el.textContent = snap.size;
  } catch (_) {}
}

window.filterUsers = function() {
  const q = document.getElementById("user-search").value.toLowerCase();
  const filtered = allUsers.filter(u => (u.email || "").toLowerCase().includes(q));
  renderUsers(filtered);
};

window.changeUserPlan = async function(userId, newPlan) {
  if (!newPlan) return;
  if (!confirm(`Change this user's plan to ${newPlan.toUpperCase()}?`)) return;

  try {
    const limits  = PLAN_LIMITS[newPlan];
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);

    // Expire old active plan
    const oldSnap = await getDocs(query(
      collection(db, "business_accounts"),
      where("userId", "==", userId),
      where("status", "==", "active")
    ));
    for (const d of oldSnap.docs) {
      await updateDoc(doc(db, "business_accounts", d.id), { status: "admin_changed" });
    }

    // Create new plan if not free
    if (newPlan !== "free") {
      await addDoc(collection(db, "business_accounts"), {
        userId,
        plan:      newPlan,
        billing:   "monthly",
        status:    "active",
        price:     0,
        startDate: new Date(),
        endDate,
        activatedBy: "admin",
        createdAt:   new Date()
      });
    }

    // Update user doc
    await updateDoc(doc(db, "users", userId), {
      plan:             newPlan,
      isSellerVerified: newPlan === "silver" || newPlan === "gold",
      planUpdatedAt:    new Date()
    });

    showToast(`Plan changed to ${newPlan} ✅`, "success");
    loadUsers();
  } catch (e) {
    console.error(e);
    showToast("Failed to change plan", "error");
  }
};

window.toggleBan = async function(userId, ban) {
  if (!confirm(`${ban ? "Ban" : "Unban"} this user?`)) return;
  try {
    await updateDoc(doc(db, "users", userId), { banned: ban });
    showToast(ban ? "User banned" : "User unbanned", ban ? "error" : "success");
    loadUsers();
  } catch (e) {
    showToast("Failed", "error");
  }
};

// ══════════════════════════════════════════════
//  SUBSCRIPTIONS
// ══════════════════════════════════════════════
async function loadSubscriptions() {
  try {
    const snap = await getDocs(collection(db, "business_accounts"));
    allSubs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                       .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
    renderSubs(allSubs);
  } catch (e) { console.error(e); }
}

function renderSubs(subs) {
  const tbody = document.getElementById("subs-table-body");
  if (!tbody) return;

  if (subs.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8">No subscriptions yet</td></tr>`;
    return;
  }

  tbody.innerHTML = subs.map(s => {
    const start   = fmtDate(s.startDate);
    const end     = fmtDate(s.endDate);
    const statusChip = chipClass(s.status);

    return `
      <tr>
        <td style="font-size:12px">${s.email || s.userId}</td>
        <td><span class="plan-chip chip-${s.plan}">${planEmoji(s.plan)} ${s.plan}</span></td>
        <td style="font-size:12px">${s.billing || "monthly"}</td>
        <td style="font-weight:700;color:var(--orange)">UGX ${Number(s.price || 0).toLocaleString()}</td>
        <td style="font-size:12px">${start}</td>
        <td style="font-size:12px">${end}</td>
        <td><span class="plan-chip ${statusChip}">${s.status}</span></td>
        <td>
          ${s.status === "pending_payment" ? `
            <button class="action-btn btn-approve" onclick="activateSub('${s.id}','${s.userId}','${s.plan}')">✅ Activate</button>
            <button class="action-btn btn-reject"  onclick="rejectSub('${s.id}')">✗ Reject</button>` : ""}
          ${s.status === "active" ? `
            <button class="action-btn btn-reject" onclick="expireSub('${s.id}','${s.userId}')">Expire</button>` : ""}
        </td>
      </tr>`;
  }).join("");
}

window.activateSub = async function(subId, userId, plan) {
  try {
    const limits  = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);

    await updateDoc(doc(db, "business_accounts", subId), {
      status:        "active",
      activatedAt:   new Date(),
      activatedBy:   "admin",
      endDate
    });

    await updateDoc(doc(db, "users", userId), {
      plan,
      isSellerVerified: plan === "silver" || plan === "gold",
      planUpdatedAt:    new Date()
    }).catch(() => {});

    showToast("Subscription activated ✅", "success");
    loadSubscriptions();
    renderOverview();
  } catch (e) {
    showToast("Failed to activate", "error");
  }
};

window.rejectSub = async function(subId) {
  if (!confirm("Reject this subscription request?")) return;
  try {
    await updateDoc(doc(db, "business_accounts", subId), { status: "rejected" });
    showToast("Rejected", "info");
    loadSubscriptions();
  } catch (e) { showToast("Failed", "error"); }
};

window.expireSub = async function(subId, userId) {
  if (!confirm("Expire this subscription now?")) return;
  try {
    await updateDoc(doc(db, "business_accounts", subId), {
      status: "expired", expiredAt: new Date()
    });
    await updateDoc(doc(db, "users", userId), {
      plan: "free", planExpiredAt: new Date(), isSellerVerified: false
    }).catch(() => {});
    showToast("Subscription expired", "info");
    loadSubscriptions();
  } catch (e) { showToast("Failed", "error"); }
};

// ══════════════════════════════════════════════
//  BOOST REQUESTS
// ══════════════════════════════════════════════
async function loadBoosts() {
  try {
    const snap = await getDocs(collection(db, "boost_requests"));
    allBoosts = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                         .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
    renderBoosts(allBoosts);
  } catch (e) { console.error(e); }
}

function renderBoosts(boosts) {
  const tbody = document.getElementById("boosts-table-body");
  if (!tbody) return;

  if (boosts.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">No boost requests</td></tr>`;
    return;
  }

  tbody.innerHTML = boosts.map(b => `
    <tr>
      <td>
        <a href="product.html?id=${b.productId}" target="_blank"
          style="color:var(--orange);font-weight:700;font-size:13px">
          ${b.productName || b.productId}
        </a>
      </td>
      <td style="font-size:12px">${b.userEmail}</td>
      <td>${b.days} days</td>
      <td style="font-weight:700;color:var(--orange)">UGX ${Number(b.price||0).toLocaleString()}</td>
      <td style="font-size:12px">${fmtDate(b.createdAt)}</td>
      <td><span class="plan-chip ${chipClass(b.status)}">${b.status}</span></td>
      <td>
        ${b.status === "pending" ? `
          <button class="action-btn btn-approve" onclick="approveBoost('${b.id}','${b.productId}',${b.days})">✅ Approve</button>
          <button class="action-btn btn-reject"  onclick="rejectBoost('${b.id}','${b.productId}')">✗ Reject</button>` : ""}
      </td>
    </tr>`).join("");
}

window.approveBoost = async function(boostId, productId, days) {
  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    // Get boost request to find userId
    const boostSnap = await getDocs(query(
      collection(db, "boost_requests"),
      where("productId", "==", productId)
    ));
    const boostData = boostSnap.empty ? null : boostSnap.docs[0].data();

    await updateDoc(doc(db, "boost_requests", boostId), {
      status:      "approved",
      approvedAt:  new Date(),
      approvedBy:  "admin"
    });

    await updateDoc(doc(db, "products", productId), {
      isPremium:        true,
      premiumExpiresAt: expiresAt
    });

    // ── Notify the seller ─────────────────────
    if (boostData?.userId) {
      await addDoc(collection(db, "notifications"), {
        userId:    boostData.userId,
        type:      "boost",
        title:     "⭐ Your Ad is Now Boosted!",
        message:   `Your ad "${boostData.productName || "Ad"}" is now featured for ${days} days. More buyers will see it!`,
        relatedId: productId,
        read:      false,
        createdAt: new Date()
      });
    }

 // ── Notify the user ───────────────────────
    const planLabels = { bronze:"🥉 Bronze", silver:"🥈 Silver", gold:"🥇 Gold" };
    await addDoc(collection(db, "notifications"), {
      userId,
      type:      "plan",
      title:     `${planLabels[plan] || plan} Plan Activated!`,
      message:   `Your ${plan} business plan is now active. Enjoy your new features!`,
      relatedId: subId,
      read:      false,
      createdAt: new Date()
    });

    showToast("Subscription activated ✅", "success");
    loadSubscriptions();
    renderOverview();
  } catch (e) {
    showToast("Failed to activate", "error");
  }
};

window.rejectBoost = async function(boostId, productId) {
  if (!confirm("Reject this boost request?")) return;
  try {
    await updateDoc(doc(db, "boost_requests", boostId), {
      status:     "rejected",
      rejectedAt: new Date()
    });
    await updateDoc(doc(db, "products", productId), { isPremium: false }).catch(() => {});
    showToast("Boost rejected", "info");
    loadBoosts();
  } catch (e) { showToast("Failed", "error"); }
};

// ══════════════════════════════════════════════
//  ALL ADS
// ══════════════════════════════════════════════
async function loadAds() {
  try {
    const snap = await getDocs(collection(db, "products"));
    allAds = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                      .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
    renderAdsTable(allAds);
  } catch (e) { console.error(e); }
}

function renderAdsTable(ads) {
  const tbody = document.getElementById("ads-table-body");
  if (!tbody) return;

  if (ads.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">No ads</td></tr>`;
    return;
  }

  tbody.innerHTML = ads.map(a => `
    <tr>
      <td>
        <img src="${a.images?.[0] || ''}" alt=""
          style="width:44px;height:44px;object-fit:cover;border-radius:8px;background:#f3f4f6">
      </td>
      <td style="font-weight:700;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.name}</td>
      <td style="color:var(--orange);font-weight:800">UGX ${Number(a.price||0).toLocaleString()}</td>
      <td style="font-size:12px">${a.userEmail || "—"}</td>
      <td><span class="plan-chip ${chipClass(a.status)}">${a.status || "active"}</span></td>
      <td style="font-size:12px">${fmtDate(a.expiresAt)}</td>
      <td>
        <button class="action-btn btn-reject" onclick="adminDeleteAd('${a.id}')">🗑️ Delete</button>
      </td>
    </tr>`).join("");
}

window.filterAds = function() {
  const q = document.getElementById("ads-search").value.toLowerCase();
  const filtered = allAds.filter(a =>
    (a.name || "").toLowerCase().includes(q) ||
    (a.userEmail || "").toLowerCase().includes(q)
  );
  renderAdsTable(filtered);
};

window.adminDeleteAd = async function(adId) {
  if (!confirm("Delete this ad permanently?")) return;
  try {
    await deleteDoc(doc(db, "products", adId));
    showToast("Ad deleted", "info");
    loadAds();
  } catch (e) { showToast("Failed", "error"); }
};

// ══════════════════════════════════════════════
//  ORDERS
// ══════════════════════════════════════════════
async function loadOrders() {
  try {
    const snap = await getDocs(collection(db, "orders"));
    allOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                         .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
    renderOrdersTable(allOrders);
  } catch (e) { console.error(e); }
}

function renderOrdersTable(orders) {
  const tbody = document.getElementById("orders-table-body");
  if (!tbody) return;

  if (orders.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">No orders</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(o => `
    <tr>
      <td style="font-weight:700;font-size:12px;color:var(--orange)">${o.orderId}</td>
      <td style="font-size:12px">${o.customerName || "—"}<br><span style="color:var(--gray)">${o.customerPhone || ""}</span></td>
      <td style="font-weight:800">UGX ${Number(o.total||0).toLocaleString()}</td>
      <td style="font-size:12px">${o.paymentMethod || "—"}</td>
      <td><span class="plan-chip ${chipClass(o.status)}">${o.status}</span></td>
      <td style="font-size:12px">${fmtDate(o.createdAt)}</td>
      <td>
        <select class="plan-select" onchange="updateOrderStatus('${o.id}', this.value)">
          <option value="">— Update —</option>
          <option value="Pending">Pending</option>
          <option value="Processing">Processing</option>
          <option value="Shipped">Shipped</option>
          <option value="Delivered">Delivered</option>
        </select>
      </td>
    </tr>`).join("");
}

window.updateOrderStatus = async function(orderId, status) {
  if (!status) return;
  try {
    await updateDoc(doc(db, "orders", orderId), { status, updatedAt: new Date() });
    showToast(`Order marked as ${status} ✅`, "success");
    loadOrders();
  } catch (e) { showToast("Failed", "error"); }
};

// ── Helpers ───────────────────────────────────
function planEmoji(plan) {
  return { free:"🆓", bronze:"🥉", silver:"🥈", gold:"🥇" }[plan] || "🆓";
}

function chipClass(status) {
  const map = {
    active: "chip-approved", approved: "chip-approved",
    pending: "chip-pending", pending_payment: "chip-pending",
    expired: "chip-expired", rejected: "chip-rejected",
    sold: "chip-expired", free: "chip-free",
    bronze: "chip-bronze", silver: "chip-silver", gold: "chip-gold"
  };
  return map[status] || "chip-free";
}

function fmtDate(ts) {
  const d = ts?.toDate?.() || (ts ? new Date(ts) : null);
  if (!d || isNaN(d)) return "—";
  return d.toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" });
}

function showToast(msg, type = "info") {
  const c = document.getElementById("toast-container");
  if (!c) return;
  const t = document.createElement("div");
  t.className   = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}



// ══════════════════════════════════════════════
//  PREMIUM ADS
// ══════════════════════════════════════════════
async function loadPremiumAds() {
  try {
    const snap = await getDocs(collection(db, "premium_ads"));
    allPremiumAds = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                            .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
    renderPremiumAds(allPremiumAds);

    const active  = allPremiumAds.filter(p => p.status === "active" && new Date(p.expiresAt?.toDate?.()) > new Date());
    const revenue = allPremiumAds.reduce((s, p) => s + (p.price || 0), 0);
    const avgClicks = active.length > 0
      ? Math.round(active.reduce((s, p) => s + (p.clicks || 0), 0) / active.length)
      : 0;

    const ke = document.getElementById("kpi-active-boosts");
    const kr = document.getElementById("kpi-boost-revenue");
    const kc = document.getElementById("kpi-avg-clicks");
    if (ke) ke.textContent = active.length;
    if (kr) kr.textContent = "UGX " + revenue.toLocaleString();
    if (kc) kc.textContent = avgClicks;
  } catch (e) { console.error(e); }
}

function renderPremiumAds(ads) {
  const tbody = document.getElementById("premium-table-body");
  if (!tbody) return;
  if (ads.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8">No premium ads</td></tr>`;
    return;
  }
  tbody.innerHTML = ads.map(a => {
    const isActive = a.status === "active" && new Date(a.expiresAt?.toDate?.()) > new Date();
    return `
      <tr>
        <td><a href="product.html?id=${a.productId}" target="_blank" style="color:var(--orange);font-weight:700">${a.productId?.slice(0,10)}…</a></td>
        <td style="font-size:12px">${a.userEmail || a.userId?.slice(0,8)}</td>
        <td>${a.days} days</td>
        <td style="font-weight:800;color:var(--orange)">UGX ${Number(a.price||0).toLocaleString()}</td>
        <td>${a.clicks || 0}</td>
        <td style="font-size:12px">${fmtDate(a.expiresAt)}</td>
        <td><span class="plan-chip ${isActive ? 'chip-approved' : 'chip-expired'}">${isActive ? 'active' : a.status}</span></td>
        <td>
          ${isActive ? `<button class="action-btn btn-reject" onclick="removePremiumAd('${a.id}','${a.productId}')">Remove</button>` : ""}
        </td>
      </tr>`;
  }).join("");
}

window.removePremiumAd = async function(premiumId, productId) {
  if (!confirm("Remove this premium boost?")) return;
  try {
    await updateDoc(doc(db, "premium_ads", premiumId), { status: "removed" });
    await updateDoc(doc(db, "products", productId), { isPremium: false }).catch(() => {});
    showToast("Boost removed", "info");
    loadPremiumAds();
  } catch (e) { showToast("Failed", "error"); }
};

// ══════════════════════════════════════════════
//  VERIFICATIONS
// ══════════════════════════════════════════════
async function loadVerifications() {
  try {
    const snap = await getDocs(collection(db, "seller_verifications"));
    allVerifs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                        .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
    renderVerifs(allVerifs);
  } catch (e) { console.error(e); }
}

function renderVerifs(verifs) {
  const tbody = document.getElementById("verif-table-body");
  if (!tbody) return;
  if (verifs.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">No verification requests</td></tr>`;
    return;
  }
  tbody.innerHTML = verifs.map(v => `
    <tr>
      <td style="font-weight:700">${v.fullName || "—"}</td>
      <td>${v.businessName || "—"}</td>
      <td style="font-size:12px">${v.email || "—"}</td>
      <td style="font-size:12px">${v.phone || "—"}</td>
      <td style="font-size:12px">${v.location || "—"}</td>
      <td><span class="plan-chip ${chipClass(v.status)}">${v.status}</span></td>
      <td style="display:flex;gap:6px;flex-wrap:wrap">
        ${v.status === "pending" ? `
          <button class="action-btn btn-approve" onclick="approveVerif('${v.id}','${v.userId}')">✅ Approve</button>
          <button class="action-btn btn-reject"  onclick="rejectVerif('${v.id}')">✗ Reject</button>
          ${v.phone ? `<button class="action-btn" style="background:#dcfce7;color:#166534" onclick="window.open('https://wa.me/${v.phone}?text=${encodeURIComponent("Hi "+v.fullName+", your ZiBuy seller verification is under review.")}','_blank')">💬 WA</button>` : ""}
        ` : ""}
      </td>
    </tr>`).join("");
}

window.filterVerifs = function(status) {
  const filtered = status === "all" ? allVerifs : allVerifs.filter(v => v.status === status);
  renderVerifs(filtered);
};

window.approveVerif = async function(verifId, userId) {
  if (!confirm("Approve this seller?")) return;
  try {
    await updateDoc(doc(db, "seller_verifications", verifId), { status: "approved", approvedAt: new Date() });
    if (userId) {
      await updateDoc(doc(db, "users", userId), { isSellerVerified: true, sellerVerificationStatus: "approved" }).catch(() => {});
    }
    showToast("Seller approved ✅", "success");
    loadVerifications();
  } catch (e) { showToast("Failed", "error"); }
};

window.rejectVerif = async function(verifId) {
  const reason = prompt("Rejection reason (optional):");
  try {
    await updateDoc(doc(db, "seller_verifications", verifId), {
      status: "rejected",
      rejectionReason: reason || "Not provided"
    });
    showToast("Rejected", "info");
    loadVerifications();
  } catch (e) { showToast("Failed", "error"); }
};

// ══════════════════════════════════════════════
//  REPORTS
// ══════════════════════════════════════════════
async function loadReports() {
  try {
    const snap = await getDocs(collection(db, "reports"));
    allReports = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                         .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
    renderReports(allReports);
  } catch (e) { console.error(e); }
}

function renderReports(reports) {
  const tbody = document.getElementById("reports-table-body");
  if (!tbody) return;
  if (reports.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No reports</td></tr>`;
    return;
  }
  tbody.innerHTML = reports.map(r => `
    <tr>
      <td style="font-weight:700;color:#ef4444">${r.reason || "—"}</td>
      <td><a href="product.html?id=${r.productId}" target="_blank" style="color:var(--orange);font-weight:700;font-size:12px">${r.productId?.slice(0,10) || "—"}</a></td>
      <td style="font-size:12px">${r.reportedBy || r.reporterEmail || "—"}</td>
      <td style="font-size:12px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.description || "—"}</td>
      <td><span class="plan-chip ${r.status === 'resolved' ? 'chip-approved' : 'chip-pending'}">${r.status || "open"}</span></td>
      <td style="display:flex;gap:6px">
        ${r.status !== "resolved" ? `<button class="action-btn btn-approve" onclick="resolveReport('${r.id}')">✅ Resolve</button>` : ""}
        <button class="action-btn btn-reject" onclick="deleteReportedAd('${r.productId}','${r.id}')">🗑️ Delete Ad</button>
      </td>
    </tr>`).join("");
}

window.resolveReport = async function(reportId) {
  try {
    await updateDoc(doc(db, "reports", reportId), { status: "resolved", resolvedAt: new Date() });
    showToast("Report resolved ✅", "success");
    loadReports();
  } catch (e) { showToast("Failed", "error"); }
};

window.deleteReportedAd = async function(productId, reportId) {
  if (!confirm("Delete this product permanently?")) return;
  try {
    await deleteDoc(doc(db, "products", productId));
    await updateDoc(doc(db, "reports", reportId), { status: "resolved", resolvedAt: new Date() }).catch(() => {});
    showToast("Product deleted & report resolved", "info");
    loadReports();
    loadAds();
  } catch (e) { showToast("Failed", "error"); }
};


// ══════════════════════════════════════════════
//  BROADCAST NOTIFICATIONS
// ══════════════════════════════════════════════
window.sendBroadcast = async function() {
  const title   = document.getElementById("bc-title").value.trim();
  const message = document.getElementById("bc-message").value.trim();
  const url     = document.getElementById("bc-url").value.trim() || "/";

  if (!title || !message) { showToast("Fill title and message", "error"); return; }
  if (!confirm(`Send "${title}" to ALL users?`)) return;

  try {
    // Save to broadcasts — all users' pages listen to this
    await addDoc(collection(db, "broadcasts"), {
      title,
      message,
      url,
      active:    true,
      sentBy:    ADMIN_EMAIL,
      createdAt: new Date()
    });

    // Also save to all users' notifications
    const usersSnap = await getDocs(collection(db, "users"));
    const batch = [];
    usersSnap.forEach(d => {
      batch.push(addDoc(collection(db, "notifications"), {
        userId:    d.id,
        type:      "offer",
        title,
        message,
        relatedId: url,
        read:      false,
        createdAt: new Date()
      }));
    });
    await Promise.all(batch);

    document.getElementById("bc-title").value   = "";
    document.getElementById("bc-message").value = "";
    document.getElementById("bc-url").value     = "";

    showToast(`✅ Sent to ${usersSnap.size} users!`, "success");
    loadBroadcasts();
  } catch (e) {
    console.error(e);
    showToast("Failed to send", "error");
  }
};

window.sendToUser = async function() {
  const userId  = document.getElementById("notif-userid").value.trim();
  const title   = document.getElementById("notif-title").value.trim();
  const message = document.getElementById("notif-message").value.trim();

  if (!userId || !title || !message) { showToast("Fill all fields", "error"); return; }

  try {
    await addDoc(collection(db, "notifications"), {
      userId,
      type:      "admin",
      title,
      message,
      relatedId: null,
      read:      false,
      createdAt: new Date()
    });

    document.getElementById("notif-userid").value  = "";
    document.getElementById("notif-title").value   = "";
    document.getElementById("notif-message").value = "";

    showToast("✅ Notification sent!", "success");
  } catch (e) {
    showToast("Failed", "error");
  }
};

async function loadBroadcasts() {
  try {
    const snap = await getDocs(collection(db, "broadcasts"));
    const list = document.getElementById("broadcasts-list");
    if (!list) return;

    const items = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0))
      .slice(0, 10);

    if (items.length === 0) {
      list.innerHTML = "<p style='color:var(--gray);font-size:13px'>No broadcasts yet</p>";
      return;
    }

    list.innerHTML = items.map(b => `
      <div style="padding:12px;border-bottom:1px solid #f0f0f0">
        <p style="font-weight:800;font-size:14px;margin:0 0 4px">🔥 ${b.title}</p>
        <p style="font-size:13px;color:var(--gray);margin:0 0 4px">${b.message}</p>
        <p style="font-size:11px;color:#adb5bd;margin:0">${fmtDate(b.createdAt)}</p>
      </div>
    `).join("");
  } catch (e) { console.warn(e); }
}