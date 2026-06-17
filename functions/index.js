// ============================================
// ZiBuy — Firebase Functions v2 Clean Version
// ============================================

const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

const {
  onDocumentCreated,
} = require("firebase-functions/v2/firestore");

const {
  onSchedule,
} = require("firebase-functions/v2/scheduler");

const {
  setGlobalOptions,
} = require("firebase-functions/v2");

setGlobalOptions({ region: "us-central1" });


// ============================================
// EMAIL TRANSPORTER
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
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"ZiBuy Uganda" <${process.env.GMAIL_EMAIL}>`,
    to,
    subject,
    html,
  });
}


// ============================================
// HELPERS
// ============================================

function emailTemplate(title, body, ctaText, ctaUrl) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff">
      <div style="background:#ff6600;padding:24px;text-align:center">
        <h1 style="color:white;margin:0;font-size:28px;font-weight:900">ZiBuy</h1>
        <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px">Uganda's Trusted Marketplace</p>
      </div>
      <div style="padding:28px 24px">
        <h2 style="color:#111827;font-size:20px;margin:0 0 14px">${title}</h2>
        <div style="color:#374151;font-size:15px;line-height:1.7">${body}</div>
        ${
          ctaText
            ? `<div style="text-align:center;margin:28px 0 8px">
                <a href="${ctaUrl}" style="background:#ff6600;color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block">
                  ${ctaText}
                </a>
              </div>`
            : ""
        }
      </div>
    </div>
  `;
}


// ============================================
// USER HELPER
// ============================================

async function getUserData(userId) {
  const snap = await db.collection("users").doc(userId).get();
  return snap.exists ? snap.data() : null;
}


// ============================================
// 1. PUSH NOTIFICATIONS
// ============================================

exports.sendPushOnNotification = onDocumentCreated(
  "notifications/{notifId}",
  async (event) => {
    try {
      const data = event.data.data();
      if (!data?.userId) return;

      const userData = await getUserData(data.userId);
      if (!userData) return;

      const token = userData.fcmToken;
      const plan = userData.plan || "free";

      if (plan === "free" || !token) return;

      await admin.messaging().send({
        token,
        notification: {
          title: data.title || "ZiBuy",
          body: data.message || "",
        },
        data: {
          type: data.type || "",
          url: data.url || "https://zibuy-5deae.web.app",
        },
      });

      console.log(`[Push] Sent to ${data.userId}`);
    } catch (err) {
      console.error("[Push] Failed:", err.message);
    }
  }
);


// ============================================
// 2. ORDER CREATED
// ============================================

exports.onNewOrder = onDocumentCreated(
  "orders/{orderId}",
  async (event) => {
    try {
      const order = event.data.data();
      const orderId = event.params.orderId;

      const productSnap = await db
        .collection("products")
        .doc(order.items?.[0]?.productId || "x")
        .get();

      const sellerEmail = productSnap.exists
        ? productSnap.data().userEmail
        : null;

      const itemList = (order.items || [])
        .map(
          (i) =>
            `<li>${i.name} × ${i.qty} — UGX ${(
              i.price * i.qty
            ).toLocaleString()}</li>`
        )
        .join("");

      if (order.userEmail) {
        await sendEmail(
          order.userEmail,
          `Order Confirmed — ${orderId}`,
          emailTemplate(
            "Your order is confirmed 🎉",
            `<p>Hi ${order.customerName || "there"},</p>
             <p>Order <strong>${orderId}</strong> placed successfully.</p>
             <ul>${itemList}</ul>
             <p>Total: UGX ${Number(order.total).toLocaleString()}</p>`,
            "Track Order",
            "https://zibuy-5deae.web.app/dashboard.html?tab=orders"
          )
        );
      }

      if (sellerEmail) {
        await sendEmail(
          sellerEmail,
          `New Order — ${orderId}`,
          emailTemplate(
            "New order received",
            `<p>You received a new order.</p><ul>${itemList}</ul>`
          )
        );
      }

      console.log(`[Order] Processed ${orderId}`);
    } catch (err) {
      console.error("[Order] Failed:", err.message);
    }
  }
);


// ============================================
// 3. CHAT MESSAGE
// ============================================

exports.onNewMessage = onDocumentCreated(
  "messages/{msgId}",
  async (event) => {
    try {
      const msg = event.data.data();

      if (!msg?.participants || !msg.senderEmail) return;

      const recipientEmail = msg.participants.find(
        (p) => p !== msg.senderEmail
      );
      if (!recipientEmail) return;

      const recipientSnap = await db
        .collection("users")
        .where("email", "==", recipientEmail)
        .limit(1)
        .get();

      if (recipientSnap.empty) return;

      const recipient = recipientSnap.docs[0];
      const userData = recipient.data();

      await db.collection("notifications").add({
        userId: recipient.id,
        type: "message",
        title: `New message from ${msg.senderEmail.split("@")[0]}`,
        message: msg.text?.slice(0, 80),
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      if (userData.plan !== "free" && userData.fcmToken) {
        await admin.messaging().send({
          token: userData.fcmToken,
          notification: {
            title: "New Message",
            body: msg.text?.slice(0, 100),
          },
        });
      }

      console.log(`[Chat] Notified ${recipientEmail}`);
    } catch (err) {
      console.error("[Chat] Failed:", err.message);
    }
  }
);


// ============================================
// 4. EMAIL BROADCAST
// ============================================

exports.sendEmailBroadcast = onDocumentCreated(
  "email_broadcasts/{id}",
  async (event) => {
    try {
      const data = event.data.data();

      const usersSnap = await db.collection("users").get();
      const emails = usersSnap.docs
        .map((d) => d.data().email)
        .filter(Boolean);

      const html = emailTemplate(data.title, data.message);

      for (const email of emails) {
        await sendEmail(email, data.title, html);
      }

      console.log(`[Broadcast] Sent to ${emails.length}`);
    } catch (err) {
      console.error("[Broadcast] Failed:", err.message);
    }
  }
);


// ============================================
// 5. WELCOME EMAIL
// ============================================

exports.onUserCreated = onDocumentCreated(
  "users/{userId}",
  async (event) => {
    try {
      const user = event.data.data();

      if (!user?.email) return;

      await sendEmail(
        user.email,
        "Welcome to ZiBuy 🎉",
        emailTemplate(
          "Welcome!",
          `<p>Hello ${user.email.split("@")[0]}, welcome to ZiBuy Uganda.</p>`
        )
      );

      console.log(`[Welcome] Sent`);
    } catch (err) {
      console.error("[Welcome] Failed:", err.message);
    }
  }
);


// ============================================
// 6. ABANDONED CART (SCHEDULE)
// ============================================

exports.abandonedCartEmails = onSchedule(
  {
    schedule: "every 24 hours",
  },
  async () => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const snap = await db
      .collection("cart_sessions")
      .where("status", "==", "active")
      .where("updatedAt", "<=", cutoff)
      .get();

    for (const d of snap.docs) {
      const s = d.data();
      if (!s.userEmail) continue;

      const items = (s.items || [])
        .map((i) => `<li>${i.name}</li>`)
        .join("");

      await sendEmail(
        s.userEmail,
        "You left items in your cart 🛒",
        emailTemplate(
          "Complete your order",
          `<ul>${items}</ul>`
        )
      );

      await d.ref.update({ status: "email_sent" });
    }

    console.log(`[Cart] Sent ${snap.size}`);
  }
);


// ============================================
// 7. WEEKLY DEALS
// ============================================

exports.weeklyTopDeals = onSchedule(
  {
    schedule: "every monday 08:00",
    timeZone: "Africa/Kampala",
  },
  async () => {
    const productsSnap = await db
      .collection("products")
      .where("status", "==", "active")
      .orderBy("views", "desc")
      .limit(6)
      .get();

    const usersSnap = await db.collection("users").get();
    const emails = usersSnap.docs.map((d) => d.data().email);

    for (const email of emails) {
      await sendEmail(
        email,
        "Top Deals This Week 🔥",
        emailTemplate("Deals", "Check new deals on ZiBuy")
      );
    }

    console.log(`[Weekly] Sent`);
  }
);


// ============================================
// 8. BOOST EXPIRY
// ============================================

exports.expireBoosts = onSchedule(
  { schedule: "every 24 hours" },
  async () => {
    const now = admin.firestore.Timestamp.now();

    const snap = await db
      .collection("products")
      .where("isPremium", "==", true)
      .where("premiumExpiresAt", "<=", now)
      .get();

    const batch = db.batch();

    snap.docs.forEach((d) =>
      batch.update(d.ref, { isPremium: false })
    );

    await batch.commit();

    console.log(`[Boosts] Expired ${snap.size}`);
  }
);


// ============================================
// 9. SUBSCRIPTION EXPIRY
// ============================================

exports.expireSubscriptions = onSchedule(
  { schedule: "every 24 hours" },
  async () => {
    const now = new Date();

    const snap = await db
      .collection("business_accounts")
      .where("status", "==", "active")
      .get();

    const batch = db.batch();

    snap.docs.forEach((d) => {
      const end = d.data().endDate?.toDate?.();
      if (end && now > end) {
        batch.update(d.ref, { status: "expired" });
      }
    });

    await batch.commit();

    console.log(`[Subs] Expired`);
  }
);


// ============================================
// 10. SMS GOLD SELLERS
// ============================================

exports.smsGoldSellers = onDocumentCreated(
  "orders/{orderId}",
  async (event) => {
    try {
      const order = event.data.data();

      const productSnap = await db
        .collection("products")
        .doc(order.items?.[0]?.productId || "x")
        .get();

      if (!productSnap.exists) return;

      const seller = await getUserData(
        productSnap.data().userId
      );

      if (!seller || seller.plan !== "gold") return;

      console.log(`[SMS] Would send to ${seller.phone}`);
    } catch (err) {
      console.error(err.message);
    }
  }
);


// ============================================
// 11. AI RECOMMENDATIONS
// ============================================

exports.aiRecommendations = onSchedule(
  {
    schedule: "every friday 10:00",
    timeZone: "Africa/Kampala",
  },
  async () => {
    const usersSnap = await db.collection("users").get();

    console.log(`[AI] Running recommendations`);
  }
);