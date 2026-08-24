// ============================================
//   ZiBuy — Admin Panel
// ============================================

import {
  db, auth, collection, getDocs, doc,
  getDoc, query, where,
  updateDoc as _updateDoc,
  deleteDoc as _deleteDoc,
  addDoc as _addDoc,
  setDoc as _setDoc,
  orderBy, limit
} from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ── Write interceptors: every admin write, anywhere in this file, is auto-logged ──
async function updateDoc(ref, data) {
  const result = await _updateDoc(ref, data);
  logAdminAction("UPDATE", `${ref.path} — fields: ${Object.keys(data || {}).join(", ")}`);
  return result;
}
async function addDoc(ref, data) {
  const result = await _addDoc(ref, data);
  logAdminAction("CREATE", result.path);
  return result;
}
async function deleteDoc(ref) {
  const result = await _deleteDoc(ref);
  logAdminAction("DELETE", ref.path);
  return result;
}
async function setDoc(ref, data, options) {
  const result = await _setDoc(ref, data, options);
  logAdminAction("SET", `${ref.path} — fields: ${Object.keys(data || {}).join(", ")}`);
  return result;
}
import { onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


// ==========================================
// Escape HTML (XSS Protection)
// ==========================================
function escapeHTML(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

// ── Admin audit log — records every action taken by any admin ──
async function logAdminAction(action, details) {
  try {
    await _addDoc(collection(db, "admin_action_logs"), {
      action,
      details: details || "",
      adminEmail: auth.currentUser?.email || "unknown",
      adminUid: auth.currentUser?.uid || "",
      createdAt: new Date()
    });
  } catch (e) {
    console.error("Failed to log admin action:", e);
  }
}

// ── Raw data caches ───────────────────────────
let allUsers       = [];
let allSubs        = [];
let allBoosts      = [];
let allAds         = [];
let allOrders       = [];
let allPremiumAds  = [];
let allVerifs      = [];
let allReports     = [];
let allJobAds      = [];

// ── Auth guard ────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  const emailDisplay = document.getElementById("admin-email-display");

  if (!user) {
    window.location.href = "index.html";
    return;
  }

  let allowed = user.email === ADMIN_EMAIL;
  if (!allowed) {
    try {
      const adminSnap = await getDoc(doc(db, "admins", user.uid));
      allowed = adminSnap.exists();
    } catch (e) {
      allowed = false;
    }
  }

  if (!allowed) {
    alert("Access denied. Admins only.");
    await signOut(auth);
    window.location.href = "index.html";
    return;
  }

  if (emailDisplay) {
    emailDisplay.textContent = user.email;
  }

  const staffAccessNavBtn = document.getElementById("staff-access-nav-btn");
  if (staffAccessNavBtn) {
    staffAccessNavBtn.style.display = user.email === ADMIN_EMAIL ? "" : "none";
  }

  const auditLogNavBtn = document.getElementById("admin-audit-nav-btn");
  if (auditLogNavBtn) {
    auditLogNavBtn.style.display = user.email === ADMIN_EMAIL ? "" : "none";
  }

  if (user.email === ADMIN_EMAIL) {
    startAdminAuditLogListener();
  }

  await loadAll();
});

window.adminLogout = () => signOut(auth).then(() => window.location.href = "index.html");

// ══════════════════════════════════════════════
//  STAFF ACCESS — additional admins
// ══════════════════════════════════════════════
async function loadAdmins() {
  try {
    const snap = await getDocs(collection(db, "admins"));
    const admins = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAdmins(admins);
  } catch (e) { console.error(e); }
}
window.loadAdmins = loadAdmins;

function renderAdmins(admins) {
  const tbody = document.getElementById("admins-table-body");
  if (!tbody) return;

  if (admins.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="4">No additional admins yet</td></tr>`;
    return;
  }

  tbody.innerHTML = admins.map(a => `
    <tr>
      <td style="font-family:monospace;font-size:12px">${escapeHTML(a.id)}</td>
      <td>${escapeHTML(a.email) || "—"}</td>
      <td style="font-size:12px">${fmtDate(a.addedAt)}</td>
      <td><button class="action-btn btn-reject" onclick="removeAdmin('${a.id}')">🗑️ Remove</button></td>
    </tr>`).join("");
}

window.addAdmin = async function() {
  const uid = document.getElementById("new-admin-uid")?.value.trim();
  const email = document.getElementById("new-admin-email")?.value.trim();
  if (!uid) { showToast("Paste the user's UID first", "info"); return; }

  try {
    await setDoc(doc(db, "admins", uid), {
      email: email || "",
      addedAt: new Date(),
      addedBy: ADMIN_EMAIL
    });
    showToast("Admin added", "success");
    document.getElementById("new-admin-uid").value = "";
    document.getElementById("new-admin-email").value = "";
    loadAdmins();
  } catch (e) {
    showToast("Failed: " + e.message, "error");
  }
};

window.removeAdmin = async function(uid) {
  if (!confirm("Remove this person's admin access?")) return;
  try {
    await deleteDoc(doc(db, "admins", uid));
    showToast("Admin removed", "info");
    loadAdmins();
  } catch (e) {
    showToast("Failed: " + e.message, "error");
  }
};

// ══════════════════════════════════════════════
//  ADMIN AUDIT LOG — real-time, super-admin only
// ══════════════════════════════════════════════
function renderAdminAuditLog(logs) {
  const tbody = document.getElementById("admin-audit-table-body");
  if (!tbody) return;

  if (logs.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="4">No admin activity yet</td></tr>`;
    return;
  }

  tbody.innerHTML = logs.map(l => {
    const date = l.createdAt?.toDate ? l.createdAt.toDate().toLocaleString() : (l.createdAt ? new Date(l.createdAt).toLocaleString() : "");
    return `
      <tr>
        <td style="font-size:12px">${date}</td>
        <td><span class="plan-chip chip-pending">${escapeHTML(l.action || "action")}</span></td>
        <td style="font-size:12px">${escapeHTML(l.adminEmail) || "—"}</td>
        <td style="font-size:12px">${escapeHTML(l.details) || "—"}</td>
      </tr>`;
  }).join("");
}

function startAdminAuditLogListener() {
  const q = query(collection(db, "admin_action_logs"), orderBy("createdAt", "desc"), limit(200));
  onSnapshot(q, (snap) => {
    const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAdminAuditLog(logs);
  }, (err) => {
    console.error("Admin audit log listener failed:", err);
  });
}


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
async function loadOverviewExtras() {
  try {
    const jobsSnap = await getDocs(collection(db, "job_ads"));
    allJobAds = jobsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) {
    console.warn("loadOverviewExtras:", e.message);
    allJobAds = [];
  }
}

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
    loadJobAdsAdmin(),
    loadBroadcasts(),
    loadBlogAdmin(),
    loadCategorySponsorsAdmin(),
    loadPinRequestsAdmin(),
    loadOverviewExtras(),
    loadAdmins()
  ]);
  renderOverview();
  checkSystemHealth();
  checkFraudAlerts();
  loadGrowthSnapshot();
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

  // Revenue — sum of amounts actually approved/active, not just requested
  const boostRevenue   = allBoosts.filter(b => b.status === "approved").reduce((s,b) => s + Number(b.price||0), 0);
  const subRevenue     = allSubs.filter(s => s.status === "active").reduce((s,sub) => s + Number(sub.price||0), 0);
  const premiumRevenue = allPremiumAds.reduce((s,p) => s + Number(p.price||0), 0);
  const totalRevenue   = boostRevenue + subRevenue + premiumRevenue;
  const kpiRevenue = document.getElementById("kpi-revenue");
  if (kpiRevenue) kpiRevenue.textContent = "UGX " + totalRevenue.toLocaleString();

  const kpiVerifs = document.getElementById("kpi-verifications");
  if (kpiVerifs) kpiVerifs.textContent = allVerifs.filter(v => v.status === "approved").length;

  const kpiJobs = document.getElementById("kpi-jobads");
  if (kpiJobs) kpiJobs.textContent = allJobAds.filter(j => j.status === "active").length;

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

// ── Compress an image client-side before upload — critical for
// mobile, where camera photos are often 10-20MB. This is the same
// approach already used in post-ad.js and bulk-post.js. ──
async function compressImageForUpload(file, maxWidth = 1280, quality = 0.75) {
  if (file.size < 300 * 1024) return file; // already small — skip

  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name, { type: "image/jpeg", lastModified: Date.now() }));
        }, "image/jpeg", quality);
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
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
    tbody.innerHTML = `<tr class="empty-row"><td colspan="9">No users found</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const plan     = u.plan || "free";
    const verified = u.isSellerVerified ? "✅ Yes" : "—";
    const banned   = u.banned ? "banned" : "active";

    return `
      <tr>
        <td><input type="checkbox" class="user-select-checkbox" value="${u.id}"></td>
        <td><span style="font-weight:700">${escapeHTML(u.email) || escapeHTML(u.id)}</span></td>
        <td><span class="plan-chip chip-${plan}">${planEmoji(plan)} ${plan}</span></td>
        <td id="ads-count-${u.id}">—</td>
        <td>${verified}</td>
        <td>
          <span class="plan-chip ${u.banned ? 'chip-expired' : 'chip-approved'}">
            ${banned}
          </span>
        </td>
        <td>${u.buyerRating ? `⭐ ${u.buyerRating} (${u.buyerRatingCount || 0})` : "—"}</td>
        <td>
          ${u.trustTier ? `${u.trustScore} <span style="text-transform:capitalize;color:#6b7280;font-size:11px">(${u.trustTier})</span>` : "—"}
          <button onclick="adminForceTrustRecalc('${u.id}')" style="background:none;border:none;cursor:pointer;font-size:12px;margin-left:4px" title="Recalculate now">🔄</button>
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
        <td class="zb-action-cell">
          ${u.banned
            ? `<button class="action-btn btn-unban" onclick="toggleBan('${u.id}', false)">Unban</button>`
            : `<button class="action-btn btn-ban"   onclick="toggleBan('${u.id}', true)">Ban</button>`}
          ${u.phone ? `
            <a href="https://wa.me/${u.phone.replace(/\D/g,"")}?text=${encodeURIComponent("Hello from ZiBuy Support:")}"
              target="_blank"
              style="background:#25d366;color:white;border:none;padding:6px 10px;border-radius:7px;font-size:12px;font-weight:700;text-decoration:none">
              💬 WA
            </a>` : ""}
          <button class="action-btn" style="background:#dbeafe;color:#1e40af;border:none;padding:6px 10px;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer"
            onclick="adminViewUserAds('${u.id}','${u.email}')">
            📋 Ads
          </button>
          <button class="action-btn" style="background:#dcfce7;color:#166534;border:none;padding:6px 10px;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer"
            onclick="adminViewUserOrders('${u.id}','${u.email}')">
            🛍️ Orders
          </button>
          <button class="action-btn" style="background:${u.adminNotes ? '#fef3c7' : '#f3f4f6'};color:${u.adminNotes ? '#92400e' : '#6b7280'};border:none;padding:6px 10px;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer"
            onclick="viewUserNotes('${u.id}', '${(u.adminNotes||'').replace(/'/g,"\\'")}')">
            📝 Notes${u.adminNotes ? ' ●' : ''}
          </button>
          <button class="action-btn btn-reject" onclick="adminDeleteUser('${u.id}','${(u.email||'this user').replace(/'/g,"\\'")}')">🗑️ Delete</button>
        
          <button class="action-btn" style="background:#f3e8ff;color:#7e22ce;border:none;padding:6px 10px;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer"
            onclick="adminForceExpireAd('${u.id}')">
            🕒 Force Expire
          </button>

          <button class="action-btn" style="background:#e0f2fe;color:#0369a1;border:none;padding:6px 10px;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer"
            onclick="adminViewUserDoc('${u.id}')">
            🗂️ Full Doc
          </button>

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
    const configSnap = await getDoc(doc(db, "plan_config", "current"));
    const configured  = configSnap.exists() ? configSnap.data()[newPlan] : null;
    const adDays      = configured?.adDays || PLAN_LIMITS[newPlan]?.adDays || 30;

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + adDays);

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

    const shouldBeVerified = newPlan === "silver" || newPlan === "gold";

    // Update user doc
    await updateDoc(doc(db, "users", userId), {
      plan:             newPlan,
      isSellerVerified: shouldBeVerified,
      planUpdatedAt:    new Date()
    });

    // Sync the ACTUAL verification record every badge-checking function reads
    await syncPlanVerification(userId, shouldBeVerified, newPlan);

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

window.toggleSelectAllUsers = function(checkbox) {
  document.querySelectorAll(".user-select-checkbox").forEach(cb => cb.checked = checkbox.checked);
};

function getSelectedUserIds() {
  return Array.from(document.querySelectorAll(".user-select-checkbox:checked")).map(cb => cb.value);
}

window.bulkBanUsers = async function(ban) {
  const ids = getSelectedUserIds();
  if (ids.length === 0) { showToast("No users selected", "info"); return; }
  if (!confirm(`${ban ? "Ban" : "Unban"} ${ids.length} selected user(s)?`)) return;

  for (const id of ids) {
    try { await updateDoc(doc(db, "users", id), { banned: ban }); }
    catch (e) { console.error(`Failed for ${id}:`, e); }
  }
  showToast(`${ban ? "Banned" : "Unbanned"} ${ids.length} user(s)`, ban ? "error" : "success");
  loadUsers();
};

window.bulkDeleteUsers = async function() {
  const ids = getSelectedUserIds();
  if (ids.length === 0) { showToast("No users selected", "info"); return; }

  const typed = prompt(`This will PERMANENTLY delete ${ids.length} user(s) — accounts, logins, products, and subscriptions. This CANNOT be undone.\n\nType DELETE to confirm:`);
  if (typed !== "DELETE") {
    if (typed !== null) alert("Confirmation didn't match — bulk deletion cancelled for safety.");
    return;
  }

  const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js");
  const fn = httpsCallable(getFunctions(), "adminDeleteUserAccount");

  let succeeded = 0, failed = 0;
  for (const id of ids) {
    try { await fn({ userId: id }); succeeded++; }
    catch (e) { failed++; console.error(`Failed to delete ${id}:`, e); }
  }
  logAdminAction("BULK_USER_DELETE", `${succeeded} succeeded, ${failed} failed: ${ids.join(", ")}`);
  showToast(`Deleted ${succeeded} user(s)${failed ? `, ${failed} failed` : ""}`, failed ? "info" : "success");
  loadUsers();
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
        <td style="font-size:12px">${escapeHTML(s.email) || escapeHTML(s.userId)}</td>
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
    const configSnap = await getDoc(doc(db, "plan_config", "current"));
    const configured  = configSnap.exists() ? configSnap.data()[plan] : null;
    const adDays      = configured?.adDays || PLAN_LIMITS[plan]?.adDays || 30;

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + adDays);

    await updateDoc(doc(db, "business_accounts", subId), {
      status:        "active",
      activatedAt:   new Date(),
      activatedBy:   "admin",
      endDate
    });

    const shouldBeVerified = plan === "silver" || plan === "gold";

    await updateDoc(doc(db, "users", userId), {
      plan,
      isSellerVerified: shouldBeVerified,
      planUpdatedAt:    new Date()
    }).catch(() => {});

    // Sync the ACTUAL verification record every badge-checking function reads
    await syncPlanVerification(userId, shouldBeVerified, plan);
    // Notify user that subscription was approved
await addDoc(collection(db, "notifications"), {
  userId,
  type: "subscription",
  title: `🎉 ${plan.toUpperCase()} Plan Activated`,
  message: `Your ${plan} subscription has been approved and is now active.`,
  read: false,
  createdAt: new Date()
});


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

    const subDoc = await getDoc(
      doc(db, "business_accounts", subId)
    );

    if (!subDoc.exists()) return;

    const sub = subDoc.data();

    await updateDoc(
      doc(db, "business_accounts", subId),
      {
        status: "rejected"
      }
    );

    if (sub.userId) {
      await addDoc(
        collection(db, "notifications"),
        {
          userId: sub.userId,
          type: "subscription_rejected",
          title: "❌ Subscription Rejected",
          message: "Your subscription request was not approved.",
          read: false,
          createdAt: new Date()
        }
      );
    }

    showToast("Rejected", "info");
    loadSubscriptions();

  } catch (e) {
    console.error(e);
    showToast("Failed", "error");
  }
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
                         .sort((a, b) => {
                           const aTime = (a.requestedAt || a.createdAt)?.toDate?.() || 0;
                           const bTime = (b.requestedAt || b.createdAt)?.toDate?.() || 0;
                           return bTime - aTime;
                         });
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
          ${escapeHTML(b.productName) || b.productId?.slice(0,14) || "—"}
        </a>
        <br>
        <span style="font-size:11px;color:#6b7280">${b.productId?.slice(0,12)}</span>
      </td>
      <td>
        <span style="font-weight:700;font-size:13px">${escapeHTML(b.userEmail) || "—"}</span>
      </td>
      <td style="font-weight:800;text-align:center">${b.days || "—"} days</td>
      <td style="font-weight:800;color:var(--orange)">UGX ${Number(b.price||0).toLocaleString()}</td>
      <td>
        <span style="font-size:12px;font-weight:700;color:#ff6600;background:#fff4ee;padding:4px 8px;border-radius:6px;letter-spacing:.5px;display:inline-block">
          ${escapeHTML(b.paymentRef) || "—"}
        </span>
        ${b.transactionRef ? `<br><span style="font-size:11px;color:#6b7280">Txn: ${escapeHTML(b.transactionRef)}</span>` : ""}
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

        await addDoc(collection(db, "admin_approvals"), {
  type: "boost",
  userId: boostData.userId,
  productId,
  productName: boostData.productName || "Ad",
  days,
  approvedAt: new Date()
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
//  AUTO-RENEW REQUESTS
// ══════════════════════════════════════════════
window.loadAutoRenewRequests = async function() {
  const tbody = document.getElementById("auto-renew-table-body");
  if (!tbody) return;

  try {
    const snap = await getDocs(query(
      collection(db, "auto_renewals"),
      where("status", "==", "pending_verification")
    ));

    const requests = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (requests.length === 0) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No pending auto-renew requests</td></tr>`;
      return;
    }

    tbody.innerHTML = requests.map(r => `
      <tr>
        <td style="font-weight:700;font-size:13px">${escapeHTML(r.productName)}</td>
        <td style="font-size:12px">${escapeHTML(r.userEmail)}</td>
        <td style="font-weight:800;color:var(--orange)">UGX ${Number(r.price||0).toLocaleString()}</td>
        <td style="font-size:12px">${escapeHTML(r.paymentRef)}<br><span style="color:#6b7280">Txn: ${escapeHTML(r.transactionRef)}</span></td>
        <td style="font-size:12px">${fmtDate(r.createdAt)}</td>
        <td>
          <button class="action-btn btn-approve" onclick="approveAutoRenew('${r.id}','${r.productId}')">✅ Approve</button>
          <button class="action-btn btn-reject" onclick="rejectAutoRenew('${r.id}')">✗ Reject</button>
        </td>
      </tr>`).join("");

  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:red">Failed: ${e.message}</td></tr>`;
  }
};

window.approveAutoRenew = async function(renewalId, productId) {
  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await updateDoc(doc(db, "auto_renewals", renewalId), {
      status:      "active",
      approvedAt:  new Date(),
      expiresAt
    });

    await updateDoc(doc(db, "products", productId), {
      autoRenew: true,
      expiresAt: expiresAt
    });

    const renewalSnap = await getDoc(doc(db, "auto_renewals", renewalId));
    const renewal = renewalSnap.data();

    if (renewal?.userId) {
      await addDoc(collection(db, "notifications"), {
        userId:    renewal.userId,
        type:      "auto_renew_activated",
        title:     "🔄 Auto-Renew Activated!",
        message:   `Your ad "${renewal.productName}" will now auto-renew every 30 days.`,
        relatedId: productId,
        read:      false,
        createdAt: new Date()
      });
    }

    showToast("Auto-renew activated ✅", "success");
    loadAutoRenewRequests();
  } catch(e) {
    showToast("Failed: " + e.message, "error");
  }
};

window.rejectAutoRenew = async function(renewalId) {
  if (!confirm("Reject this auto-renew request?")) return;
  try {
    await updateDoc(doc(db, "auto_renewals", renewalId), { status: "rejected" });
    showToast("Rejected", "info");
    loadAutoRenewRequests();
  } catch(e) {
    showToast("Failed", "error");
  }
};


window.loadPinRequestsAdmin = async function() {
  const list = document.getElementById("pin-requests-list");
  if (!list) return;
  list.innerHTML = `<p style="text-align:center;padding:30px;color:#6b7280">Loading...</p>`;

  try {
    const snap = await getDocs(query(
      collection(db, "pin_requests"),
      where("status", "==", "pending")
    ));

    if (snap.empty) {
      list.innerHTML = `<p style="text-align:center;padding:30px;color:#6b7280">No pending pin requests</p>`;
      return;
    }

    const requests = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    list.innerHTML = requests.map(r => `
      <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;
        padding:16px;margin-bottom:12px">
        <p style="margin:0 0 6px;font-weight:800;color:#111827">${r.productName}</p>
        <p style="margin:0 0 4px;font-size:13px;color:#6b7280">
          ${r.hours}h pin · UGX ${Number(r.price).toLocaleString()} ·
          Ref: <strong>${r.paymentRef}</strong> · Txn: <strong>${r.transactionRef}</strong>
        </p>
        <p style="margin:0 0 12px;font-size:12px;color:#9ca3af">${r.userEmail}</p>
        <div style="display:flex;gap:8px">
          <button class="action-btn btn-approve" onclick="approvePin('${r.id}','${r.productId}',${r.hours})">
            ✅ Approve & Pin
          </button>
          <button class="action-btn btn-reject" onclick="rejectPin('${r.id}')">
            ❌ Reject
          </button>
        </div>
      </div>
    `).join("");

  } catch (err) {
    list.innerHTML = `<p style="color:red;padding:20px">Failed: ${err.message}</p>`;
  }
};

window.approvePin = async function(requestId, productId, hours) {
  try {
    const pinnedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);

    await updateDoc(doc(db, "products", productId), {
      pinnedUntil
    });

    // Read pin request to get userId for notification
    const pinDoc  = await getDoc(doc(db, "pin_requests", requestId));
    const pinData = pinDoc.exists() ? pinDoc.data() : {};

    await updateDoc(doc(db, "pin_requests", requestId), {
      status:     "approved",
      approvedAt: new Date(),
      expiresAt:  pinnedUntil
    });

    // Notify the seller
    if (pinData.userId) {
      await addDoc(collection(db, "notifications"), {
        userId:    pinData.userId,
        type:      "pin_approved",
        title:     "📍 Your Ad is Pinned to Top!",
        message:   `"${pinData.productName || "Your ad"}" is now pinned to the top of all listings for ${hours} hours.`,
        relatedId: productId,
        read:      false,
        createdAt: new Date()
      });
    }

    showToast("✅ Ad pinned to top!", "success");
    loadPinRequestsAdmin();
  } catch (err) {
    showToast("Failed: " + err.message, "error");
  }
};

window.rejectPin = async function(requestId) {
  try {
    await updateDoc(doc(db, "pin_requests", requestId), {
      status: "rejected",
      rejectedAt: new Date()
    });
    showToast("Request rejected", "info");
    loadPinRequestsAdmin();
  } catch (err) {
    showToast("Failed: " + err.message, "error");
  }
};

// ══════════════════════════════════════════════
//  ALL ADS
// ══════════════════════════════════════════════
function isValidWhatsAppPhoneAdmin(phone) {
  return /^[1-9]\d{9,14}$/.test((phone || "").trim());
}

async function loadAds() {
  try {
    const snap = await getDocs(collection(db, "products"));
    allAds = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                      .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
    applyAdsFilters();
  } catch (e) { console.error(e); }
}

function renderAdsTable(ads) {
  const tbody = document.getElementById("ads-table-body");
  if (!tbody) return;

  if (ads.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8">No ads match this filter</td></tr>`;
    return;
  }

  tbody.innerHTML = ads.map(a => {
    const effStatus = getAdEffectiveStatus(a);
    const chip  = effStatus === "expired" ? "chip-expired" : effStatus === "sold" ? "chip-rejected" : "chip-approved";
    const label = effStatus === "expired" ? "⏰ expired" : effStatus === "sold" ? "❌ sold" : "✅ active";
    const phoneOk = isValidWhatsAppPhoneAdmin(a.seller?.phone);

    return `
    <tr>
      <td>
        <img src="${a.images?.[0] || ''}" alt=""
          style="width:44px;height:44px;object-fit:cover;border-radius:8px;background:#f3f4f6">
      </td>
      <td style="font-weight:700;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(a.name)}</td>
      <td style="color:var(--orange);font-weight:800">UGX ${Number(a.price||0).toLocaleString()}</td>
      <td style="font-size:12px">${escapeHTML(a.userEmail) || "—"}</td>
      <td>
        ${phoneOk
          ? `<span class="plan-chip chip-approved" title="${escapeHTML(a.seller?.phone||'')}">✅ ${escapeHTML(a.seller?.phone||'')}</span>`
          : `<span class="plan-chip chip-expired" title="Missing or invalid WhatsApp number">⚠️ ${a.seller?.phone ? escapeHTML(a.seller.phone) : "None"}</span>`}
      </td>
      <td><span class="plan-chip ${chip}">${label}</span></td>
      <td style="font-size:12px">${fmtDate(a.expiresAt)}</td>
      <td style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="action-btn btn-approve" onclick="adminEditAd('${a.id}')">✏️ Edit</button>
        ${effStatus === "expired" ? `
          <button class="action-btn" style="background:#dcfce7;color:#166534;border:none;padding:6px 10px;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer"
            onclick="adminReactivateAd('${a.id}')">🔄 Reactivate</button>
        ` : `
          <button class="action-btn" style="background:#dbeafe;color:#1e40af;border:none;padding:6px 10px;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer"
            onclick="adminToggleAdStatus('${a.id}','${a.status}')">
            ${a.status === "active" ? "📦 Mark Sold" : "♻️ Restore"}
          </button>
          <button class="action-btn" style="background:#fff4ee;color:#ff6600;border:none;padding:6px 10px;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer"
            onclick="grantFreeBoost('${a.id}','${(a.name||"").replace(/'/g,"\\'")}')">⭐ Free Boost</button>
          <button class="action-btn" style="background:#ede9fe;color:#5b21b6;border:none;padding:6px 10px;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer"
            onclick="grantFreePin('${a.id}')">📍 Free Pin</button>
        `}
        <button class="action-btn btn-reject" onclick="adminDeleteAd('${a.id}')">🗑️ Delete</button>
      </td>
    </tr>`;
  }).join("");
}

let currentAdsStatusFilter = "all";

function isAdExpiredAdmin(a) {
  if (a.status !== "active") return false;
  const exp = a.expiresAt?.toDate ? a.expiresAt.toDate() : (a.expiresAt ? new Date(a.expiresAt) : null);
  return exp ? exp < new Date() : false;
}

function getAdEffectiveStatus(a) {
  if (a.status === "sold") return "sold";
  if (a.status === "expired" || isAdExpiredAdmin(a)) return "expired";
  return "active";
}

window.filterAdsByStatus = function(status) {
  currentAdsStatusFilter = status;
  document.querySelectorAll(".ads-status-filter-btn").forEach(b => b.classList.remove("active-filter"));
  document.querySelector(`.ads-status-filter-btn[data-status="${status}"]`)?.classList.add("active-filter");
  applyAdsFilters();
};

window.filterAds = function() {
  applyAdsFilters();
};

function applyAdsFilters() {
  const q = (document.getElementById("ads-search")?.value || "").toLowerCase();
  let filtered = allAds.filter(a =>
    (a.name || "").toLowerCase().includes(q) ||
    (a.userEmail || "").toLowerCase().includes(q)
  );
  if (currentAdsStatusFilter === "badphone") {
    filtered = filtered.filter(a => !isValidWhatsAppPhoneAdmin(a.seller?.phone));
  } else if (currentAdsStatusFilter !== "all") {
    filtered = filtered.filter(a => getAdEffectiveStatus(a) === currentAdsStatusFilter);
  }
  renderAdsTable(filtered);
}

window.adminReactivateAd = async function(productId) {
  const days = prompt("Reactivate this ad for how many days?", "30");
  if (!days) return;

  try {
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + Number(days));

    await updateDoc(doc(db, "products", productId), {
      status:         "active",
      expiresAt:      newExpiresAt,
      reactivatedAt:  new Date(),
      reactivatedBy:  "admin"
    });

    showToast(`✅ Ad reactivated for ${days} days`, "success");
    loadAds();
  } catch(e) {
    showToast("Failed: " + e.message, "error");
  }
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
      <td style="font-weight:700;font-size:12px;color:var(--orange)">${escapeHTML(o.orderId)}</td>
      <td style="font-size:12px">${escapeHTML(o.customerName) || "—"}<br><span style="color:var(--gray)">${escapeHTML(o.customerPhone)}</span></td>
      <td style="font-weight:800">UGX ${Number(o.total||0).toLocaleString()}</td>
      <td style="font-size:12px">${o.paymentMethod || "—"}</td>
      <td><span class="plan-chip ${chipClass(o.status)}">${o.status}</span></td>
      <td style="font-size:12px">${fmtDate(o.createdAt)}</td>
      <td style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <button class="action-btn btn-approve" onclick="viewOrderDetail('${o.id}')">👁️ View</button>
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
window.showToast = showToast;



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
        <td style="font-size:12px">${escapeHTML(a.userEmail) || a.userId?.slice(0,8)}</td>
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
      <td style="font-weight:700">${escapeHTML(v.fullName) || "—"}</td>
      <td>${escapeHTML(v.businessName) || "—"}</td>
      <td style="font-size:12px">${escapeHTML(v.email) || "—"}</td>
      <td style="font-size:12px">${escapeHTML(v.phone) || "—"}</td>
      <td style="font-size:12px">${escapeHTML(v.location) || "—"}</td>
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
      <td style="font-weight:800;color:#ef4444">${escapeHTML(r.reason) || "—"}</td>
      <td>
        <span style="font-weight:700;font-size:13px;color:#111827">${escapeHTML(r.sellerName) || escapeHTML(r.productId) || "—"}</span>
        ${r.productRef && r.productRef !== "—"
          ? `<br><span style="font-size:11px;color:#6b7280">${escapeHTML(r.productRef.slice(0,30))}</span>`
          : ""}
      </td>
      <td style="font-size:12px">${escapeHTML(r.reporterEmail || r.reportedBy) || "—"}</td>
      <td style="font-size:12px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(r.description) || "—"}</td>
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
        `🔗 ${url !== "/" ? `https://zibuy.ziteche.com${url}` : "https://zibuy.ziteche.com"}`
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
      <div style="padding:12px;border-bottom:1px solid #f0f0f0;display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
        <div style="flex:1">
          <p style="font-weight:800;font-size:14px;margin:0 0 4px">🔥 ${escapeHTML(b.title)}</p>
          <p style="font-size:13px;color:var(--gray);margin:0 0 4px">${escapeHTML(b.message)}</p>
          <p style="font-size:11px;color:#adb5bd;margin:0">${fmtDate(b.createdAt)}</p>
        </div>
        <button onclick="deleteBroadcast('${b.id}')"
          style="background:#fee2e2;color:#ef4444;border:none;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;flex-shrink:0">
          🗑️ Delete
        </button>
      </div>
    `).join("");
  } catch (e) { console.warn(e); }
}

window.deleteBroadcast = async function(broadcastId) {
  if (!confirm("Delete this broadcast? It will stop appearing on every page immediately.")) return;

  try {
    await deleteDoc(doc(db, "broadcasts", broadcastId));
    showToast("Broadcast deleted ✅", "success");
    loadBroadcasts();
  } catch (e) {
    showToast("Failed: " + e.message, "error");
  }
};


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
              <p style="font-weight:800;margin:0 0 4px">${escapeHTML(b.title)}</p>
              <p style="font-size:12px;color:#6b7280;margin:0 0 4px">👁️ ${b.impressions || 0} impressions · 🖱️ ${b.clicks || 0} clicks</p>
              <p style="font-size:12px;color:#ff6600;font-weight:700;margin:0">UGX ${Number(b.price || 0).toLocaleString()}/mo</p>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button onclick="toggleBanner('${b.id}', ${!b.active})"
                style="background:${b.active ? '#dcfce7' : '#fee2e2'};color:${b.active ? '#16a34a' : '#ef4444'};border:none;padding:7px 12px;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer">
                ${b.active ? '✅ Active' : '❌ Paused'}
              </button>
              <button onclick="editBanner('${b.id}')"
                style="background:#dbeafe;color:#1e40af;border:none;padding:7px 12px;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer">
                ✏️ Edit
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
    if (btn) btn.textContent = "Optimizing photo...";
    const compressedFile = await compressImageForUpload(_bannerImageFile);

    // Import storage
    const { getStorage, ref, uploadBytes, getDownloadURL }
      = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js");
    const storage = getStorage();

    if (btn) btn.textContent = "Uploading...";
    const storageRef = ref(storage, `banner-ads/${Date.now()}-${compressedFile.name}`);
    await uploadBytes(storageRef, compressedFile, { contentType: compressedFile.type });
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


window.editBanner = async function(bannerId) {
  const snap = await getDoc(doc(db, "banner_ads", bannerId));
  if (!snap.exists()) return;
  const b = snap.data();

  const newTitle = prompt("Banner title:", b.title || "");
  if (newTitle === null) return;
  const newUrl = prompt("Destination URL:", b.url || "");
  if (newUrl === null) return;
  const newPrice = prompt("Price (UGX/mo):", b.price || 0);
  if (newPrice === null) return;

  try {
    await updateDoc(doc(db, "banner_ads", bannerId), {
      title: newTitle.trim(), url: newUrl.trim(), price: Number(newPrice)
    });
    showToast("Banner updated ✅", "success");
    loadBanners();
  } catch(e) { showToast("Failed", "error"); }
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
            ${escapeHTML(r.email) || r.userId?.slice(0,16) || "Unknown user"}
          </p>
          <p style="margin:0;font-size:12px;color:#6b7280">
            📱 ${escapeHTML(r.phone) || "No phone"} ·
            ${r.plan ? "Plan: " + escapeHTML(r.plan.toUpperCase()) : ""}
            ${r.productName ? "Ad: " + escapeHTML(r.productName) : ""}
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


function openWhatsApp(reminder) {
  if (!reminder.phone) {
    alert("No phone number available for this user");
    return;
  }

  const url = reminder.waLink;
  window.open(url, "_blank");
}

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
          <p style="margin:0;font-weight:800;font-size:13px">${escapeHTML(j.title)}</p>
          <p style="margin:2px 0 0;font-size:11px;color:#6b7280">
            📍 ${escapeHTML(j.location)} · ${escapeHTML(j.type) || "Full Time"}
          </p>
        </td>
        <td style="padding:12px;font-size:13px;font-weight:700">${escapeHTML(j.company)}</td>
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
          <p style="margin:0;font-weight:800;font-size:14px">${escapeHTML(s.sponsorName)}</p>
          <p style="margin:3px 0;font-size:12px;color:#ff6600;font-weight:700">
            Category: ${escapeHTML(s.category)}
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
      const compressedCover = await compressImageForUpload(_blogCoverFile);
      const { getStorage, ref, uploadBytes, getDownloadURL }
        = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js");
      const storage = getStorage();
      const storageRef = ref(storage, `blog-covers/${Date.now()}-${compressedCover.name}`);
      await uploadBytes(storageRef, compressedCover, { contentType: compressedCover.type });
      coverImage = await getDownloadURL(storageRef);
    }

       const slug = title
  .toLowerCase()
  .trim()
  .replace(/[^\w\s-]/g, "")
  .replace(/\s+/g, "-");

let publishAt = null;

if (status === "scheduled") {
  const scheduleInput = document.getElementById("bp-schedule-date")?.value;
  if (!scheduleInput) {
    showToast("Pick a date and time to schedule for", "error");
    return;
  }
  publishAt = new Date(scheduleInput);
  if (publishAt <= new Date()) {
    showToast("Scheduled time must be in the future", "error");
    return;
  }
}

const postData = {
  title,
  slug,
  category,
  author,
  excerpt,
  content,
  coverImage,
  status,
  publishAt,
  updatedAt: new Date()
};

    if (editId) {
      await updateDoc(doc(db, "blog_posts", editId), postData);
      showToast(status === "published" ? "✅ Post published!" : status === "scheduled" ? "📅 Post scheduled!" : "💾 Draft saved", "success");
    } else {
      await addDoc(collection(db, "blog_posts"), {
        ...postData,
        views: 0,
        createdAt: new Date()
      });
      showToast(status === "published" ? "🚀 Post published!" : status === "scheduled" ? "📅 Post scheduled!" : "💾 Draft saved", "success");
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
  document.getElementById("bp-schedule-date").value = "";
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

  const scheduleEl = document.getElementById("bp-schedule-date");
  if (scheduleEl) {
    if (post.status === "scheduled" && post.publishAt) {
      const d = post.publishAt.toDate ? post.publishAt.toDate() : new Date(post.publishAt);
      scheduleEl.value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    } else {
      scheduleEl.value = "";
    }
  }

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
          <p style="margin:0;font-weight:800;font-size:14px;color:#111827">${escapeHTML(p.title)}</p>
          <p style="margin:4px 0;font-size:12px;color:#6b7280">
            ${escapeHTML(p.category) || "—"} · by ${escapeHTML(p.author) || "ZiBuy Team"} · 👁️ ${p.views || 0} views
          </p>
          <span class="plan-chip ${p.status === 'published' ? 'chip-approved' : p.status === 'scheduled' ? 'chip-pending' : 'chip-free'}">
            ${p.status === 'published' ? '✅ Published' : p.status === 'scheduled' ? `⏰ Scheduled — ${fmtDate(p.publishAt)}` : '📝 Draft'}
          </span>
        </div>

        <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
          <button class="action-btn btn-approve" onclick="editBlogPost('${p.id}')">✏️ Edit</button>
          ${p.status === 'published'
            ? `<button class="action-btn btn-reject" onclick="toggleBlogStatus('${p.id}','draft')">📥 Unpublish</button>`
            : `<button class="action-btn btn-approve" onclick="toggleBlogStatus('${p.id}','published')">🚀 Publish Now</button>`}
          <button class="action-btn btn-reject" onclick="deleteBlogPost('${p.id}')">🗑️ Delete</button>
        </div>
      </div>
    `).join("");

  } catch (err) {
    list.innerHTML = `<p style="color:red;text-align:center;padding:30px">Failed: ${err.message}</p>`;
  }
};

let _allActivityLogs = [];

async function loadAdminLogs() {
  const tableBody = document.getElementById("activity-table-body");
  if (!tableBody) return;

  tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:30px;color:#6b7280">Loading...</td></tr>`;

  try {
    const snap = await getDocs(
      query(
        collection(db, "function_logs"),
        orderBy("createdAt", "desc"),
        limit(200)
      )
    );

    _allActivityLogs = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      // Filter out silent dedup-lock documents (no type field = not a real event)
      .filter(d => d.type);

    renderActivityLogs(_allActivityLogs);

  } catch (err) {
    console.error(err);
    tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:30px;color:red">Failed to load logs</td></tr>`;
  }
}

function renderActivityLogs(logs) {
  const tableBody = document.getElementById("activity-table-body");
  if (!tableBody) return;

  if (logs.length === 0) {
    tableBody.innerHTML = `<tr class="empty-row"><td colspan="4">No activity found</td></tr>`;
    return;
  }

  tableBody.innerHTML = logs.map(data => {
    const date = data.createdAt?.toDate?.()?.toLocaleString() || "";
    return `
      <tr>
        <td style="font-size:12px">${date}</td>
        <td><span class="plan-chip chip-pending">${data.type || "event"}</span></td>
        <td style="font-size:12px">${data.admin || "-"}</td>
        <td style="font-size:12px">${data.details || "-"}</td>
      </tr>`;
  }).join("");
}

window.filterActivityLogs = function() {
  const val = document.getElementById("log-filter")?.value || "all";
  const filtered = val === "all"
    ? _allActivityLogs
    : _allActivityLogs.filter(d => d.type === val);
  renderActivityLogs(filtered);
};

window.loadAdminLogs = loadAdminLogs;

window.seedStarterBlogPosts = async function() {
  if (!confirm("This creates 20 starter blog posts — 1 published immediately, 19 pre-scheduled every 3 days after that. Continue?")) return;

  const btn = document.getElementById("seed-blog-btn");
  if (btn) { btn.textContent = "Seeding..."; btn.disabled = true; }

  const posts = [
    { category: "selling-tips", title: "How to Take Photos That Actually Sell Your Product",
      excerpt: "Good lighting and a clean background can double your views. Here's how to shoot photos buyers trust.",
      content: `## Why Photos Matter More Than You Think

On ZiBuy, your cover photo is the first thing a buyer sees in search results — before your price, before your title. A blurry or dark photo gets scrolled past in under a second.

### 3 Quick Fixes

- **Use natural light.** Shoot near a window during the day instead of using flash at night.
- **Clean, plain background.** A cluttered background distracts from the product itself.
- **Show it from multiple angles.** Front, back, close-up of any defects — buyers trust honesty.

### One Simple Rule

If you wouldn't stop scrolling for your own photo, a buyer won't either. Take 30 extra seconds — it's the cheapest way to sell faster.` },

    { category: "selling-tips", title: "Pricing Your Items Right on ZiBuy",
      excerpt: "Price too high and nobody clicks. Price too low and you lose money. Here's how to find the sweet spot.",
      content: `## Start With Research, Not Guessing

Before you price anything, search your exact item on ZiBuy and see what similar sellers are charging. If you have a Silver or Gold plan, your Analytics tab even shows you the category average directly.

### A Simple Pricing Approach

1. Find 3-5 similar listings
2. Note the average price
3. Price slightly below if your item has more wear, slightly above if it's in better condition or comes with extras

### Don't Be Afraid to Adjust

If a product sits with zero interest for a week, it's usually the price, not bad luck. Lowering it — and letting **Price Drop Alerts** notify buyers who already liked it — is often the fastest way to finally sell.` },

    { category: "selling-tips", title: "Writing Descriptions Buyers Actually Trust",
      excerpt: "Vague descriptions raise suspicion. Specific ones build confidence. Here's the difference.",
      content: `## Buyers Read Between the Lines

"Good condition, no issues" tells a buyer nothing — and on a marketplace, vague usually reads as hiding something.

### What to Include Instead

- **Exact condition**, including small flaws ("light scratch on the back, doesn't affect use")
- **Why you're selling** (upgrading, moving, no longer needed) — it's a small trust signal
- **What's included** (charger, box, accessories)

### The Golden Rule

Describe it the way you'd want it described if you were buying it. Honest listings get fewer questions in chat and close faster.` },

    { category: "selling-tips", title: "Boost vs Pin to Top: Which One Should You Use?",
      excerpt: "Both put your ad in front of more buyers — but for different situations. Here's how to choose.",
      content: `## Two Tools, Two Jobs

**Boost** keeps your ad featured for 7, 14, or 30 days — good for items you're in no rush to sell, where steady extra visibility matters most.

**Pin to Top** places your ad above everyone else — including boosted ads — for a short 24–48 hour burst. It's built for urgency: a price drop you want everyone to see today, or clearing stock fast.

### Quick Guide

- Selling something over weeks? → **Boost**
- Need it gone this weekend? → **Pin to Top**
- Want both? Many sellers boost for the month, then pin during the final push.` },

    { category: "selling-tips", title: "From One Ad to a Real Shop: When to Upgrade Your Plan",
      excerpt: "Free is great to start. Here's how to know when it's time for Bronze, Silver, or Gold.",
      content: `## Signs You've Outgrown Free

If you're regularly hitting your ad limit, deleting old listings just to post new ones, that's your clearest signal — it's costing you sales, not just convenience.

### What Upgrading Actually Unlocks

- **More ad slots** — post your full catalog instead of a fraction of it
- **Silver & Gold** include automatic seller verification — buyers see that badge instantly
- **Analytics** — know exactly which products and categories are working

### A Simple Test

If the extra ad slots alone would let you post even 2-3 more items a month, the plan usually pays for itself in the first sale.` },

    { category: "buying-guide", title: "How to Spot a Trustworthy Seller on ZiBuy",
      excerpt: "Before you message a seller, these signals tell you a lot about who you're dealing with.",
      content: `## Look Past the Product — Look at the Seller

Every product page shows more than a price. Check the seller's badges before you commit.

### What to Check

- **Trust Score & Tier** — 🥇 Gold or 💎 Elite means a strong track record
- **📱 Phone Verified** and **✅ Verified Seller** badges
- **Response rate** — "usually replies within 1 hour" tells you they're active
- **Star rating and review count** — a handful of genuine reviews beats zero

### One More Tip

A seller with a full shop page — logo, description, multiple listings — is almost always more established than a bare, single-ad account.` },

    { category: "buying-guide", title: "Paying With MTN and Airtel Mobile Money on ZiBuy",
      excerpt: "A simple walkthrough of how payment works when you tap Buy Now.",
      content: `## It's Simpler Than It Looks

When you tap **Buy Now**, ZiBuy shows you a merchant code (MTN) or number (Airtel) along with a unique order reference.

### The Steps

1. Dial the Mobile Money code shown on your screen
2. Enter the exact amount displayed
3. Enter your PIN to confirm
4. Copy the transaction ID from your phone
5. Paste it into ZiBuy and tap "I've Paid"

Your reference and transaction ID are sent straight to the seller via WhatsApp — so they know it's really you, and can start preparing your order immediately.` },

    { category: "buying-guide", title: "What Is ZiBuy Protect, and Should You Use It?",
      excerpt: "A small optional fee that gives you a real say if something goes wrong with your order.",
      content: `## The Short Version

ZiBuy Protect adds a small fee at checkout. In exchange, your order isn't automatically considered "done" the moment you pay — **you** confirm it once the item actually arrives.

### If Something's Wrong

Instead of confirming, you tap **"Report a Problem"** right from your dashboard. Our team reviews it as a real dispute — not just a complaint lost in a chat.

### When It's Worth It

For low-value items from a seller you already trust, it's optional. For higher-value purchases, or a seller you're buying from for the first time, it's cheap peace of mind.` },

    { category: "buying-guide", title: "Buying a Used Phone Safely in Uganda",
      excerpt: "Phones are one of the most popular — and most risky — categories. Here's how to buy smart.",
      content: `## Before You Pay

Ask the seller directly: **is the phone unlocked, and does it have a receipt or proof of purchase?** A hesitant answer is worth noting.

### Checklist Before Confirming

- IMEI number matches what's on the box (ask for it)
- Battery health, if the seller can share it
- Screen, buttons, and charging port all tested on a call or video
- Check the seller's Trust Score and reviews specifically for phone sales

### Our Advice

For phones especially, ZiBuy Protect is worth the small fee — it gives you a real window to confirm everything works before the order is final.` },

    { category: "buying-guide", title: "How to Negotiate Politely and Still Get a Good Price",
      excerpt: "You can absolutely negotiate on ZiBuy — here's how to do it in a way sellers actually respond to.",
      content: `## Start the Conversation Right

Messaging "is this your final price?" opens the door without pressuring anyone. Sellers respond far better to polite, direct questions than lowball offers with no context.

### What Works

- Mention *why* — "I found a similar one for less, could you match it?"
- Offer to buy sooner or pay in full upfront as your leverage
- Be willing to walk away respectfully if the answer is no

### Remember

A good rating from the seller matters to them too — buyers who negotiate respectfully tend to get better deals over time, not just once.` },

    { category: "safety", title: "5 Red Flags to Watch For When Buying Online",
      excerpt: "Most bad deals show warning signs early — if you know what to look for.",
      content: `## Trust Your Gut, But Verify Too

### The 5 Signs

1. **Price far below market** — if it seems too good to be true, ask why directly
2. **Seller avoids ZiBuy chat**, pushing you to WhatsApp immediately with no ad history
3. **Refuses any form of verification** or gets defensive when asked simple questions
4. **New account, zero reviews, high-value item** — not disqualifying alone, but worth extra caution
5. **Pressure to pay instantly** with no room for questions

### What To Do

None of these alone mean a scam — but two or more together is a real reason to slow down, or simply choose a different seller with a stronger track record.` },

    { category: "safety", title: "How ZiBuy's Trust Score Actually Works",
      excerpt: "It's not random — here's exactly what goes into a seller's score, and why it matters.",
      content: `## What Actually Feeds the Score

A seller's Trust Score (0–100) is calculated from real, verifiable signals:

- Phone verification status
- ID verification approval
- Average rating and number of genuine reviews
- Buyer ratings received (yes, sellers can be rated too)
- Account age

### The Tiers

🌱 New → 🥉 Bronze → 🥈 Silver → 🥇 Gold → 💎 Elite

### Why It Can't Be Gamed

The score recalculates automatically the moment any of these change — it can't be bought, and a seller who stops delivering good service will see their tier drop over time, not just rise once and stay there forever.` },

    { category: "safety", title: "What to Do If a Deal Feels Wrong",
      excerpt: "Trust your instincts — here's exactly what to do, step by step, if something feels off.",
      content: `## Don't Ignore the Feeling

If a conversation feels pressured, evasive, or just off, you're allowed to slow down or stop entirely — no explanation needed to the seller.

### Your Options, In Order

1. **Ask more questions** in ZiBuy chat — a genuine seller won't mind
2. **Check their profile** — reviews, verification, response rate
3. **Report the seller** directly from the product page if something feels genuinely wrong
4. **If you already paid with ZiBuy Protect**, raise a dispute from your dashboard immediately

### Remember

Reporting doesn't require proof of a scam — flagging a bad feeling helps our team catch patterns before someone else gets hurt.` },

    { category: "safety", title: "Meeting a Buyer or Seller in Person: A Safety Checklist",
      excerpt: "For local pickups and cash deals, a few simple habits make a big difference.",
      content: `## Before You Go

- Meet in a public place — a mall, market, or busy street, never somewhere isolated
- Tell a friend or family member where you're going, and roughly when you'll be back
- If possible, meet during daylight hours

### During the Meeting

- Inspect the item fully before handing over payment
- Count cash carefully, or confirm Mobile Money before parting with the item
- Trust your instincts — if anything feels wrong, it's okay to leave

### After

A quick review of the seller or buyer — good or bad — helps the next person make a safer decision too.` },

    { category: "news", title: "Introducing ZiBuy Protect: Buy With Confidence",
      excerpt: "Our newest feature gives buyers real assurance on every purchase — here's how it works.",
      content: `## A New Way to Buy Safely

We've just launched **ZiBuy Protect** — an optional protection fee at checkout that puts real control in the buyer's hands.

### How It Works

Instead of an order being "done" the moment you pay, you confirm receipt yourself — or raise a dispute if something's wrong, reviewed directly by our team.

### Why We Built It

Trust is the biggest thing standing between a buyer and clicking "Buy Now." ZiBuy Protect is our answer — a real safety net, not just a promise.

Look for the 🛡️ shield toggle the next time you check out.` },

    { category: "news", title: "Real-Time Chat Has Arrived on ZiBuy",
      excerpt: "No more refreshing to see if a seller replied. Messages now appear instantly.",
      content: `## Faster Conversations, Faster Sales

Messaging on ZiBuy just got a major upgrade — conversations now update **instantly**, with read receipts so you know the moment your message has been seen.

### What's New

- Messages appear live, no refresh needed
- Blue double-checkmarks show when a message has been read
- Your conversation list updates automatically as new messages arrive

Faster replies mean faster deals — try it out in your Messages tab today.` },

    { category: "news", title: "New: Compare Products Side by Side Before You Buy",
      excerpt: "Torn between two similar listings? Now you can view them side by side before deciding.",
      content: `## Decisions Made Easier

Choosing between two or three similar products used to mean opening multiple tabs. Not anymore.

### How to Use It

From any product page, tap **"Compare"** on up to 3 related items — price, condition, and photos appear side by side instantly, right on your screen.

### Why We Added This

Buyers shouldn't have to choose blind. This feature is live now on every product page — look for the compare checkbox under "You Might Also Like."` },

    { category: "success-stories", title: "From Side Hustle to Full-Time Shop: A ZiBuy Seller's Story",
      excerpt: "What started as a way to clear out old clothes turned into a real business.",
      content: `## Small Beginnings

Like many sellers, it started with a handful of items posted just to make some quick cash. A few sales turned into steady demand.

### The Turning Point

Upgrading from Free to a paid plan meant posting more items at once — and unlocking a proper shop page gave the business a real identity buyers could recognize and return to.

### The Lesson

Consistency mattered more than any single boost or promotion. Regular posting, honest photos, and quick replies built the kind of reputation that keeps buyers coming back.` },

    { category: "success-stories", title: "How One Kampala Electronics Seller Doubled Views With Boosts",
      excerpt: "A simple change in strategy made a measurable difference in traffic.",
      content: `## The Problem

Ads were getting posted regularly, but views stayed flat — buried under newer listings within a day or two.

### What Changed

Switching to **Boost** on the top 3 best-performing items, rather than spreading a small budget thin across everything, made the real difference — those specific ads stayed visible for weeks instead of hours.

### The Result

Focused boosting on proven sellers, rather than boosting everything equally, turned out to be the more effective approach — a lesson worth trying for any seller with a mixed catalog.` },

    { category: "success-stories", title: "Selling Farm Produce Online: A First-Time Seller's Experience",
      excerpt: "Moving from selling only at the local market to reaching buyers across the region.",
      content: `## Starting From Scratch

Listing agricultural products for the first time meant learning what buyers actually wanted to see — clear photos of the produce itself, honest quantities, and real pickup locations.

### What Worked

Being upfront about harvest dates and freshness built trust quickly with first-time buyers — and positive reviews from those early sales made every listing afterward easier to sell.

### Advice for Other First-Timers

Don't wait for the "perfect" first listing. Post honestly, respond quickly, and let your reviews do the convincing over time.` }
  ];

  try {
    const now = new Date();

    for (let i = 0; i < posts.length; i++) {
      const p = posts[i];
      const slug = p.title.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");

      const isFirst = i === 0;
      const publishAt = new Date(now.getTime() + i * 3 * 86400000); // every 3 days apart

      await addDoc(collection(db, "blog_posts"), {
        title: p.title,
        slug,
        category: p.category,
        author: "ZiBuy Team",
        excerpt: p.excerpt,
        content: p.content,
        coverImage: "",
        status: isFirst ? "published" : "scheduled",
        publishAt: isFirst ? null : publishAt,
        publishedAt: isFirst ? new Date() : null,
        views: 0,
        createdAt: new Date()
      });
    }

    showToast(`✅ Seeded 20 posts — 1 live now, 19 scheduled every 3 days`, "success");
    loadBlogAdmin();

  } catch (err) {
    console.error("seedStarterBlogPosts error:", err);
    showToast("Failed: " + err.message, "error");
  } finally {
    if (btn) { btn.textContent = "🌱 Seed 20 Starter Posts"; btn.disabled = false; }
  }
};

// ══════════════════════════════════════════════
//  EDIT ANY AD (Admin)
// ══════════════════════════════════════════════
window.adminEditAd = async function(adId) {
  const ad = allAds.find(a => a.id === adId);
  if (!ad) return;

  const newName  = prompt("Product name:", ad.name || "");
  if (newName === null) return;

  const newPrice = prompt("Price (UGX):", ad.price || "");
  if (newPrice === null) return;

  const newDesc  = prompt("Description:", ad.description || "");
  if (newDesc === null) return;

  try {
    await updateDoc(doc(db, "products", adId), {
      name:        newName.trim(),
      price:       Number(newPrice),
      description: newDesc.trim(),
      updatedAt:   new Date()
    });
    showToast("Ad updated ✅", "success");
    loadAds();
  } catch(e) {
    showToast("Failed: " + e.message, "error");
  }
};


window.adminToggleAdStatus = async function(adId, currentStatus) {
  const newStatus = currentStatus === "active" ? "sold" : "active";
  if (!confirm(`Mark this ad as ${newStatus}?`)) return;
  try {
    await updateDoc(doc(db, "products", adId), {
      status:    newStatus,
      updatedAt: new Date()
    });
    showToast(`Ad marked as ${newStatus}`, "info");
    loadAds();
  } catch(e) {
    showToast("Failed", "error");
  }
};


// ══════════════════════════════════════════════
//  REVIEWS MANAGEMENT
// ══════════════════════════════════════════════
window.loadReviewsAdmin = async function() {
  const tbody = document.getElementById("reviews-admin-table-body");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:#6b7280">Loading...</td></tr>`;

  try {
    const snap = await getDocs(collection(db, "reviews"));
    const reviews = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));

    if (reviews.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:#6b7280">No reviews</td></tr>`;
      return;
    }

    tbody.innerHTML = reviews.map(r => `
      <tr>
        <td style="font-size:12px">${r.reviewerEmail || "—"}</td>
        <td style="font-size:12px">${r.productId?.slice(0,12) || "—"}</td>
        <td style="font-weight:800;color:#ff6600">${"⭐".repeat(Math.min(r.rating || 0, 5))} ${r.rating}/5</td>
        <td style="font-size:13px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.text || r.reviewText || "—"}</td>
        <td style="font-size:12px">${fmtDate(r.createdAt)}</td>
        <td>
          <button class="action-btn btn-reject" onclick="adminDeleteReview('${r.id}','${r.productId}','${r.sellerId}')">🗑️ Delete</button>
        </td>
      </tr>`).join("");

  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:red;padding:20px">Failed: ${e.message}</td></tr>`;
  }
};

window.adminDeleteReview = async function(reviewId, productId, sellerId) {
  if (!confirm("Delete this review permanently?")) return;
  try {
    await deleteDoc(doc(db, "reviews", reviewId));

    // Recalculate seller rating after deletion
    if (sellerId) {
      const remaining = await getDocs(query(
        collection(db, "reviews"),
        where("sellerId", "==", sellerId)
      ));
      let total = 0;
      let count = 0;
      remaining.forEach(d => { total += Number(d.data().rating || 0); count++; });
      const avg = count > 0 ? parseFloat((total / count).toFixed(1)) : 0;
      await updateDoc(doc(db, "shops", sellerId), { avgRating: avg, reviewCount: count }).catch(() => {});
      await updateDoc(doc(db, "business_profiles", sellerId), { avgRating: avg, reviewCount: count }).catch(() => {});
    }

    showToast("Review deleted ✅", "info");
    loadReviewsAdmin();
  } catch(e) {
    showToast("Failed: " + e.message, "error");
  }
};


// ══════════════════════════════════════════════
//  ORDER DETAIL VIEW
// ══════════════════════════════════════════════
window.viewOrderDetail = function(orderId) {
  const order = allOrders.find(o => o.id === orderId);
  if (!order) return;

  const modal = document.createElement("div");
  modal.id = "admin-order-detail-modal";
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px`;
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  modal.innerHTML = `
    <div style="background:white;border-radius:20px;padding:28px;max-width:500px;width:100%;max-height:90vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h2 style="margin:0;font-size:18px;font-weight:800">📦 Order ${order.orderId}</h2>
        <button onclick="document.getElementById('admin-order-detail-modal').remove()"
          style="background:#f3f4f6;border:none;width:32px;height:32px;border-radius:50%;font-size:18px;cursor:pointer">×</button>
      </div>
      <div style="background:#f9fafb;border-radius:12px;padding:14px;margin-bottom:14px">
        <p style="margin:0 0 6px;font-size:13px"><strong>Customer:</strong> ${escapeHTML(order.customerName) || "—"}</p>
        <p style="margin:0 0 6px;font-size:13px"><strong>Phone:</strong> ${escapeHTML(order.customerPhone) || "—"}</p>
        <p style="margin:0 0 6px;font-size:13px"><strong>Email:</strong> ${escapeHTML(order.userEmail || order.buyerEmail) || "—"}</p>
        <p style="margin:0 0 6px;font-size:13px"><strong>Location:</strong> ${escapeHTML(order.customerLocation || order.deliveryAddress) || "—"}</p>
        <p style="margin:0 0 6px;font-size:13px"><strong>Payment:</strong> ${order.paymentMethod || "—"}</p>
        <p style="margin:0 0 6px;font-size:13px"><strong>Total:</strong> <span style="color:#ff6600;font-weight:800">UGX ${Number(order.total || 0).toLocaleString()}</span></p>
        <p style="margin:0;font-size:13px"><strong>Status:</strong> ${order.status}</p>
      </div>
      <h3 style="font-size:14px;font-weight:800;margin-bottom:8px">Items:</h3>
      ${(order.items || []).map(item => `
        <div style="display:flex;justify-content:space-between;padding:8px;background:#f9fafb;border-radius:8px;margin-bottom:6px;font-size:13px">
          <span>${escapeHTML(item.name)} × ${item.qty}</span>
          <span style="font-weight:700;color:#ff6600">UGX ${Number(item.price * item.qty).toLocaleString()}</span>
        </div>`).join("") || "<p style='color:#6b7280;font-size:13px'>No items recorded</p>"}
      ${order.customerPhone ? `
        <a href="https://wa.me/${order.customerPhone.replace(/\D/g,"")}?text=${encodeURIComponent("Hello "+order.customerName+", your ZiBuy order "+order.orderId+" update:")}"
          target="_blank"
          style="display:block;margin-top:14px;background:#25d366;color:white;padding:12px;border-radius:10px;text-align:center;font-weight:800;text-decoration:none">
          💬 Contact Customer on WhatsApp
        </a>` : ""}
    </div>
  `;
  document.body.appendChild(modal);
};


// ══════════════════════════════════════════════
//  FORCE EXPIRE AD
// ══════════════════════════════════════════════
window.adminForceExpireAd = async function(adId) {
  if (!confirm("Force expire this ad now? It will be hidden from buyers.")) return;
  try {
    await updateDoc(doc(db, "products", adId), {
      status:    "expired",
      expiresAt: new Date(),
      updatedAt: new Date()
    });
    showToast("Ad expired", "info");
    loadAds();
  } catch(e) {
    showToast("Failed", "error");
  }
};


window.adminViewUserAds = async function(userId, email) {
  try {
    const snap = await getDocs(query(
      collection(db, "products"),
      where("userId", "==", userId)
    ));

    const ads = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const modal = document.createElement("div");
    modal.id = "admin-user-ads-modal";
    modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px`;
    // Click on the dark background itself also closes it — safety net
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
      <div style="background:white;border-radius:20px;padding:24px;max-width:560px;width:100%;max-height:90vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;margin-bottom:16px">
          <h2 style="margin:0;font-size:16px;font-weight:800">📋 ${email} — ${ads.length} Ads</h2>
          <button onclick="document.getElementById('admin-user-ads-modal').remove()"
            style="background:#f3f4f6;border:none;width:32px;height:32px;border-radius:50%;font-size:18px;cursor:pointer">×</button>
        </div>
        ${ads.length === 0 ? `<p style="color:#6b7280;text-align:center;padding:20px">No ads posted yet</p>` :
          ads.map(a => `
            <div style="display:flex;gap:12px;padding:10px;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:8px">
              <img src="${a.images?.[0] || ''}" style="width:50px;height:50px;object-fit:cover;border-radius:8px;background:#f3f4f6;flex-shrink:0">
              <div style="flex:1">
                <p style="margin:0;font-weight:700;font-size:13px">${escapeHTML(a.name)}</p>
                <p style="margin:2px 0;font-size:12px;color:#ff6600;font-weight:800">UGX ${Number(a.price||0).toLocaleString()}</p>
                <span style="font-size:11px;background:${a.status==='active'?'#dcfce7':'#fee2e2'};color:${a.status==='active'?'#16a34a':'#ef4444'};padding:2px 7px;border-radius:20px;font-weight:700">${a.status}</span>
              </div>
              <div style="display:flex;flex-direction:column;gap:4px">
                <a href="product.html?id=${a.id}" target="_blank"
                  style="background:#f3f4f6;color:#111827;padding:5px 8px;border-radius:7px;font-size:11px;font-weight:700;text-decoration:none;text-align:center">View</a>
                <button onclick="if(confirm('Delete?')){deleteDoc(doc(db,'products','${a.id}')).then(()=>{showToast('Deleted','info');document.getElementById('admin-user-ads-modal')?.remove()})}"
                  style="background:#fee2e2;color:#ef4444;border:none;padding:5px 8px;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer">Del</button>
              </div>
            </div>`).join("")}
      </div>
    `;
    document.body.appendChild(modal);
  } catch(e) {
    showToast("Failed: " + e.message, "error");
  }
};


window.adminViewUserOrders = async function(userId, email) {
  try {
    const snap = await getDocs(query(
      collection(db, "orders"),
      where("userEmail", "==", email)
    ));

    const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const modal = document.createElement("div");
    modal.id = "admin-user-orders-modal";
    modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px`;
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
      <div style="background:white;border-radius:20px;padding:24px;max-width:560px;width:100%;max-height:90vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;margin-bottom:16px">
          <h2 style="margin:0;font-size:16px;font-weight:800">🛍️ ${email} — ${orders.length} Orders</h2>
          <button onclick="document.getElementById('admin-user-orders-modal').remove()"
            style="background:#f3f4f6;border:none;width:32px;height:32px;border-radius:50%;font-size:18px;cursor:pointer">×</button>
        </div>
        ${orders.length === 0 ? `<p style="color:#6b7280;text-align:center;padding:20px">No orders yet</p>` :
          orders.map(o => `
            <div style="padding:12px;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:8px;font-size:13px">
              <div style="display:flex;justify-content:space-between">
                <strong>${escapeHTML(o.orderId) || o.id.slice(0,10)}</strong>
                <span class="plan-chip ${chipClass(o.status)}">${o.status}</span>
              </div>
              <p style="margin:4px 0;color:#6b7280">UGX ${Number(o.total||0).toLocaleString()} · ${o.paymentMethod || "—"}</p>
              <p style="margin:0;font-size:11px;color:#9ca3af">${fmtDate(o.createdAt)}</p>
            </div>`).join("")}
      </div>
    `;
    document.body.appendChild(modal);
  } catch(e) {
    showToast("Failed: " + e.message, "error");
  }
};


// ══════════════════════════════════════════════
//  CLEAR USER NOTIFICATIONS
// ══════════════════════════════════════════════
window.clearUserNotifications = async function(userId) {
  if (!confirm("Clear ALL notifications for this user?")) return;
  try {
    const snap = await getDocs(query(
      collection(db, "notifications"),
      where("userId", "==", userId)
    ));
    await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "notifications", d.id))));
    showToast(`Cleared ${snap.size} notifications`, "info");
  } catch(e) {
    showToast("Failed", "error");
  }
};


// ══════════════════════════════════════════════
//  MESSAGE MODERATION
// ══════════════════════════════════════════════
window.loadMessagesAdmin = async function() {
  const container = document.getElementById("messages-admin-list");
  if (!container) return;
  container.innerHTML = `<p style="text-align:center;padding:30px;color:#6b7280">Loading...</p>`;

  try {
    const snap = await getDocs(collection(db, "messages"));
    const messages = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.timestamp?.toDate?.() || 0) - (a.timestamp?.toDate?.() || 0))
      .slice(0, 200);

    if (messages.length === 0) {
      container.innerHTML = `<p style="text-align:center;padding:30px;color:#6b7280">No messages</p>`;
      return;
    }

    container.innerHTML = messages.map(m => `
      <div style="padding:12px;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:8px;font-size:13px">
        <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
          <span style="font-weight:700">${escapeHTML(m.senderEmail) || "—"} → ${escapeHTML((m.participants||[]).find(p=>p!==m.senderEmail)) || "—"}</span>
          <span style="color:#9ca3af;font-size:11px">${fmtDate(m.timestamp)}</span>
        </div>
        <p style="margin:6px 0;color:#374151">${escapeHTML(m.text)}</p>
        <button class="action-btn btn-reject" onclick="adminDeleteMessage('${m.id}')">🗑️ Delete Message</button>
      </div>`).join("");

  } catch(e) {
    container.innerHTML = `<p style="color:red;padding:20px">Failed: ${e.message}</p>`;
  }
};

window.searchMessagesByUser = async function() {
  const email = document.getElementById("messages-search-email")?.value.trim().toLowerCase();
  if (!email) { loadMessagesAdmin(); return; }

  const container = document.getElementById("messages-admin-list");
  container.innerHTML = `<p style="text-align:center;padding:30px;color:#6b7280">Searching...</p>`;

  try {
    const snap = await getDocs(query(
      collection(db, "messages"),
      where("participants", "array-contains", email)
    ));

    const messagesData = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.timestamp?.toDate?.() || 0) - (a.timestamp?.toDate?.() || 0));

    if (messagesData.length === 0) {
      container.innerHTML = `<p style="text-align:center;color:#6b7280;padding:30px">No messages found for ${escapeHTML(email)}</p>`;
      return;
    }

    container.innerHTML = messagesData.map(m => `
      <div style="padding:12px;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:8px;font-size:13px">
        <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
          <span style="font-weight:700">${escapeHTML(m.senderEmail) || "—"} → ${escapeHTML((m.participants||[]).find(p=>p!==m.senderEmail)) || "—"}</span>
          <span style="color:#9ca3af;font-size:11px">${fmtDate(m.timestamp)}</span>
        </div>
        <p style="margin:6px 0;color:#374151">${escapeHTML(m.text)}</p>
        <button class="action-btn btn-reject" onclick="adminDeleteMessage('${m.id}')">🗑️ Delete Message</button>
      </div>`).join("");
  } catch(e) {
    container.innerHTML = `<p style="color:red;padding:20px">Failed: ${e.message}</p>`;
  }
};

window.adminDeleteMessage = async function(messageId) {
  if (!confirm("Delete this message permanently?")) return;
  try {
    await deleteDoc(doc(db, "messages", messageId));
    showToast("Message deleted", "info");
    loadMessagesAdmin();
  } catch(e) {
    showToast("Failed", "error");
  }
};


// ══════════════════════════════════════════════
//  BUYER RATINGS MODERATION
// ══════════════════════════════════════════════
window.loadBuyerRatingsAdmin = async function() {
  const tbody = document.getElementById("buyer-ratings-table-body");
  if (!tbody) return;

  try {
    const snap = await getDocs(collection(db, "buyer_ratings"));
    const ratings = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));

    if (ratings.length === 0) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="5">No buyer ratings yet</td></tr>`;
      return;
    }

    tbody.innerHTML = ratings.map(r => `
      <tr>
        <td style="font-size:12px">${escapeHTML(r.sellerEmail) || "—"}</td>
        <td style="font-size:12px">${r.buyerId?.slice(0,10) || "—"}</td>
        <td style="font-weight:800;color:#ff6600">${"⭐".repeat(Math.min(r.rating||0,5))} ${r.rating}/5</td>
        <td style="font-size:13px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(r.text) || "—"}</td>
        <td><button class="action-btn btn-reject" onclick="adminDeleteBuyerRating('${r.id}','${r.buyerId}')">🗑️ Delete</button></td>
      </tr>`).join("");

  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="5" style="color:red">Failed: ${e.message}</td></tr>`;
  }
};

window.adminDeleteBuyerRating = async function(ratingId, buyerId) {
  if (!confirm("Delete this buyer rating? This recalculates the buyer's average.")) return;
  try {
    await deleteDoc(doc(db, "buyer_ratings", ratingId));

    const remaining = await getDocs(query(collection(db, "buyer_ratings"), where("buyerId", "==", buyerId)));
    let total = 0, count = 0;
    remaining.forEach(d => { total += Number(d.data().rating || 0); count++; });
    const avg = count > 0 ? parseFloat((total/count).toFixed(1)) : 0;
    await updateDoc(doc(db, "users", buyerId), { buyerRating: avg, buyerRatingCount: count }).catch(()=>{});

    showToast("Rating deleted ✅", "info");
    loadBuyerRatingsAdmin();
  } catch(e) {
    showToast("Failed: " + e.message, "error");
  }
};


// ══════════════════════════════════════════════
//  FREE BOOST / PIN (Admin promo grant — bypasses payment)
// ══════════════════════════════════════════════
window.grantFreeBoost = async function(productId, productName) {
  const customDays = prompt("Boost duration in days:", "7");
  if (!customDays) return;

  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + Number(customDays));

    await updateDoc(doc(db, "products", productId), {
      isPremium:        true,
      premiumExpiresAt: expiresAt,
      boostApprovedAt:  new Date(),
      boostExpiresAt:   expiresAt
    });

    await addDoc(collection(db, "boost_requests"), {
      productId, productName,
      status:      "approved",
      days:        Number(customDays),
      price:       0,
      approvedAt:  new Date(),
      approvedBy:  "admin_free_grant",
      requestedAt: new Date()
    });

    showToast(`✅ Free ${customDays}-day boost granted`, "success");
    loadAds();
  } catch(e) {
    showToast("Failed: " + e.message, "error");
  }
};

window.grantFreePin = async function(productId) {
  const customHours = prompt("Pin duration in hours:", "24");
  if (!customHours) return;

  try {
    const pinnedUntil = new Date(Date.now() + Number(customHours) * 3600000);
    await updateDoc(doc(db, "products", productId), { pinnedUntil });
    showToast(`✅ Pinned to top for ${customHours}h`, "success");
    loadAds();
  } catch(e) {
    showToast("Failed: " + e.message, "error");
  }
};

// ══════════════════════════════════════════════
//  DATA EXPORT (CSV)
// ══════════════════════════════════════════════
function downloadCSV(filename, rows) {
  if (!rows.length) { showToast("Nothing to export", "info"); return; }

  const headers  = Object.keys(rows[0]);
  const csvLines = [
    headers.join(","),
    ...rows.map(row =>
      headers.map(h => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(",")
    )
  ];

  const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

window.exportUsersCSV = function() {
  const rows = allUsers.map(u => ({
    email: u.email || "", plan: u.plan || "free", phone: u.phone || "",
    verified: u.isSellerVerified ? "yes" : "no", banned: u.banned ? "yes" : "no",
    buyerRating: u.buyerRating || "", joined: fmtDate(u.createdAt)
  }));
  downloadCSV(`zibuy-users-${Date.now()}.csv`, rows);
};

window.exportOrdersCSV = function() {
  const rows = allOrders.map(o => ({
    orderId: o.orderId || "", customer: o.customerName || "", phone: o.customerPhone || "",
    email: o.userEmail || o.buyerEmail || "", total: o.total || 0,
    paymentMethod: o.paymentMethod || "", status: o.status || "", date: fmtDate(o.createdAt)
  }));
  downloadCSV(`zibuy-orders-${Date.now()}.csv`, rows);
};


// ══════════════════════════════════════════════
//  MAINTENANCE MODE
// ══════════════════════════════════════════════
window.loadMaintenanceStatus = async function() {
  const toggle   = document.getElementById("maintenance-toggle");
  const msgInput = document.getElementById("maintenance-message");
  if (!toggle) return;

  try {
    const snap = await getDoc(doc(db, "system_config", "maintenance"));
    const data = snap.exists() ? snap.data() : { enabled: false, message: "" };
    toggle.checked = !!data.enabled;
    if (msgInput) msgInput.value = data.message || "ZiBuy is undergoing scheduled maintenance. We'll be back shortly.";
  } catch(e) { console.warn(e); }
};

window.toggleMaintenanceMode = async function() {
  const toggle  = document.getElementById("maintenance-toggle");
  const enabled = toggle.checked;
  const message = document.getElementById("maintenance-message")?.value.trim()
    || "ZiBuy is undergoing scheduled maintenance. We'll be back shortly.";

  if (enabled && !confirm("Enable maintenance mode? This blocks ALL non-admin users from using the site.")) {
    toggle.checked = false;
    return;
  }

  try {
    await setDoc(doc(db, "system_config", "maintenance"), {
      enabled, message, updatedAt: new Date(), updatedBy: ADMIN_EMAIL
    });
    showToast(enabled ? "🔴 Maintenance mode ON" : "🟢 Maintenance mode OFF", enabled ? "error" : "success");
  } catch(e) {
    showToast("Failed: " + e.message, "error");
  }
};

// ══════════════════════════════════════════════
//  LIVE ADMIN ALERTS FEED
// ══════════════════════════════════════════════
window.loadAdminAlerts = async function() {
  const list = document.getElementById("admin-alerts-list");
  if (!list) return;

  try {
    const snap = await getDocs(collection(db, "admin_alerts"));
    const alerts = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0))
      .slice(0, 100);

    if (alerts.length === 0) {
      list.innerHTML = `<p style="text-align:center;color:#6b7280;padding:30px">No alerts yet</p>`;
      return;
    }

    const icons = { order: "🛍️", payment: "💰", notification: "🔔" };

    list.innerHTML = alerts.map(a => `
      <div style="display:flex;gap:12px;padding:12px;border-bottom:1px solid #f0f0f0;${a.read ? "opacity:.6" : ""}">
        <span style="font-size:20px;flex-shrink:0">${icons[a.type] || "📌"}</span>
        <div style="flex:1">
          <p style="margin:0;font-weight:800;font-size:13px;color:#111827">${a.title}</p>
          <p style="margin:3px 0 0;font-size:12px;color:#6b7280">${a.message}</p>
          <p style="margin:3px 0 0;font-size:11px;color:#9ca3af">${fmtDate(a.createdAt)}</p>
        </div>
        ${!a.read ? `<button onclick="markAlertRead('${a.id}')" style="background:#f3f4f6;border:none;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;height:fit-content">Mark Read</button>` : ""}
      </div>`).join("");

  } catch(e) {
    list.innerHTML = `<p style="color:red;padding:20px">Failed: ${e.message}</p>`;
  }
};

window.markAlertRead = async function(alertId) {
  try {
    await updateDoc(doc(db, "admin_alerts", alertId), { read: true });
    loadAdminAlerts();
  } catch(e) { showToast("Failed", "error"); }
};

window.clearAllAdminAlerts = async function() {
  if (!confirm("Clear all read alerts older than 7 days?")) return;
  try {
    const cutoff = new Date(Date.now() - 7 * 86400000);
    const snap = await getDocs(query(collection(db, "admin_alerts"), where("read", "==", true)));
    const toDelete = snap.docs.filter(d => (d.data().createdAt?.toDate?.() || new Date()) < cutoff);
    await Promise.all(toDelete.map(d => deleteDoc(doc(db, "admin_alerts", d.id))));
    showToast(`Cleared ${toDelete.length} old alerts`, "info");
    loadAdminAlerts();
  } catch(e) { showToast("Failed", "error"); }
};


// ══════════════════════════════════════════════
//  DISPUTES
// ══════════════════════════════════════════════
window.loadDisputesAdmin = async function() {
  const tbody = document.getElementById("disputes-table-body");
  if (!tbody) return;

  try {
    const snap = await getDocs(collection(db, "disputes"));
    const disputes = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));

    if (disputes.length === 0) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No disputes</td></tr>`;
      return;
    }

    tbody.innerHTML = disputes.map(d => `
      <tr>
        <td style="font-weight:700;font-size:13px">${escapeHTML(d.productName)}</td>
        <td style="font-size:12px">${escapeHTML(d.buyerEmail)}</td>
        <td><span class="plan-chip chip-rejected">${escapeHTML(d.reason)}</span></td>
        <td style="font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(d.details)}</td>
        <td><span class="plan-chip ${d.status === 'resolved' ? 'chip-approved' : 'chip-pending'}">${d.status}</span></td>
        <td>
          ${d.status !== "resolved" ? `
            <button class="action-btn btn-approve" onclick="resolveDispute('${d.id}','${d.orderId}')">✅ Resolve — Buyer Wins</button>
            <button class="action-btn btn-reject" onclick="dismissDispute('${d.id}','${d.orderId}')">✗ Dismiss</button>
          ` : "—"}
        </td>
      </tr>`).join("");

  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:red">Failed: ${e.message}</td></tr>`;
  }
};

window.resolveDispute = async function(disputeId, orderId) {
  if (!confirm("Mark resolved in buyer's favor? This does NOT auto-refund — arrange that manually with the seller.")) return;
  try {
    await updateDoc(doc(db, "disputes", disputeId), { status: "resolved", resolution: "buyer_favor", resolvedAt: new Date() });
    if (orderId) {
      await updateDoc(doc(db, "orders", orderId), { disputeStatus: "resolved_buyer_favor" });
    }
    showToast("Dispute resolved", "success");
    loadDisputesAdmin();
  } catch(e) { showToast("Failed", "error"); }
};

window.dismissDispute = async function(disputeId, orderId) {
  if (!confirm("Dismiss this dispute?")) return;
  try {
    await updateDoc(doc(db, "disputes", disputeId), { status: "resolved", resolution: "dismissed", resolvedAt: new Date() });
    if (orderId) {
      await updateDoc(doc(db, "orders", orderId), { disputeStatus: "dismissed" });
    }
    showToast("Dispute dismissed", "info");
    loadDisputesAdmin();
  } catch(e) { showToast("Failed", "error"); }
};


window.adminForceTrustRecalc = async function(userId) {
  try {
    const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js");
    const fn = httpsCallable(getFunctions(), "adminRecalculateTrustScore");
    await fn({ userId });
    logAdminAction("TRUST_SCORE_RECALCULATED", `User ID: ${userId}`);
    showToast("Trust score recalculated ✅", "success");
    loadUsers();
  } catch (e) {
    showToast("Failed: " + e.message, "error");
  }
};



async function checkSystemHealth() {
  const el = document.getElementById("system-health");
  if (!el) return;

  el.innerHTML = `<p style="color:var(--gray)">Checking...</p>`;
  const results = [];

  // Firestore — a real timed read, not a guess
  try {
    const start = performance.now();
    await getDocs(query(collection(db, "users"), limit(1)));
    const ms = Math.round(performance.now() - start);
    results.push(`<p>Firestore: ✅ Online <span style="color:#9ca3af;font-size:11px">(${ms}ms)</span></p>`);
  } catch(e) {
    results.push(`<p>Firestore: ❌ Error — ${e.message}</p>`);
  }

  // Cloud Functions — inferred from whether one has logged activity recently
  try {
    const snap = await getDocs(query(collection(db, "function_logs"), orderBy("createdAt","desc"), limit(1)));
    if (!snap.empty) {
      const lastTime = snap.docs[0].data().createdAt?.toDate?.();
      const hoursAgo = lastTime ? Math.round((Date.now() - lastTime.getTime()) / 3600000) : null;
      const healthy = hoursAgo !== null && hoursAgo < 48;
      results.push(`<p>Cloud Functions: ${healthy ? "✅ Active" : "⚠️ No recent activity"} <span style="color:#9ca3af;font-size:11px">(last log ${hoursAgo ?? "—"}h ago)</span></p>`);
    } else {
      results.push(`<p>Cloud Functions: ⚠️ No logs found yet</p>`);
    }
  } catch(e) {
    results.push(`<p>Cloud Functions: ❓ Unable to check</p>`);
  }

  // Storage — no reliable client-side check exists, so say so honestly
  results.push(`<p>Storage: ❓ Not actively monitored <span style="color:#9ca3af;font-size:11px">(check Firebase Console → Storage)</span></p>`);

  el.innerHTML = results.join("");
}


async function checkFraudAlerts() {
  const el = document.getElementById("fraud-alerts");
  if (!el) return;

  const alerts = [];

  // Sellers with 3+ unresolved reports
  const reportCounts = {};
  allReports.filter(r => r.status !== "resolved").forEach(r => {
    const key = r.sellerName || r.productId || "unknown";
    reportCounts[key] = (reportCounts[key] || 0) + 1;
  });
  Object.entries(reportCounts).filter(([,c]) => c >= 3).forEach(([name,c]) => {
    alerts.push(`<p style="color:#991b1b">🚨 "${escapeHTML(name)}" has ${c} open reports — review recommended</p>`);
  });

  // Disputes open longer than 48 hours — nobody should sit unresolved this long
  try {
    const snap = await getDocs(query(collection(db, "disputes"), where("status","==","open")));
    const cutoff = Date.now() - 48*3600000;
    snap.forEach(d => {
      const data = d.data();
      const created = data.createdAt?.toDate?.()?.getTime();
      if (created && created < cutoff) {
        alerts.push(`<p style="color:#92400e">⏰ Dispute on "${escapeHTML(data.productName||"an order")}" open 48+ hours — needs attention</p>`);
      }
    });
  } catch(e) {}

  // Banned users whose ads are still live — a real data inconsistency to catch
  const bannedIds = allUsers.filter(u => u.banned).map(u => u.id);
  if (bannedIds.length && allAds.length) {
    allAds.filter(a => a.status === "active" && bannedIds.includes(a.userId))
      .forEach(a => alerts.push(`<p style="color:#991b1b">⚠️ Banned user still has an active ad: "${escapeHTML(a.name)}"</p>`));
  }

  // Same phone number used across MULTIPLE different accounts —
  // classic sign of one person running several fake seller profiles
  const activeAds = allAds.filter(a => a.status === "active");
  const phoneToUsers = {};
  activeAds.forEach(a => {
    const phone = (a.seller?.phone || "").replace(/\D/g, "");
    if (!phone || phone.length < 9) return;
    if (!phoneToUsers[phone]) phoneToUsers[phone] = new Set();
    phoneToUsers[phone].add(a.userId);
  });
  Object.entries(phoneToUsers)
    .filter(([, userSet]) => userSet.size >= 2)
    .forEach(([phone, userSet]) => {
      alerts.push(`<p style="color:#7c2d12">📞 Phone number ending ...${phone.slice(-4)} is used across ${userSet.size} different accounts — possible fake accounts</p>`);
    });

  // Near-identical listings (same title + same price) posted by
  // DIFFERENT sellers — classic copy-paste scam pattern
  const listingSignatures = {};
  activeAds.forEach(a => {
    const sig = `${(a.name || "").toLowerCase().trim()}::${a.price}`;
    if (!listingSignatures[sig]) listingSignatures[sig] = new Set();
    listingSignatures[sig].add(a.userId);
  });
  Object.entries(listingSignatures)
    .filter(([, userSet]) => userSet.size >= 2)
    .forEach(([sig, userSet]) => {
      const title = sig.split("::")[0];
      alerts.push(`<p style="color:#7c2d12">🔁 "${escapeHTML(title)}" posted identically by ${userSet.size} different sellers — possible duplicate/scam listing</p>`);
    });

  el.innerHTML = alerts.length ? alerts.join("") : `<p style="color:#16a34a">✅ No fraud signals detected</p>`;
}



window.viewUserNotes = async function(userId, currentNotes) {
  const notes = prompt("Admin notes for this user (only visible to admins — never shown to the user):", currentNotes || "");
  if (notes === null) return;
  try {
    await updateDoc(doc(db, "users", userId), { adminNotes: notes });
    showToast("Notes saved", "success");
    loadUsers();
  } catch(e) {
    showToast("Failed: " + e.message, "error");
  }
};


// ══════════════════════════════════════════════
//  FULL USER DOCUMENT — raw Firestore record
// ══════════════════════════════════════════════
window.adminViewUserDoc = async function(userId) {
  try {
    const snap = await getDoc(doc(db, "users", userId));
    if (!snap.exists()) {
      showToast("User document not found", "error");
      return;
    }

    const data = snap.data();
    const fullDoc = { id: snap.id, ...data };
    const jsonText = JSON.stringify(fullDoc, (key, value) => {
      if (value && value.toDate) return value.toDate().toISOString();
      return value;
    }, 2);

    const modal = document.createElement("div");
    modal.id = "admin-user-doc-modal";
    modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px`;
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
      <div style="background:white;border-radius:20px;padding:24px;max-width:640px;width:100%;max-height:90vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;margin-bottom:16px">
          <h2 style="margin:0;font-size:16px;font-weight:800">🗂️ Full User Document</h2>
          <button onclick="document.getElementById('admin-user-doc-modal').remove()"
            style="background:#f3f4f6;border:none;width:32px;height:32px;border-radius:50%;font-size:18px;cursor:pointer">×</button>
        </div>

        <label style="display:block;font-size:11px;font-weight:800;color:#6b7280;text-transform:uppercase;margin-bottom:4px">User ID (Document ID)</label>
        <div style="display:flex;gap:8px;margin-bottom:16px">
          <input id="admin-user-doc-uid" readonly value="${snap.id}"
            style="flex:1;padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px;font-family:monospace;font-size:13px">
          <button onclick="navigator.clipboard.writeText(document.getElementById('admin-user-doc-uid').value); showToast('User ID copied','success')"
            style="background:#111827;color:white;border:none;padding:8px 12px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">Copy</button>
        </div>

        <label style="display:block;font-size:11px;font-weight:800;color:#6b7280;text-transform:uppercase;margin-bottom:4px">Full Document (Firestore)</label>
        <textarea id="admin-user-doc-json" readonly rows="18"
          style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #e5e7eb;border-radius:8px;font-family:monospace;font-size:12px;white-space:pre;overflow:auto">${jsonText.replace(/</g,"&lt;")}</textarea>
        <button onclick="navigator.clipboard.writeText(document.getElementById('admin-user-doc-json').value); showToast('Document copied','success')"
          style="margin-top:8px;background:#e0f2fe;color:#0369a1;border:none;padding:8px 12px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">📋 Copy Full Document</button>
      </div>
    `;
    document.body.appendChild(modal);
  } catch(e) {
    showToast("Failed: " + e.message, "error");
  }
};

window.jumpToUser = function() {
  const uid = document.getElementById("jump-to-user-input")?.value.trim();
  if (!uid) return;
  window.showSection("users", document.querySelector('.admin-nav-item[data-section="users"]'));
  adminViewUserDoc(uid);
};


// ══════════════════════════════════════════════
//  PLAN SETTINGS — genuine admin-editable limits
// ══════════════════════════════════════════════
window.loadPlanSettings = async function() {
  try {
    const snap = await getDoc(doc(db, "plan_config", "current"));
    const saved = snap.exists() ? snap.data() : {};

    // Fallback defaults if nothing saved yet — matches plans-data.js
    const defaults = {
      free:   { maxAds: 3,  boosts: 0,  images: 3,  adDays: 30  },
      bronze: { maxAds: 15, boosts: 2,  images: 5,  adDays: 60  },
      silver: { maxAds: 50, boosts: 8,  images: 8,  adDays: 90  },
      gold:   { maxAds: "unlimited", boosts: 25, images: 15, adDays: 180 }
    };

    ["free", "bronze", "silver", "gold"].forEach(planId => {
      const vals = saved[planId] || defaults[planId];
      const maxAdsEl = document.getElementById(`ps-${planId}-maxads`);
      const boostsEl = document.getElementById(`ps-${planId}-boosts`);
      const imagesEl = document.getElementById(`ps-${planId}-images`);
      const daysEl   = document.getElementById(`ps-${planId}-days`);
      if (maxAdsEl) maxAdsEl.value = vals.maxAds;
      if (boostsEl) boostsEl.value = vals.boosts;
      if (imagesEl) imagesEl.value = vals.images;
      if (daysEl)   daysEl.value   = vals.adDays;
    });

    const savedAt = document.getElementById("ps-last-saved");
    if (savedAt && saved.updatedAt) {
      savedAt.textContent = "Last updated: " + fmtDate(saved.updatedAt);
    }

  } catch(e) {
    showToast("Failed to load plan settings: " + e.message, "error");
  }
};

window.savePlanSettings = async function() {
  const btn = document.getElementById("ps-save-btn");
  if (btn) { btn.textContent = "Saving..."; btn.disabled = true; }

  try {
    const config = {};

    ["free", "bronze", "silver", "gold"].forEach(planId => {
      const maxAdsRaw = document.getElementById(`ps-${planId}-maxads`)?.value.trim();
      config[planId] = {
        maxAds:  maxAdsRaw === "" || maxAdsRaw?.toLowerCase() === "unlimited" ? "unlimited" : Number(maxAdsRaw),
        boosts:  Number(document.getElementById(`ps-${planId}-boosts`)?.value || 0),
        images:  Number(document.getElementById(`ps-${planId}-images`)?.value || 1),
        adDays:  Number(document.getElementById(`ps-${planId}-days`)?.value || 30)
      };
    });

    config.updatedAt = new Date();
    config.updatedBy = ADMIN_EMAIL;

    await setDoc(doc(db, "plan_config", "current"), config);

    showToast("✅ Plan limits saved — live across the platform now", "success");
    loadPlanSettings();

  } catch(e) {
    showToast("Failed to save: " + e.message, "error");
  } finally {
    if (btn) { btn.textContent = "💾 Save Plan Settings"; btn.disabled = false; }
  }
};


// ══════════════════════════════════════════════
//  SYNC PLAN-BASED VERIFICATION → seller_verifications
//  This is the collection every badge display actually
//  reads from (product.js, shop.js, user-profile.js) —
//  not users.isSellerVerified, which is display-only.
// ══════════════════════════════════════════════
async function syncPlanVerification(userId, shouldBeVerified, plan) {
  try {
    const existingSnap = await getDocs(query(
      collection(db, "seller_verifications"),
      where("userId", "==", userId)
    ));

    if (shouldBeVerified) {
      if (!existingSnap.empty) {
        // Already has a verification record — just make sure it's approved
        const existing = existingSnap.docs[0];
        if (existing.data().status !== "approved") {
          await updateDoc(doc(db, "seller_verifications", existing.id), {
            status:      "approved",
            approvedAt:  new Date(),
            approvedVia: `${plan}_subscription`
          });
        }
      } else {
        // No record at all yet — create one representing plan-based verification
        const userSnap = await getDoc(doc(db, "users", userId));
        const userData = userSnap.exists() ? userSnap.data() : {};

        await addDoc(collection(db, "seller_verifications"), {
          userId,
          email:        userData.email || "",
          fullName:     userData.displayName || (userData.email || "").split("@")[0],
          businessName: "",
          phone:        userData.phone || "",
          location:     userData.location || "",
          status:       "approved",
          approvedAt:   new Date(),
          approvedVia:  `${plan}_subscription`,
          createdAt:    new Date()
        });
      }
    } else {
      // Plan downgraded below Silver — only revoke verification that
      // came FROM a plan, never touch a manually ID-verified seller
      if (!existingSnap.empty) {
        const existing = existingSnap.docs[0];
        if (existing.data().approvedVia?.endsWith("_subscription")) {
          await updateDoc(doc(db, "seller_verifications", existing.id), {
            status: "expired"
          });
        }
      }
    }
  } catch (e) {
    console.warn("syncPlanVerification:", e.message);
  }
}


// ══════════════════════════════════════════════
//  DEVELOPER CONSOLE — real client-side errors
// ══════════════════════════════════════════════
window.loadClientErrors = async function() {
  const tbody = document.getElementById("errors-table-body");
  if (!tbody) return;

  try {
    const snap = await getDocs(query(
      collection(db, "client_errors"),
      orderBy("createdAt", "desc"),
      limit(150)
    ));

    const errors = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (errors.length === 0) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="6">✅ No errors logged</td></tr>`;
      return;
    }

    // Group identical errors together so 40 copies of the same bug
    // shows as "1 error × 40 occurrences" instead of drowning the list
    const grouped = {};
    errors.forEach(e => {
      const key = `${e.message}::${e.page}`;
      if (!grouped[key]) grouped[key] = { ...e, count: 0, lastSeen: e.createdAt };
      grouped[key].count++;
    });

    const groupedList = Object.values(grouped).sort((a, b) => b.count - a.count);

    tbody.innerHTML = groupedList.map(e => `
      <tr>
        <td style="font-size:12px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#991b1b;font-weight:700">${escapeHTML(e.message)}</td>
        <td style="font-size:11px">${escapeHTML(e.page)}</td>
        <td style="font-size:11px">${escapeHTML(e.source)}</td>
        <td style="text-align:center"><span class="plan-chip chip-rejected">${e.count}×</span></td>
        <td style="font-size:11px">${escapeHTML(e.userEmail)}</td>
        <td style="font-size:11px">${fmtDate(e.lastSeen)}</td>
      </tr>
    `).join("");

  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:red">Failed to load: ${e.message}</td></tr>`;
  }
};

window.clearOldErrors = async function() {
  if (!confirm("Clear all logged errors older than 14 days?")) return;
  try {
    const snap = await getDocs(collection(db, "client_errors"));
    const cutoff = Date.now() - 14 * 86400000;
    const toDelete = snap.docs.filter(d => {
      const t = d.data().createdAt?.toDate?.()?.getTime();
      return t && t < cutoff;
    });
    await Promise.all(toDelete.map(d => deleteDoc(doc(db, "client_errors", d.id))));
    showToast(`Cleared ${toDelete.length} old error logs`, "info");
    loadClientErrors();
  } catch(e) {
    showToast("Failed", "error");
  }
};


// ══════════════════════════════════════════════
//  SHOPS
// ══════════════════════════════════════════════
let allShops = [];

window.loadShopsAdmin = async function() {
  const tbody = document.getElementById("shops-table-body");
  if (!tbody) return;

  try {
    const snap = await getDocs(collection(db, "shops"));
    allShops = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderShopsAdmin(allShops);
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:red;padding:20px">Failed: ${e.message}</td></tr>`;
  }
};

function renderShopsAdmin(shops) {
  const tbody = document.getElementById("shops-table-body");
  if (!tbody) return;

  if (shops.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No shops created yet</td></tr>`;
    return;
  }

  tbody.innerHTML = shops.map(s => `
    <tr>
      <td style="font-weight:700">${escapeHTML(s.name) || "Unnamed Shop"}</td>
      <td style="font-size:12px">${escapeHTML(s.location) || "—"}</td>
      <td>
        <span class="plan-chip chip-${s.plan || 'free'}">${(s.plan || "free").toUpperCase()}</span>
        ${s.suspended ? `<br><span class="plan-chip chip-rejected" style="margin-top:4px">⏸️ Suspended</span>` : ""}
      </td>
      <td>${s.isVerified ? "✅" : "—"}</td>
      <td>
        <span class="plan-chip ${s.adminFeatured ? 'chip-approved' : 'chip-free'}">
          ${s.adminFeatured ? "⭐ Featured" : "Not featured"}
        </span>
      </td>
      <td style="display:flex;gap:6px;flex-wrap:wrap">
        <a href="shop.html?seller=${s.id}" target="_blank"
          style="background:#f3f4f6;color:#111827;padding:6px 10px;border-radius:7px;font-size:11px;font-weight:700;text-decoration:none">View</a>
        <button class="action-btn ${s.adminFeatured ? 'btn-reject' : 'btn-approve'}"
          onclick="toggleShopFeature('${s.id}', ${!s.adminFeatured})">
          ${s.adminFeatured ? "✗ Unfeature" : "⭐ Feature"}
        </button>
        <button class="action-btn" style="background:${s.suspended ? '#dcfce7' : '#fef3c7'};color:${s.suspended ? '#166534' : '#92400e'}"
          onclick="toggleShopSuspend('${s.id}', ${!s.suspended})">
          ${s.suspended ? "▶️ Unsuspend" : "⏸️ Suspend"}
        </button>
        <button class="action-btn btn-reject" onclick="adminDeleteShop('${s.id}','${(s.name||'this shop').replace(/'/g,"\\'")}')">🗑️ Delete</button>
      </td>
    </tr>`).join("");
}

window.filterShopsAdmin = function() {
  const q = document.getElementById("shops-search")?.value.toLowerCase() || "";
  const filtered = allShops.filter(s => (s.name || "").toLowerCase().includes(q));
  renderShopsAdmin(filtered);
};

window.toggleShopFeature = async function(shopId, featured) {
  try {
    await updateDoc(doc(db, "shops", shopId), { adminFeatured: featured });
    showToast(featured ? "Shop featured on homepage ✅" : "Shop unfeatured", "success");
    loadShopsAdmin();
  } catch(e) {
    showToast("Failed: " + e.message, "error");
  }
};


window.toggleShopSuspend = async function(shopId, suspend) {
  const msg = suspend
    ? "Suspend this shop? It will be hidden from all buyers immediately, but the seller's account and products stay intact — you can unsuspend anytime."
    : "Unsuspend this shop? It becomes visible to buyers again immediately.";
  if (!confirm(msg)) return;

  try {
    await updateDoc(doc(db, "shops", shopId), {
      suspended:   suspend,
      suspendedAt: suspend ? new Date() : null
    });

    // Also pull all of this shop's products offline while suspended —
    // otherwise the shop page is hidden but items still show in search
    const shopDoc = await getDoc(doc(db, "shops", shopId));
    const ownerId = shopDoc.exists() ? (shopDoc.data().ownerId || shopId) : shopId;

    const productsSnap = await getDocs(query(
      collection(db, "products"),
      where("userId", "==", ownerId),
      where("status", "==", suspend ? "active" : "suspended_with_shop")
    ));

    const batchPromises = productsSnap.docs.map(d =>
      updateDoc(doc(db, "products", d.id), {
        status: suspend ? "suspended_with_shop" : "active"
      })
    );
    await Promise.all(batchPromises);

    showToast(suspend ? "Shop suspended — hidden from buyers" : "Shop reinstated", suspend ? "error" : "success");
    loadShopsAdmin();
  } catch(e) {
    showToast("Failed: " + e.message, "error");
  }
};

window.adminDeleteShop = async function(shopId, shopName) {
  if (!confirm(`Permanently delete "${shopName}"? This removes the shop page and cannot be undone. Their products and account are NOT deleted — only the shop storefront itself.`)) return;

  try {
    await deleteDoc(doc(db, "shops", shopId));
    // Also clean up the parallel business_profiles doc if it exists (some shops use either collection)
    await deleteDoc(doc(db, "business_profiles", shopId)).catch(() => {});

    showToast("Shop deleted", "info");
    loadShopsAdmin();
  } catch(e) {
    showToast("Failed: " + e.message, "error");
  }
};


window.adminDeleteUser = async function(userId, userEmail) {
  const step1 = confirm(`Permanently delete ${userEmail}?\n\nThis removes their account, login, all products, boost requests, and subscriptions. This CANNOT be undone.`);
  if (!step1) return;

  const typed = prompt(`Type the user's email to confirm deletion:\n\n${userEmail}`);
  if (typed !== userEmail) {
    if (typed !== null) alert("Email didn't match — deletion cancelled for safety.");
    return;
  }

  try {
    const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js");
    const fn = httpsCallable(getFunctions(), "adminDeleteUserAccount");
    const result = await fn({ userId });

    logAdminAction("USER_DELETED", `${userEmail} (UID: ${userId})`);

    const data = result.data;
    if (data.errors && data.errors.length > 0) {
      showToast(`Deleted with warnings: ${data.errors.join("; ")}`, "info");
    } else {
      showToast(`${userEmail} fully deleted — data and login both removed`, "success");
    }
    loadUsers();

  } catch(e) {
    showToast("Failed: " + e.message, "error");
  }
};


// ══════════════════════════════════════════════
//  WEEKLY GROWTH SNAPSHOT
// ══════════════════════════════════════════════
async function loadGrowthSnapshot() {
  const container = document.getElementById("growth-snapshot");
  if (!container) return;

  try {
    const now = Date.now();
    const weekAgo    = now - 7 * 86400000;
    const twoWeeksAgo = now - 14 * 86400000;

    const usersThisWeek = allUsers.filter(u => (u.createdAt?.toDate?.()?.getTime() || 0) >= weekAgo).length;
    const usersLastWeek = allUsers.filter(u => {
      const t = u.createdAt?.toDate?.()?.getTime() || 0;
      return t >= twoWeeksAgo && t < weekAgo;
    }).length;

    const ordersThisWeek = allOrders.filter(o => (o.createdAt?.toDate?.()?.getTime() || 0) >= weekAgo).length;
    const ordersLastWeek = allOrders.filter(o => {
      const t = o.createdAt?.toDate?.()?.getTime() || 0;
      return t >= twoWeeksAgo && t < weekAgo;
    }).length;

    const catCounts = {};
    allOrders.filter(o => (o.createdAt?.toDate?.()?.getTime() || 0) >= weekAgo).forEach(o => {
      (o.items || []).forEach(i => { if (i.category) catCounts[i.category] = (catCounts[i.category]||0)+1; });
      if (o.productId && !o.items) catCounts["single-item orders"] = (catCounts["single-item orders"]||0)+1;
    });
    const topCats = Object.entries(catCounts).sort((a,b)=>b[1]-a[1]).slice(0,3);

    function trendArrow(curr, prev) {
      if (prev === 0) return curr > 0 ? `<span style="color:#16a34a">▲ new</span>` : "";
      const pct = Math.round(((curr - prev) / prev) * 100);
      return pct >= 0 ? `<span style="color:#16a34a">▲ ${pct}%</span>` : `<span style="color:#ef4444">▼ ${Math.abs(pct)}%</span>`;
    }

    container.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div style="background:#f9fafb;border-radius:10px;padding:14px">
          <p style="font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase">New Users (7d)</p>
          <p style="font-size:22px;font-weight:900;color:#111827;margin:4px 0">${usersThisWeek} ${trendArrow(usersThisWeek, usersLastWeek)}</p>
        </div>
        <div style="background:#f9fafb;border-radius:10px;padding:14px">
          <p style="font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase">Orders (7d)</p>
          <p style="font-size:22px;font-weight:900;color:#111827;margin:4px 0">${ordersThisWeek} ${trendArrow(ordersThisWeek, ordersLastWeek)}</p>
        </div>
      </div>
      ${topCats.length > 0 ? `
        <p style="font-size:12px;font-weight:800;color:#374151;margin-bottom:6px">🏆 Top Categories This Week</p>
        ${topCats.map(([c,n],i) => `<p style="font-size:12px;color:#6b7280;margin:3px 0">${i+1}. ${c} — ${n} order${n>1?"s":""}</p>`).join("")}
      ` : `<p style="font-size:12px;color:#9ca3af">No orders yet this week</p>`}
    `;
  } catch (e) { console.warn("loadGrowthSnapshot:", e.message); }
}
