const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const express = require("express");


admin.initializeApp();
const db = admin.firestore();

const { setGlobalOptions } = require("firebase-functions/v2");
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule }        = require("firebase-functions/v2/scheduler");

// ── Must be called before any function exports ──
setGlobalOptions({
  region:         "us-central1",
  memory:         "1GiB",
  timeoutSeconds: 540,
  maxInstances:   10,
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
      from: `"ZiBuy Uganda" <${process.env.GMAIL_EMAIL}>`,
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
    if (!user?.fcmToken || user.plan === "free") return;

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
// ORDER SYSTEM (SINGLE MASTER TRIGGER)
// ============================================

// ============================================
// ORDER SYSTEM (SCALE MODE FIXED)
// ============================================

exports.onNewOrder = onDocumentCreated(
  "orders/{orderId}",
  async (event) => {
    const order = event.data.data();
    const orderId = event.params.orderId;

    const product = await getProduct(order.items?.[0]?.productId);
    const seller = product?.userId ? await getUser(product.userId) : null;

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

    if (user.plan !== "free" && user.fcmToken) {
      try {
        await admin.messaging().send({
          token: user.fcmToken,
          notification: {
            title: "New Message",
            body: msg.text?.slice(0, 100),
          },
        });
      } catch (err) {
        console.error("[MSG ERROR]", err.message);
      }
    }
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
        const image    = p.images?.[0] || "https://zibuy-5deae.web.app/icons/icon-512.png";
        const price    = Number(p.price || 0).toLocaleString();
        const name     = p.name || "Product";
        const category = (p.category || "").charAt(0).toUpperCase() + (p.category || "").slice(1);
        const location = p.seller?.location || p.location || "Uganda";
        const link     = `https://zibuy-5deae.web.app/product.html?id=${p.id}`;

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
            <a href="https://zibuy-5deae.web.app"
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
            <a href="https://zibuy-5deae.web.app" style="color:#ff6600">Visit ZiBuy</a>
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
              <a href="https://zibuy-5deae.web.app/product.html?id=${p.id}">
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
            "https://zibuy-5deae.web.app"
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
              "https://zibuy-5deae.web.app/business-plans.html"
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
              "https://zibuy-5deae.web.app/boost.html"
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
        "https://zibuy-5deae.web.app/blog.html"
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
      "https://zibuy-5deae.web.app/icons/icon-512.png";

    const url =
      `https://zibuy-5deae.web.app/blog/${slug}`;

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
content="0; url=https://zibuy-5deae.web.app/blog-post.html?id=${matchedPost.id}" />

</head>

<body>
Redirecting...
</body>
</html>
`);

  } catch (err) {

    console.error(err);

    res.redirect(
      "https://zibuy-5deae.web.app/blog.html"
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
        "https://zibuy-5deae.web.app"
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
        : "https://zibuy-5deae.web.app/icons/icon-512.png";

    const url =
      `https://zibuy-5deae.web.app/product/${productId}`;

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
  url: `https://zibuy-5deae.web.app/product.html?id=${productId}`,
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

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="${image}" />

<script type="application/ld+json">
${JSON.stringify(schema)}
</script>

<meta http-equiv="refresh"
content="0; url=https://zibuy-5deae.web.app/product.html?id=${productId}" />

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
      "https://zibuy-5deae.web.app"
    );
  }
});

exports.productSeo = onRequest(seoApp);