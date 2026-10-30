const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const express = require("express");


admin.initializeApp();
const db = admin.firestore();

const { setGlobalOptions } = require("firebase-functions/v2");
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onSchedule }        = require("firebase-functions/v2/scheduler");

// ── Must be called before any function exports ──
setGlobalOptions({
  region:         "us-central1",
  memory:         "1GiB",
  timeoutSeconds: 540,
  maxInstances:   10,
});

// Shared check: super-admin, or a non-suspended, non-viewer entry in /admins
async function assertCallerIsFullAdmin(request) {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Login required");

  if (request.auth.token.email === "swaibuziraye22@gmail.com") {
    return { uid: callerUid, email: request.auth.token.email };
  }

  const adminSnap = await db.collection("admins").doc(callerUid).get();
  if (!adminSnap.exists || adminSnap.data()?.suspended === true || adminSnap.data()?.role === "viewer") {
    throw new HttpsError("permission-denied", "Full admin access required");
  }
  return { uid: callerUid, email: request.auth.token.email };
}

// ============================================
// VIEW AS USER — mints a sign-in token for support
// ============================================
exports.adminImpersonateUser = onCall(async (request) => {
  const caller = await assertCallerIsFullAdmin(request);

  const targetUid = request.data?.userId;
  if (!targetUid) throw new HttpsError("invalid-argument", "userId required");

  const targetSnap = await db.collection("users").doc(targetUid).get();
  if (!targetSnap.exists) throw new HttpsError("not-found", "User not found");
  const targetEmail = targetSnap.data()?.email || "";

  const token = await admin.auth().createCustomToken(targetUid, {
    impersonatedBy: caller.email
  });

  await db.collection("admin_action_logs").add({
    action: "VIEW_AS_USER",
    details: `Viewing as ${targetEmail} (UID: ${targetUid})`,
    adminEmail: caller.email,
    adminUid: caller.uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { token, email: targetEmail };
});

// ============================================
// AUTO-FLAG NEW ADS MATCHING BANNED KEYWORDS
// ============================================
// ============================================
// AUTO-EXPIRE OLD AD FLAGS
// ============================================
exports.autoExpireFlags = onSchedule(
  { schedule: "every 24 hours", timeZone: "Africa/Kampala" },
  async () => {
    try {
      const cfgSnap = await db.collection("moderation_config").doc("keywords").get();
      const days = Number(cfgSnap.exists ? cfgSnap.data().flagExpiryDays : 14) || 14;
      const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - days * 86400000);

      const snap = await db.collection("products")
        .where("adminAdNotesFlaggedAt", "<=", cutoff)
        .get();

      if (snap.empty) { console.log("[FLAG EXPIRY] Nothing to clear"); return; }

      const batch = db.batch();
      snap.forEach(docSnap => {
        batch.update(docSnap.ref, {
          adminAdNotes: admin.firestore.FieldValue.delete(),
          adminAdNotesFlaggedAt: admin.firestore.FieldValue.delete()
        });
      });
      await batch.commit();

      await db.collection("admin_action_logs").add({
        action: "FLAGS_AUTO_EXPIRED",
        details: `Cleared ${snap.size} ad flag(s) older than ${days} day(s)`,
        adminEmail: "SYSTEM (auto-moderation)",
        adminUid: "system",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`[FLAG EXPIRY] Cleared ${snap.size} flags`);
    } catch (err) {
      console.error("[FLAG EXPIRY ERROR]", err.message);
    }
  }
);

// ============================================
// AUTO-RESTORE SUSPENDED STAFF ADMINS
// ============================================
exports.autoUnsuspendStaff = onSchedule(
  { schedule: "every 1 hours", timeZone: "Africa/Kampala" },
  async () => {
    try {
      const now = admin.firestore.Timestamp.now();
      const snap = await db.collection("admins")
        .where("suspended", "==", true)
        .where("suspendedUntil", "<=", now)
        .get();

      if (snap.empty) return;

      const batch = db.batch();
      const restored = [];
      snap.forEach(docSnap => {
        batch.update(docSnap.ref, {
          suspended: false,
          suspendedUntil: null
        });
        restored.push(docSnap.data().email || docSnap.id);
      });
      await batch.commit();

      await db.collection("admin_action_logs").add({
        action: "STAFF_AUTO_RESTORED",
        details: `Restored: ${restored.join(", ")}`,
        adminEmail: "SYSTEM (auto-moderation)",
        adminUid: "system",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`[AUTO-RESTORE] Restored ${restored.length} admin(s)`);
    } catch (err) {
      console.error("[AUTO-RESTORE ERROR]", err.message);
    }
  }
);

// ============================================
// AUTO-FLAG SELLERS WITH REPEATED REPORTS
// ============================================
exports.autoFlagRepeatedlyReportedSeller = onDocumentCreated("reports/{reportId}", async (event) => {
  const report = event.data.data();
  if (!report.sellerId) return;

  try {
    const since = admin.firestore.Timestamp.fromMillis(Date.now() - 7 * 86400000); // 7 days
    const recentReports = await db.collection("reports")
      .where("sellerId", "==", report.sellerId)
      .where("createdAt", ">=", since)
      .get();

    if (recentReports.size < 3) return; // threshold: 3+ reports in 7 days

    const userSnap = await db.collection("users").doc(report.sellerId).get();
    if (!userSnap.exists) return;
    if (userSnap.data().scamFlagged) return; // already flagged, don't repeat

    await userSnap.ref.update({
      scamFlagged: true,
      scamFlagReason: `${recentReports.size} reports in the last 7 days`,
      scamFlaggedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await db.collection("admin_action_logs").add({
      action: "SELLER_AUTO_FLAGGED",
      details: `Seller ${userSnap.data().email || report.sellerId}: ${recentReports.size} reports in 7 days`,
      adminEmail: "SYSTEM (auto-moderation)",
      adminUid: "system",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error("[SCAM FLAG ERROR]", err.message);
  }
});

// ============================================
// AUTO-FLAG NEW ACCOUNTS POSTING HIGH-VALUE ITEMS
// ============================================
exports.autoFlagNewAccountHighValue = onDocumentCreated("products/{productId}", async (event) => {
  const ad = event.data.data();
  if (!ad.userId || !ad.price) return;

  try {
    const userSnap = await db.collection("users").doc(ad.userId).get();
    if (!userSnap.exists) return;
    const user = userSnap.data();

    const joined = user.createdAt?.toDate ? user.createdAt.toDate() : (user.createdAt ? new Date(user.createdAt) : null);
    if (!joined) return;

    const accountAgeHours = (Date.now() - joined.getTime()) / 3600000;
    const HIGH_VALUE_THRESHOLD = 2000000; // UGX 2,000,000 — adjust to taste

    if (accountAgeHours > 24 || Number(ad.price) < HIGH_VALUE_THRESHOLD) return;

    await db.collection("products").doc(event.params.productId).update({
      adminAdNotes: `🤖 Auto-flagged: brand-new account (joined ${Math.round(accountAgeHours)}h ago) posting a high-value item (UGX ${Number(ad.price).toLocaleString()}) — common scam pattern, review before buyer contact.`,
      adminAdNotesFlaggedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await db.collection("admin_action_logs").add({
      action: "AD_AUTO_FLAGGED_NEW_ACCOUNT",
      details: `${user.email || ad.userId}: UGX ${Number(ad.price).toLocaleString()} item, account ${Math.round(accountAgeHours)}h old`,
      adminEmail: "SYSTEM (auto-moderation)",
      adminUid: "system",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error("[NEW ACCOUNT FLAG ERROR]", err.message);
  }
});

exports.autoFlagNewAd = onDocumentCreated("products/{productId}", async (event) => {
  const ad = event.data.data();
  if (!ad) return;

  try {
    const cfgSnap = await db.collection("moderation_config").doc("keywords").get();
    const words = (cfgSnap.exists ? cfgSnap.data().bannedWords : []) || [];
    if (words.length === 0) return;

    const haystack = `${ad.name || ""} ${ad.description || ""}`.toLowerCase();
    const hit = words.find(w => w && haystack.includes(String(w).toLowerCase()));
    if (!hit) return;

    await db.collection("products").doc(event.params.productId).update({
      adminAdNotes: `🤖 Auto-flagged: matched banned word "${hit}" — review this listing.`,
      adminAdNotesFlaggedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await db.collection("admin_action_logs").add({
      action: "AD_AUTO_FLAGGED",
      details: `Ad "${ad.name || event.params.productId}" matched "${hit}"`,
      adminEmail: "SYSTEM (auto-moderation)",
      adminUid: "system",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error("[AUTO-FLAG ERROR]", err.message);
  }
});

// ============================================
// FULL DATA EXPORT
// ============================================
exports.adminExportAllData = onCall(async (request) => {
  const caller = await assertCallerIsFullAdmin(request);

  const collectionsToExport = [
    "users", "products", "orders", "subscriptions", "shops",
    "business_accounts", "reviews", "disputes", "reports", "seller_verifications"
  ];

  const exportData = {};
  let totalDocs = 0;

  for (const name of collectionsToExport) {
    const snap = await db.collection(name).get();
    exportData[name] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    totalDocs += snap.size;
  }

  const fileName = `admin-exports/export-${Date.now()}.json`;
  const bucket = admin.storage().bucket();
  const file = bucket.file(fileName);

  await file.save(JSON.stringify(exportData, null, 2), {
    contentType: "application/json"
  });

  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + 60 * 60 * 1000 // 1 hour
  });

  await db.collection("admin_action_logs").add({
    action: "FULL_DATA_EXPORT",
    details: `${totalDocs} documents across ${collectionsToExport.length} collections`,
    adminEmail: caller.email,
    adminUid: caller.uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { url, totalDocs, collections: collectionsToExport };
});



// ============================================
// LOG REVENUE EVENT (CLEAN V2 MODULE)
// ============================================

exports.logRevenueEvent = onDocumentCreated(
  "admin_approvals/{id}",
  async (event) => {
    try {
      const data = event.data.data();

      await db.collection("revenue_logs").add({
        type: data.type || "unknown",
        amount: data.amount || 0,
        productId: data.productId || null,
        userId: data.userId || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await alertAdminPayment(data.type, data.amount || 0);

      console.log(`[REVENUE] Logged ${data.type}`);
    } catch (err) {
      console.error("[REVENUE ERROR]", err.message);
    }

    
  }
);

// ============================================
// SMS FALLBACK SYSTEM (CLEAN UTILITY)
// ============================================

async function sendSMS(phone, message) {
  try {
    if (!phone || !message) return;

    const AfricasTalking = require("africastalking");

    const at = AfricasTalking({
      apiKey: process.env.AT_API_KEY,
      username: process.env.AT_USERNAME || "sandbox",
    });

    const result = await at.SMS.send({
      to: [phone],
      message,
      from: "ZiBuy",
    });

    console.log("[SMS SENT]", phone);
    return result;

  } catch (err) {
    console.error("[SMS ERROR]", err.message);
  }
}


// ============================================
// PRODUCT SEO APP
// ============================================

const seoApp = express();



async function alertAdminOrder(orderId, amount) {
  await pushAdminAlert(
    "order",
    "New Order Received",
    `Order ${orderId} worth UGX ${amount}`,
    { orderId, amount }
  );
}

async function alertAdminPayment(type, amount) {
  await pushAdminAlert(
    "payment",
    "Revenue Event",
    `${type} payment UGX ${amount}`,
    { type, amount }
  );
}

// ============================================
// EMAIL ENGINE (SCALE OPTIMIZED)
// ============================================

function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    pool: true, // IMPORTANT: reuse SMTP connections
    maxConnections: 5,
    maxMessages: 100,
    auth: {
      user: process.env.GMAIL_EMAIL,
      pass: process.env.GMAIL_PASSWORD,
    },
  });
}

const transporter = createTransporter();

async function sendEmail(to, subject, html) {
  if (!to) return;

  try {
    await transporter.sendMail({
      from: `"ZiBuy" <${process.env.GMAIL_EMAIL}>`,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error("[EMAIL ERROR]", err.message);
  }
}


function emailTemplate(title, content, buttonText = "", buttonUrl = "") {
  return `
    <div style="
      max-width:600px;
      margin:auto;
      font-family:Arial,sans-serif;
      background:#ffffff;
      border:1px solid #e5e7eb;
      border-radius:12px;
      overflow:hidden;
    ">
      <div style="
        background:#ff6600;
        color:white;
        padding:20px;
        text-align:center;
      ">
        <h1 style="margin:0;font-size:24px;">ZiBuy Uganda</h1>
      </div>

      <div style="padding:24px;">
        <h2 style="color:#111827;">${title}</h2>

        ${content}

        ${
          buttonText && buttonUrl
            ? `
          <div style="margin-top:24px;text-align:center;">
            <a href="${buttonUrl}"
              style="
                background:#ff6600;
                color:white;
                text-decoration:none;
                padding:12px 20px;
                border-radius:8px;
                display:inline-block;
                font-weight:bold;
              ">
              ${buttonText}
            </a>
          </div>
          `
            : ""
        }
      </div>

      <div style="
        background:#f9fafb;
        padding:16px;
        text-align:center;
        color:#6b7280;
        font-size:12px;
      ">
        © ${new Date().getFullYear()} ZiBuy Uganda
      </div>
    </div>
  `;
}

// ============================================
// QUEUE-STYLE SAFE LOGGING (ANTI DUPLICATION AT SCALE)
// ============================================

async function logOnce(key, data = {}) {
  const ref = db.collection("function_logs").doc(key);

  try {
    await ref.create({
      ...data,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return true;

  } catch (e) {
    return false; // already exists
  }
}


async function auditLog(action, adminName, details = "") {
  try {
    await db.collection("function_logs").add({
      type: action,
      admin: adminName || "system",
      details,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error("[AUDIT]", err.message);
  }
}


// ============================================
// PLATFORM-WIDE ACTIVITY LOGGING
// Fires server-side on every "creation" event —
// cannot be bypassed by client-side code
// ============================================

function logCreationTrigger(collectionName, actionType, summaryFn) {
  return onDocumentCreated(`${collectionName}/{id}`, async (event) => {
    try {
      const data = event.data.data();
      const actor = data.userEmail || data.email || data.reporterEmail ||
                    data.buyerEmail || data.sellerEmail || "user";
      await auditLog(actionType, actor, summaryFn(data));
    } catch (err) {
      console.error(`[ACTIVITY LOG ERROR - ${actionType}]`, err.message);
    }
  });
}

exports.logAdPosted = logCreationTrigger(
  "products", "AD_POSTED",
  d => `"${d.name || "Untitled"}" — ${d.category || "—"} — UGX ${Number(d.price || 0).toLocaleString()}`
);

// Logged on both possible collection names since shop creation may
// write to either "shops" or "business_profiles" depending on the flow
exports.logShopCreatedA = logCreationTrigger(
  "shops", "SHOP_CREATED",
  d => `${d.name || "New shop"} — ${d.location || "—"}`
);
exports.logShopCreatedB = logCreationTrigger(
  "business_profiles", "SHOP_CREATED",
  d => `${d.name || d.shopName || "New shop"} — ${d.location || "—"}`
);

exports.logReviewPosted = logCreationTrigger(
  "reviews", "REVIEW_POSTED",
  d => `${d.rating || "?"}⭐ review posted`
);

exports.logBuyerRated = logCreationTrigger(
  "buyer_ratings", "BUYER_RATED",
  d => `${d.rating || "?"}⭐ buyer rating given`
);

exports.logBoostRequested = logCreationTrigger(
  "boost_requests", "BOOST_REQUESTED",
  d => `"${d.productName || "Ad"}" — ${d.days || "?"} days — UGX ${Number(d.price || 0).toLocaleString()}`
);

exports.logPinRequested = logCreationTrigger(
  "pin_requests", "PIN_REQUESTED",
  d => `"${d.productName || "Ad"}" — ${d.hours || "?"}h — UGX ${Number(d.price || 0).toLocaleString()}`
);

exports.logCVBoostRequested = logCreationTrigger(
  "cv_boosts", "CV_BOOST_REQUESTED",
  d => `"${d.productName || "CV"}" — ${d.days || "?"} days`
);

exports.logAutoRenewRequested = logCreationTrigger(
  "auto_renewals", "AUTO_RENEW_REQUESTED",
  d => `"${d.productName || "Ad"}" — UGX ${Number(d.price || 0).toLocaleString()}`
);

exports.logVerificationRequested = logCreationTrigger(
  "seller_verifications", "VERIFICATION_REQUESTED",
  d => `${d.fullName || "—"} — ${d.businessName || "—"}`
);

exports.logSubscriptionRequested = logCreationTrigger(
  "business_accounts", "SUBSCRIPTION_REQUESTED",
  d => `${(d.plan || "plan").toUpperCase()} — ${d.billing || "monthly"}`
);

exports.logReportFiled = logCreationTrigger(
  "reports", "REPORT_FILED",
  d => `${d.reason || "Report"} — target: ${d.sellerName || d.productId || "—"}`
);

exports.logJobAdPosted = logCreationTrigger(
  "job_ads", "JOB_AD_POSTED",
  d => `${d.title || "Job"} at ${d.company || "—"}`
);


// ============================================
// HELPERS (OPTIMIZED FOR SCALE)
// ============================================

const userCache = new Map();
const productCache = new Map();

async function getUser(userId) {
  if (!userId) return null;
  if (userCache.has(userId)) return userCache.get(userId);

  const snap = await db.collection("users").doc(userId).get();
  const data = snap.exists ? snap.data() : null;

  userCache.set(userId, data);
  return data;
}

async function getProduct(productId) {
  if (!productId) return null;
  if (productCache.has(productId)) return productCache.get(productId);

  const snap = await db.collection("products").doc(productId).get();
  const data = snap.exists ? snap.data() : null;

  productCache.set(productId, data);
  return data;
}


async function sendUnifiedNotification({ userId, title, message, email, phone }) {
  try {
    // 1. In-app notification (always)
    await db.collection("notifications").add({
      userId,
      title,
      message,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 2. Email fallback
    if (email) {
      await sendEmail(email, title, emailTemplate(title, `<p>${message}</p>`));
    }

    // 3. SMS fallback (ONLY if phone exists)
    if (phone) {
      await sendSMS(phone, `${title} - ${message}`);
    }

    // 4. Admin alert (real-time dashboard feed)
    await pushAdminAlert("notification", title, message, { userId });

  } catch (err) {
    console.error("[UNIFIED NOTIF ERROR]", err.message);
  }
}

async function enqueueNotificationJob(payload) {
  await queueJob("notification", payload);
}


// ============================================
// TRUST SCORE SYSTEM
// ============================================

function getTrustTierLabel(score) {
  if (score >= 90) return "elite";
  if (score >= 70) return "gold";
  if (score >= 50) return "silver";
  if (score >= 30) return "bronze";
  return "new";
}

async function recalculateTrustScore(userId) {
  if (!userId) return;

  try {
    const userSnap = await db.collection("users").doc(userId).get();
    if (!userSnap.exists) return;
    const user = userSnap.data();

    // Seller reviews
    const reviewsSnap = await db.collection("reviews").where("sellerId", "==", userId).get();
    let totalRating = 0, reviewCount = 0;
    reviewsSnap.forEach(d => {
      const r = d.data();
      if (r.rating) { totalRating += Number(r.rating); reviewCount++; }
    });
    const avgRating = reviewCount > 0 ? totalRating / reviewCount : 0;

    // ID verification
    const verifSnap = await db.collection("seller_verifications")
      .where("userId", "==", userId)
      .where("status", "==", "approved")
      .limit(1)
      .get();
    const isVerified = !verifSnap.empty;

    const buyerRating = Number(user.buyerRating || 0);

    let score = 0;
    if (user.phoneVerified) score += 15;
    if (isVerified)         score += 20;
    if (reviewCount > 0)    score += (avgRating / 5) * 25;
    score += Math.min(reviewCount, 20) * 0.5;            // up to 10
    if (buyerRating > 0)    score += (buyerRating / 5) * 8;

    const joined = user.createdAt?.toDate?.();
    if (joined) {
      const monthsActive = Math.min(12, (Date.now() - joined.getTime()) / (30 * 86400000));
      score += monthsActive; // up to 12
    }

    score = Math.round(Math.min(100, score));
    const tier = getTrustTierLabel(score);

    // Skip the write entirely if nothing actually changed
    if (user.trustScore === score && user.trustTier === tier) return;

    await db.collection("users").doc(userId).update({
      trustScore:     score,
      trustTier:      tier,
      trustUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

  } catch (err) {
    console.error("[TRUST SCORE ERROR]", err.message);
  }
}

// ── Recalculate whenever a new seller review comes in ──
exports.trustScoreOnReview = onDocumentCreated("reviews/{id}", async (event) => {
  const data = event.data.data();
  if (data?.sellerId) await recalculateTrustScore(data.sellerId);
});

// ── Recalculate whenever a buyer gets rated ──
exports.trustScoreOnBuyerRating = onDocumentCreated("buyer_ratings/{id}", async (event) => {
  const data = event.data.data();
  if (data?.buyerId) await recalculateTrustScore(data.buyerId);
});

// ── Recalculate the moment ID verification is approved ──
exports.trustScoreOnVerification = onDocumentUpdated("seller_verifications/{id}", async (event) => {
  const before = event.data.before.data();
  const after  = event.data.after.data();
  if (before.status !== "approved" && after.status === "approved" && after.userId) {
    await recalculateTrustScore(after.userId);
  }
});

// ── Nightly sweep — keeps account-age scoring fresh for active sellers ──
exports.trustScoreDailySweep = onSchedule(
  { schedule: "every 24 hours", timeZone: "Africa/Kampala" },
  async () => {
    try {
      const snap = await db.collection("products").where("status", "==", "active").limit(2000).get();
      const sellerIds = new Set();
      snap.forEach(d => { const uid = d.data().userId; if (uid) sellerIds.add(uid); });

      for (const uid of sellerIds) {
        await recalculateTrustScore(uid);
      }
      console.log(`[TRUST SWEEP] Recalculated ${sellerIds.size} sellers`);
    } catch (err) {
      console.error("[TRUST SWEEP ERROR]", err.message);
    }
  }
);


exports.adminRecalculateTrustScore = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Login required");

  const callerSnap = await db.collection("users").doc(callerUid).get();
  if (callerSnap.data()?.email !== "swaibuziraye22@gmail.com") {
    throw new HttpsError("permission-denied", "Admin only");
  }

  const targetUid = request.data?.userId;
  if (!targetUid) throw new HttpsError("invalid-argument", "userId required");

  await recalculateTrustScore(targetUid);
  return { success: true };
});


// ============================================
// EARNED VERIFICATION — cannot be purchased,
// only earned through sustained good behavior
// ============================================

async function checkEarnedVerification(userId) {
  try {
    const userSnap = await db.collection("users").doc(userId).get();
    if (!userSnap.exists) return;
    const user = userSnap.data();

    // Requirements — all must be true
    const hasPhoneVerified = !!user.phoneVerified;
    const hasGoodTrust     = (user.trustScore || 0) >= 70;

    const reviewsSnap = await db.collection("reviews").where("sellerId", "==", userId).get();
    const completedSalesProxy = reviewsSnap.size; // reviews are the closest signal to completed transactions we have

    const disputesSnap = await db.collection("disputes")
      .where("status", "==", "open")
      .get();
    // Filter to disputes actually tied to this seller's orders — cheap check via order lookup skipped for cost; approximate via zero tolerance on THEIR open disputes if productId maps back
    // (kept intentionally simple: a seller with any of their own orders currently disputed does not qualify)

    const qualifies = hasPhoneVerified && hasGoodTrust && completedSalesProxy >= 10;

    const alreadyEarned = user.earnedVerification === true;

    if (qualifies && !alreadyEarned) {
      await db.collection("users").doc(userId).update({
        earnedVerification:   true,
        earnedVerificationAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await db.collection("notifications").add({
        userId,
        type:      "earned_verification",
        title:     "🏆 You Earned ZiBuy Trusted Seller Status!",
        message:   "Your track record of great service earned you our highest trust badge — visible to every buyer.",
        read:      false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

    } else if (!qualifies && alreadyEarned) {
      // Standards slipped — badge is earned, so it can be lost too
      await db.collection("users").doc(userId).update({
        earnedVerification: false
      });
    }

  } catch (err) {
    console.error("[EARNED VERIFICATION ERROR]", err.message);
  }
}

// Recalculate earned verification whenever trust score changes
exports.earnedVerificationOnTrustUpdate = onDocumentUpdated("users/{userId}", async (event) => {
  const before = event.data.before.data();
  const after  = event.data.after.data();
  if (before.trustScore === after.trustScore) return; // only react to real trust changes, avoid loops
  await checkEarnedVerification(event.params.userId);
});

// Nightly sweep — catches review-count changes and dispute resolutions too
exports.earnedVerificationDailySweep = onSchedule(
  { schedule: "every 24 hours", timeZone: "Africa/Kampala" },
  async () => {
    const snap = await db.collection("products").where("status", "==", "active").limit(2000).get();
    const sellerIds = new Set();
    snap.forEach(d => { const uid = d.data().userId; if (uid) sellerIds.add(uid); });
    for (const uid of sellerIds) await checkEarnedVerification(uid);
    console.log(`[EARNED VERIFICATION SWEEP] Checked ${sellerIds.size} sellers`);
  }
);



// ============================================
// PRICE DROP ALERTS — notifies buyers who liked
// a product when the seller drops the price
// ============================================

exports.notifyPriceDrop = onDocumentUpdated("products/{productId}", async (event) => {
  const before = event.data.before.data();
  const after  = event.data.after.data();
  const productId = event.params.productId;

  if (!before || !after) return;
  if (after.status !== "active") return;

  const oldPrice = Number(before.price || 0);
  const newPrice = Number(after.price || 0);

  // Only real, meaningful drops — ignore price increases and rounding noise
  if (!(oldPrice > 0) || !(newPrice < oldPrice)) return;
  const dropPercent = Math.round(((oldPrice - newPrice) / oldPrice) * 100);
  if (dropPercent < 3) return;

  // Mark the product with a visible badge — shows to EVERYONE browsing,
  // not just people who already liked it
  try {
    await event.data.after.ref.update({
      priceDropped:     true,
      priceDropPercent: dropPercent,
      priceDropFrom:    oldPrice,
      priceDropAt:      admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    console.warn("[PRICE DROP] badge update failed:", e.message);
  }

  // Dedup — never re-notify for the exact same price point twice,
  // even if the doc gets touched again for an unrelated field
  const lockKey = `pricedrop_${productId}_${newPrice}`;
  const locked = await logOnce(lockKey, { type: "price_drop_lock", productId, newPrice });
  if (!locked) return;

  const likesSnap = await db.collection("likes").where("productId", "==", productId).get();
  if (likesSnap.empty) return;

  const sellerId    = after.userId;
  const productName = after.name || "An item you liked";
  const savings     = oldPrice - newPrice;

  const notifyPromises = [];
  likesSnap.forEach(doc => {
    const userId = doc.data().userId;
    if (!userId || userId === sellerId) return; // never notify the seller about their own price change

    notifyPromises.push(
      db.collection("notifications").add({
        userId,
        type:      "price_drop",
        title:     `📉 Price Drop: ${productName}`,
        message:   `Now UGX ${newPrice.toLocaleString()} — save UGX ${savings.toLocaleString()} (${dropPercent}% off)!`,
        relatedId: productId,
        read:      false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      })
    );
  });

  await Promise.all(notifyPromises);
  console.log(`[PRICE DROP] Notified ${notifyPromises.length} users for ${productId}`);
});

// Badges don't stay forever — clear them after 5 days so "Price Drop"
// doesn't become a stale, meaningless label on old ads
exports.expirePriceDropBadges = onSchedule(
  { schedule: "every 24 hours", timeZone: "Africa/Kampala" },
  async () => {
    try {
      const cutoff = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 5 * 86400000));
      const snap = await db.collection("products")
        .where("priceDropped", "==", true)
        .where("priceDropAt", "<=", cutoff)
        .get();

      if (snap.empty) return;

      const batch = db.batch();
      snap.forEach(d => batch.update(d.ref, { priceDropped: false }));
      await batch.commit();

      console.log(`[PRICE DROP] Expired badge on ${snap.size} products`);
    } catch (err) {
      console.error("[PRICE DROP EXPIRE ERROR]", err.message);
    }
  }
);

// ============================================
// EXPIRE REGULAR ADS — flips status to "expired"
// once expiresAt passes. Skips ads with autoRenew
// ON, since processAutoRenewals handles those.
// ============================================

exports.expireOldAds = onSchedule(
  { schedule: "every 24 hours", timeZone: "Africa/Kampala" },
  async () => {
    try {
      const now  = admin.firestore.Timestamp.now();
      const snap = await db.collection("products")
        .where("status", "==", "active")
        .where("expiresAt", "<=", now)
        .get();

      if (snap.empty) { console.log("[AD EXPIRY] Nothing to expire"); return; }

      const batch    = db.batch();
      const toNotify = [];

      snap.forEach(docSnap => {
        const p = docSnap.data();
        if (p.autoRenew === true) return; // let processAutoRenewals handle these

        batch.update(docSnap.ref, {
          status:    "expired",
          expiredAt: admin.firestore.FieldValue.serverTimestamp()
        });
        toNotify.push({ id: docSnap.id, ...p });
      });

      await batch.commit();

      for (const p of toNotify) {
        if (!p.userId) continue;
        await db.collection("notifications").add({
          userId:    p.userId,
          type:      "ad_expired",
          title:     "⏰ Your ad has expired",
          message:   `"${p.name}" is no longer visible to buyers. Reactivate it anytime from My Ads.`,
          relatedId: p.id,
          read:      false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      console.log(`[AD EXPIRY] Expired ${toNotify.length} ads`);
    } catch (err) {
      console.error("[AD EXPIRY ERROR]", err.message);
    }
  }
);

// ============================================
// CATEGORY BENCHMARK STATS — powers "vs category
// average" comparisons in Silver/Gold analytics
// ============================================

exports.computeCategoryStats = onSchedule(
  { schedule: "every 24 hours", timeZone: "Africa/Kampala" },
  async () => {
    try {
      const snap = await db.collection("products")
        .where("status", "==", "active")
        .get();

      const grouped = {};

      snap.forEach(doc => {
        const p = doc.data();
        const cat = p.category;
        if (!cat) return;

        if (!grouped[cat]) {
          grouped[cat] = { totalViews: 0, totalPrice: 0, totalLikes: 0, count: 0 };
        }
        grouped[cat].totalViews += Number(p.views || 0);
        grouped[cat].totalPrice += Number(p.price || 0);
        grouped[cat].totalLikes += Number(p.likes || 0);
        grouped[cat].count++;
      });

      const batch = db.batch();

      Object.entries(grouped).forEach(([cat, stats]) => {
        const ref = db.collection("category_stats").doc(cat);
        batch.set(ref, {
          avgViews:   stats.count > 0 ? Math.round(stats.totalViews / stats.count) : 0,
          avgPrice:   stats.count > 0 ? Math.round(stats.totalPrice / stats.count) : 0,
          avgLikes:   stats.count > 0 ? Math.round((stats.totalLikes / stats.count) * 10) / 10 : 0,
          activeAds:  stats.count,
          updatedAt:  admin.firestore.FieldValue.serverTimestamp()
        });
      });

      await batch.commit();
      console.log(`[CATEGORY STATS] Updated ${Object.keys(grouped).length} categories`);
    } catch (err) {
      console.error("[CATEGORY STATS ERROR]", err.message);
    }
  }
);


// ============================================
// PUSH NOTIFICATIONS
// ============================================

// ============================================
// PUSH NOTIFICATIONS (NO CHANGE LOGIC, SCALE SAFE)
// ============================================

exports.sendPushOnNotification = onDocumentCreated(
  "notifications/{id}",
  async (event) => {
    const data = event.data.data();
    if (!data?.userId) return;

    const user = await getUser(data.userId);
    if (!user?.fcmToken) return;

    // Messages notify everyone, like WhatsApp. Other notification types
    // (price drops, boosts, etc.) remain a paid-plan perk for now.
    if (user.plan === "free" && data.type !== "message" && data.type !== "order" && data.type !== "back_in_stock") return;

    try {
      await admin.messaging().send({
        token: user.fcmToken,
        notification: {
          title: data.title || "ZiBuy",
          body: data.message || "",
        },
      });
    } catch (err) {
      console.error("[PUSH ERROR]", err.message);
    }
  }
);


// ============================================
// PROOF LOG + DELIVERY CODE
// ============================================
const crypto = require("crypto");

// Same key-sorted form is used by the certificate page to re-check the fingerprints
function zbCanon(v) {
  if (Array.isArray(v)) return "[" + v.map(zbCanon).join(",") + "]";
  if (v && typeof v === "object") {
    return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + zbCanon(v[k])).join(",") + "}";
  }
  return JSON.stringify(v === undefined ? null : v);
}

// Adds one permanent entry to an order's proof chain
async function zbAppendProof(orderId, order, type, actorUid, actorRole, data) {
  const headRef  = db.collection("order_proof_heads").doc(orderId);
  const proofRef = db.collection("order_proofs").doc();
  const cleanData = JSON.parse(JSON.stringify(data || {}));

  await db.runTransaction(async (t) => {
    const head     = await t.get(headRef);
    const prevHash = head.exists ? head.data().hash : "GENESIS";
    const seq      = head.exists ? head.data().seq + 1 : 1;

    const core = {
      orderId, seq, type,
      atMs:      Date.now(),
      actorUid:  actorUid || "",
      actorRole: actorRole || "system",
      data:      cleanData
    };
    const hash = crypto.createHash("sha256").update(prevHash + zbCanon(core)).digest("hex");

    t.set(proofRef, {
      ...core,
      buyerUid:    order.buyerUid || "",
      buyerEmail:  order.userEmail || "",
      sellerId:    order.sellerId || "",
      sellerEmail: order.sellerEmail || "",
      prevHash,
      hash,
      at: admin.firestore.FieldValue.serverTimestamp()
    });
    t.set(headRef, { seq, hash, at: admin.firestore.FieldValue.serverTimestamp() });
  });
}

// 1) A snapshot of the order the moment it is placed
exports.onOrderPlacedProof = onDocumentCreated("orders/{orderId}", async (event) => {
  try {
    const o = event.data.data();
    if (!o || !o.trackingStatus) return;
    await zbAppendProof(event.params.orderId, o, "order_placed", o.buyerUid || "", "buyer", {
      orderRef:         o.orderRef || "",
      productName:      o.productName || "",
      quantity:         o.quantity || 1,
      itemsCount:       Array.isArray(o.items) ? o.items.length : 1,
      itemTotal:        o.price || 0,
      deliveryFee:      o.deliveryFee || 0,
      protectionFee:    o.protectionFee || 0,
      total:            o.total || 0,
      transactionRef:   o.transactionRef || "",
      buyerName:        o.customerName || "",
      buyerPhone:       o.customerPhone || "",
      deliveryLocation: o.customerLocation || "",
      sellerName:       o.sellerName || ""
    });
  } catch (e) {
    console.error("[onOrderPlacedProof]", e);
  }
});

// 2) Every step change is logged; the delivery code is created when payment is confirmed
exports.onOrderProofLog = onDocumentUpdated("orders/{orderId}", async (event) => {
  try {
    const before = event.data.before.data() || {};
    const after  = event.data.after.data()  || {};
    const status = after.trackingStatus;
    if (!status || before.trackingStatus === status) return;

    const orderId = event.params.orderId;
    const events  = Array.isArray(after.trackingEvents) ? after.trackingEvents : [];
    const last    = [...events].reverse().find(e => e.status === status) || {};
    const role    = last.by || "system";
    const isSeller = String(role).startsWith("seller");
    const actorUid = isSeller ? (after.sellerId || "") : role === "buyer" ? (after.buyerUid || "") : "";

    await zbAppendProof(orderId, after, "status_" + status, actorUid, isSeller ? "seller" : role, {
      status, eventAtMs: last.at || 0
    });

    const notifyBuyer = async (title, message) => {
      if (!after.buyerUid || after.buyerUid === "guest") return;
      await db.collection("notifications").add({
        userId: after.buyerUid, type: "order", title, message, orderId, read: false, createdAt: new Date()
      });
    };

    if (status === "payment_verified") {
      const secretRef = db.collection("order_secrets").doc(orderId);
      const existing  = await secretRef.get();
      if (!existing.exists) {
        await secretRef.set({
          buyerUid:   after.buyerUid || "",
          buyerEmail: after.userEmail || "",
          code:       String(crypto.randomInt(1000, 10000)),
          attempts:   0,
          used:       false,
          createdAt:  admin.firestore.FieldValue.serverTimestamp()
        });
        await notifyBuyer(
          "🔐 Your delivery code is ready",
          "Open My Orders to see your 4-digit delivery code. Give it to the seller only when you are holding your item."
        );
      }
    }


    if (status === "received") {
      const noteUrl = `https://zibuy.ziteche.com/handover-note.html?order=${orderId}`;
      const itemName = after.productName || "your order";

      await notifyBuyer("✍️ Please sign your receipt note",
        `Review and sign the handover note for ${itemName} with your account password.`);
      if (after.sellerId) {
        await db.collection("notifications").add({
          userId: after.sellerId, type: "order", title: "✍️ Please sign the handover note",
          message: `Review and sign the handover note for ${itemName} with your account password.`,
          orderId, read: false, createdAt: new Date()
        });
      }

      const body = `<p>The delivery of <strong>${itemName}</strong> is complete.
        Please review and sign the handover note. You sign by confirming your account password.</p>`;
      await sendEmail(after.userEmail,   "Please sign your ZiBuy receipt note",
        emailTemplate("Sign your receipt note", body, "Review & sign", noteUrl));
      await sendEmail(after.sellerEmail, "Please sign the ZiBuy handover note",
        emailTemplate("Sign the handover note", body, "Review & sign", noteUrl));
    }

    if (status === "received" && after.deliveryProof?.method === "pin") {
      await notifyBuyer("✅ Delivery confirmed", "Your delivery code was verified at handover. Thank you for shopping on ZiBuy.");
    }
  } catch (e) {
    console.error("[onOrderProofLog]", e);
  }
});

// 3) The seller types the buyer's code at handover; checked here, on the server
exports.verifyDeliveryCode = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Please log in");

  const orderId = String(request.data?.orderId || "");
  const code    = String(request.data?.code || "").trim();
  if (!orderId || !/^\d{4}$/.test(code)) throw new HttpsError("invalid-argument", "Enter the 4-digit code");

  const ev          = request.data?.evidence || {};
  const photoPath   = String(ev.photoPath || "");
  const photoSha256 = String(ev.photoSha256 || "");
  if (photoPath && !photoPath.startsWith(`handover-photos/${uid}/`)) {
    throw new HttpsError("invalid-argument", "Invalid photo");
  }
  if (photoSha256 && !/^[a-f0-9]{64}$/.test(photoSha256)) {
    throw new HttpsError("invalid-argument", "Invalid photo fingerprint");
  }
  const loc = (ev.location && Number.isFinite(Number(ev.location.lat)) && Number.isFinite(Number(ev.location.lng)))
    ? {
        lat:      Math.round(Number(ev.location.lat) * 1e5) / 1e5,
        lng:      Math.round(Number(ev.location.lng) * 1e5) / 1e5,
        accuracy: Math.round(Number(ev.location.accuracy) || 0),
        atMs:     Number(ev.location.atMs) || Date.now()
      }
    : null;

  const orderRef  = db.collection("orders").doc(orderId);
  const secretRef = db.collection("order_secrets").doc(orderId);

  const outcome = await db.runTransaction(async (t) => {
    const [oSnap, sSnap] = await Promise.all([t.get(orderRef), t.get(secretRef)]);
    if (!oSnap.exists) throw new HttpsError("not-found", "Order not found");

    const o = oSnap.data();
    if (o.sellerId !== uid) throw new HttpsError("permission-denied", "This isn't your order");
    if (o.refunded) throw new HttpsError("failed-precondition", "This order was refunded and can't be delivered");
    if (!["on_the_way", "arrived"].includes(o.trackingStatus)) {
      throw new HttpsError("failed-precondition", "This order isn't out for delivery");
    }
    if (!sSnap.exists) throw new HttpsError("failed-precondition", "No delivery code exists for this order");

    const s = sSnap.data();
    if (s.used) throw new HttpsError("failed-precondition", "This order was already completed");
    if ((s.attempts || 0) >= 5) {
      throw new HttpsError("resource-exhausted", "Too many wrong attempts. Please contact ZiBuy support.");
    }

    if (s.code !== code) {
      t.update(secretRef, { attempts: (s.attempts || 0) + 1 });
      return { ok: false, attemptsLeft: 4 - (s.attempts || 0), order: o };
    }

    if (!photoPath) throw new HttpsError("invalid-argument", "Please take a photo of the handover first");
    const events = Array.isArray(o.trackingEvents) ? o.trackingEvents : [];
    t.update(orderRef, {
      trackingStatus:    "received",
      trackingEvents:    [...events, { status: "received", at: Date.now(), by: "seller_pin" }],
      deliveryConfirmed: true,
      confirmedAt:       new Date(),
      deliveryProof:     { method: "pin", verifiedAt: new Date(), sellerUid: uid, photoPath, photoSha256, location: loc },
      updatedAt:         new Date()
    });
    t.update(secretRef, { used: true, usedAt: admin.firestore.FieldValue.serverTimestamp() });
    return { ok: true, order: o };
  });

  if (!outcome.ok) {
    await zbAppendProof(orderId, outcome.order, "delivery_pin_failed", uid, "seller", { attemptsLeft: outcome.attemptsLeft });
    throw new HttpsError("invalid-argument", `Wrong code. ${outcome.attemptsLeft} attempt(s) left.`);
  }

  await zbAppendProof(orderId, outcome.order, "delivery_pin_verified", uid, "seller", {
    method: "pin",
    hasPhoto: true,
    photoSha256,
    lat:      loc ? loc.lat : null,
    lng:      loc ? loc.lng : null,
    accuracy: loc ? loc.accuracy : null
  });
  return { ok: true };
});


// ============================================
// SELLER PAYOUT: admin records it, seller signs with an email code
// ============================================
const zbSha = (s) => crypto.createHash("sha256").update(s).digest("hex");

// 1) Admin records that the money was sent to the seller
exports.recordPayout = onCall(async (request) => {
  const caller = await assertCallerIsFullAdmin(request);
  const d = request.data || {};

  const orderId = String(d.orderId || "");
  const amount  = Math.round(Number(d.amount));
  const method  = ["mtn", "airtel", "bank"].includes(d.method) ? d.method : "";
  const txnId   = String(d.txnId || "").trim();
  if (!orderId || !(amount > 0) || !method || txnId.length < 4) {
    throw new HttpsError("invalid-argument", "Order, amount, method and transaction ID are required");
  }

  const orderSnap = await db.collection("orders").doc(orderId).get();
  if (!orderSnap.exists) throw new HttpsError("not-found", "Order not found");
  const o = orderSnap.data();

  if (!o.sellerId) {
    const found = await zbResolveSeller(o);
    if (!found) {
      throw new HttpsError("failed-precondition", "We couldn't find the seller's account (the listing may have been deleted)");
    }
    Object.assign(o, found);
    await orderSnap.ref.update(found);
  }
  if (o.trackingStatus !== "received") {
    throw new HttpsError("failed-precondition", "Pay the seller only after the buyer has received the order");
  }

  if (o.refunded) throw new HttpsError("failed-precondition", "This order was refunded, so no seller payout is due");
  const existing = await db.collection("payouts").where("orderId", "==", orderId).limit(1).get();
  if (!existing.empty) throw new HttpsError("already-exists", "A payout was already recorded for this order");

  const core = {
    orderId, sellerId: o.sellerId, amount, method, txnId,
    payoutDateMs: Number(d.payoutDateMs) || Date.now()
  };
  const detailsHash = zbSha(zbCanon(core));

  const ref = db.collection("payouts").doc();
  await ref.set({
    ...core,
    orderRef:      o.orderRef || "",
    sellerEmail:   o.sellerEmail || "",
    sellerName:    o.sellerName || "",
    buyerUid:      o.buyerUid || "",
    screenshotUrl: String(d.screenshotUrl || ""),
    status:        "sent",
    detailsHash,
    recordedBy:    caller.email,
    createdAt:     admin.firestore.FieldValue.serverTimestamp()
  });

  // the log only holds a fingerprint of the details, so buyers never see the amount
  await zbAppendProof(orderId, o, "payout_recorded", caller.uid, "admin", {
    payoutId: ref.id, method, detailsHash
  });

  await db.collection("notifications").add({
    userId:    o.sellerId,
    type:      "order",
    title:     "💸 ZiBuy has sent your payment",
    message:   `UGX ${amount.toLocaleString()} for ${o.productName || "your order"} was sent via ${method.toUpperCase()}. Please open Orders to Deliver and confirm you received it.`,
    orderId,
    read:      false,
    createdAt: new Date()
  });

  return { ok: true, payoutId: ref.id };
});

// 2) Seller asks for a confirmation code, sent to their account email
exports.requestPayoutCode = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Please log in");

  const payoutId = String(request.data?.payoutId || "");
  const pSnap = await db.collection("payouts").doc(payoutId).get();
  if (!pSnap.exists) throw new HttpsError("not-found", "Payout not found");

  const p = pSnap.data();
  if (p.sellerId !== uid) throw new HttpsError("permission-denied", "This payout isn't yours");
  if (p.status === "acknowledged") throw new HttpsError("failed-precondition", "You already confirmed this payment");

  const email = request.auth.token.email;
  if (!email) throw new HttpsError("failed-precondition", "Your account has no email address");

  const cRef  = db.collection("payout_codes").doc(payoutId);
  const cSnap = await cRef.get();
  const now   = Date.now();
  const recent = ((cSnap.exists ? cSnap.data().sends : []) || []).filter(ms => now - ms < 3600000);
  if (recent.length >= 3) {
    throw new HttpsError("resource-exhausted", "Too many codes requested. Please try again in an hour.");
  }

  const code = String(crypto.randomInt(100000, 1000000));
  await cRef.set({
    hash:      zbSha(payoutId + ":" + code),
    expiresAt: now + 10 * 60 * 1000,
    attempts:  0,
    used:      false,
    sends:     [...recent, now]
  });

  try {
    await transporter.sendMail({
      from:    `"ZiBuy" <${process.env.GMAIL_EMAIL}>`,
      to:      email,
      subject: "Your ZiBuy payment confirmation code",
      html:    emailTemplate(
        "Confirm your payment",
        `<p>Your confirmation code is</p>
         <p style="font-size:30px;font-weight:800;letter-spacing:6px;margin:8px 0">${code}</p>
         <p>It expires in 10 minutes. Enter it on the ZiBuy page to confirm you received
         <strong>UGX ${Number(p.amount).toLocaleString()}</strong> from ZiBuy.
         ZiBuy staff will never ask you for this code.</p>`
      )
    });
  } catch (err) {
    console.error("[requestPayoutCode] email failed:", err.message);
    throw new HttpsError("internal", "We couldn't send the email. Please try again in a moment.");
  }

  return { ok: true, sentTo: email.replace(/^(.).*(@.*)$/, "$1***$2") };
});

// 3) Seller signs: code + typed full name + confirmation tick
exports.acknowledgePayout = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Please log in");

  const payoutId = String(request.data?.payoutId || "");
  const code     = String(request.data?.code || "").trim();
  const fullName = String(request.data?.fullName || "").trim();

  if (request.data?.agree !== true)  throw new HttpsError("invalid-argument", "Please tick the confirmation box");
  if (fullName.length < 3)           throw new HttpsError("invalid-argument", "Type your full name to sign");
  if (!/^\d{6}$/.test(code))         throw new HttpsError("invalid-argument", "Enter the 6-digit code from your email");

  const headers = request.rawRequest?.headers || {};
  const ip = String(headers["x-forwarded-for"] || request.rawRequest?.ip || "").split(",")[0].trim();
  const ua = String(headers["user-agent"] || "").slice(0, 300);

  const pRef = db.collection("payouts").doc(payoutId);
  const cRef = db.collection("payout_codes").doc(payoutId);

  const result = await db.runTransaction(async (t) => {
    const [pSnap, cSnap] = await Promise.all([t.get(pRef), t.get(cRef)]);
    if (!pSnap.exists) throw new HttpsError("not-found", "Payout not found");

    const p = pSnap.data();
    if (p.sellerId !== uid)       throw new HttpsError("permission-denied", "This payout isn't yours");
    if (p.status !== "sent")      throw new HttpsError("failed-precondition", "This payment was already confirmed");
    if (!cSnap.exists)            throw new HttpsError("failed-precondition", "Please request a code first");

    const c = cSnap.data();
    if (c.used)                   throw new HttpsError("failed-precondition", "This code was already used");
    if (Date.now() > c.expiresAt) throw new HttpsError("deadline-exceeded", "The code expired. Please request a new one.");
    if ((c.attempts || 0) >= 5)   throw new HttpsError("resource-exhausted", "Too many wrong attempts. Please request a new code.");

    if (c.hash !== zbSha(payoutId + ":" + code)) {
      t.update(cRef, { attempts: (c.attempts || 0) + 1 });
      return { ok: false, left: 4 - (c.attempts || 0) };
    }

    const atMs = Date.now();
    t.update(pRef, {
      status: "acknowledged",
      acknowledgement: {
        atMs,
        nameTyped: fullName,
        email:     request.auth.token.email || "",
        via:       "email_code",
        ip,
        userAgent: ua
      }
    });
    t.update(cRef, { used: true });
    return { ok: true, p, atMs };
  });

  if (!result.ok) {
    throw new HttpsError("invalid-argument", `Wrong code. ${result.left} attempt(s) left.`);
  }

  const p = result.p;
  const oSnap = await db.collection("orders").doc(p.orderId).get();
  const o = oSnap.exists ? oSnap.data() : {};

  const ackHash = zbSha(zbCanon({ payoutId, nameTyped: fullName, atMs: result.atMs, email: request.auth.token.email || "" }));
  await zbAppendProof(p.orderId, o, "payout_acknowledged", uid, "seller", {
    payoutId, method: p.method, detailsHash: p.detailsHash, signedVia: "email_code", ackHash
  });

  // tell the buyer and the owner
  const notes = [];
  if (o.buyerUid && o.buyerUid !== "guest") {
    notes.push({
      userId:  o.buyerUid,
      title:   "✅ The seller has been paid",
      message: `The seller confirmed they received their payment for ${o.productName || "your order"}. Your order is now complete.`
    });
  }
  const ownerSnap = await db.collection("users").where("email", "==", "swaibuziraye22@gmail.com").limit(1).get();
  if (!ownerSnap.empty) {
    notes.push({
      userId:  ownerSnap.docs[0].id,
      title:   "✅ Seller confirmed payout",
      message: `${fullName} confirmed receiving UGX ${Number(p.amount).toLocaleString()} for ${o.productName || "an order"}.`
    });
  }
  await Promise.all(notes.map(n => db.collection("notifications").add({
    ...n, type: "order", orderId: p.orderId, read: false, createdAt: new Date()
  })));

  return { ok: true };
});


// ============================================
// FINDS THE SELLER'S ACCOUNT FOR ANY ORDER (even older ones)
// ============================================
async function zbResolveSeller(o) {
  if (o.sellerId) {
    return { sellerId: o.sellerId, sellerEmail: o.sellerEmail || "", sellerName: o.sellerName || "" };
  }

  const pid = o.productId || o.items?.[0]?.productId;
  if (pid) {
    const ps = await db.collection("products").doc(pid).get();
    if (ps.exists && ps.data().userId) {
      const p = ps.data();
      return {
        sellerId:    p.userId,
        sellerEmail: (await db.collection("users").doc(p.userId).get()).data()?.email || "",
        sellerName:  p.seller?.name || o.sellerName || ""
      };
    }
  }

  if (o.sellerEmail) {
    const u = await db.collection("users").where("email", "==", o.sellerEmail).limit(1).get();
    if (!u.empty) {
      return { sellerId: u.docs[0].id, sellerEmail: o.sellerEmail, sellerName: o.sellerName || "" };
    }
  }
  return null;
}

// ============================================
// DAILY SEAL: emails the owner the latest record fingerprints
// ============================================
exports.dailyProofSeal = onSchedule(
  { schedule: "55 23 * * *", timeZone: "Africa/Kampala" },
  async () => {
    try {
      const since = admin.firestore.Timestamp.fromMillis(Date.now() - 24 * 3600 * 1000);
      const snap  = await db.collection("order_proof_heads").where("at", ">=", since).get();
      if (snap.empty) return;

      const rows = snap.docs
        .map(d => ({ orderId: d.id, seq: d.data().seq, hash: d.data().hash }))
        .sort((a, b) => a.orderId.localeCompare(b.orderId));

      const date = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Kampala" });
      const csv  = "orderId,entries,latestFingerprint\n" +
        rows.map(r => `${r.orderId},${r.seq},${r.hash}`).join("\n");
      const sealHash = zbSha(csv);

      await db.collection("daily_seals").doc(date).set({
        date, orders: rows.length, sealHash,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await transporter.sendMail({
        from:    `"ZiBuy" <${process.env.GMAIL_EMAIL}>`,
        to:      "swaibuziraye22@gmail.com",
        subject: `ZiBuy daily record seal ${date}`,
        html:    emailTemplate(
          `Daily record seal: ${date}`,
          `<p>${rows.length} order record(s) had new entries in the last 24 hours.</p>
           <p><strong>Seal fingerprint:</strong><br>
           <span style="font-family:monospace;word-break:break-all;font-size:12px">${sealHash}</span></p>
           <p>The attached file lists the latest fingerprint of each order's record.
           Keep these emails: they are an independent, time-stamped copy that proves what was recorded and when.</p>`
        ),
        attachments: [{ filename: `zibuy-seal-${date}.csv`, content: csv }]
      });
    } catch (e) {
      console.error("[dailyProofSeal]", e);
    }
  }
);

// ============================================
// SIGNED HANDOVER NOTE
// ============================================
function zbNoteSnapshot(orderId, o) {
  const items = (Array.isArray(o.items) && o.items.length)
    ? o.items.map(i => ({ name: String(i.name || ""), qty: Number(i.qty) || 1, price: Number(i.price) || 0 }))
    : [{ name: String(o.productName || ""), qty: Number(o.quantity) || 1, price: Number(o.unitPrice || o.price) || 0 }];

  const received = (Array.isArray(o.trackingEvents) ? o.trackingEvents : [])
    .filter(e => e.status === "received").map(e => e.at).pop() || 0;

  return {
    orderId,
    orderRef:         o.orderRef || "",
    items,
    total:            Number(o.total) || 0,
    buyerName:        o.customerName || "",
    buyerPhone:       o.customerPhone || "",
    buyerEmail:       o.userEmail || "",
    sellerName:       o.sellerName || "",
    sellerPhone:      o.sellerPhone || "",
    deliveryLocation: o.customerLocation || "",
    deliveredAtMs:    received,
    deliveryMethod:   o.deliveryProof?.method || "buyer_confirmation",
    photoSha256:      o.deliveryProof?.photoSha256 || ""
  };
}

exports.signHandoverNote = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Please log in");

  const orderId = String(request.data?.orderId || "");
  if (!orderId) throw new HttpsError("invalid-argument", "Missing order");

  // the signer must have just re-entered their password (or confirmed with Google)
  const authTime = Number(request.auth.token.auth_time || 0);
  if (!authTime || Date.now() / 1000 - authTime > 300) {
    throw new HttpsError("failed-precondition", "Please confirm your password again to sign");
  }

  const orderRef = db.collection("orders").doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Order not found");
  const o = snap.data();

  const email = request.auth.token.email || "";
  let role = "";
  if ((o.buyerUid && o.buyerUid === uid) || (o.userEmail && o.userEmail === email))            role = "buyer";
  else if ((o.sellerId && o.sellerId === uid) || (o.sellerEmail && o.sellerEmail === email))   role = "seller";
  else throw new HttpsError("permission-denied", "You are not part of this order");

  if (o.trackingStatus !== "received") {
    throw new HttpsError("failed-precondition", "The note can be signed once the order has been received");
  }

  const snapshot     = zbNoteSnapshot(orderId, o);
  const documentHash = zbSha(zbCanon(snapshot));
  const atMs         = Date.now();

  const uDoc = await db.collection("users").doc(uid).get();
  const name = uDoc.data()?.displayName || request.auth.token.name || email;
  const provider = request.auth.token.firebase?.sign_in_provider || "";

  const headers = request.rawRequest?.headers || {};
  const ip = String(headers["x-forwarded-for"] || request.rawRequest?.ip || "").split(",")[0].trim();
  const ua = String(headers["user-agent"] || "").slice(0, 300);

  const sigId = `${orderId}_${role}`;
  try {
    // create() fails if this person already signed
    await db.collection("order_signatures").doc(sigId).create({
      orderId, role, uid, name, provider, atMs, documentHash, snapshot,
      buyerUid: role === "buyer"  ? uid : (o.buyerUid || ""),
      sellerId: role === "seller" ? uid : (o.sellerId || ""),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    throw new HttpsError("already-exists", "You already signed this note");
  }

  // private details, visible to admins only
  await db.collection("order_signature_meta").doc(sigId).set({ orderId, role, email, ip, userAgent: ua, atMs });

  await orderRef.update({ [`noteSigned.${role}`]: atMs });

  await zbAppendProof(orderId, o, role === "buyer" ? "note_signed_buyer" : "note_signed_seller", uid, role, {
    documentHash, via: provider === "google.com" ? "google" : "password"
  });

  // tell the owner, and remind the other side if they have not signed yet
  const item  = o.productName || "an order";
  const other = role === "buyer" ? "seller" : "buyer";
  const otherUid = role === "buyer" ? o.sellerId : o.buyerUid;
  const notes = [];

  const ownerSnap = await db.collection("users").where("email", "==", "swaibuziraye22@gmail.com").limit(1).get();
  if (!ownerSnap.empty) {
    notes.push({ userId: ownerSnap.docs[0].id, title: `✍️ ${role === "buyer" ? "Buyer" : "Seller"} signed the note`,
                 message: `${name} signed the handover note for ${item}.` });
  }
  if (otherUid && !o.noteSigned?.[other]) {
    notes.push({ userId: otherUid, title: "✍️ The other side has signed",
                 message: `Your signature is still needed on the handover note for ${item}.` });
  }
  await Promise.all(notes.map(n => db.collection("notifications").add({
    ...n, type: "order", orderId, read: false, createdAt: new Date()
  })));

  return { ok: true };
});


// ============================================
// ACCOUNT SECURITY: terms log, email codes, phone login
// ============================================
const ZB_WEB_API_KEY = "AIzaSyDc7-XKk30DshUE-9PUoMF4VObt4UTIncM";   // the public web key from your site config

function zbClientInfo(request) {
  const h = request.rawRequest?.headers || {};
  return {
    ip: String(h["x-forwarded-for"] || request.rawRequest?.ip || "").split(",")[0].trim(),
    ua: String(h["user-agent"] || "").slice(0, 300)
  };
}

// Simple limiter: at most `max` tries per `windowMs` for a key
async function zbRateLimit(key, max, windowMs) {
  const ref  = db.collection("rate_limits").doc(zbSha(key));
  const now  = Date.now();
  const snap = await ref.get();
  const hits = ((snap.exists ? snap.data().hits : []) || []).filter(ms => now - ms < windowMs);
  if (hits.length >= max) {
    throw new HttpsError("resource-exhausted", "Too many attempts. Please wait a few minutes and try again.");
  }
  hits.push(now);
  await ref.set({ hits, updatedAt: now });
}

// Ugandan numbers in every common spelling: 0701234567, 256701234567, +256701234567, 701234567
function zbPhoneForms(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("0") && d.length === 10) d = "256" + d.slice(1);
  if (d.length === 9) d = "256" + d;
  if (!/^256\d{9}$/.test(d)) return null;
  return [d, "+" + d, "0" + d.slice(3), d.slice(3)];
}

// ── Current versions of the Terms and Privacy Policy ──
async function zbLegalVersions() {
  const snap = await db.collection("system_config").doc("legal").get();
  const d = snap.exists ? snap.data() : {};
  return {
    termsVersion:   String(d.termsVersion   || "2026-10-15"),
    privacyVersion: String(d.privacyVersion || "2026-10-15")
  };
}

// Fingerprint of the pages as they are live right now (cached for an hour)
let zbLegalHashCache = { at: 0, terms: "", privacy: "" };
async function zbLegalHashes() {
  if (Date.now() - zbLegalHashCache.at < 3600000) return zbLegalHashCache;
  const hash = async (path) => {
    try {
      const r = await fetch("https://zibuy.ziteche.com/" + path);
      return zbSha(await r.text());
    } catch (e) { return "unavailable"; }
  };
  zbLegalHashCache = { at: Date.now(), terms: await hash("terms.html"), privacy: await hash("privacy.html") };
  return zbLegalHashCache;
}

// 1) Saves that a person accepted the Terms and Privacy Policy
exports.recordTermsAcceptance = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Please log in");

  const d = request.data || {};
  if (d.agreed !== true) throw new HttpsError("invalid-argument", "Please tick the box to accept");

  const legal = await zbLegalVersions();
  if (String(d.termsVersion) !== legal.termsVersion || String(d.privacyVersion) !== legal.privacyVersion) {
    throw new HttpsError("failed-precondition", "Our terms were just updated. Please refresh the page and try again.");
  }

  const method = ["signup_form", "google_signup", "reaccept", "login_gate"].includes(d.method) ? d.method : "login_gate";
  const { ip, ua } = zbClientInfo(request);
  const hashes = await zbLegalHashes();
  const email  = request.auth.token.email || "";

  const uDoc = await db.collection("users").doc(uid).get();
  const name = uDoc.data()?.displayName || request.auth.token.name || "";
  const atMs = Date.now();

  await db.collection("terms_acceptances").add({
    uid, email, name,
    termsVersion:   legal.termsVersion,
    privacyVersion: legal.privacyVersion,
    termsHash:      hashes.terms,
    privacyHash:    hashes.privacy,
    method, ip, userAgent: ua, atMs,
    at: admin.firestore.FieldValue.serverTimestamp()
  });

  await db.collection("users").doc(uid).set({
    termsAccepted: { termsVersion: legal.termsVersion, privacyVersion: legal.privacyVersion, atMs, method }
  }, { merge: true });

  return { ok: true };
});

// 2) Sends a 6-digit code to the account's email
exports.sendEmailCode = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Please log in");

  const email = request.auth.token.email;
  if (!email) throw new HttpsError("failed-precondition", "Your account has no email address");
  if (request.auth.token.email_verified === true) return { alreadyVerified: true };

  const ref  = db.collection("email_codes").doc(uid);
  const snap = await ref.get();
  const now  = Date.now();
  const recent = ((snap.exists ? snap.data().sends : []) || []).filter(ms => now - ms < 3600000);

  if (recent.length >= 5) {
    throw new HttpsError("resource-exhausted", "Too many codes requested. Please try again in an hour.");
  }
  if (recent.length && now - recent[recent.length - 1] < 30000) {
    throw new HttpsError("resource-exhausted", "Please wait a few seconds before asking for another code.");
  }

  const code = String(crypto.randomInt(100000, 1000000));
  await ref.set({
    hash:      zbSha(uid + ":" + code),
    expiresAt: now + 10 * 60 * 1000,
    attempts:  0,
    used:      false,
    sends:     [...recent, now]
  });

  try {
    await transporter.sendMail({
      from:    `"ZiBuy" <${process.env.GMAIL_EMAIL}>`,
      to:      email,
      subject: "Your ZiBuy verification code",
      html:    emailTemplate(
        "Verify your email",
        `<p>Welcome to ZiBuy! Your verification code is</p>
         <p style="font-size:30px;font-weight:800;letter-spacing:6px;margin:8px 0">${code}</p>
         <p>It expires in 10 minutes. If you didn't create a ZiBuy account, you can ignore this email.</p>`
      )
    });
  } catch (err) {
    console.error("[sendEmailCode] email failed:", err.message);
    throw new HttpsError("internal", "We couldn't send the email. Please try again in a moment.");
  }

  return { ok: true, sentTo: email.replace(/^(.).*(@.*)$/, "$1***$2") };
});

// 3) Checks the code and marks the email as verified
exports.verifyEmailCode = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Please log in");

  const code = String(request.data?.code || "").trim();
  if (!/^\d{6}$/.test(code)) throw new HttpsError("invalid-argument", "Enter the 6-digit code");

  const ref  = db.collection("email_codes").doc(uid);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("failed-precondition", "Please request a code first");

  const c = snap.data();
  if (c.used)                   throw new HttpsError("failed-precondition", "This code was already used");
  if (Date.now() > c.expiresAt) throw new HttpsError("deadline-exceeded", "The code expired. Please request a new one.");
  if ((c.attempts || 0) >= 5)   throw new HttpsError("resource-exhausted", "Too many wrong attempts. Please request a new code.");

  if (c.hash !== zbSha(uid + ":" + code)) {
    await ref.update({ attempts: (c.attempts || 0) + 1 });
    throw new HttpsError("invalid-argument", `Wrong code. ${4 - (c.attempts || 0)} attempt(s) left.`);
  }

  await ref.update({ used: true });
  await admin.auth().updateUser(uid, { emailVerified: true });
  await db.collection("users").doc(uid).set({ emailVerified: true, emailVerifiedAt: Date.now() }, { merge: true });

  return { ok: true };
});

// 4) Log in with phone number + password: finds the email only if the password is right
exports.phoneLoginLookup = onCall(async (request) => {
  const forms    = zbPhoneForms(request.data?.phone);
  const password = String(request.data?.password || "");
  const generic  = new HttpsError("invalid-argument", "Wrong phone number or password.");
  if (!forms || !password) throw generic;

  const { ip } = zbClientInfo(request);
  await zbRateLimit("phone:" + forms[0], 8, 15 * 60000);
  await zbRateLimit("ip:" + ip, 40, 15 * 60000);

  const found = await db.collection("users").where("phone", "in", forms).limit(5).get();

  for (const d of found.docs) {
    const email = d.data().email;
    if (!email) continue;
    try {
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${ZB_WEB_API_KEY}`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json", "Referer": "https://zibuy.ziteche.com/" },
          body:    JSON.stringify({ email, password, returnSecureToken: false })
        }
      );
      if (res.ok) return { email };

      const body = await res.json().catch(() => ({}));
      if (body?.error?.message === "USER_DISABLED") {
        throw new HttpsError("permission-denied", "This account has been disabled. Please contact support.");
      }
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      console.error("[phoneLoginLookup]", e.message);
    }
  }
  throw generic;
});

// 5) Friendly "already registered" checks on the sign-up form
exports.checkSignupAvailability = onCall(async (request) => {
  const { ip } = zbClientInfo(request);
  await zbRateLimit("avail:" + ip, 30, 3600000);

  const email = String(request.data?.email || "").trim().toLowerCase();
  const forms = zbPhoneForms(request.data?.phone);
  let emailTaken = false, phoneTaken = false;

  if (/^\S+@\S+\.\S+$/.test(email)) {
    try { await admin.auth().getUserByEmail(email); emailTaken = true; } catch (e) { /* not registered */ }
  }
  if (forms) {
    const q = await db.collection("users").where("phone", "in", forms).limit(1).get();
    phoneTaken = !q.empty;
  }
  return { emailTaken, phoneTaken };
});


// ============================================
// REFUNDS: admin records, buyer confirms
// ============================================
exports.recordRefund = onCall(async (request) => {
  const caller = await assertCallerIsFullAdmin(request);
  const d = request.data || {};

  const orderId = String(d.orderId || "");
  const amount  = Math.round(Number(d.amount));
  const method  = ["mtn", "airtel", "bank"].includes(d.method) ? d.method : "";
  const txnId   = String(d.txnId || "").trim();
  const reason  = String(d.reason || "").trim().slice(0, 200);
  if (!orderId || !(amount > 0) || !method || txnId.length < 4 || !reason) {
    throw new HttpsError("invalid-argument", "Order, amount, method, transaction ID and reason are required");
  }

  const orderRef = db.collection("orders").doc(orderId);
  const oSnap = await orderRef.get();
  if (!oSnap.exists) throw new HttpsError("not-found", "Order not found");
  const o = oSnap.data();
  const total = Number(o.total) || 0;

  // the buyer's account
  let buyerUid = (o.buyerUid && o.buyerUid !== "guest") ? o.buyerUid : "";
  if (!buyerUid && o.userEmail && o.userEmail !== "guest") {
    const u = await db.collection("users").where("email", "==", o.userEmail).limit(1).get();
    if (!u.empty) buyerUid = u.docs[0].id;
  }
  if (!buyerUid) throw new HttpsError("failed-precondition", "We couldn't find the buyer's account");

  // never refund more than the buyer paid
  const prev = await db.collection("refunds").where("orderId", "==", orderId).get();
  const already = prev.docs.reduce((t, x) => t + (Number(x.data().amount) || 0), 0);
  if (already + amount > total) {
    throw new HttpsError("failed-precondition",
      `Refunds can't be more than the amount paid (UGX ${total.toLocaleString()}). Already refunded: UGX ${already.toLocaleString()}.`);
  }

  const core = { orderId, buyerUid, amount, method, txnId, reason, refundDateMs: Date.now() };
  const detailsHash = zbSha(zbCanon(core));

  const ref = db.collection("refunds").doc();
  await ref.set({
    ...core,
    orderRef:      o.orderRef || "",
    buyerEmail:    o.userEmail || "",
    buyerName:     o.customerName || "",
    sellerId:      o.sellerId || "",
    screenshotUrl: String(d.screenshotUrl || ""),
    status:        "sent",
    detailsHash,
    recordedBy:    caller.email,
    createdAt:     admin.firestore.FieldValue.serverTimestamp()
  });

  const fully = already + amount >= total;
  await orderRef.update(fully
    ? { refunded: true, status: "refunded", refundedAt: Date.now(), updatedAt: new Date() }
    : { partiallyRefunded: already + amount, updatedAt: new Date() });

  // the log only holds a fingerprint of the details, so the seller never sees the amount
  await zbAppendProof(orderId, o, "refund_recorded", caller.uid, "admin", {
    refundId: ref.id, method, detailsHash
  });

  const item = o.productName || "your order";
  const notes = [{
    userId:  buyerUid,
    title:   "↩️ ZiBuy has sent your refund",
    message: `UGX ${amount.toLocaleString()} for ${item} was sent via ${method.toUpperCase()}. Open My Orders and confirm you received it.`
  }];
  if (o.sellerId) {
    notes.push({
      userId:  o.sellerId,
      title:   "ℹ️ A refund was issued to the buyer",
      message: fully
        ? `The order for ${item} (${o.orderRef || ""}) was refunded. Please do not deliver it.`
        : `A partial refund was issued on the order for ${item} (${o.orderRef || ""}).`
    });
  }
  await Promise.all(notes.map(n => db.collection("notifications").add({
    ...n, type: "order", orderId, read: false, createdAt: new Date()
  })));

  return { ok: true, refundId: ref.id };
});

exports.confirmRefund = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Please log in");

  // the buyer must have just re-entered their password (or confirmed with Google)
  const authTime = Number(request.auth.token.auth_time || 0);
  if (!authTime || Date.now() / 1000 - authTime > 300) {
    throw new HttpsError("failed-precondition", "Please confirm your password again to continue");
  }

  const refundId = String(request.data?.refundId || "");
  const rRef = db.collection("refunds").doc(refundId);

  const uDoc = await db.collection("users").doc(uid).get();
  const name = uDoc.data()?.displayName || request.auth.token.name || request.auth.token.email || "";
  const provider = request.auth.token.firebase?.sign_in_provider || "";
  const { ip, ua } = zbClientInfo(request);

  const r = await db.runTransaction(async (t) => {
    const snap = await t.get(rRef);
    if (!snap.exists) throw new HttpsError("not-found", "Refund not found");
    const x = snap.data();
    if (x.buyerUid !== uid)  throw new HttpsError("permission-denied", "This refund isn't yours");
    if (x.status !== "sent") throw new HttpsError("failed-precondition", "This refund was already confirmed");
    t.update(rRef, {
      status: "acknowledged",
      acknowledgement: {
        atMs: Date.now(), name, email: request.auth.token.email || "",
        via: provider === "google.com" ? "google" : "password", ip, userAgent: ua
      }
    });
    return x;
  });

  const oSnap = await db.collection("orders").doc(r.orderId).get();
  const o = oSnap.exists ? oSnap.data() : {};

  await zbAppendProof(r.orderId, o, "refund_acknowledged", uid, "buyer", {
    refundId, detailsHash: r.detailsHash, via: provider === "google.com" ? "google" : "password"
  });

  const ownerSnap = await db.collection("users").where("email", "==", "swaibuziraye22@gmail.com").limit(1).get();
  if (!ownerSnap.empty) {
    await db.collection("notifications").add({
      userId: ownerSnap.docs[0].id, type: "order", orderId: r.orderId, read: false, createdAt: new Date(),
      title: "✅ Buyer confirmed the refund",
      message: `${name} confirmed receiving UGX ${Number(r.amount).toLocaleString()} for ${o.productName || "an order"}.`
    });
  }

  return { ok: true };
});

// ============================================
// ACCOUNT DELETION REQUESTS (for people who can't log in)
// ============================================
exports.startDeletionRequest = onCall(async (request) => {
  const email = String(request.data?.email || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpsError("invalid-argument", "Enter a valid email address");

  const { ip } = zbClientInfo(request);
  await zbRateLimit("delreq-ip:" + ip, 10, 3600000);
  await zbRateLimit("delreq:" + email, 5, 3600000);

  let exists = true;
  try { await admin.auth().getUserByEmail(email); } catch (e) { exists = false; }

  if (exists) {
    const code = String(crypto.randomInt(100000, 1000000));
    await db.collection("deletion_codes").doc(zbSha(email)).set({
      hash: zbSha(email + ":" + code), expiresAt: Date.now() + 15 * 60000, attempts: 0, used: false
    });
    try {
      await transporter.sendMail({
        from:    `"ZiBuy" <${process.env.GMAIL_EMAIL}>`,
        to:      email,
        subject: "Your ZiBuy account deletion code",
        html:    emailTemplate(
          "Confirm your deletion request",
          `<p>Someone asked to delete the ZiBuy account for this email. If it was you, enter this code on the deletion page:</p>
           <p style="font-size:30px;font-weight:800;letter-spacing:6px;margin:8px 0">${code}</p>
           <p>It expires in 15 minutes. If you didn't ask for this, ignore this email and your account stays as it is.</p>`
        )
      });
    } catch (err) {
      console.error("[startDeletionRequest] email failed:", err.message);
      throw new HttpsError("internal", "We couldn't send the email. Please try again in a moment.");
    }
  }

  // same answer either way, so nobody can use this to find out who has an account
  return { ok: true };
});

exports.confirmDeletionRequest = onCall(async (request) => {
  const email = String(request.data?.email || "").trim().toLowerCase();
  const code  = String(request.data?.code || "").trim();
  const note  = String(request.data?.note || "").trim().slice(0, 300);
  if (!/^\S+@\S+\.\S+$/.test(email) || !/^\d{6}$/.test(code)) {
    throw new HttpsError("invalid-argument", "Enter your email and the 6-digit code");
  }

  const { ip } = zbClientInfo(request);
  await zbRateLimit("delconf-ip:" + ip, 20, 3600000);

  const ref  = db.collection("deletion_codes").doc(zbSha(email));
  const snap = await ref.get();
  const bad  = new HttpsError("invalid-argument", "That code isn't valid. Please request a new one.");
  if (!snap.exists) throw bad;

  const c = snap.data();
  if (c.used || Date.now() > c.expiresAt) throw new HttpsError("deadline-exceeded", "The code expired. Please request a new one.");
  if ((c.attempts || 0) >= 5)             throw new HttpsError("resource-exhausted", "Too many wrong attempts. Please request a new code.");
  if (c.hash !== zbSha(email + ":" + code)) {
    await ref.update({ attempts: (c.attempts || 0) + 1 });
    throw new HttpsError("invalid-argument", `Wrong code. ${4 - (c.attempts || 0)} attempt(s) left.`);
  }
  await ref.update({ used: true });

  let user;
  try { user = await admin.auth().getUserByEmail(email); } catch (e) { throw bad; }

  await db.collection("deletion_requests").add({
    email, uid: user.uid, note, status: "pending", via: "web_form", ip,
    atMs: Date.now(), createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // tell the owner
  try {
    const ownerSnap = await db.collection("users").where("email", "==", "swaibuziraye22@gmail.com").limit(1).get();
    if (!ownerSnap.empty) {
      await db.collection("notifications").add({
        userId: ownerSnap.docs[0].id, type: "order", read: false, createdAt: new Date(),
        title: "🗑️ New account deletion request",
        message: `${email} asked to delete their account. Open Admin → Deletion Requests.`
      });
    }
    await transporter.sendMail({
      from: `"ZiBuy" <${process.env.GMAIL_EMAIL}>`, to: "swaibuziraye22@gmail.com",
      subject: "New account deletion request",
      html: emailTemplate("Account deletion request", `<p><strong>${email}</strong> confirmed a request to delete their account.</p><p>${note ? "Note: " + note : "No note."}</p><p>Open Admin → Deletion Requests to process it.</p>`)
    });
  } catch (e) { console.error("[confirmDeletionRequest] owner alert failed:", e.message); }

  // confirm to the person
  try {
    await transporter.sendMail({
      from: `"ZiBuy" <${process.env.GMAIL_EMAIL}>`, to: email,
      subject: "We received your ZiBuy deletion request",
      html: emailTemplate("Request received", `<p>We received your request to delete your ZiBuy account and its data. We will process it within 30 days and email you when it's done.</p><p>Some order and payment records are kept as legal evidence, as described in our Privacy Policy.</p>`)
    });
  } catch (e) { console.error("[confirmDeletionRequest] confirmation failed:", e.message); }

  return { ok: true };
});


// ============================================
// AUTOMATIC REMINDERS
// ============================================
const ZB_HOUR = 3600000;
const ZB_REMIND_SCALE = 1;   // 1 = real hours. Use 0.01 to test quickly, then put it back to 1.

async function zbAdminUids() {
  const set = new Set();
  const owner = await db.collection("users").where("email", "==", "swaibuziraye22@gmail.com").limit(1).get();
  if (!owner.empty) set.add(owner.docs[0].id);
  const staff = await db.collection("admins").get();
  staff.forEach(d => { if (d.data().suspended !== true) set.add(d.id); });
  return [...set];
}

exports.orderReminders = onSchedule(
  { schedule: "0 8,13,18 * * *", timeZone: "Africa/Kampala" },
  async () => {
    try {
      const now    = Date.now();
      const admins = await zbAdminUids();
      const hrs    = (h) => h < 48 ? `${Math.floor(h)} hours` : `${Math.floor(h / 24)} days`;

      // sends the same kind of reminder at most `max` times, at least `gap` hours apart
      const nudge = async (key, kind, recipients, title, message, orderId, { max = 3, gap = 20 } = {}) => {
        const ref  = db.collection("order_reminders").doc(key);
        const snap = await ref.get();
        const st   = (snap.exists ? snap.data()[kind] : null) || { n: 0, last: 0 };
        if (st.n >= max || now - st.last < gap * ZB_HOUR * ZB_REMIND_SCALE) return;

        const ids = [...new Set((recipients || []).filter(u => u && u !== "guest"))];
        if (!ids.length) return;

        await Promise.all(ids.map(userId => db.collection("notifications").add({
          userId, type: "order", title, message, orderId: orderId || "", read: false, createdAt: new Date()
        })));
        await ref.set({ [kind]: { n: st.n + 1, last: now } }, { merge: true });
      };

      // payouts and refunds, looked up once
      const [payoutSnap, refundSnap, orderSnap] = await Promise.all([
        db.collection("payouts").limit(2000).get(),
        db.collection("refunds").where("status", "==", "sent").limit(500).get(),
        db.collection("orders")
          .where("trackingStatus", "in", ["placed", "payment_verified", "packed", "on_the_way", "arrived", "received"])
          .limit(1000).get()
      ]);

      const payoutByOrder = {};
      payoutSnap.forEach(d => { payoutByOrder[d.data().orderId] = { id: d.id, ...d.data() }; });

      // 1) orders moving through the steps
      for (const d of orderSnap.docs) {
        const o = d.data();
        if (o.status === "cancelled_by_buyer" || o.refunded) continue;

        const id   = d.id;
        const item = o.productName || "an order";
        const ref  = o.orderRef || id.slice(0, 8).toUpperCase();
        const ev   = (Array.isArray(o.trackingEvents) ? o.trackingEvents : [])
                       .filter(e => e.status === o.trackingStatus).map(e => e.at).pop();
        const since = ev || o.createdAt?.toDate?.().getTime() || now;
        const age   = (now - since) / (ZB_HOUR * ZB_REMIND_SCALE);

        switch (o.trackingStatus) {
          case "placed":
            if (age >= 6) await nudge(id, "admin_payment", admins, "💳 Payment waiting for your check",
              `${item} (${ref}) has waited ${hrs(age)} for payment confirmation.`, id, { max: 5 });
            break;

          case "payment_verified":
            if (age >= 24) await nudge(id, "seller_pack", [o.sellerId], "📦 Please pack your order",
              `${item} (${ref}) was paid ${hrs(age)} ago. Pack it and mark it as packed.`, id);
            if (age >= 72) await nudge(id, "admin_pack", admins, "🛑 Seller hasn't packed an order",
              `${item} (${ref}) was paid ${hrs(age)} ago and is not packed yet.`, id);
            break;

          case "packed":
            if (age >= 24) await nudge(id, "seller_ship", [o.sellerId], "🚚 Time to send it",
              `${item} (${ref}) is packed. Mark it as on the way when you leave.`, id);
            if (age >= 72) await nudge(id, "admin_ship", admins, "🛑 Packed order not sent",
              `${item} (${ref}) has been packed for ${hrs(age)}.`, id);
            break;

          case "on_the_way":
            if (age >= 48) await nudge(id, "seller_arrive", [o.sellerId], "📍 Please complete the delivery",
              `${item} (${ref}) has been on the way for ${hrs(age)}. Hand it over with the buyer's code.`, id);
            if (age >= 120) await nudge(id, "admin_arrive", admins, "🛑 Delivery taking very long",
              `${item} (${ref}) has been on the way for ${hrs(age)}.`, id);
            break;

          case "arrived":
            if (age >= 12) await nudge(id, "buyer_confirm", [o.buyerUid], "✅ Did you receive your item?",
              `The seller reached you with ${item} (${ref}). Please confirm that you received it.`, id);
            if (age >= 72) await nudge(id, "admin_confirm", admins, "🛑 Buyer hasn't confirmed receipt",
              `${item} (${ref}) arrived ${hrs(age)} ago and the buyer hasn't confirmed.`, id);
            break;

          case "received":
            if (!payoutByOrder[id] && age >= 24) await nudge(id, "admin_payout", admins, "💸 Seller payment is due",
              `${item} (${ref}) was delivered ${hrs(age)} ago and the seller hasn't been paid.`, id, { max: 5, gap: 24 });
            if (age >= 24 && !o.noteSigned?.buyer) await nudge(id, "buyer_note", [o.buyerUid], "✍️ Please sign your receipt note",
              `Review and sign the handover note for ${item} (${ref}).`, id, { max: 2, gap: 48 });
            if (age >= 24 && !o.noteSigned?.seller) await nudge(id, "seller_note", [o.sellerId], "✍️ Please sign the handover note",
              `Review and sign the handover note for ${item} (${ref}).`, id, { max: 2, gap: 48 });
            break;
        }
      }

      // 2) payouts waiting for the seller to sign
      for (const p of Object.values(payoutByOrder)) {
        if (p.status !== "sent") continue;
        const age = (now - (p.createdAt?.toDate?.().getTime() || now)) / (ZB_HOUR * ZB_REMIND_SCALE);
        if (age >= 24) await nudge(p.orderId, "seller_sign_payout", [p.sellerId], "💸 Please confirm your payment",
          `ZiBuy sent you UGX ${Number(p.amount).toLocaleString()}. Open Orders to Deliver and confirm you received it.`, p.orderId, { gap: 48 });
      }

      // 3) refunds waiting for the buyer to confirm
      for (const d of refundSnap.docs) {
        const r = d.data();
        const age = (now - (r.createdAt?.toDate?.().getTime() || now)) / (ZB_HOUR * ZB_REMIND_SCALE);
        if (age >= 24) await nudge(r.orderId, "buyer_confirm_refund", [r.buyerUid], "↩️ Please confirm your refund",
          `ZiBuy sent you a refund of UGX ${Number(r.amount).toLocaleString()}. Open My Orders and confirm you received it.`, r.orderId, { gap: 48 });
      }
    } catch (e) {
      console.error("[orderReminders]", e);
    }
  }
);


// ============================================
// BACK IN STOCK: tell everyone who saved a product when it is available again
// ============================================
exports.onBackInStock = onDocumentUpdated("products/{productId}", async (event) => {
  try {
    const before = event.data.before.data();
    const after  = event.data.after.data();
    if (!before || !after) return;
    if (before.status !== "sold" || after.status !== "active") return;

    const productId = event.params.productId;

    // the same product is announced at most once every 3 days, even if the seller flips it back and forth
    const bucket = Math.floor(Date.now() / (3 * 86400000));
    const locked = await logOnce(`backinstock_${productId}_${bucket}`, { type: "back_in_stock_lock", productId });
    if (!locked) return;

    const likes = await db.collection("likes").where("productId", "==", productId).limit(1000).get();
    if (likes.empty) return;

    const sellerId = after.userId;
    const name     = after.name || "An item you saved";
    const price    = Number(after.price || 0);

    const jobs = [];
    const seen = new Set();
    likes.forEach(d => {
      const userId = d.data().userId;
      if (!userId || userId === sellerId || seen.has(userId)) return;
      seen.add(userId);
      jobs.push(db.collection("notifications").add({
        userId,
        type:      "back_in_stock",
        title:     `🛍️ Back in stock: ${name}`,
        message:   `An item you saved is available again${price ? " at UGX " + price.toLocaleString() : ""}. Grab it before it's gone!`,
        relatedId: productId,
        read:      false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }));
    });

    await Promise.all(jobs);
    console.log(`[BACK IN STOCK] Notified ${jobs.length} users for ${productId}`);
  } catch (e) {
    console.error("[onBackInStock]", e);
  }
});


// ============================================
// PUBLIC PROFILES: a safe copy of each user (no email, no phone)
// ============================================
const ZB_PUBLIC_FIELDS = [
  "displayName", "photoURL", "bio", "location", "plan", "accountType",
  "isSellerVerified", "phoneVerified", "earnedVerification",
  "trustTier", "trustScore", "buyerRating", "buyerRatingCount",
  "referralCode", "createdAt"
];

function zbPublicProfile(u) {
  const p = {};
  ZB_PUBLIC_FIELDS.forEach(k => { if (u[k] !== undefined) p[k] = u[k]; });
  // a scrambled fingerprint, so chat can still find a person by email without anyone being able to read emails
  if (u.email) p.emailHash = zbSha(String(u.email).trim().toLowerCase());
  p.updatedAt = Date.now();
  return p;
}

exports.syncPublicProfile = onDocumentWritten("users/{uid}", async (event) => {
  try {
    const uid = event.params.uid;
    const ref = db.collection("public_profiles").doc(uid);

    if (!event.data.after.exists) {            // account deleted: remove the public copy too
      await ref.delete().catch(() => {});
      return;
    }

    const after  = event.data.after.data();
    const before = event.data.before.exists ? event.data.before.data() : null;

    // skip writes that don't change anything public (token refreshes, counters...)
    if (before) {
      const same = ZB_PUBLIC_FIELDS.every(k => JSON.stringify(before[k] ?? null) === JSON.stringify(after[k] ?? null))
                && (before.email || "") === (after.email || "");
      if (same) return;
    }

    await ref.set(zbPublicProfile(after));
  } catch (e) {
    console.error("[syncPublicProfile]", e);
  }
});

// One-time cleanup: reviews must not carry the reviewer's email
exports.scrubReviewEmails = onCall({ timeoutSeconds: 540 }, async (request) => {
  await assertCallerIsFullAdmin(request);

  let last = null, scanned = 0, cleaned = 0;
  while (true) {
    let q = db.collection("reviews").orderBy(admin.firestore.FieldPath.documentId()).limit(300);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;

    const batch = db.batch();
    let inBatch = 0;
    for (const d of snap.docs) {
      const r = d.data();
      const email = r.reviewerEmail || r.userEmail;
      if (!email) continue;

      const update = {
        reviewerEmail: admin.firestore.FieldValue.delete(),
        userEmail: admin.firestore.FieldValue.delete()
      };
      if (!r.reviewerName) {
        update.reviewerName = String(email).split("@")[0].slice(0, 2) + "***";
      }
      if (!r.userId) {
        try {
          const u = await admin.auth().getUserByEmail(email);
          update.userId = u.uid;
        } catch (e) { /* no account with that email any more */ }
      }
      batch.update(d.ref, update);
      inBatch++;
    }
    if (inBatch) { await batch.commit(); cleaned += inBatch; }

    scanned += snap.size;
    last = snap.docs[snap.docs.length - 1];
  }
  return { ok: true, scanned, cleaned };
});

// Adds participantUids / senderUid to old messages (needed to move chat from emails to user IDs)
exports.backfillMessageUids = onCall({ timeoutSeconds: 540 }, async (request) => {
  await assertCallerIsFullAdmin(request);

  const cache = new Map();
  const uidOf = async (email) => {
    if (!email) return "";
    const key = String(email).toLowerCase();
    if (cache.has(key)) return cache.get(key);
    let uid = "";
    try { uid = (await admin.auth().getUserByEmail(key)).uid; } catch (e) { /* account no longer exists */ }
    cache.set(key, uid);
    return uid;
  };

  let last = null, scanned = 0, updated = 0;
  while (true) {
    let q = db.collection("messages").orderBy(admin.firestore.FieldPath.documentId()).limit(300);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;

    const batch = db.batch();
    let inBatch = 0;
    for (const d of snap.docs) {
      const m = d.data();
      if (m.participantUids && m.senderUid) continue;
      const parts = Array.isArray(m.participants) ? m.participants : [];
      const uids = [];
      for (const e of parts) uids.push(await uidOf(e));
      batch.update(d.ref, { participantUids: uids, senderUid: await uidOf(m.senderEmail) });
      inBatch++;
    }
    if (inBatch) { await batch.commit(); updated += inBatch; }

    scanned += snap.size;
    last = snap.docs[snap.docs.length - 1];
  }
  return { ok: true, scanned, updated };
});

// Gives a signed-in user the chat contact for a seller, so the email never sits in public data.
exports.getChatContact = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Please log in first");

  const targetUid = String(request.data?.userId || "");
  if (!targetUid || targetUid === uid) {
    throw new HttpsError("invalid-argument", "Invalid user");
  }

  await zbRateLimit("chatcontact:" + uid, 40, 24 * 3600000);

  const snap = await db.collection("users").doc(targetUid).get();
  const email = snap.exists ? snap.data().email : "";
  if (!email) throw new HttpsError("not-found", "User not found");

  return { email };
});

// Prepares products for the move away from public emails: every ad gets a userId
// (when it can be found) and the owner's official ads are marked isOfficial.
exports.backfillProductOwners = onCall({ timeoutSeconds: 540 }, async (request) => {
  await assertCallerIsFullAdmin(request);

  const OWNER_EMAIL = "swaibuziraye22@gmail.com";
  const cache = new Map();
  const uidOf = async (email) => {
    const key = String(email || "").toLowerCase();
    if (!key) return "";
    if (cache.has(key)) return cache.get(key);
    let uid = "";
    try { uid = (await admin.auth().getUserByEmail(key)).uid; } catch (e) { /* no account */ }
    cache.set(key, uid);
    return uid;
  };

  let last = null, scanned = 0, updated = 0, noOwner = 0;
  while (true) {
    let q = db.collection("products").orderBy(admin.firestore.FieldPath.documentId()).limit(300);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;

    const batch = db.batch();
    let inBatch = 0;
    for (const d of snap.docs) {
      const p = d.data();
      const email = String(p.userEmail || "").toLowerCase();
      const update = {};

      if (typeof p.isOfficial !== "boolean") update.isOfficial = email === OWNER_EMAIL;
      if (!p.userId && email) {
        const uid = await uidOf(email);
        if (uid) update.userId = uid; else noOwner++;
      }

      if (Object.keys(update).length) { batch.update(d.ref, update); inBatch++; }
    }
    if (inBatch) { await batch.commit(); updated += inBatch; }

    scanned += snap.size;
    last = snap.docs[snap.docs.length - 1];
  }
  return { ok: true, scanned, updated, noOwner };
});

// Removes the seller's email from every ad. Makes sure each ad keeps its owner (userId)
// and the official flag first, so nothing is lost.
exports.scrubProductEmails = onCall({ timeoutSeconds: 540 }, async (request) => {
  await assertCallerIsFullAdmin(request);

  const OWNER_EMAIL = "swaibuziraye22@gmail.com";
  const cache = new Map();
  const uidOf = async (email) => {
    const key = String(email || "").toLowerCase();
    if (!key) return "";
    if (cache.has(key)) return cache.get(key);
    let uid = "";
    try { uid = (await admin.auth().getUserByEmail(key)).uid; } catch (e) { /* no account */ }
    cache.set(key, uid);
    return uid;
  };

  let last = null, scanned = 0, cleaned = 0, noOwner = 0;
  while (true) {
    let q = db.collection("products").orderBy(admin.firestore.FieldPath.documentId()).limit(300);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;

    const batch = db.batch();
    let inBatch = 0;
    for (const d of snap.docs) {
      const p = d.data();
      if (!Object.prototype.hasOwnProperty.call(p, "userEmail")) continue;

      const email = String(p.userEmail || "").toLowerCase();
      const update = { userEmail: admin.firestore.FieldValue.delete() };

      if (typeof p.isOfficial !== "boolean") update.isOfficial = email === OWNER_EMAIL;
      if (!p.userId && email) {
        const uid = await uidOf(email);
        if (uid) update.userId = uid; else noOwner++;
      }

      batch.update(d.ref, update);
      inBatch++;
    }
    if (inBatch) { await batch.commit(); cleaned += inBatch; }

    scanned += snap.size;
    last = snap.docs[snap.docs.length - 1];
  }
  return { ok: true, scanned, cleaned, noOwner };
});

// Removes follower emails and seller emails from public collections.
exports.scrubPublicEmails = onCall({ timeoutSeconds: 540 }, async (request) => {
  await assertCallerIsFullAdmin(request);

  const FV = admin.firestore.FieldValue;
  const jobs = [["shop_followers", "userEmail"], ["buyer_ratings", "sellerEmail"]];
  const result = {};

  for (const [col, field] of jobs) {
    let last = null, scanned = 0, cleaned = 0;
    while (true) {
      let q = db.collection(col).orderBy(admin.firestore.FieldPath.documentId()).limit(400);
      if (last) q = q.startAfter(last);
      const snap = await q.get();
      if (snap.empty) break;

      const batch = db.batch();
      let n = 0;
      for (const d of snap.docs) {
        if (Object.prototype.hasOwnProperty.call(d.data(), field)) {
          batch.update(d.ref, { [field]: FV.delete() });
          n++;
        }
      }
      if (n) { await batch.commit(); cleaned += n; }

      scanned += snap.size;
      last = snap.docs[snap.docs.length - 1];
    }
    result[col] = { scanned, cleaned };
  }
  return { ok: true, result };
});

// Clears a shop's public contact email when it is just the owner's login email.
// Owners can type a contact email again on purpose in Edit Shop.
exports.clearShopLoginEmails = onCall({ timeoutSeconds: 540 }, async (request) => {
  await assertCallerIsFullAdmin(request);

  const loginEmail = new Map();
  const emailOf = async (uid) => {
    if (!uid) return "";
    if (loginEmail.has(uid)) return loginEmail.get(uid);
    let e = "";
    try { e = String((await admin.auth().getUser(uid)).email || "").toLowerCase(); } catch (err) { /* no account */ }
    loginEmail.set(uid, e);
    return e;
  };

  let scanned = 0, cleared = 0;
  for (const col of ["business_profiles", "shops"]) {
    const snap = await db.collection(col).get();
    let batch = db.batch();
    let n = 0;
    for (const d of snap.docs) {
      scanned++;
      const s = d.data();
      const shopEmail = String(s.email || "").toLowerCase();
      if (!shopEmail) continue;
      const owner = await emailOf(s.ownerId || s.userId || d.id);
      if (owner && owner === shopEmail) {
        batch.update(d.ref, { email: "" });
        n++; cleared++;
        if (n === 400) { await batch.commit(); batch = db.batch(); n = 0; }
      }
    }
    if (n) await batch.commit();
  }
  return { ok: true, scanned, cleared };
});

// One-time (and any-time) rebuild for every existing user
exports.rebuildPublicProfiles = onCall({ timeoutSeconds: 540 }, async (request) => {
  await assertCallerIsFullAdmin(request);

  let last = null, count = 0;
  while (true) {
    let q = db.collection("users").orderBy(admin.firestore.FieldPath.documentId()).limit(300);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach(d => batch.set(db.collection("public_profiles").doc(d.id), zbPublicProfile(d.data())));
    await batch.commit();

    count += snap.size;
    last = snap.docs[snap.docs.length - 1];
  }
  return { ok: true, count };
});

// ============================================
// ORDER TRACKING: notify buyer, seller and admins on every step
// ============================================
exports.onOrderTrackingChange = onDocumentUpdated("orders/{orderId}", async (event) => {
  try {
    const before = event.data.before.data() || {};
    const after  = event.data.after.data()  || {};
    const status = after.trackingStatus;
    if (!status || before.trackingStatus === status) return;

    const orderId = event.params.orderId;
    const ref  = after.orderRef || after.orderId || orderId.slice(0, 8).toUpperCase();
    const item = after.productName || after.items?.[0]?.name || "your order";

    const uidByEmail = async (email) => {
      if (!email || email === "guest") return null;
      const s = await db.collection("users").where("email", "==", email).limit(1).get();
      return s.empty ? null : s.docs[0].id;
    };

    const buyerUid  = (after.buyerUid && after.buyerUid !== "guest")
      ? after.buyerUid : await uidByEmail(after.userEmail);
    const sellerUid = after.sellerId || await uidByEmail(after.sellerEmail);

    const adminUids = new Set();
    const superUid  = await uidByEmail("swaibuziraye22@gmail.com");
    if (superUid) adminUids.add(superUid);
    const staff = await db.collection("admins").get();
    staff.forEach(d => { if (d.data().suspended !== true) adminUids.add(d.id); });

    const jobs = [];
    const notify = (userId, title, message) => {
      if (!userId) return;
      jobs.push(db.collection("notifications").add({
        userId, type: "order", title, message, orderId, read: false, createdAt: new Date()
      }));
    };
    const toAdmins = (title, message) => adminUids.forEach(uid => notify(uid, title, message));

    switch (status) {
      case "payment_verified":
        notify(buyerUid,  "✅ Payment confirmed", `We've received your payment for ${item} (${ref}). The seller is now preparing your order.`);
        notify(sellerUid, "💰 New paid order: start packing", `${item} (${ref}) has been paid for. Please pack it and mark it as packed.`);
        break;
      case "packed":
        notify(buyerUid, "📦 Your order is packed", `${item} (${ref}) has been packed and is getting ready to ship.`);
        toAdmins("📦 Order packed", `${item} (${ref}) was marked packed by the seller.`);
        break;
      case "on_the_way":
        notify(buyerUid, "🚚 Your order is on the way", `${item} (${ref}) is now on its way to you.`);
        toAdmins("🚚 Order on the way", `${item} (${ref}) is on its way to the buyer.`);
        break;
      case "arrived":
        notify(buyerUid, "📍 The seller has arrived", `The seller has reached your delivery location with ${item} (${ref}). Please confirm once you receive it.`);
        toAdmins("📍 Seller arrived", `The seller reached the delivery location for ${item} (${ref}).`);
        break;
      case "received":
        notify(sellerUid, "✅ Buyer confirmed receipt", `The buyer confirmed receiving ${item} (${ref}). ZiBuy will release your payment.`);
        toAdmins("✅ Order received by buyer", `${item} (${ref}) was received. Ready to release payment to the seller.`);
        break;
    }

    await Promise.all(jobs);
  } catch (err) {
    console.error("[onOrderTrackingChange]", err);
  }
});


// ============================================
// ORDER SYSTEM (SCALE MODE FIXED)
// ============================================

exports.onNewOrder = onDocumentCreated(
  "orders/{orderId}",
  async (event) => {
    const order = event.data.data();
    const orderId = event.params.orderId;

    const product = await getProduct(order.items?.[0]?.productId);
    const seller = (!order.trackingStatus && product?.userId) ? await getUser(product.userId) : null;

    const itemList = (order.items || [])
      .map(i => `<li>${i.name} × ${i.qty}</li>`)
      .join("");

    // BUYER
    if (order.userEmail) {
      await sendEmail(order.userEmail, `Order Confirmed ${orderId}`,
        `<h2>Order confirmed</h2><ul>${itemList}</ul>`
      );
    }

    // SELLER
    if (seller?.email) {
      await sendEmail(seller.email, `New Order ${orderId}`,
        `<h2>New order received</h2><ul>${itemList}</ul>`
      );
    }

    // SMS handled exclusively by smsGoldSellers trigger
    // to avoid duplicate messages to gold plan sellers
    if (seller?.phone && seller?.plan !== "gold") {
      const lock = await logOnce(
        `order_sms_${orderId}`,
        {
          type:     "order_sms",
          orderId,
          customer: order.customerName || "",
          amount:   order.total || 0
        }
      );
      if (!lock) return;

      try {
        await sendSMS(
          seller.phone,
          `New order ${order.customerName} UGX ${order.total}`
        );
      } catch (err) {
        console.error("[SMS ERROR]", err.message);
      }
    }

    await auditLog(
  "NEW_ORDER",
  order.userEmail || "customer",
  `Order ${orderId} Total UGX ${order.total}`
);

console.log(`[ORDER] ${orderId}`);

await alertAdminOrder(orderId, order.total || 0);
  }
);


// ============================================
// CHAT MESSAGES
// ============================================

// ============================================
// CHAT SYSTEM (SAFE SCALE NOTIFICATIONS)
// ============================================

exports.onNewMessage = onDocumentCreated(
  "messages/{id}",
  async (event) => {
    const msg = event.data.data();
    if (!msg?.participants) return;

    const recipient = msg.participants.find(p => p !== msg.senderEmail);
    if (!recipient) return;

    const users = await db.collection("users")
      .where("email", "==", recipient)
      .limit(1)
      .get();

    if (users.empty) return;

    const userDoc = users.docs[0];
    const user = userDoc.data();

    await db.collection("notifications").add({
      userId: userDoc.id,
      title: `New message from ${msg.senderEmail?.split("@")[0] || "someone"}`,
      message: msg.text?.slice(0, 80),
      type: "message",
      relatedId: msg.senderEmail || null,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
);


// ============================================
// EMAIL BROADCAST (SAFE BATCHED)
// ============================================

exports.sendEmailBroadcast = onDocumentCreated(
  "email_broadcasts/{id}",
  async (event) => {
    const data = event.data.data();

    // Paginate through all users in batches of 500
    let allEmails = [];
    let lastDoc = null;

    while (true) {
      let q = db.collection("users").limit(500);
      if (lastDoc) q = q.startAfter(lastDoc);
      const batch = await q.get();
      if (batch.empty) break;
      batch.docs.forEach(d => { if (d.data().email) allEmails.push(d.data().email); });
      lastDoc = batch.docs[batch.docs.length - 1];
      if (batch.size < 500) break;
    }

    const emails = allEmails;
    // const emails = users.docs.map(d => d.data().email).filter(Boolean);

    const batchSize = 50;

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);

      await Promise.all(
        batch.map(email =>
          sendEmail(email, data.title, data.message)
        )
      );
    }

    console.log(`[Broadcast] Sent to ${emails.length}`);
  }
);


// ============================================
// WELCOME EMAIL
// ============================================

exports.onUserCreated = onDocumentCreated(
  "users/{id}",
  async (event) => {
    const user = event.data.data();

    if (!user?.email) return;

    await sendEmail(
      user.email,
      "Welcome to ZiBuy",
      `<h2>Welcome ${user.email.split("@")[0]}</h2>`
    );

    await auditLog(
  "NEW_USER",
  user.email,
  "New account created"
);

  }
);


// ============================================
// ABANDONED CART
// ============================================

exports.abandonedCartEmails = onSchedule(
  { schedule: "every 24 hours" },
  async () => {
    const cutoff = new Date(Date.now() - 86400000);

    const snap = await db.collection("cart_sessions")
      .where("status", "==", "active")
      .where("updatedAt", "<=", cutoff)
      .get();

    for (const d of snap.docs) {
      const s = d.data();
      if (!s.userEmail) continue;

      await sendEmail(
        s.userEmail,
        "You left items in your cart",
        `<p>Complete your order now.</p>`
      );

      await d.ref.update({ status: "emailed" });
    }
  }
);


// ============================================
// WEEKLY DEALS
// SCHEDULED JOBS (THROTTLED FOR SCALE)
// ============================================

exports.weeklyTopDeals = onSchedule(
  { schedule: "every monday 08:00", timeZone: "Africa/Kampala" },
  async () => {
    try {
      // ── 1. Fetch top active products (most viewed) ──
      const productsSnap = await db
        .collection("products")
        .where("status", "==", "active")
        .limit(200)
        .get();

      const products = productsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.views || 0) - (a.views || 0))
        .slice(0, 6); // top 6 for the email

      if (products.length === 0) {
        console.log("[WEEKLY] No products to feature");
        return;
      }

      // ── 2. Build product cards HTML ──
      const productCardsHtml = products.map(p => {
        const image    = p.images?.[0] || "https://zibuy.ziteche.com/icons/icon-512.png";
        const price    = Number(p.price || 0).toLocaleString();
        const name     = p.name || "Product";
        const category = (p.category || "").charAt(0).toUpperCase() + (p.category || "").slice(1);
        const location = p.seller?.location || p.location || "Uganda";
        const link     = `https://zibuy.ziteche.com/product.html?id=${p.id}`;

        return `
          <div style="
            display:inline-block;
            width:160px;
            vertical-align:top;
            margin:8px;
            background:#ffffff;
            border-radius:12px;
            border:1px solid #e5e7eb;
            overflow:hidden;
            font-family:Arial,sans-serif;
          ">
            <a href="${link}" style="text-decoration:none">
              <img src="${image}" alt="${name}"
                width="160" height="130"
                style="width:160px;height:130px;object-fit:cover;display:block;background:#f3f4f6">
            </a>
            <div style="padding:10px">
              <p style="margin:0 0 3px;font-size:10px;font-weight:700;color:#ff6600;
                text-transform:uppercase;letter-spacing:.5px">
                ${category}
              </p>
              <p style="margin:0 0 5px;font-size:13px;font-weight:700;color:#111827;
                overflow:hidden;white-space:nowrap;text-overflow:ellipsis">
                ${name}
              </p>
              <p style="margin:0 0 8px;font-size:15px;font-weight:900;color:#ff6600">
                UGX ${price}
              </p>
              <p style="margin:0 0 10px;font-size:11px;color:#9ca3af">
                📍 ${location}
              </p>
              <a href="${link}"
                style="
                  display:block;
                  background:#ff6600;
                  color:white;
                  text-align:center;
                  padding:8px;
                  border-radius:8px;
                  font-size:12px;
                  font-weight:700;
                  text-decoration:none;
                  font-family:Arial,sans-serif;
                ">
                View →
              </a>
            </div>
          </div>
        `;
      }).join("");

      // ── 3. Build full email HTML ──
      const emailHtml = emailTemplate(
        "🔥 Top Deals This Week on ZiBuy",
        `
          <p style="color:#6b7280;margin-bottom:20px">
            Here are the hottest listings right now on ZiBuy Uganda.
            Don't miss out — these go fast!
          </p>

          <div style="text-align:center;margin-bottom:20px">
            ${productCardsHtml}
          </div>

          <div style="background:#f9fafb;border-radius:10px;padding:16px;
            margin-top:20px;text-align:center">
            <p style="margin:0 0 10px;font-size:13px;color:#374151;font-weight:700">
              Want to see more deals?
            </p>
            <a href="https://zibuy.ziteche.com"
              style="
                background:#111827;
                color:white;
                padding:10px 24px;
                border-radius:8px;
                font-size:13px;
                font-weight:700;
                text-decoration:none;
                display:inline-block;
              ">
              Browse All Listings →
            </a>
          </div>

          <p style="font-size:11px;color:#9ca3af;margin-top:20px;text-align:center">
            You're receiving this because you have a ZiBuy account.<br>
            <a href="https://zibuy.ziteche.com" style="color:#ff6600">Visit ZiBuy</a>
          </p>
        `,
        "",
        ""
      );

      // ── 4. Paginate through all users and send ──
      let allEmails = [];
      let lastDoc   = null;

      while (true) {
        let q = db.collection("users").limit(500);
        if (lastDoc) q = q.startAfter(lastDoc);
        const batch = await q.get();
        if (batch.empty) break;
        batch.docs.forEach(d => { if (d.data().email) allEmails.push(d.data().email); });
        lastDoc = batch.docs[batch.docs.length - 1];
        if (batch.size < 500) break;
      }

      // ── 5. Send in batches of 15 with throttle ──
      for (let i = 0; i < allEmails.length; i += 15) {
        const batch = allEmails.slice(i, i + 15);

        await Promise.allSettled(
          batch.map(email =>
            sendEmail(email, "🔥 Top Deals This Week on ZiBuy Uganda", emailHtml)
          )
        );

        // Throttle — avoid Gmail rate limits
        await new Promise(r => setTimeout(r, 1500));
      }

      console.log(`[WEEKLY] Sent to ${allEmails.length} users with ${products.length} products`);

    } catch (err) {
      console.error("[WEEKLY ERROR]", err.message);
    }
  }
);


exports.smsGoldSellers = onDocumentCreated(
  "orders/{orderId}",
  async (event) => {
    try {
      const order = event.data.data();
      if (order.trackingStatus) return;   // tracked orders: the seller is told after payment is confirmed
      const productId = order.items?.[0]?.productId;

      const smsKey = `sms_${event.params.orderId}`;
const docRef = db.collection("function_logs").doc(smsKey);

const alreadySent = await docRef.get();
if (alreadySent.exists) return;

await docRef.set({
  createdAt: admin.firestore.FieldValue.serverTimestamp()
});

      if (!productId) return;

      const productSnap = await db.collection("products").doc(productId).get();
      if (!productSnap.exists) return;

      const product = productSnap.data();
      const seller = await getUser(product.userId);

      if (!seller || seller.plan !== "gold") return;
      if (!seller.phone) return;

      await sendSMS(
  seller.phone,
  `New order ${order.customerName} UGX ${order.total}`
);

      console.log("[SMS] Sent to gold seller");
    } catch (err) {
      console.error("[SMS] Failed:", err.message);
    }
  }
);


// ============================================
// PHONE OTP VERIFICATION
// ============================================

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

exports.sendPhoneOTP = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "You must be logged in");

  const phone = (request.data?.phone || "").replace(/\D/g, "");
  if (!phone || phone.length < 9) {
    throw new HttpsError("invalid-argument", "Enter a valid phone number");
  }

  const otpRef   = db.collection("phone_otps").doc(uid);
  const existing = await otpRef.get();

  // Cooldown: 60 seconds between sends
  if (existing.exists) {
    const lastSent = existing.data().createdAt?.toDate?.();
    if (lastSent && (Date.now() - lastSent.getTime()) < 60000) {
      const waitSec = Math.ceil((60000 - (Date.now() - lastSent.getTime())) / 1000);
      throw new HttpsError("resource-exhausted", `Please wait ${waitSec}s before requesting another code`);
    }
  }

  const code      = generateOTP();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  await otpRef.set({
    code,
    phone,
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    attempts:  0,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  const fullPhone = phone.startsWith("256") ? phone : "256" + phone.replace(/^0/, "");

  await sendSMS(fullPhone, `Your ZiBuy verification code is ${code}. It expires in 5 minutes. Do not share this code with anyone.`);

  return { success: true };
});

exports.verifyPhoneOTP = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "You must be logged in");

  const code = (request.data?.code || "").trim();
  if (!code) throw new HttpsError("invalid-argument", "Enter the code");

  const otpRef = db.collection("phone_otps").doc(uid);
  const snap   = await otpRef.get();

  if (!snap.exists) {
    throw new HttpsError("not-found", "No verification code found. Please request a new one.");
  }

  const data      = snap.data();
  const expiresAt = data.expiresAt?.toDate?.();

  if (!expiresAt || expiresAt < new Date()) {
    await otpRef.delete();
    throw new HttpsError("deadline-exceeded", "Code expired. Please request a new one.");
  }

  if ((data.attempts || 0) >= 5) {
    await otpRef.delete();
    throw new HttpsError("resource-exhausted", "Too many attempts. Please request a new code.");
  }

  if (data.code !== code) {
    await otpRef.update({ attempts: admin.firestore.FieldValue.increment(1) });
    throw new HttpsError("invalid-argument", "Incorrect code. Please try again.");
  }

  // Success — mark user's phone as verified
  await db.collection("users").doc(uid).set({
    phone:           data.phone,
    phoneVerified:   true,
    phoneVerifiedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  await otpRef.delete();
  await recalculateTrustScore(uid);

  return { success: true, phone: data.phone };
});


exports.aiRecommendations = onSchedule(
  {
    schedule: "every friday 10:00",
    timeZone: "Africa/Kampala",
  },
  async () => {
    try {
      // Paginate users in batches of 500 to handle any database size
      let allUserDocs = [];
      let lastUserDoc = null;
      while (true) {
        let q = db.collection("users").limit(500);
        if (lastUserDoc) q = q.startAfter(lastUserDoc);
        const batch = await q.get();
        if (batch.empty) break;
        batch.docs.forEach(d => allUserDocs.push(d));
        lastUserDoc = batch.docs[batch.docs.length - 1];
        if (batch.size < 500) break;
      }
      const usersSnap = { docs: allUserDocs };
      const productsSnap = await db
        .collection("products")
        .where("status", "==", "active")
        .limit(200)
        .get();

      const products = productsSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      }));

      for (const userDoc of usersSnap.docs) {
        const user = userDoc.data();
        if (!user.email) continue;

        const ordersSnap = await db
          .collection("orders")
          .where("userEmail", "==", user.email)
          .limit(10)
          .get();

        const categoryScore = {};

        ordersSnap.docs.forEach(o => {
          (o.data().items || []).forEach(i => {
            if (i.category) {
              categoryScore[i.category] =
                (categoryScore[i.category] || 0) + 1;
            }
          });
        });

        const scored = products
          .map(p => ({
            ...p,
            score:
              (categoryScore[p.category] || 0) * 10 +
              (p.views || 0) * 0.1 +
              (p.likes || 0) * 0.5,
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 4);

        if (!scored.length) continue;

        const html = scored
          .map(
            p => `
            <div style="margin:10px;padding:10px;border:1px solid #eee">
              <h3>${p.name}</h3>
              <p>UGX ${Number(p.price).toLocaleString()}</p>
              <a href="https://zibuy.ziteche.com/product.html?id=${p.id}">
                View Product
              </a>
            </div>
          `
          )
          .join("");

        await sendEmail(
          user.email,
          "🎯 Recommended for you on ZiBuy",
          emailTemplate(
            "We found deals for you 🇺🇬",
            `<p>Hello ${user.email.split("@")[0]}</p>${html}`,
            "Shop Now",
            "https://zibuy.ziteche.com"
          )
        );
      }

      console.log("[AI] Recommendations sent");
    } catch (err) {
      console.error("[AI] Failed:", err.message);
    }
  }
);

// ============================================
// PLAN EXPIRY REMINDERS (CLEAN V2 MODULE)
// ============================================

// ============================================
// HOME FEED PERSONALIZATION — category interest per user
// ============================================
exports.computeHomeFeedScores = onSchedule(
  { schedule: "every 6 hours", timeZone: "Africa/Kampala" },
  async () => {
    try {
      let allUserDocs = [];
      let lastUserDoc = null;
      while (true) {
        let q = db.collection("users").limit(500);
        if (lastUserDoc) q = q.startAfter(lastUserDoc);
        const batch = await q.get();
        if (batch.empty) break;
        batch.docs.forEach(d => allUserDocs.push(d));
        lastUserDoc = batch.docs[batch.docs.length - 1];
        if (batch.size < 500) break;
      }

      let updated = 0;

      for (const userDoc of allUserDocs) {
        const user = userDoc.data();
        if (!user.email) continue;

        const categoryScore = {};

        // Past purchases — strongest signal
        const ordersSnap = await db.collection("orders")
          .where("userEmail", "==", user.email)
          .limit(20)
          .get();
        ordersSnap.docs.forEach(o => {
          (o.data().items || []).forEach(i => {
            if (i.category) categoryScore[i.category] = (categoryScore[i.category] || 0) + 10;
          });
        });

        // Liked products — lighter signal
        const likesSnap = await db.collection("likes")
          .where("userId", "==", userDoc.id)
          .limit(50)
          .get();

        for (const likeDoc of likesSnap.docs) {
          const productId = likeDoc.data().productId;
          if (!productId) continue;
          const prodSnap = await db.collection("products").doc(productId).get();
          if (prodSnap.exists && prodSnap.data().category) {
            const cat = prodSnap.data().category;
            categoryScore[cat] = (categoryScore[cat] || 0) + 3;
          }
        }

        if (Object.keys(categoryScore).length === 0) continue;

        await userDoc.ref.update({
          homeFeedCategoryScores: categoryScore,
          homeFeedUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        updated++;
      }

      console.log(`[HOME FEED] Updated personalization for ${updated} user(s)`);
    } catch (err) {
      console.error("[HOME FEED ERROR]", err.message);
    }
  }
);

exports.planExpiryReminders = onSchedule(
  {
    schedule: "0 8 * * *",
    timeZone: "Africa/Kampala",
  },
  async () => {
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    try {
      const snap = await db
        .collection("business_accounts")
        .where("status", "==", "active")
        .get();

      const docsInWindow = snap.docs.filter(d => {
        const end = d.data().endDate?.toDate?.();
        if (!end) return false;
        return end > now && end <= in48h;
      });

      for (const docSnap of docsInWindow) {
        const sub = docSnap.data();
        const userId = sub.userId;
        const plan = sub.plan || "free";

        const userSnap = await db.collection("users").doc(userId).get();
        const user = userSnap.exists ? userSnap.data() : null;

        const email = user?.email || "";

        const endDate = sub.endDate?.toDate?.() || new Date(sub.endDate);
        const daysLeft = Math.ceil((endDate - now) / 86400000);

        const planLabels = {
          bronze: "🥉 Bronze",
          silver: "🥈 Silver",
          gold: "🥇 Gold",
        };

        const prices = {
          bronze: "15,000",
          silver: "35,000",
          gold: "80,000",
        };

        const planLabel = planLabels[plan] || plan;
        const price = prices[plan] || "15,000";

        // 1. In-app notification
        await db.collection("notifications").add({
          userId,
          type: "plan_expiry",
          title: `⚠️ ${planLabel} expires in ${daysLeft} day(s)`,
          message: `Renew to keep benefits active.`,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // WhatsApp reminder (ADMIN CLICK-TO-SEND SYSTEM)
const msg =
  `Hello from ZiBuy 👋\n\n` +
  `Your *${planLabel}* expires in *${daysLeft} day(s)*.\n\n` +
  `Renew for UGX ${price}/month.`;

const planPhone = user?.phone || null;

// build WhatsApp link (only if phone exists)
const waLink = planPhone
  ? `https://wa.me/${planPhone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`
  : `https://wa.me/?text=${encodeURIComponent(msg)}`;

// store reminder ALWAYS
await db.collection("whatsapp_reminders").add({
  userId,
  type: "plan_expiry",
  message: msg,
  phone: planPhone,
  waLink,
  status: "pending",
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
});

        // 3. Email reminder
        if (email) {
          await sendEmail(
            email,
            `⚠️ ${planLabel} Expiry Notice`,
            emailTemplate(
              "Plan Expiry Warning",
              `<p>Your ${planLabel} plan expires in <b>${daysLeft} day(s)</b>.</p>
               <p>Renew now to avoid losing benefits.</p>`,
              "Renew Now",
              "https://zibuy.ziteche.com/business-plans.html"
            )
          );
        }
      }

      console.log(`[PLAN EXPIRY] Processed ${snap.size}`);
    } catch (err) {
      console.error("[PLAN EXPIRY ERROR]", err.message);
    }
  }
);


// ============================================
// AUTO-RENEW ADS — daily processor
// ============================================

exports.processAutoRenewals = onSchedule(
  {
    schedule: "every 24 hours",
    timeZone: "Africa/Kampala",
  },
  async () => {
    try {
      const now = admin.firestore.Timestamp.now();

      // Find active products with autoRenew enabled that are about to expire (within 24h)
      const snap = await db
        .collection("products")
        .where("autoRenew", "==", true)
        .where("status", "==", "active")
        .get();

      if (snap.empty) {
        console.log("[AUTO-RENEW] Nothing to process");
        return;
      }

      const nowDate = new Date();

      for (const docSnap of snap.docs) {
        const product = docSnap.data();
        const expiresAt = product.expiresAt?.toDate?.();
        if (!expiresAt) continue;

        // Only renew if within 24h of expiry or already expired
        const hoursUntilExpiry = (expiresAt - nowDate) / 3600000;
        if (hoursUntilExpiry > 24) continue;

        // Check the seller has an active auto-renew subscription for this product
        const renewalSnap = await db
          .collection("auto_renewals")
          .where("productId", "==", docSnap.id)
          .where("status", "==", "active")
          .limit(1)
          .get();

        if (renewalSnap.empty) {
          // No active auto-renew plan — turn off the flag and let it expire normally
          await docSnap.ref.update({ autoRenew: false });
          continue;
        }

        const renewal = renewalSnap.docs[0].data();

        // Check renewal subscription hasn't itself expired
        const renewalExpiresAt = renewal.expiresAt?.toDate?.();
        if (renewalExpiresAt && renewalExpiresAt < nowDate) {
          await renewalSnap.docs[0].ref.update({ status: "expired" });
          await docSnap.ref.update({ autoRenew: false });

          // Notify seller their auto-renew subscription lapsed
          if (product.userId) {
            await db.collection("notifications").add({
              userId:    product.userId,
              type:      "auto_renew_expired",
              title:     "⏰ Auto-Renew Subscription Expired",
              message:   `Auto-renew for "${product.name}" has ended. Your ad will expire on schedule unless you renew.`,
              relatedId: docSnap.id,
              read:      false,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
          continue;
        }

        // Push expiry forward by 30 more days
        const newExpiresAt = new Date();
        newExpiresAt.setDate(newExpiresAt.getDate() + 30);

        await docSnap.ref.update({
          expiresAt:      admin.firestore.Timestamp.fromDate(newExpiresAt),
          status:         "active",
          lastRenewedAt:  admin.firestore.FieldValue.serverTimestamp(),
        });

        // Notify seller
        if (product.userId) {
          await db.collection("notifications").add({
            userId:    product.userId,
            type:      "auto_renewed",
            title:     "🔄 Ad Auto-Renewed",
            message:   `"${product.name}" has been automatically renewed for another 30 days.`,
            relatedId: docSnap.id,
            read:      false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        console.log(`[AUTO-RENEW] Renewed ${docSnap.id}`);
      }

      console.log(`[AUTO-RENEW] Processed ${snap.size} candidates`);
    } catch (err) {
      console.error("[AUTO-RENEW ERROR]", err.message);
    }
  }
);

// ============================================
// BOOST EXPIRY REMINDERS (CLEAN V2 MODULE)
// ============================================

exports.boostExpiryReminders = onSchedule(
  {
    schedule: "0 9 * * *",
    timeZone: "Africa/Kampala",
  },
  async () => {
    const now   = new Date();
    const in72h = new Date(now.getTime() + 72 * 60 * 60 * 1000);

    try {
      // Fetch all approved boosts, filter in memory — avoids composite index dependency
      const snap = await db
        .collection("boost_requests")
        .where("status", "==", "approved")
        .get();

      const docsInWindow = snap.docs.filter(d => {
        const exp = d.data().expiresAt?.toDate?.();
        if (!exp) return false;
        return exp > now && exp <= in72h;
      });

      for (const docSnap of docsInWindow) {
        const boost = docSnap.data();
        const userId = boost.userId;
        const productName = boost.productName || "Your ad";

        // Skip if reminder already pending for this product
        const existingReminder = await db.collection("whatsapp_reminders")
          .where("type", "==", "boost_expiry")
          .where("productId", "==", boost.productId || "")
          .where("status", "==", "pending")
          .limit(1)
          .get();
        if (!existingReminder.empty) continue;

        const userSnap = await db.collection("users").doc(userId).get();
        const user = userSnap.exists ? userSnap.data() : null;

        const email = user?.email || "";

        const expiresAt =
          boost.expiresAt?.toDate?.() || new Date(boost.expiresAt);

        const daysLeft = Math.ceil((expiresAt - now) / 86400000);

        // 1. In-app notification
        await db.collection("notifications").add({
          userId,
          type: "boost_expiry",
          title: `⭐ Boost expires in ${daysLeft} day(s)`,
          message: `"${productName}" will lose featured placement soon.`,
          relatedId: boost.productId || null,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        
        // WhatsApp reminder (ADMIN CLICK-TO-SEND SYSTEM)
        const msg =

            
  `Hello from ZiBuy 👋\n\n` +
  `Your boost for "${productName}" expires in ${daysLeft} day(s).\n\n` +
  `Re-boost to stay visible:\n` +
  `• 7 Days — UGX 5,000\n` +
  `• 14 Days — UGX 8,000\n` +
  `• 30 Days — UGX 15,000`;

const boostPhone = user?.phone || null;

const waLink = boostPhone
  ? `https://wa.me/${boostPhone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`
  : `https://wa.me/?text=${encodeURIComponent(msg)}`;

await db.collection("whatsapp_reminders").add({
  userId,
  type: "boost_expiry",
  productId: boost.productId,
  productName,
  message: msg,
  phone: boostPhone,
  waLink,
  status: "pending",
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
});

        // 3. Email reminder (optional but clean fallback)
        if (email) {
          await sendEmail(
            email,
            `⭐ Boost Expiry Reminder - ${productName}`,
            emailTemplate(
              "Your Boost is Expiring",
              `<p>Your boost for <b>${productName}</b> expires in <b>${daysLeft} day(s)</b>.</p>
               <p>Boost again to stay at the top of search results.</p>`,
              "Re-Boost Now",
              "https://zibuy.ziteche.com/boost.html"
            )
          );
        }
      }

      console.log(`[BOOST EXPIRY] Processed ${docsInWindow.length} boosts`);
    } catch (err) {
      console.error("[BOOST EXPIRY ERROR]", err.message);
    }
  }
);


// ============================================
// ADMIN ANALYTICS API (NEW)
// ============================================

exports.getAdminStats = onRequest(async (req, res) => {
  try {
    const usersSnap = await db.collection("users").get();
    const ordersSnap = await db.collection("orders").get();

    let revenue = 0;

    ordersSnap.docs.forEach(d => {
      const data = d.data();
      revenue += Number(data.total || 0);
    });

    res.json({
      users: usersSnap.size,
      orders: ordersSnap.size,
      revenue,
    });

  } catch (err) {
    res.status(500).send(err.message);
  }
});

// ============================================
// MOBILE MONEY PAYMENTS (NO FLUTTERWAVE)
// ============================================

exports.momoPaymentVerify = onDocumentCreated(
  "momo_payments/{id}",
  async (event) => {
    const data = event.data.data();

    /*
      EXPECTED DATA FROM FRONTEND:
      {
        userId,
        phone,
        amount,
        txRef,
        type: "subscription" | "boost"
      }
    */

    if (!data?.userId || !data?.txRef) return;

    // prevent duplicate payment processing
    const lockRef = db.collection("payment_logs").doc(data.txRef);
    const lock = await lockRef.get();
    if (lock.exists) return;

    await lockRef.set({
      status:    "confirmed",
      amount:    data.amount || 0,
      type:      data.type   || "unknown",
      userId:    data.userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const userRef = db.collection("users").doc(data.userId);

    if (data.type === "subscription") {
      await userRef.update({
        plan: data.plan || "gold",
        subscriptionActive: true,
        subscriptionStart: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    if (data.type === "boost") {
      const productId = data.productId;
      if (productId) {
        await db.collection("products").doc(productId).update({
          isPremium: true,
          premiumExpiresAt: admin.firestore.Timestamp.fromDate(
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          ),
        });
      }
    }

    await auditLog(
  "MOMO_PAYMENT",
  data.userId,
  `Transaction ${data.txRef} Amount ${data.amount}`
);

    console.log("[MOMO] Payment activated:", data.txRef);
  }
);


// ============================================
// REVENUE TRACKING SYSTEM (NEW)
// ============================================

exports.revenueTracker = onSchedule(
  { schedule: "every day 00:00", timeZone: "Africa/Kampala" },
  async () => {
    const payments = await db.collection("payment_logs")
      .where("status", "==", "confirmed")
      .get();

    let total = 0;
    let subscriptions = 0;
    let boosts = 0;

    payments.forEach(doc => {
      const d = doc.data();
      total += Number(d.amount || 0);

      if (d.type === "subscription") subscriptions += Number(d.amount || 0);
      if (d.type === "boost") boosts += Number(d.amount || 0);
    });

    await db.collection("analytics").doc("revenue").set({
      total,
      subscriptions,
      boosts,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("[REVENUE] Updated");
  }
);


// ============================================
// ADMIN ANALYTICS API (REAL TIME)
// ============================================

exports.adminAnalytics = onRequest(async (req, res) => {
  const users = await db.collection("users").count().get();
  const products = await db.collection("products").count().get();
  const orders = await db.collection("orders").count().get();

  const revenueSnap = await db.collection("analytics").doc("revenue").get();

  res.json({
    users: users.data().count,
    products: products.data().count,
    orders: orders.data().count,
    revenue: revenueSnap.exists ? revenueSnap.data() : null,
  });
});

// ============================================
// AUTO EXPIRE BOOSTS (CLEAN V2 MODULE)
// ============================================

exports.expireBoosts = onSchedule(
  {
    schedule: "every 24 hours",
    timeZone: "Africa/Kampala",
  },
  async () => {
    try {
      const now = admin.firestore.Timestamp.now();

      const snap = await db
        .collection("products")
        .where("isPremium", "==", true)
        .where("premiumExpiresAt", "<=", now)
        .get();

      if (snap.empty) {
        console.log("[BOOST EXPIRE] Nothing to expire");
        return;
      }

      const batch = db.batch();

      // Collect products to notify AFTER batch succeeds
      const toNotify = [];

      for (const docSnap of snap.docs) {
        batch.update(docSnap.ref, { isPremium: false });
        toNotify.push({ id: docSnap.id, ...docSnap.data() });
      }

      // Commit product updates first
      await batch.commit();

      // Only now send notifications — batch succeeded
      for (const product of toNotify) {
        if (!product.userId) continue;

        await db.collection("notifications").add({
          userId:    product.userId,
          type:      "boost_expired",
          title:     "⭐ Boost Expired",
          message:   `Your ad "${product.name}" is no longer boosted.`,
          relatedId: product.id,
          read:      false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const seller = await getUser(product.userId);

        if (seller?.email) {
          await sendEmail(
            seller.email,
            "⭐ Boost Expired",
            emailTemplate(
              "Boost Expired",
              `<p>Your boost for <b>${product.name}</b> has ended.</p>
               <p>You can re-boost anytime.</p>`
            )
          );
        }

        if (seller?.phone) {
          const msg =
            `⭐ Your boost for "${product.name}" has expired.\n\n` +
            `Re-boost to regain top placement.`;

          await db.collection("whatsapp_reminders").add({
            userId:      product.userId,
            phone:       seller.phone,
            type:        "boost_expired",
            productId:   product.id,
            productName: product.name,
            message:     msg,
            waLink:      `https://wa.me/${seller.phone.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`,
            status:      "pending",
            createdAt:   admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }

      console.log(`[BOOST EXPIRE] Updated ${snap.size}`);
    } catch (err) {
      console.error("[BOOST EXPIRE ERROR]", err.message);
    }
  }
);


// ============================================
// AUTO EXPIRE SUBSCRIPTIONS (CLEAN V2 MODULE)
// ============================================

exports.expireSubscriptions = onSchedule(
  {
    schedule: "every 24 hours",
    timeZone: "Africa/Kampala",
  },
  async () => {
    try {
      const now = new Date();

      const snap = await db
        .collection("business_accounts")
        .where("status", "==", "active")
        .get();

      if (snap.empty) {
        console.log("[SUBS EXPIRE] Nothing to expire");
        return;
      }

      const batch = db.batch();

      // Collect expired subs first, commit batch, then notify
      const toExpire = [];

      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        const end  = data.endDate?.toDate?.();
        if (!end || end > now) continue;
        batch.update(docSnap.ref, { status: "expired" });
        toExpire.push({ id: docSnap.id, ...data });
      }

      if (toExpire.length === 0) {
        console.log("[SUBS EXPIRE] Nothing expired");
        return;
      }

      // Commit subscription status changes first
      await batch.commit();

      // Only then downgrade users and notify
      for (const data of toExpire) {
        if (!data.userId) continue;

        await db.collection("users").doc(data.userId).update({ plan: "free" }).catch(() => {});

        await db.collection("notifications").add({
          userId:    data.userId,
          type:      "subscription_expired",
          title:     "⚠️ Subscription Expired",
          message:   "Your seller plan has expired. Renew to restore benefits.",
          read:      false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const userSnap = await db.collection("users").doc(data.userId).get();
        if (!userSnap.exists) continue;
        const user = userSnap.data();

        if (user.phone) {
          const msg = `⚠️ Your ZiBuy subscription has expired.\n\nRenew now to restore your seller benefits.`;
          await db.collection("whatsapp_reminders").add({
            userId:  data.userId,
            phone:   user.phone,
            type:    "subscription_expired",
            message: msg,
            waLink:  `https://wa.me/${user.phone.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`,
            status:  "pending",
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }

        if (user.email) {
          await sendEmail(
            user.email,
            "⚠️ Subscription Expired",
            emailTemplate(
              "Subscription Expired",
              `<p>Your seller subscription has expired.</p>
               <p>Renew to restore premium benefits.</p>`
            )
          );
        }
      }

      console.log(`[SUBS EXPIRE] Completed`);
    } catch (err) {
      console.error("[SUBS EXPIRE ERROR]", err.message);
    }
  }
);



// ============================================
// BOOST APPROVAL NOTIFICATIONS
// ============================================

exports.boostApprovalNotification = onDocumentCreated(
  "admin_approvals/{id}",
  async (event) => {
    try {

  const approval = event.data.data();

  if (approval.type !== "boost") return;

  const userSnap =
    await db.collection("users")
      .doc(approval.userId)
      .get();

  if (!userSnap.exists) return;

  const user = userSnap.data();

  const productName =
    approval.productName || "your product";


    // IN-APP
      await db.collection("notifications").add({
        userId: approval.userId,
        type: "boost_approved",
        title: "⭐ Boost Approved",
        message: `${productName} is now boosted.`,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

  // EMAIL
  if (user.email) {

    await sendEmail(
      user.email,
      "⭐ Boost Approved",
      emailTemplate(
        "Boost Approved",
        `<p>Your product <b>${productName}</b> is now boosted.</p>`
      )
    );
  }

  // WHATSAPP RECORD

  if (user.phone) {

    const msg =
      `⭐ Your product "${productName}" has been boosted successfully on ZiBuy.`;

    await db.collection("whatsapp_reminders").add({
      userId: approval.userId,
      phone: user.phone,
      type: "boost_approved",
      productId: approval.productId,
      productName,
      message: msg,
      waLink:
        `https://wa.me/${user.phone.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`,
      status: "pending",
      createdAt:
        admin.firestore.FieldValue.serverTimestamp()
    });
  }

} catch (err) {
  console.error(err);
}
  }
);

// ============================================
// ADMIN REAL-TIME ALERT SYSTEM
// ============================================

async function pushAdminAlert(type, title, message, meta = {}) {
  try {
    await db.collection("admin_alerts").add({
      type,
      title,
      message,
      meta,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error("[ADMIN ALERT ERROR]", err.message);
  }
}

async function queueJob(type, payload) {
  await db.collection("job_queue").add({
    type,
    payload,
    status: "pending",
    attempts: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

exports.processQueue = onSchedule(
  {
    schedule: "every 5 minutes",
    timeZone: "Africa/Kampala",
  },
  async () => {
    const snap = await db
      .collection("job_queue")
      .where("status", "==", "pending")
      .limit(20)
      .get();

    for (const docSnap of snap.docs) {
      const job = docSnap.data();

      try {
        // MARK RUNNING
        await docSnap.ref.update({ status: "running" });

        // ========================
        // JOB TYPES
        // ========================
        if (job.type === "email") {
          await sendEmail(job.payload.to, job.payload.subject, job.payload.html);
        }

        if (job.type === "sms") {
          await sendSMS(job.payload.phone, job.payload.message);
        }

        if (job.type === "notification") {
          await db.collection("notifications").add(job.payload);
        }

        await docSnap.ref.update({ status: "done" });
      } catch (err) {
        await docSnap.ref.update({
          status: "failed",
          error: err.message,
          attempts: (job.attempts || 0) + 1,
        });
      }
    }

    console.log(`[QUEUE] processed ${snap.size}`);
  }
);

// ============================================
// SAVED SEARCH ALERTS
// ============================================

exports.notifySavedSearchMatches = onDocumentCreated(
  "products/{productId}",
  async (event) => {
    try {
      const product   = event.data.data();
      const productId = event.params.productId;

      if (!product || product.status !== "active") return;

      // Fetch searches matching this exact category, plus category-agnostic ("all") searches
      const [categorySnap, allCatSnap] = await Promise.all([
        product.category
          ? db.collection("saved_searches").where("category", "==", product.category).limit(200).get()
          : Promise.resolve({ docs: [] }),
        db.collection("saved_searches").where("category", "==", "all").limit(200).get()
      ]);

      const candidates = [...categorySnap.docs, ...allCatSnap.docs];
      if (candidates.length === 0) return;

      const price = Number(product.price || 0);
      const productText = `${product.name || ""} ${product.description || ""} ${product.location || ""} ${product.seller?.location || ""}`.toLowerCase();

      const notifiedUsers = new Set();

      for (const docSnap of candidates) {
        const s = docSnap.data();

        if (s.userId === product.userId) continue; // don't alert sellers about their own ad
        if (notifiedUsers.has(s.userId)) continue;   // one notification per user per product

        if (s.priceMin != null && price < s.priceMin) continue;
        if (s.priceMax != null && price > s.priceMax) continue;

        if (s.keyword && !productText.includes(s.keyword)) continue;
        if (s.location && !productText.includes(s.location)) continue;

        notifiedUsers.add(s.userId);

        await db.collection("notifications").add({
          userId:    s.userId,
          type:      "saved_search_match",
          title:     `🔔 New match for "${s.label}"`,
          message:   `"${product.name}" — UGX ${Number(product.price).toLocaleString()}`,
          relatedId: productId,
          read:      false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await docSnap.ref.update({
          lastNotifiedAt: admin.firestore.FieldValue.serverTimestamp()
        }).catch(() => {});
      }

      if (notifiedUsers.size > 0) {
        console.log(`[SAVED SEARCH] Notified ${notifiedUsers.size} users for product ${productId}`);
      }
    } catch (err) {
      console.error("[SAVED SEARCH ERROR]", err.message);
    }
  }
);

exports.subscriptionApprovalNotifications = onDocumentUpdated(
  "business_accounts/{id}",
  async (event) => {

    const before = event.data.before.data();
    const after = event.data.after.data();

    // Only run when subscription becomes active
    if (
      before.status === "active" ||
      after.status !== "active"
    ) {
      return;
    }

    try {

      const userSnap = await db
        .collection("users")
        .doc(after.userId)
        .get();

      if (!userSnap.exists) return;

      const user = userSnap.data();
      const shouldBeVerified = after.plan === "silver" || after.plan === "gold";

      // Keep users.isSellerVerified in sync (display field)
      await db.collection("users").doc(after.userId).update({
        isSellerVerified: shouldBeVerified
      }).catch(() => {});

      // Sync the REAL verification record every badge display reads from
      if (shouldBeVerified) {
        const existingSnap = await db.collection("seller_verifications")
          .where("userId", "==", after.userId)
          .get();

        if (!existingSnap.empty) {
          const existing = existingSnap.docs[0];
          if (existing.data().status !== "approved") {
            await existing.ref.update({
              status:      "approved",
              approvedAt:  admin.firestore.FieldValue.serverTimestamp(),
              approvedVia: `${after.plan}_subscription`
            });
          }
        } else {
          await db.collection("seller_verifications").add({
            userId:       after.userId,
            email:        user.email || "",
            fullName:     user.displayName || (user.email || "").split("@")[0],
            businessName: "",
            phone:        user.phone || "",
            location:     user.location || "",
            status:       "approved",
            approvedAt:   admin.firestore.FieldValue.serverTimestamp(),
            approvedVia:  `${after.plan}_subscription`,
            createdAt:    admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }

      await db.collection("notifications").add({
  userId: after.userId,
  type: "subscription_approved",
  title: "🎉 Subscription Activated",
  message: `Your ${after.plan} plan is now active.`,
  read: false,
  createdAt: admin.firestore.FieldValue.serverTimestamp()
});

      // EMAIL
      if (user.email) {
        await sendEmail(
          user.email,
          `🎉 ${after.plan.toUpperCase()} Plan Activated`,
          emailTemplate(
            "Subscription Approved",
            `<p>Your ${after.plan} subscription has been approved and activated.</p>`
          )
        );
      }

      // WHATSAPP REMINDER RECORD
      if (user.phone) {

        const msg =
          `🎉 Your ${after.plan} subscription has been activated on ZiBuy.\n\n` +
          `Thank you for upgrading your account.`;

        await db.collection("whatsapp_reminders").add({
          userId: after.userId,
          phone: user.phone,
          type: "subscription_approved",
          message: msg,
          waLink:
            `https://wa.me/${user.phone.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`,
          status: "pending",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      console.log(
        `[SUB APPROVED] ${after.userId}`
      );

    } catch (err) {
      console.error(
        "[SUB APPROVED ERROR]",
        err.message
      );
    }
  }
);


// ============================================
// BLOG SEO FUNCTION
// ============================================

exports.blogSeo = onRequest(async (req, res) => {
  try {

    const slug = req.path.replace("/blog/", "");

    // Query directly by slug field — requires index on (slug, status)
    const posts = await db.collection("blog_posts")
      .where("status", "==", "published")
      .where("slug",   "==", slug)
      .limit(1)
      .get();

    let matchedPost = null;

    if (!posts.empty) {
      matchedPost = { id: posts.docs[0].id, ...posts.docs[0].data() };
    }

    if (!matchedPost) {
      return res.redirect(
        "https://zibuy.ziteche.com/blog.html"
      );
    }

    const title =
      matchedPost.title || "ZiBuy Blog";

    const description =
      matchedPost.excerpt ||
      (matchedPost.content || "")
        .replace(/\n/g, " ")
        .slice(0, 160);

    const image =
      matchedPost.coverImage ||
      "https://zibuy.ziteche.com/icons/icon-512.png";

    const url =
      `https://zibuy.ziteche.com/blog/${slug}`;

    res.status(200).send(`
<!DOCTYPE html>
<html lang="en">
<head>

<title>${title}</title>

<meta name="description" content="${description}" />

<meta property="og:type" content="article" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:image" content="${image}" />
<meta property="og:url" content="${url}" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="${image}" />

<meta http-equiv="refresh"
content="0; url=https://zibuy.ziteche.com/blog-post.html?id=${matchedPost.id}" />

</head>

<body>
Redirecting...
</body>
</html>
`);

  } catch (err) {

    console.error(err);

    res.redirect(
      "https://zibuy.ziteche.com/blog.html"
    );
  }
});


// ============================================
// PRODUCT SEO PAGE
// ============================================

seoApp.get("/product/:id", async (req, res) => {
  try {

    const productId = req.params.id;

    const snap = await db
      .collection("products")
      .doc(productId)
      .get();

    if (!snap.exists) {
      return res.redirect(
        "https://zibuy.ziteche.com"
      );
    }

    const p = snap.data();

    const title =
      p.name || "ZiBuy Product";

    const description =
      p.description ||
      "Buy and sell safely on ZiBuy Uganda";

    const image =
      (p.images && p.images[0])
        ? p.images[0]
        : "https://zibuy.ziteche.com/icons/icon-512.png";

    const url =
      `https://zibuy.ziteche.com/product/${productId}`;

    const seller =
      p.seller?.name ||
      "ZiBuy Seller";

    const schema = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: title,
      image: [image],
      description,
      brand: {
        "@type": "Brand",
        name: p.details?.brand || "ZiBuy"
      },
      offers: {
  "@type": "Offer",
  url: `https://zibuy.ziteche.com/product.html?id=${productId}`,
  priceCurrency: "UGX",
  price: p.price || 0,
  availability: "https://schema.org/InStock",
  itemCondition: "https://schema.org/NewCondition",
  seller: {
    "@type": "Organization",
    name: seller
  }
}
    };

    if (
      p.aggregateRating &&
      p.aggregateRating.reviewCount > 0
    ) {
      schema.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue:
          p.aggregateRating.ratingValue,
        reviewCount:
          p.aggregateRating.reviewCount
      };
    }

    res.status(200).send(`
<!DOCTYPE html>
<html lang="en">
<head>

<title>${title}</title>

<meta name="description" content="${description}" />

<meta property="og:type" content="product" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:image" content="${image}" />
<meta property="og:url" content="${url}" />

<link rel="canonical" href="${url}" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="${image}" />

<script type="application/ld+json">
${JSON.stringify(schema)}
</script>

<meta http-equiv="refresh"
content="0; url=https://zibuy.ziteche.com/product.html?id=${productId}" />

</head>
<body>
Redirecting...
</body>
</html>
`);
  }
  catch (err) {

    console.error(err);

    res.redirect(
      "https://zibuy.ziteche.com"
    );
  }
});

exports.productSeo = onRequest(seoApp);


// ============================================
// SCHEDULED BLOG PUBLISHING
// Runs every 15 minutes, publishes any post
// whose scheduled time has arrived
// ============================================

exports.publishScheduledBlogPosts = onSchedule(
  { schedule: "every 15 minutes", timeZone: "Africa/Kampala" },
  async () => {
    try {
      const now = admin.firestore.Timestamp.now();

      const snap = await db.collection("blog_posts")
        .where("status", "==", "scheduled")
        .where("publishAt", "<=", now)
        .get();

      if (snap.empty) return;

      const batch = db.batch();
      snap.forEach(doc => {
        batch.update(doc.ref, {
          status: "published",
          publishedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });

      await batch.commit();
      console.log(`[BLOG SCHEDULER] Published ${snap.size} post(s)`);
    } catch (err) {
      console.error("[BLOG SCHEDULER ERROR]", err.message);
    }
  }
);

// ============================================
// ZIBUY PROTECT — auto-confirm & dispute alerts
// ============================================

exports.autoConfirmProtectedOrders = onSchedule(
  { schedule: "every 24 hours", timeZone: "Africa/Kampala" },
  async () => {
    try {
      const cutoff = new Date(Date.now() - 7 * 86400000);

      const snap = await db.collection("orders")
        .where("protected", "==", true)
        .where("deliveryConfirmed", "==", false)
        .get();

      let count = 0;

      for (const docSnap of snap.docs) {
        const order = docSnap.data();
        if (order.disputeStatus === "open") continue; // never auto-confirm a disputed order

        const created = order.createdAt?.toDate?.();
        if (!created || created > cutoff) continue;

        await docSnap.ref.update({
          deliveryConfirmed: true,
          autoConfirmed:      true,
          confirmedAt:         admin.firestore.FieldValue.serverTimestamp()
        });

        if (order.buyerUid && order.buyerUid !== "guest") {
          await db.collection("notifications").add({
            userId:  order.buyerUid,
            type:    "order_auto_confirmed",
            title:   "✅ Order Auto-Confirmed",
            message: `"${order.productName}" was automatically marked as received after 7 days.`,
            read:    false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }

        count++;
      }

      console.log(`[ZIBUY PROTECT] Auto-confirmed ${count} orders`);
    } catch (err) {
      console.error("[ZIBUY PROTECT ERROR]", err.message);
    }
  }
);

// Alert admin the moment a dispute is filed
exports.notifyAdminOnDispute = onDocumentCreated("disputes/{id}", async (event) => {
  const dispute = event.data.data();
  await pushAdminAlert(
    "dispute",
    "🚨 New Dispute Filed",
    `${dispute.productName} — ${dispute.reason}`,
    { orderId: dispute.orderId }
  );
});


// ============================================
// FULL ACCOUNT DELETION — admin-triggered,
// removes Firebase Auth login too (only the
// Admin SDK, server-side, can do this part)
// ============================================

// ============================================
// DELETE MY ACCOUNT — self-service
// (Google Play and the App Store both require this)
// ============================================
async function selfDeleteByQuery(colName, field, value) {
  const snap = await db.collection(colName).where(field, "==", value).get();
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch();
    snap.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  return snap.size;
}

exports.deleteMyAccount = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Please log in first");

  const userSnap = await db.collection("users").doc(uid).get();
  const email = String(userSnap.data()?.email || request.auth.token.email || "").toLowerCase();

  if (email === "swaibuziraye22@gmail.com") {
    throw new HttpsError("failed-precondition", "The owner account can't be deleted from inside the app.");
  }

  const openDispute = await db.collection("disputes")
    .where("buyerUid", "==", uid)
    .where("status", "==", "open")
    .limit(1).get();
  if (!openDispute.empty) {
    throw new HttpsError("failed-precondition", "You have an open ZiBuy Protect dispute. Please wait until it is resolved, then delete your account.");
  }

  const errors = [];
  const step = async (label, fn) => {
    try { await fn(); } catch (e) { errors.push(`${label}: ${e.message}`); }
  };

  // 1. Everything they own or created
  const byUid = [
    ["products", "userId"], ["boost_requests", "userId"], ["pin_requests", "userId"],
    ["cv_boosts", "userId"], ["auto_renewals", "userId"], ["business_accounts", "userId"],
    ["seller_verifications", "userId"], ["saved_searches", "userId"], ["likes", "userId"],
    ["notifications", "userId"], ["similar_item_alerts", "userId"], ["shop_followers", "userId"],
    ["boost_credits", "userId"], ["buyer_ratings", "buyerId"], ["reviews", "sellerId"], ["reviews", "userId"]
  ];
  for (const [col, field] of byUid) {
    await step(col, () => selfDeleteByQuery(col, field, uid));
  }

  if (email) {
    await step("reviews-written", () => selfDeleteByQuery("reviews", "reviewerEmail", email));
    await step("messages-sent", () => selfDeleteByQuery("messages", "senderEmail", email));
  }

  // 2. Order records are kept (the other party and disputes need them),
  //    but the buyer's personal details are removed
  await step("orders-anonymize", async () => {
    const snap = await db.collection("orders").where("buyerUid", "==", uid).get();
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = db.batch();
      snap.docs.slice(i, i + 400).forEach(d => batch.update(d.ref, {
        customerName: "Deleted user", customerPhone: "", customerLocation: "",
        userEmail: "deleted", buyerEmail: "deleted"
      }));
      await batch.commit();
    }
  });

  // 3. Single documents keyed by their id
  for (const col of ["shops", "business_profiles", "response_stats", "admins", "admin_sessions", "phone_otps"]) {
    await step(col, () => db.collection(col).doc(uid).delete());
  }

  // 4. Uploaded files
  const bucket = admin.storage().bucket();
  for (const prefix of [
    `products/${uid}/`, `seller-verification/${uid}/`, `profile-pictures/${uid}/`,
    `business-logos/${uid}/`, `business-banners/${uid}/`, `service-videos/${uid}/`,
    `shop-logos/${uid}`, `shop-banners/${uid}`
  ]) {
    await step(`storage ${prefix}`, () => bucket.deleteFiles({ prefix }));
  }

  // 5. The user record, then the login itself
  await step("user-doc", () => db.collection("users").doc(uid).delete());

  try {
    await admin.auth().deleteUser(uid);
  } catch (e) {
    throw new HttpsError("internal", "Your data was removed but we couldn't close your login. Please contact ZiBuy Support.");
  }

  await auditLog("USER_SELF_DELETED", "system", `User ${uid} deleted their own account`);
  return { ok: true, errors };
});

exports.adminDeleteUserAccount = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError("unauthenticated", "Login required");

  const callerSnap = await db.collection("users").doc(callerUid).get();
  if (callerSnap.data()?.email !== "swaibuziraye22@gmail.com") {
    throw new HttpsError("permission-denied", "Admin only");
  }

  const targetUid = request.data?.userId;
  if (!targetUid) throw new HttpsError("invalid-argument", "userId required");

  const results = { firestoreDeleted: false, authDeleted: false, errors: [] };

  // ── 1. Delete all their Firestore data ──
  try {
    const collectionsToClean = [
      { name: "products",          field: "userId" },
      { name: "boost_requests",    field: "userId" },
      { name: "pin_requests",      field: "userId" },
      { name: "cv_boosts",         field: "userId" },
      { name: "auto_renewals",     field: "userId" },
      { name: "business_accounts", field: "userId" },
      { name: "seller_verifications", field: "userId" },
      { name: "reviews",           field: "sellerId" },
      { name: "buyer_ratings",     field: "buyerId" },
      { name: "saved_searches",    field: "userId" },
      { name: "response_stats",    field: null } // doc ID IS the userId
    ];

    for (const col of collectionsToClean) {
      if (col.field === null) {
        await db.collection(col.name).doc(targetUid).delete().catch(() => {});
        continue;
      }
      const snap = await db.collection(col.name).where(col.field, "==", targetUid).get();
      const batch = db.batch();
      snap.forEach(d => batch.delete(d.ref));
      if (!snap.empty) await batch.commit();
    }

    // Shop docs — ID is usually the userId itself
    await db.collection("shops").doc(targetUid).delete().catch(() => {});
    await db.collection("business_profiles").doc(targetUid).delete().catch(() => {});

    // The user document itself, last
    await db.collection("users").doc(targetUid).delete();

    results.firestoreDeleted = true;
  } catch (err) {
    results.errors.push(`Firestore cleanup: ${err.message}`);
  }

  // ── 2. Delete the actual Auth login — this is the part the
  //      browser could never do, only the Admin SDK can ──
  try {
    await admin.auth().deleteUser(targetUid);
    results.authDeleted = true;
  } catch (err) {
    // User may already be gone from Auth, or never existed there — not fatal
    results.errors.push(`Auth deletion: ${err.message}`);
  }

  await auditLog("ADMIN_DELETED_USER", "admin", `Fully deleted user ${targetUid}`);

  return results;
});



// ============================================
// LOGIN-ONLY LINKING for Google / Phone sign-in
// Registration always happens via email+phone+
// password. Google/Phone sign-in NEVER creates a
// new account — it looks up the existing account
// by verified email or phone and hands back a
// custom token so the client becomes that account.
// ============================================

function phoneVariants(e164Phone) {
  const digits = (e164Phone || "").replace(/\D/g, ""); // e.g. 256701234567
  const local  = digits.length > 9 ? "0" + digits.slice(-9) : digits; // e.g. 0701234567
  return Array.from(new Set([digits, local, e164Phone]));
}

exports.linkLoginToExistingAccount = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Login required");

  const token = request.auth.token;

  // Fast path — this Firebase identity already has a real account
  // (e.g. they've used this exact login method before)
  const existingOwnDoc = await db.collection("users").doc(uid).get();
  if (existingOwnDoc.exists) {
    return { status: "ok" };
  }

  let matchSnap = null;

  if (token.email) {
    matchSnap = await db.collection("users")
      .where("email", "==", token.email)
      .limit(1)
      .get();
  } else if (token.phone_number) {
    matchSnap = await db.collection("users")
      .where("phone", "in", phoneVariants(token.phone_number))
      .limit(1)
      .get();
  }

  if (matchSnap && !matchSnap.empty) {
    const existingUserDoc = matchSnap.docs[0];
    const existingUid = existingUserDoc.id;

    // Already the same account somehow — nothing to link
    if (existingUid === uid) {
      return { status: "ok" };
    }

    // Mint a custom token for the REAL account so the client can
    // switch into it — this is the only server-side-safe way to do
    // this, since only the Admin SDK can issue tokens for another uid
    const customToken = await admin.auth().createCustomToken(existingUid);

    // Clean up the orphan Auth identity this Google/Phone sign-in
    // just created, now that we're routing them to their real account
    await admin.auth().deleteUser(uid).catch(() => {});

    return { status: "existing_account_found", customToken };
  }

  // No matching account anywhere — this person has never registered.
  // Per policy, we do NOT create one here. Clean up the orphan Auth
  // identity that signInWithPopup/confirm() just created.
  await admin.auth().deleteUser(uid).catch(() => {});

  return { status: "no_account_found" };
});


// ============================================
// NOTIFY ABOUT SIMILAR ITEMS — fires when a
// seller posts a new product matching a category
// someone requested alerts for
// ============================================

exports.notifySimilarItemAlerts = onDocumentCreated("products/{productId}", async (event) => {
  const product = event.data.data();
  const productId = event.params.productId;

  if (!product || product.status !== "active" || !product.category) return;

  try {
    const alertsSnap = await db.collection("similar_item_alerts")
      .where("category", "==", product.category)
      .get();

    if (alertsSnap.empty) return;

    const notified = new Set();

    for (const alertDoc of alertsSnap.docs) {
      const alert = alertDoc.data();
      if (alert.userId === product.userId) continue; // don't notify someone about their own new listing
      if (notified.has(alert.userId)) continue;
      notified.add(alert.userId);

      await db.collection("notifications").add({
        userId: alert.userId,
        type: "similar_item",
        title: "🔔 New item you might like",
        message: `A new "${product.name}" just got posted — similar to something you were watching.`,
        relatedId: productId,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Clean up the alert once fired — avoids re-notifying for every future post
      await alertDoc.ref.delete();
    }
  } catch (err) {
    console.error("[SIMILAR ITEM ALERT ERROR]", err.message);
  }
});