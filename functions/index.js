const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

const { setGlobalOptions } =
  require("firebase-functions/v2");

const { onRequest } =
  require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");

setGlobalOptions({
  region: "us-central1",
  memory: "1GiB", // SCALE MODE UPGRADE
  timeoutSeconds: 540, // avoid timeout crashes in heavy AI/broadcast jobs
  maxInstances: 10, // prevent cost spikes + overload
});


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

async function logOnce(key) {
  const ref = db.collection("function_logs").doc(key);

  try {
    await ref.create({
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return true;
  } catch (e) {
    return false; // already exists
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

    // SMS (SAFE + DEDUP SCALE LOCK)
    if (seller?.plan === "gold" && seller.phone) {
      const lock = await logOnce(`sms_order_${orderId}`);
      if (!lock) return;

      try {
        const AfricasTalking = require("africastalking");
        const at = AfricasTalking({
          apiKey: process.env.AT_API_KEY,
          username: process.env.AT_USERNAME || "sandbox",
        });

        await at.SMS.send({
          to: [seller.phone],
          message: `New order ${order.customerName} UGX ${order.total}`,
          from: "ZiBuy",
        });

      } catch (err) {
        console.error("[SMS ERROR]", err.message);
      }
    }

    console.log(`[ORDER] ${orderId}`);
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
      title: "New Message",
      message: msg.text?.slice(0, 80),
      type: "message",
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

    const users = await db.collection("users").limit(2000).get();
    const emails = users.docs.map(d => d.data().email).filter(Boolean);

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
    const users = await db.collection("users").limit(2000).get();
    const emails = users.docs.map(d => d.data().email).filter(Boolean);

    for (let i = 0; i < emails.length; i += 15) {
      const batch = emails.slice(i, i + 15);

      await Promise.allSettled(
        batch.map(email =>
          sendEmail(email, "Top Deals This Week", "Check ZiBuy deals")
        )
      );

      await new Promise(r => setTimeout(r, 1500));
    }

    console.log("[WEEKLY] done");
  }
);


// ============================================
// BOOST EXPIRY
// ============================================

exports.expireBoosts = onSchedule(
  { schedule: "every 24 hours" },
  async () => {
    const now = admin.firestore.Timestamp.now();

    const snap = await db.collection("products")
      .where("isPremium", "==", true)
      .where("premiumExpiresAt", "<=", now)
      .get();

    const batch = db.batch();

    snap.docs.forEach(d =>
      batch.update(d.ref, { isPremium: false })
    );

    await batch.commit();

    console.log(`[Boosts] Expired ${snap.size}`);
  }
);


// ============================================
// SUBSCRIPTIONS
// ============================================

exports.expireSubscriptions = onSchedule(
  { schedule: "every 24 hours" },
  async () => {
    const now = new Date();

    const snap = await db.collection("business_accounts")
      .where("status", "==", "active")
      .get();

    const batch = db.batch();

    snap.docs.forEach(d => {
      const end = d.data().endDate?.toDate?.();
      if (end && now > end) {
        batch.update(d.ref, { status: "expired" });
      }
    });

    await batch.commit();
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

      const AfricasTalking = require("africastalking");
      const at = AfricasTalking({
        apiKey: process.env.AT_API_KEY,
        username: process.env.AT_USERNAME || "sandbox",
      });

      

      await at.SMS.send({
        to: [seller.phone],
        message: `ZiBuy: New order from ${order.customerName}. Total UGX ${order.total}`,
        from: "ZiBuy",
      });

      console.log("[SMS] Sent to gold seller");
    } catch (err) {
      console.error("[SMS] Failed:", err.message);
    }
  }
);


exports.aiRecommendations = onSchedule(
  {
    schedule: "every friday 10:00",
    timeZone: "Africa/Kampala",
  },
  async () => {
    try {
      const usersSnap = await db.collection("users")
  .limit(1000)
  .get();
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
// BOOST / SUBSCRIPTION REVENUE TRACKING (NEW LAYER)
// ============================================

exports.logRevenueEvent = onDocumentCreated(
  "admin_approvals/{id}",
  async (event) => {
    const data = event.data.data();

    await db.collection("revenue_logs").add({
      type: data.type, // boost | subscription
      amount: data.amount || 0,
      productId: data.productId || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
);




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
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const userRef = db.collection("users").doc(data.userId);

    if (data.type === "subscription") {
      await userRef.update({
        plan: "gold",
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

    console.log("[MOMO] Payment activated:", data.txRef);
  }
);


// ============================================
// REVENUE TRACKING SYSTEM (NEW)
// ============================================

exports.revenueTracker = onSchedule(
  { schedule: "every day 00:00", timeZone: "Africa/Kampala" },
  async () => {
    const payments = await db.collection("momo_payments")
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