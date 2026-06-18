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

    // SMS (SAFE + DEDUP SCALE LOCK)
    // SMS handled by smsGoldSellers trigger (dedicated system)
    if (seller?.phone) {
      const lock = await logOnce(
        `order_${orderId}`,
        {
          type: "order",
          orderId,
          customer: order.customerName || "",
          amount: order.total || 0
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
        .where("endDate", ">", now)
        .where("endDate", "<=", in48h)
        .get();

      for (const docSnap of snap.docs) {
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
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    try {
      const snap = await db
        .collection("boost_requests")
        .where("status", "==", "approved")
        .where("expiresAt", ">", now)
        .where("expiresAt", "<=", in48h)
        .get();

      for (const docSnap of snap.docs) {
        const boost = docSnap.data();
        const userId = boost.userId;
        const productName = boost.productName || "Your ad";

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

      console.log(`[BOOST EXPIRY] Processed ${snap.size}`);
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

      for (const docSnap of snap.docs) {
        batch.update(docSnap.ref, {
          isPremium: false,
        });

        const product = docSnap.data();

        // notify seller
        if (product.userId) {
          await db.collection("notifications").add({
            userId: product.userId,
            type: "boost_expired",
            title: "⭐ Boost Expired",
            message: `Your ad "${product.name}" is no longer boosted.`,
            relatedId: docSnap.id,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          const seller = product.userId
  ? await getUser(product.userId)
  : null;

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

  if (seller.phone) {

  const msg =
    `⭐ Your boost for "${product.name}" has expired.\n\n` +
    `Re-boost to regain top placement.`;

  await db.collection("whatsapp_reminders").add({
    userId: product.userId,
    phone: seller.phone,
    type: "boost_expired",
    productId: docSnap.id,
    productName: product.name,
    message: msg,
    waLink:
      `https://wa.me/${seller.phone.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`,
    status: "pending",
    createdAt:
      admin.firestore.FieldValue.serverTimestamp()
  });
}
}
        }
      }

      await batch.commit();

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

      for (const docSnap of snap.docs) {
        const data = docSnap.data();

        const end = data.endDate?.toDate?.();
        if (!end || end > now) continue;

        batch.update(docSnap.ref, {
          status: "expired",
        });

        // downgrade user plan
        if (data.userId) {
          await db.collection("users").doc(data.userId).update({
            plan: "free",
          });

          await db.collection("notifications").add({
            userId: data.userId,
            type: "subscription_expired",
            title: "⚠️ Subscription Expired",
            message: "Your seller plan has expired. Renew to restore benefits.",
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });


          const userSnap =
  await db.collection("users")
    .doc(data.userId)
    .get();

if (userSnap.exists) {

  const user = userSnap.data();

  if (user.phone) {

  const msg =
    `⚠️ Your ZiBuy subscription has expired.\n\n` +
    `Renew now to restore your seller benefits.`;

  await db.collection("whatsapp_reminders").add({
    userId: data.userId,
    phone: user.phone,
    type: "subscription_expired",
    message: msg,
    waLink:
      `https://wa.me/${user.phone.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`,
    status: "pending",
    createdAt:
      admin.firestore.FieldValue.serverTimestamp()
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
        }
      }

      await batch.commit();

      console.log(`[SUBS EXPIRE] Completed`);
    } catch (err) {
      console.error("[SUBS EXPIRE ERROR]", err.message);
    }
  }
);


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

const { onDocumentUpdated } = require("firebase-functions/v2/firestore");

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