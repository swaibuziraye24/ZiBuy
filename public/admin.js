// ============================================
//   ZiBuy — Admin Panel
// ============================================

import {
  db, auth, collection, getDocs, doc,
  getDoc, query, where, updateDoc, deleteDoc, orderBy, limit, addDoc
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
    loadReports(),
    loadBanners(),
    loadReminders(),
    loadJobAdsAdmin()
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

  tbody.innerHTML = boosts.map(b => {
    const isPending  = b.status === "pending" || b.status === "pending_verification";
    const isApproved = b.status === "approved";
    const isExpired  = b.status === "expired" || b.status === "rejected";

    // Calculate expiry date for approved boosts
    let expiryDisplay = "—";
    let expiryWarning = false;
    if (isApproved && b.approvedAt) {
      const approvedDate = b.approvedAt?.toDate?.() || new Date(b.approvedAt);
      const expiryDate   = new Date(approvedDate);
      expiryDate.setDate(expiryDate.getDate() + (b.days || 0));
      const daysLeft = Math.ceil((expiryDate - new Date()) / 86400000);
      expiryWarning  = daysLeft <= 2 && daysLeft > 0;
      const expired  = daysLeft <= 0;
      expiryDisplay  = expired
        ? `<span style="color:#ef4444;font-weight:800">Expired</span>`
        : `${fmtDate(expiryDate)}<br><span style="font-size:11px;color:${expiryWarning ? "#f59e0b" : "#10b981"};font-weight:700">${daysLeft} day${daysLeft !== 1 ? "s" : ""} left</span>`;
    }

    const rowBg = isPending
      ? "background:#fffbeb;border-left:4px solid #ff6600"
      : isExpired ? "background:#fafafa;opacity:.7" : "";

    return `
    <tr style="${rowBg}">
      <td>
        <a href="product.html?id=${b.productId}" target="_blank"
          style="color:var(--orange);font-weight:800;font-size:13px">
          ${b.productName || b.productId?.slice(0,14) || "—"}
        </a>
        <br>
        <span style="font-size:11px;color:#6b7280">${b.productId?.slice(0,12)}</span>
      </td>
      <td>
        <span style="font-weight:700;font-size:13px">${b.userEmail || "—"}</span>
      </td>
      <td style="font-weight:800;text-align:center">${b.days || "—"} days</td>
      <td style="font-weight:800;color:var(--orange)">UGX ${Number(b.price||0).toLocaleString()}</td>
      <td>
        <span style="font-size:12px;font-weight:700;color:#ff6600;background:#fff4ee;padding:4px 8px;border-radius:6px;letter-spacing:.5px;display:inline-block">
          ${b.paymentRef || "—"}
        </span>
        ${b.transactionRef ? `<br><span style="font-size:11px;color:#6b7280">Txn: ${b.transactionRef}</span>` : ""}
      </td>
      <td style="font-size:12px">${fmtDate(b.requestedAt || b.createdAt)}</td>
      <td style="font-size:12px">${isApproved ? fmtDate(b.approvedAt) : "—"}</td>
      <td style="font-size:12px">${expiryDisplay}</td>
      <td>
        <span class="plan-chip ${isPending ? "chip-pending" : chipClass(b.status)}"
          style="${expiryWarning ? "background:#fef3c7;color:#92400e" : ""}">
          ${isPending ? "⏳ Pending" : isApproved ? "✅ Active" : isExpired ? "❌ " + b.status : b.status}
        </span>
      </td>
      <td>
        ${isPending ? `
          <div style="display:flex;flex-direction:column;gap:6px">
            <button class="action-btn btn-approve"
              onclick="approveBoost('${b.id}','${b.productId}',${b.days})"
              style="font-size:12px;padding:7px 12px">✅ Approve</button>
            <button class="action-btn btn-reject"
              onclick="rejectBoost('${b.id}','${b.productId}')"
              style="font-size:12px;padding:7px 12px">✗ Reject</button>
            ${b.userEmail ? `
            <a href="https://wa.me/?text=${encodeURIComponent("Hi, your ZiBuy boost request has been received.")}"
              style="background:#25d366;color:white;border:none;padding:7px 10px;border-radius:8px;font-size:11px;font-weight:700;text-align:center;text-decoration:none;display:block">
              💬 WhatsApp</a>` : ""}
          </div>` :
        isApproved ? `
          <button class="action-btn btn-reject"
            onclick="revokeBoost('${b.id}','${b.productId}')"
            style="font-size:12px;padding:7px 12px">🗑️ Revoke</button>` : "—"}
      </td>
    </tr>`;
  }).join("");
}

window.approveBoost = async function(boostId, productId, days) {
  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    // ── Step 1: read boost doc using its ID (no query needed) ──
    const boostDoc  = await getDoc(doc(db, "boost_requests", boostId));
    const boostData = boostDoc.exists() ? boostDoc.data() : {};

    // ── Step 2: approve the boost request ─────
    await updateDoc(doc(db, "boost_requests", boostId), {
      status:     "approved",
      approvedAt: new Date(),
      approvedBy: "admin",
      expiresAt               // saves expiry on the boost_request doc too
    });

    await updateDoc(doc(db, "products", productId), {
      isPremium:        true,
      premiumExpiresAt: expiresAt,
      boostApprovedAt:  new Date(),
      boostExpiresAt:   expiresAt
    });

    // ── Step 4: notify the seller ─────────────
    if (boostData.userId) {
      await addDoc(collection(db, "notifications"), {
        userId:    boostData.userId,
        type:      "boost",
        title:     "⭐ Your Ad is Now Boosted!",
        message:   `Your ad "${boostData.productName || "Ad"}" is now featured for ${days} days!`,
        relatedId: productId,
        read:      false,
        createdAt: new Date()
      });
    }

    showToast("Boost activated ✅", "success");
    loadBoosts();
    renderOverview();
  } catch (e) {
    console.error("approveBoost error:", e.code, e.message);
    showToast("Failed: " + (e.code || e.message), "error");
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

window.revokeBoost = async function(boostId, productId) {
  if (!confirm("Revoke this active boost? The seller will lose remaining boost days.")) return;
  try {
    await updateDoc(doc(db, "boost_requests", boostId), {
      status:   "revoked",
      revokedAt: new Date()
    });
    await updateDoc(doc(db, "products", productId), {
      isPremium: false
    }).catch(() => {});
    showToast("Boost revoked", "info");
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
      <td style="font-weight:800;color:#ef4444">${r.reason || "—"}</td>
      <td>
        <span style="font-weight:700;font-size:13px;color:#111827">${r.sellerName || r.productId || "—"}</span>
        ${r.productRef && r.productRef !== "—"
          ? `<br><span style="font-size:11px;color:#6b7280">${r.productRef.slice(0,30)}</span>`
          : ""}
      </td>
      <td style="font-size:12px">${r.reporterEmail || r.reportedBy || "—"}</td>
      <td style="font-size:12px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.description || "—"}</td>
      <td><span class="plan-chip ${r.status === 'resolved' ? 'chip-approved' : 'chip-pending'}">${r.status || "open"}</span></td>
      <td style="display:flex;gap:6px;flex-wrap:wrap">
        ${r.status !== "resolved"
          ? `<button class="action-btn btn-approve" onclick="resolveReport('${r.id}')">✅ Resolve</button>`
          : ""}
        ${r.sellerName
          ? `<a href="https://wa.me/?text=${encodeURIComponent("Hello, your account on ZiBuy has been reported for: " + r.reason)}"
              style="background:#25d366;color:white;padding:6px 10px;border-radius:7px;font-size:12px;font-weight:700;text-decoration:none">
              💬 Contact</a>`
          : ""}
        <button class="action-btn btn-reject" onclick="deleteReportedAd('${r.productId || "x"}','${r.id}')">🗑️ Delete</button>
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
    // 1. Save to broadcasts — shows banner on all pages
    await addDoc(collection(db, "broadcasts"), {
      title, message, url,
      active:    true,
      sentBy:    ADMIN_EMAIL,
      createdAt: new Date()
    });

    // 2. Save to all users' in-app notifications
    const usersSnap = await getDocs(collection(db, "users"));
    const users     = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const batch = users.map(u =>
      addDoc(collection(db, "notifications"), {
        userId:    u.id,
        type:      "broadcast",
        title,
        message,
        relatedId: url,
        read:      false,
        createdAt: new Date()
      })
    );
    await Promise.all(batch);

    // 3. Build WhatsApp broadcast link (opens with pre-filled message)
    // Admin clicks this to send to users who have shared their phone
    const usersWithPhone = users.filter(u => u.phone);
    if (usersWithPhone.length > 0) {
      const waMsg = encodeURIComponent(
        `📢 *ZiBuy Update*\n\n` +
        `*${title}*\n\n${message}\n\n` +
        `🔗 ${url !== "/" ? `https://zibuy-5deae.web.app${url}` : "https://zibuy-5deae.web.app"}`
      );
      // Opens WhatsApp with first user — admin can forward to others
      window.open(`https://wa.me/?text=${waMsg}`, "_blank");
    }

    // 4. Save email broadcast job to Firestore
    // Cloud Function picks this up and sends emails
    await addDoc(collection(db, "email_broadcasts"), {
      title,
      message,
      url,
      recipientCount: users.length,
      sentBy:         ADMIN_EMAIL,
      status:         "pending",
      createdAt:      new Date()
    });

    document.getElementById("bc-title").value   = "";
    document.getElementById("bc-message").value = "";
    document.getElementById("bc-url").value     = "";

    showToast(`✅ Sent in-app to ${users.length} users! WhatsApp opened for sharing.`, "success");
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


// ══════════════════════════════════════════════
//  BANNER ADS
// ══════════════════════════════════════════════
async function loadBanners() {
  try {
    const snap = await getDocs(collection(db, "banner_ads"));
    const list = document.getElementById("banners-list");
    if (!list) return;

    if (snap.empty) {
      list.innerHTML = "<p style='color:#6b7280;font-size:13px'>No banners yet</p>";
      return;
    }

    list.innerHTML = snap.docs.map(d => {
      const b = { id: d.id, ...d.data() };
      return `
        <div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
            <div>
              <p style="font-weight:800;margin:0 0 4px">${b.title}</p>
              <p style="font-size:12px;color:#6b7280;margin:0 0 4px">👁️ ${b.impressions || 0} impressions · 🖱️ ${b.clicks || 0} clicks</p>
              <p style="font-size:12px;color:#ff6600;font-weight:700;margin:0">UGX ${Number(b.price || 0).toLocaleString()}/mo</p>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button onclick="toggleBanner('${b.id}', ${!b.active})"
                style="background:${b.active ? '#dcfce7' : '#fee2e2'};color:${b.active ? '#16a34a' : '#ef4444'};border:none;padding:7px 12px;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer">
                ${b.active ? '✅ Active' : '❌ Paused'}
              </button>
              <button onclick="deleteBanner('${b.id}')"
                style="background:#fee2e2;color:#ef4444;border:none;padding:7px 12px;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer">
                🗑️ Delete
              </button>
            </div>
          </div>
          ${b.imageUrl ? `<img src="${b.imageUrl}" style="width:100%;height:80px;object-fit:cover;border-radius:8px;margin-top:10px">` : ""}
        </div>`;
    }).join("");
  } catch (e) { console.error(e); }
}

// ── Banner image file (held in memory until save) ──
let _bannerImageFile = null;

window.handleBannerImagePick = function(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showToast("Please select an image file", "error");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast("Image too large — max 5MB", "error");
    return;
  }

  _bannerImageFile = file;

  // Show preview
  const reader = new FileReader();
  reader.onload = (e) => {
    const prev = document.getElementById("bn-image-preview");
    if (prev) {
      prev.innerHTML = `
        <img src="${e.target.result}"
          style="width:100%;height:100px;object-fit:cover;border-radius:10px;margin-top:8px;border:1.5px solid #e5e7eb">
        <p style="font-size:11px;color:#10b981;font-weight:700;margin-top:4px">✅ ${file.name}</p>
      `;
    }
  };
  reader.readAsDataURL(file);
};

window.addBanner = async function() {
  const title = document.getElementById("bn-title").value.trim();
  const url   = document.getElementById("bn-url").value.trim();
  const price = Number(document.getElementById("bn-price").value || 0);

  if (!title) { showToast("Enter a banner title", "error"); return; }
  if (!_bannerImageFile) { showToast("Please select a banner image", "error"); return; }
  if (!url) { showToast("Enter a destination URL", "error"); return; }

  const btn = document.getElementById("bn-save-btn");
  if (btn) { btn.textContent = "Uploading..."; btn.disabled = true; }

  try {
    // Import storage
    const { getStorage, ref, uploadBytes, getDownloadURL }
      = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js");
    const storage = getStorage();

    // Upload image to Firebase Storage
    const storageRef = ref(storage, `banner-ads/${Date.now()}-${_bannerImageFile.name}`);
    await uploadBytes(storageRef, _bannerImageFile, { contentType: _bannerImageFile.type });
    const imageUrl = await getDownloadURL(storageRef);

    // Save to Firestore
    await addDoc(collection(db, "banner_ads"), {
      title, imageUrl, url, price,
      active:      true,
      impressions: 0,
      clicks:      0,
      createdAt:   new Date()
    });

    // Reset form
    document.getElementById("bn-title").value = "";
    document.getElementById("bn-url").value   = "";
    document.getElementById("bn-price").value = "";
    document.getElementById("bn-file-input").value = "";
    const prev = document.getElementById("bn-image-preview");
    if (prev) prev.innerHTML = "";
    _bannerImageFile = null;

    showToast("Banner published ✅", "success");
    loadBanners();

  } catch (e) {
    console.error(e);
    showToast("Failed: " + e.message, "error");
  } finally {
    if (btn) { btn.textContent = "Publish Banner"; btn.disabled = false; }
  }
};

window.toggleBanner = async function(bannerId, active) {
  try {
    await updateDoc(doc(db, "banner_ads", bannerId), { active });
    showToast(active ? "Banner activated" : "Banner paused", "info");
    loadBanners();
  } catch (e) { showToast("Failed", "error"); }
};

window.deleteBanner = async function(bannerId) {
  if (!confirm("Delete this banner?")) return;
  try {
    await deleteDoc(doc(db, "banner_ads", bannerId));
    showToast("Banner deleted", "info");
    loadBanners();
  } catch (e) { showToast("Failed", "error"); }
};


// ══════════════════════════════════════════════
//  WHATSAPP REMINDERS
// ══════════════════════════════════════════════

let allReminders    = [];
let currentRemFilter = "all";

window.loadReminders = async function() {
  const list = document.getElementById("reminders-list");
  if (!list) return;
  list.innerHTML = `<p style="text-align:center;color:#6b7280;padding:40px">Loading...</p>`;

  try {
    const snap = await getDocs(collection(db, "whatsapp_reminders"));
    allReminders = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));

    renderReminders(allReminders);
  } catch(e) {
    list.innerHTML = `<p style="color:red;text-align:center;padding:40px">
      Failed to load: ${e.message}</p>`;
  }
};

window.filterReminders = function(filter) {
  currentRemFilter = filter;
  let filtered = allReminders;

  if (filter === "plan_expiry")  filtered = allReminders.filter(r => r.type === "plan_expiry");
  if (filter === "boost_expiry") filtered = allReminders.filter(r => r.type === "boost_expiry");
  if (filter === "unsent")       filtered = allReminders.filter(r => !r.sent);

  renderReminders(filtered);
};

function renderReminders(reminders) {
  const list = document.getElementById("reminders-list");
  if (!list) return;

  if (reminders.length === 0) {
    list.innerHTML = `<p style="color:#6b7280;text-align:center;padding:40px">
      No reminders found</p>`;
    return;
  }

  list.innerHTML = reminders.map(r => `
    <div style="background:white;border-radius:12px;padding:16px;
      margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);
      border-left:4px solid ${r.sent ? "#10b981" : r.type === "plan_expiry" ? "#f59e0b" : "#3b82f6"}">

      <div style="display:flex;justify-content:space-between;
        align-items:flex-start;gap:12px;flex-wrap:wrap">
        <div>
          <div style="display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap">
            <span style="background:${r.type === "plan_expiry" ? "#fef3c7" : "#dbeafe"};
              color:${r.type === "plan_expiry" ? "#92400e" : "#1e40af"};
              padding:2px 8px;border-radius:20px;font-size:11px;font-weight:800">
              ${r.type === "plan_expiry" ? "📅 Plan Expiry" : "⭐ Boost Expiry"}
            </span>
            <span style="background:${r.sent ? "#dcfce7" : "#fee2e2"};
              color:${r.sent ? "#166534" : "#991b1b"};
              padding:2px 8px;border-radius:20px;font-size:11px;font-weight:800">
              ${r.sent ? "✅ Sent" : "⏳ Unsent"}
            </span>
            <span style="background:#f3f4f6;color:#374151;
              padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700">
              ${r.daysLeft} day${r.daysLeft !== 1 ? "s" : ""} left
            </span>
          </div>

          <p style="margin:0 0 3px;font-weight:800;font-size:14px;color:#111827">
            ${r.email || r.userId?.slice(0,16) || "Unknown user"}
          </p>
          <p style="margin:0;font-size:12px;color:#6b7280">
            📱 ${r.phone || "No phone"} ·
            ${r.plan ? "Plan: " + r.plan.toUpperCase() : ""}
            ${r.productName ? "Ad: " + r.productName : ""}
          </p>
          <p style="margin:4px 0 0;font-size:11px;color:#9ca3af">
            ${fmtDate(r.createdAt)}
          </p>
        </div>

        <div style="display:flex;flex-direction:column;gap:6px">
          ${!r.sent ? `
            <a href="${r.adminLink || r.waLink || "#"}" target="_blank"
              onclick="markReminderSent('${r.id}')"
              style="background:#25d366;color:white;padding:8px 14px;border-radius:8px;
              font-size:12px;font-weight:800;text-decoration:none;text-align:center;
              white-space:nowrap">
              💬 Send WhatsApp
            </a>` : `
            <span style="background:#f3f4f6;color:#9ca3af;padding:8px 14px;
              border-radius:8px;font-size:12px;font-weight:700;text-align:center">
              ✅ Already Sent
            </span>`}
          <button onclick="deleteReminder('${r.id}')"
            style="background:#fee2e2;color:#ef4444;border:none;padding:6px 14px;
            border-radius:8px;font-size:11px;font-weight:700;cursor:pointer">
            🗑️ Remove
          </button>
        </div>
      </div>
    </div>`).join("");
}


window.markReminderSent = async function(reminderId) {
  try {
    await updateDoc(doc(db, "whatsapp_reminders", reminderId), {
      sent:   true,
      sentAt: new Date()
    });
    showToast("Marked as sent ✅", "success");
    loadReminders();
  } catch(e) { showToast("Failed", "error"); }
};

window.deleteReminder = async function(reminderId) {
  if (!confirm("Remove this reminder?")) return;
  try {
    await deleteDoc(doc(db, "whatsapp_reminders", reminderId));
    showToast("Removed", "info");
    loadReminders();
  } catch(e) { showToast("Failed", "error"); }
};

// ══════════════════════════════════════════════
//  JOB ADS ADMIN
// ══════════════════════════════════════════════

window.loadJobAdsAdmin = async function() {
  const tbody = document.getElementById("job-ads-table-body");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;
    padding:30px;color:#6b7280">Loading...</td></tr>`;

  try {
    const snap = await getDocs(collection(db, "job_ads"));
    const jobs  = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));

    if (jobs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;
        padding:30px;color:#6b7280">No job ads yet</td></tr>`;
      return;
    }

    tbody.innerHTML = jobs.map(j => `
      <tr style="border-bottom:1px solid #f0f0f0">
        <td style="padding:12px">
          <p style="margin:0;font-weight:800;font-size:13px">${j.title}</p>
          <p style="margin:2px 0 0;font-size:11px;color:#6b7280">
            📍 ${j.location} · ${j.type || "Full Time"}
          </p>
        </td>
        <td style="padding:12px;font-size:13px;font-weight:700">${j.company}</td>
        <td style="padding:12px">
          <span style="background:${j.isTop ? "#fff4ee" : "#f3f4f6"};
            color:${j.isTop ? "#ff6600" : "#374151"};padding:3px 8px;
            border-radius:20px;font-size:11px;font-weight:800">
            ${j.isTop ? "⭐ Top" : "📋 Standard"}
          </span>
        </td>
        <td style="padding:12px">
          <p style="margin:0;font-size:12px;color:#ff6600;font-weight:800">
            UGX ${Number(j.price||0).toLocaleString()}
          </p>
          <p style="margin:2px 0 0;font-size:11px;color:#6b7280">
            Ref: ${j.txnRef || "—"}
          </p>
        </td>
        <td style="padding:12px">
          <span class="plan-chip ${j.status === "active" ? "chip-approved" :
            j.status === "pending" ? "chip-pending" : "chip-expired"}">
            ${j.status}
          </span>
        </td>
        <td style="padding:12px">
          <div style="display:flex;flex-direction:column;gap:6px">
            ${j.status === "pending" ? `
              <button class="action-btn btn-approve"
                onclick="approveJobAd('${j.id}','${j.userId}')"
                style="font-size:12px;padding:6px 10px">✅ Approve</button>
              <button class="action-btn btn-reject"
                onclick="rejectJobAd('${j.id}')"
                style="font-size:12px;padding:6px 10px">✗ Reject</button>` : ""}
            ${j.status === "active" ? `
              <button class="action-btn btn-reject"
                onclick="expireJobAd('${j.id}')"
                style="font-size:12px;padding:6px 10px">⏹ Expire</button>` : ""}
            ${j.phone ? `
              <a href="https://wa.me/${j.phone.replace(/\D/g,"")}"
                target="_blank"
                style="background:#25d366;color:white;padding:6px 10px;border-radius:7px;
                font-size:11px;font-weight:700;text-decoration:none;text-align:center">
                💬 Contact
              </a>` : ""}
          </div>
        </td>
      </tr>`).join("");

  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:red;text-align:center;
      padding:30px">Error: ${e.message}</td></tr>`;
  }
};

window.approveJobAd = async function(jobId, userId) {
  if (!confirm("Approve and publish this job ad?")) return;
  try {
    await updateDoc(doc(db, "job_ads", jobId), {
      status:     "active",
      approvedAt: new Date(),
      approvedBy: "admin"
    });

    // Notify the employer
    if (userId) {
      await addDoc(collection(db, "notifications"), {
        userId,
        type:      "job_approved",
        title:     "✅ Your Job Ad is Now Live!",
        message:   "Your hiring ad has been approved and is now visible to job seekers on ZiBuy.",
        relatedId: jobId,
        read:      false,
        createdAt: new Date()
      });
    }

    showToast("Job ad approved ✅", "success");
    loadJobAdsAdmin();
  } catch(e) { showToast("Failed: " + e.message, "error"); }
};

window.rejectJobAd = async function(jobId) {
  const reason = prompt("Reason for rejection (sent to employer):");
  if (reason === null) return;
  try {
    await updateDoc(doc(db, "job_ads", jobId), {
      status:          "rejected",
      rejectionReason: reason || "Does not meet our guidelines",
      rejectedAt:      new Date()
    });
    showToast("Job ad rejected", "info");
    loadJobAdsAdmin();
  } catch(e) { showToast("Failed", "error"); }
};

window.expireJobAd = async function(jobId) {
  if (!confirm("Expire this job ad now?")) return;
  try {
    await updateDoc(doc(db, "job_ads", jobId), {
      status:    "expired",
      expiredAt: new Date()
    });
    showToast("Job ad expired", "info");
    loadJobAdsAdmin();
  } catch(e) { showToast("Failed", "error"); }
};

// ══════════════════════════════════════════════
//  CATEGORY SPONSORS
// ══════════════════════════════════════════════

window.addCategorySponsor = async function() {
  const category    = document.getElementById("cs-category").value;
  const sponsorName = document.getElementById("cs-name").value.trim();
  const sponsorUrl  = document.getElementById("cs-url").value.trim();
  const price       = Number(document.getElementById("cs-price").value || 0);
  const txnRef      = document.getElementById("cs-txn").value.trim();

  if (!category || !sponsorName || !txnRef) {
    showToast("Fill category, sponsor name and transaction ID", "error");
    return;
  }

  try {
    // Deactivate any existing sponsor for this category
    const existing = await getDocs(query(
      collection(db, "category_sponsors"),
      where("category", "==", category),
      where("active",   "==", true)
    ));
    for (const d of existing.docs) {
      await updateDoc(doc(db, "category_sponsors", d.id), { active: false });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Ensure URL has protocol before saving
    let cleanUrl = sponsorUrl;
    if (cleanUrl && !cleanUrl.startsWith("http")) {
      cleanUrl = "https://" + cleanUrl;
    }

    await addDoc(collection(db, "category_sponsors"), {
      category,
      sponsorName,
      sponsorUrl: cleanUrl,
      price,
      txnRef,
      active:    true,
      expiresAt,
      createdAt: new Date()
    });

    document.getElementById("cs-category").value = "";
    document.getElementById("cs-name").value     = "";
    document.getElementById("cs-url").value      = "";
    document.getElementById("cs-price").value    = "";
    document.getElementById("cs-txn").value      = "";

    showToast(`✅ ${sponsorName} now sponsors ${category}!`, "success");
    loadCategorySponsorsAdmin();
  } catch(e) {
    showToast("Failed: " + e.message, "error");
  }
};

window.loadCategorySponsorsAdmin = async function() {
  const list = document.getElementById("sponsors-list");
  if (!list) return;

  try {
    const snap = await getDocs(collection(db, "category_sponsors"));
    const items = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));

    if (items.length === 0) {
      list.innerHTML = "<p style='color:#6b7280;font-size:13px'>No sponsors yet</p>";
      return;
    }

    list.innerHTML = items.map(s => `
      <div style="display:flex;justify-content:space-between;align-items:center;
        padding:12px;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:8px;
        background:${s.active ? "white" : "#fafafa"};flex-wrap:wrap;gap:10px">
        <div>
          <p style="margin:0;font-weight:800;font-size:14px">${s.sponsorName}</p>
          <p style="margin:3px 0;font-size:12px;color:#ff6600;font-weight:700">
            Category: ${s.category}
          </p>
          <p style="margin:0;font-size:11px;color:#9ca3af">
            ${fmtDate(s.createdAt)} · Expires: ${fmtDate(s.expiresAt)} ·
            UGX ${Number(s.price||0).toLocaleString()}
          </p>
        </div>
        <div style="display:flex;gap:8px">
          <button onclick="toggleSponsor('${s.id}',${!s.active})"
            style="background:${s.active ? "#dcfce7" : "#fee2e2"};
            color:${s.active ? "#166534" : "#991b1b"};border:none;
            padding:6px 12px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">
            ${s.active ? "✅ Active" : "❌ Paused"}
          </button>
          <button onclick="deleteSponsor('${s.id}')"
            style="background:#fee2e2;color:#ef4444;border:none;
            padding:6px 12px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">
            🗑️
          </button>
        </div>
      </div>`).join("");

  } catch(e) { showToast("Failed to load", "error"); }
};

window.toggleSponsor = async function(id, active) {
  try {
    await updateDoc(doc(db, "category_sponsors", id), { active });
    showToast(active ? "Sponsor activated" : "Sponsor paused", "info");
    loadCategorySponsorsAdmin();
  } catch(e) { showToast("Failed", "error"); }
};

window.deleteSponsor = async function(id) {
  if (!confirm("Delete this sponsorship?")) return;
  try {
    await deleteDoc(doc(db, "category_sponsors", id));
    showToast("Deleted", "info");
    loadCategorySponsorsAdmin();
  } catch(e) { showToast("Failed", "error"); }
};


// ══════════════════════════════════════════════
//  BLOG MANAGEMENT
// ══════════════════════════════════════════════

let _blogCoverFile = null;
let _allBlogPosts   = [];

window.handleBlogCoverPick = function(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showToast("Please select an image file", "error");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast("Image too large — max 5MB", "error");
    return;
  }

  _blogCoverFile = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById("bp-cover-preview").innerHTML = `
      <img src="${e.target.result}"
        style="width:100%;height:140px;object-fit:cover;border-radius:10px;margin-top:8px;border:1.5px solid #e5e7eb">
      <p style="font-size:11px;color:#10b981;font-weight:700;margin-top:4px">✅ ${file.name}</p>
    `;
  };
  reader.readAsDataURL(file);
};

window.saveBlogPost = async function(status) {
  const editId   = document.getElementById("bp-edit-id").value;
  const title    = document.getElementById("bp-title").value.trim();
  const category = document.getElementById("bp-category").value;
  const author   = document.getElementById("bp-author").value.trim() || "ZiBuy Team";
  const excerpt  = document.getElementById("bp-excerpt").value.trim();
  const content  = document.getElementById("bp-content").value.trim();

  if (!title) { showToast("Enter a post title", "error"); return; }
  if (!content) { showToast("Write some content for the post", "error"); return; }

  const btn = status === "published"
    ? document.getElementById("bp-publish-btn")
    : event.target;
  const originalText = btn.textContent;
  btn.textContent = "Saving...";
  btn.disabled    = true;

  try {
    let coverImage = "";

    // Keep existing cover if editing and no new image chosen
    if (editId && !_blogCoverFile) {
      const existing = _allBlogPosts.find(p => p.id === editId);
      coverImage = existing?.coverImage || "";
    }

    if (_blogCoverFile) {
      const { getStorage, ref, uploadBytes, getDownloadURL }
        = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js");
      const storage = getStorage();
      const storageRef = ref(storage, `blog-covers/${Date.now()}-${_blogCoverFile.name}`);
      await uploadBytes(storageRef, _blogCoverFile, { contentType: _blogCoverFile.type });
      coverImage = await getDownloadURL(storageRef);
    }

    const postData = {
      title, category, author, excerpt, content, coverImage,
      status,
      updatedAt: new Date()
    };

    if (editId) {
      await updateDoc(doc(db, "blog_posts", editId), postData);
      showToast(status === "published" ? "✅ Post published!" : "💾 Draft saved", "success");
    } else {
      await addDoc(collection(db, "blog_posts"), {
        ...postData,
        views: 0,
        createdAt: new Date()
      });
      showToast(status === "published" ? "🚀 Post published!" : "💾 Draft saved", "success");
    }

    cancelBlogEdit();
    loadBlogAdmin();

  } catch (err) {
    console.error("saveBlogPost error:", err);
    showToast("Failed: " + err.message, "error");
  } finally {
    btn.textContent = originalText;
    btn.disabled    = false;
  }
};

window.cancelBlogEdit = function() {
  document.getElementById("bp-edit-id").value     = "";
  document.getElementById("bp-title").value       = "";
  document.getElementById("bp-excerpt").value     = "";
  document.getElementById("bp-content").value     = "";
  document.getElementById("bp-author").value      = "ZiBuy Team";
  document.getElementById("bp-category").value    = "selling-tips";
  document.getElementById("bp-cover-preview").innerHTML = "";
  document.getElementById("blog-form-title").textContent = "✍️ Write New Post";
  document.getElementById("bp-cancel-edit").style.display = "none";
  _blogCoverFile = null;
};

window.editBlogPost = function(postId) {
  const post = _allBlogPosts.find(p => p.id === postId);
  if (!post) return;

  document.getElementById("bp-edit-id").value  = postId;
  document.getElementById("bp-title").value    = post.title || "";
  document.getElementById("bp-category").value = post.category || "selling-tips";
  document.getElementById("bp-author").value   = post.author || "ZiBuy Team";
  document.getElementById("bp-excerpt").value  = post.excerpt || "";
  document.getElementById("bp-content").value  = post.content || "";

  if (post.coverImage) {
    document.getElementById("bp-cover-preview").innerHTML = `
      <img src="${post.coverImage}"
        style="width:100%;height:140px;object-fit:cover;border-radius:10px;margin-top:8px;border:1.5px solid #e5e7eb">
      <p style="font-size:11px;color:#6b7280;margin-top:4px">Current cover image (upload new to replace)</p>
    `;
  }

  document.getElementById("blog-form-title").textContent = "✏️ Edit Post";
  document.getElementById("bp-cancel-edit").style.display = "block";

  document.getElementById("section-blog").scrollIntoView({ behavior: "smooth" });
};

window.deleteBlogPost = async function(postId) {
  if (!confirm("Delete this blog post permanently?")) return;
  try {
    await deleteDoc(doc(db, "blog_posts", postId));
    showToast("Post deleted", "info");
    loadBlogAdmin();
  } catch (e) { showToast("Failed", "error"); }
};

window.toggleBlogStatus = async function(postId, newStatus) {
  try {
    await updateDoc(doc(db, "blog_posts", postId), { status: newStatus });
    showToast(newStatus === "published" ? "Post published" : "Post unpublished", "success");
    loadBlogAdmin();
  } catch (e) { showToast("Failed", "error"); }
};

window.loadBlogAdmin = async function() {
  const list = document.getElementById("blog-posts-list");
  if (!list) return;
  list.innerHTML = `<p style="text-align:center;color:#6b7280;padding:30px">Loading...</p>`;

  try {
    const snap = await getDocs(collection(db, "blog_posts"));
    _allBlogPosts = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));

    if (_allBlogPosts.length === 0) {
      list.innerHTML = `<p style="text-align:center;color:#6b7280;padding:30px">No blog posts yet</p>`;
      return;
    }

    list.innerHTML = _allBlogPosts.map(p => `
      <div style="display:flex;gap:14px;align-items:flex-start;padding:14px;
        border:1px solid #e5e7eb;border-radius:12px;margin-bottom:10px;flex-wrap:wrap">

        <img src="${p.coverImage || ''}" alt=""
          onerror="this.style.background='#f3f4f6';this.src=''"
          style="width:80px;height:60px;object-fit:cover;border-radius:8px;background:#f3f4f6;flex-shrink:0">

        <div style="flex:1;min-width:160px">
          <p style="margin:0;font-weight:800;font-size:14px;color:#111827">${p.title}</p>
          <p style="margin:4px 0;font-size:12px;color:#6b7280">
            ${p.category || "—"} · by ${p.author || "ZiBuy Team"} · 👁️ ${p.views || 0} views
          </p>
          <span class="plan-chip ${p.status === 'published' ? 'chip-approved' : 'chip-pending'}">
            ${p.status === 'published' ? '✅ Published' : '📝 Draft'}
          </span>
        </div>

        <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
          <button class="action-btn btn-approve" onclick="editBlogPost('${p.id}')">✏️ Edit</button>
          ${p.status === 'published'
            ? `<button class="action-btn btn-reject" onclick="toggleBlogStatus('${p.id}','draft')">📥 Unpublish</button>`
            : `<button class="action-btn btn-approve" onclick="toggleBlogStatus('${p.id}','published')">🚀 Publish</button>`}
          <button class="action-btn btn-reject" onclick="deleteBlogPost('${p.id}')">🗑️ Delete</button>
        </div>
      </div>
    `).join("");

  } catch (err) {
    list.innerHTML = `<p style="color:red;text-align:center;padding:30px">Failed: ${err.message}</p>`;
  }
};

async function loadAdminLogs() {

  const container =
    document.getElementById("activity-log-list");

  if (!container) return;

  try {

    const snap = await getDocs(
      query(
        collection(db, "function_logs"),
        orderBy("createdAt", "desc"),
        limit(100)
      )
    );

    let html = "";

    snap.forEach(doc => {

      const data = doc.data();

      const date =
        data.createdAt?.toDate?.()
          ?.toLocaleString() || "";

      html += `
        <div class="activity-item">
          <strong>${data.type || "event"}</strong>
          <div>${doc.id}</div>
          <small>${date}</small>
        </div>
      `;
    });

    container.innerHTML =
      html || "<p>No activity found</p>";

  } catch (err) {

    console.error(err);

    container.innerHTML =
      "<p>Failed to load logs</p>";
  }
}

window.loadAdminLogs = loadAdminLogs;