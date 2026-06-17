const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

const { setGlobalOptions } = require("firebase-functions/v2");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");

setGlobalOptions({
  region: "us-central1",
  memory: "512MiB",
  timeoutSeconds: 60,
});


// ============================================
// EMAIL SETUP
// ============================================

function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_EMAIL,
      pass: process.env.GMAIL_PASSWORD,
    },
  });
}

async function sendEmail(to, subject, html) {
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"ZiBuy Uganda" <${process.env.GMAIL_EMAIL}>`,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error("Email failed:", to, err.message);
  }
}


// ============================================
// HELPERS
// ============================================

async function getUser(userId) {
  const snap = await db.collection("users").doc(userId).get();
  return snap.exists ? snap.data() : null;
}

async function getProduct(productId) {
  const snap = await db.collection("products").doc(productId).get();
  return snap.exists ? snap.data() : null;
}


// ============================================
// PUSH NOTIFICATIONS
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
      console.error("Push failed:", err.message);
    }
  }
);


// ============================================
// ORDER SYSTEM (SINGLE MASTER TRIGGER)
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

    // BUYER EMAIL
    if (order.userEmail) {
      await sendEmail(
        order.userEmail,
        `Order Confirmed ${orderId}`,
        `<h2>Your order is confirmed</h2>
         <ul>${itemList}</ul>`
      );
    }

    // SELLER EMAIL
    if (seller?.email) {
      await sendEmail(
        seller.email,
        `New Order ${orderId}`,
        `<h2>You received an order</h2>
         <ul>${itemList}</ul>`
      );
    }

    // SMS ONLY FOR GOLD SELLERS
    if (seller?.plan === "gold" && seller.phone) {
      try {
        const AfricasTalking = require("africastalking");
        const at = AfricasTalking({
          apiKey: process.env.AT_API_KEY,
          username: process.env.AT_USERNAME || "sandbox",
        });

        await at.SMS.send({
          to: [seller.phone],
          message: `New order from ${order.customerName} - UGX ${order.total}`,
          from: "ZiBuy",
        });
      } catch (err) {
        console.error("SMS failed:", err.message);
      }
    }

    console.log(`[Order] Processed ${orderId}`);
  }
);


// ============================================
// CHAT MESSAGES
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
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (user.plan !== "free" && user.fcmToken) {
      await admin.messaging().send({
        token: user.fcmToken,
        notification: {
          title: "New Message",
          body: msg.text?.slice(0, 100),
        },
      });
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
// ============================================

exports.weeklyTopDeals = onSchedule(
  { schedule: "every monday 08:00", timeZone: "Africa/Kampala" },
  async () => {
    const users = await db.collection("users").limit(2000).get();
    const emails = users.docs.map(d => d.data().email).filter(Boolean);

    await Promise.all(
      emails.map(email =>
        sendEmail(email, "Top Deals This Week", "Check ZiBuy deals")
      )
    );

    console.log(`[Weekly] Sent to ${emails.length}`);
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
      const usersSnap = await db.collection("users").limit(2000).get();
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