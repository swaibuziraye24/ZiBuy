const functions = require("firebase-functions");
const admin     = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();
const regionalFunctions = functions.region("us-central1");

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
        ${ctaText ? `
          <div style="text-align:center;margin:28px 0 8px">
            <a href="${ctaUrl}" style="background:#ff6600;color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block">
              ${ctaText}
            </a>
          </div>` : ""}
      </div>
      <div style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#6b7280">
        © 2026 ZiBuy Uganda · <a href="https://zibuy-5deae.web.app" style="color:#ff6600">Visit ZiBuy</a>
      </div>
    </div>
  `;
}

async function sendEmail(to, subject, html) {
  await db.collection("mail").add({ to, message: { subject, html } });
}

async function getUserData(userId) {
  const snap = await db.collection("users").doc(userId).get();
  return snap.exists ? snap.data() : null;
}

// ============================================
// 1. PUSH NOTIFICATIONS (paid plans only)
// ============================================
exports.sendPushOnNotification = regionalFunctions.firestore
  .document("notifications/{notifId}")
  .onCreate(async (snap) => {
    try {
      const data     = snap.data();
      if (!data?.userId) return null;

      const userData = await getUserData(data.userId);
      if (!userData) return null;

      const token = userData.fcmToken;
      const plan  = userData.plan || "free";
      if (plan === "free" || !token) return null;

      await admin.messaging().send({
        token,
        notification: { title: data.title || "ZiBuy", body: data.message || "" },
        data: { type: data.type || "", url: data.url || "https://zibuy-5deae.web.app" },
        webpush: {
          notification: {
            icon:  "https://zibuy-5deae.web.app/my_logo.png",
            badge: "https://zibuy-5deae.web.app/my_logo.png"
          },
          fcmOptions: { link: data.url || "https://zibuy-5deae.web.app" }
        }
      });

      console.log(`[Push] Sent to ${data.userId}`);
      return null;
    } catch (err) {
      console.error("[Push] Failed:", err.message);
      return null;
    }
  });

// ============================================
// 2. ORDER NOTIFICATION — email + in-app
// ============================================
exports.onNewOrder = regionalFunctions.firestore
  .document("orders/{orderId}")
  .onCreate(async (snap) => {
    try {
      const order = snap.data();
      const orderId = snap.id;

      // Find seller by product
      const productSnap = await db.collection("products")
        .doc(order.items?.[0]?.productId || "x").get();
      const sellerEmail = productSnap.exists
        ? productSnap.data().userEmail : null;

      const itemList = (order.items || [])
        .map(i => `<li>${i.name} × ${i.qty} — UGX ${Number(i.price * i.qty).toLocaleString()}</li>`)
        .join("");

      // Email to buyer
      if (order.userEmail) {
        await sendEmail(
          order.userEmail,
          `✅ Order Confirmed — ${orderId}`,
          emailTemplate(
            "Your order is confirmed! 🎉",
            `<p>Hi ${order.customerName || "there"},</p>
             <p>Your order <strong>${orderId}</strong> has been placed successfully.</p>
             <ul>${itemList}</ul>
             <p><strong>Total:</strong> UGX ${Number(order.total).toLocaleString()}</p>
             <p><strong>Delivery to:</strong> ${order.customerLocation}</p>
             <p>We'll contact you shortly to arrange delivery.</p>`,
            "Track Your Order",
            `https://zibuy-5deae.web.app/dashboard.html?tab=orders`
          )
        );
      }

      // Email to seller
      if (sellerEmail) {
        await sendEmail(
          sellerEmail,
          `🛍️ New Order Received — ${orderId}`,
          emailTemplate(
            "You have a new order!",
            `<p>A buyer just placed an order for your product(s).</p>
             <ul>${itemList}</ul>
             <p><strong>Buyer:</strong> ${order.customerName}</p>
             <p><strong>Phone:</strong> ${order.customerPhone}</p>
             <p><strong>Location:</strong> ${order.customerLocation}</p>
             <p><strong>Total:</strong> UGX ${Number(order.total).toLocaleString()}</p>`,
            "View in Dashboard",
            `https://zibuy-5deae.web.app/dashboard.html?tab=orders`
          )
        );
      }

      console.log(`[Order] Notified for order ${orderId}`);
      return null;
    } catch (err) {
      console.error("[Order] Failed:", err.message);
      return null;
    }
  });

// ============================================
// 3. CHAT NOTIFICATION — notify recipient
// ============================================
exports.onNewMessage = regionalFunctions.firestore
  .document("messages/{msgId}")
  .onCreate(async (snap) => {
    try {
      const msg = snap.data();
      if (!msg?.participants || !msg.senderEmail) return null;

      const recipientEmail = msg.participants.find(p => p !== msg.senderEmail);
      if (!recipientEmail) return null;

      // Get recipient user doc
      const recipientSnap = await db.collection("users")
        .where("email", "==", recipientEmail).limit(1).get();
      if (recipientSnap.empty) return null;

      const recipient   = recipientSnap.docs[0];
      const recipientId = recipient.id;
      const userData    = recipient.data();

      // Save in-app notification
      await db.collection("notifications").add({
        userId:    recipientId,
        type:      "message",
        title:     `New message from ${msg.senderEmail.split("@")[0]}`,
        message:   msg.text?.slice(0, 80) || "You have a new message",
        relatedId: msg.senderEmail,
        read:      false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Send push if paid plan
      const plan  = userData.plan || "free";
      const token = userData.fcmToken;
      if (plan !== "free" && token) {
        await admin.messaging().send({
          token,
          notification: {
            title: `💬 ${msg.senderEmail.split("@")[0]}`,
            body:  msg.text?.slice(0, 100) || "New message"
          },
          webpush: {
            fcmOptions: {
              link: `https://zibuy-5deae.web.app/messages.html?to=${msg.senderEmail}`
            }
          }
        });
      }

      console.log(`[Chat] Notified ${recipientEmail}`);
      return null;
    } catch (err) {
      console.error("[Chat] Failed:", err.message);
      return null;
    }
  });

// ============================================
// 4. EMAIL BROADCAST (admin sends to all)
// ============================================
exports.sendEmailBroadcast = regionalFunctions.firestore
  .document("email_broadcasts/{broadcastId}")
  .onCreate(async (snap) => {
    try {
      const data = snap.data();
      const usersSnap = await db.collection("users").get();

      const emails = usersSnap.docs
        .map(d => d.data().email)
        .filter(Boolean);

      if (emails.length === 0) return null;

      const html = emailTemplate(
        data.title,
        `<p>${data.message}</p>`,
        "Visit ZiBuy",
        data.url && data.url !== "/"
          ? `https://zibuy-5deae.web.app${data.url}`
          : "https://zibuy-5deae.web.app"
      );

      await Promise.all(
        emails.map(email => sendEmail(email, `ZiBuy: ${data.title}`, html))
      );

      await snap.ref.update({
        status: "sent",
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        sentTo: emails.length
      });

      console.log(`[Broadcast] Sent to ${emails.length} users`);
      return null;
    } catch (err) {
      console.error("[Broadcast] Failed:", err.message);
      await snap.ref.update({ status: "failed", error: err.message });
      return null;
    }
  });

// ============================================
// 5. WELCOME EMAIL after signup
// ============================================
exports.onUserCreated = regionalFunctions.firestore
  .document("users/{userId}")
  .onCreate(async (snap) => {
    try {
      const user = snap.data();
      if (!user?.email) return null;

      await sendEmail(
        user.email,
        "Welcome to ZiBuy Uganda! 🎉",
        emailTemplate(
          `Welcome to ZiBuy, ${user.email.split("@")[0]}! 🇺🇬`,
          `<p>Thank you for joining Uganda's trusted marketplace.</p>
           <p>Here's what you can do:</p>
           <ul>
             <li>📦 <strong>Post your ads</strong> for free</li>
             <li>🛒 <strong>Buy</strong> from verified sellers</li>
             <li>⭐ <strong>Boost your ads</strong> for more visibility</li>
             <li>✅ <strong>Get verified</strong> to build buyer trust</li>
           </ul>
           <p>Start selling today — it's completely free!</p>`,
          "Start Selling Now",
          "https://zibuy-5deae.web.app/post-ad.html"
        )
      );

      console.log(`[Welcome] Sent to ${user.email}`);
      return null;
    } catch (err) {
      console.error("[Welcome] Failed:", err.message);
      return null;
    }
  });

// ============================================
// 6. ABANDONED CART EMAIL (runs daily)
//    Targets users with items in localStorage
//    — we track via "cart_sessions" collection
// ============================================
exports.abandonedCartEmails = regionalFunctions.pubsub
  .schedule("every 24 hours")
  .onRun(async () => {
    try {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const snap = await db.collection("cart_sessions")
        .where("status", "==", "active")
        .where("updatedAt", "<=", cutoff)
        .get();

      if (snap.empty) return null;

      await Promise.all(snap.docs.map(async d => {
        const session = d.data();
        if (!session.userEmail || !session.items?.length) return;

        const itemList = session.items
          .map(i => `<li>${i.name} — UGX ${Number(i.price).toLocaleString()}</li>`)
          .join("");

        await sendEmail(
          session.userEmail,
          "You left something behind on ZiBuy 🛒",
          emailTemplate(
            "Your cart is waiting!",
            `<p>Hi there! You left these items in your ZiBuy cart:</p>
             <ul>${itemList}</ul>
             <p>These items are popular and may sell out. Complete your order now!</p>`,
            "Complete Your Order",
            "https://zibuy-5deae.web.app/payment.html"
          )
        );

        await d.ref.update({ status: "email_sent" });
      }));

      console.log(`[Cart] Sent ${snap.size} abandoned cart emails`);
      return null;
    } catch (err) {
      console.error("[Cart] Failed:", err.message);
      return null;
    }
  });

// ============================================
// 7. WEEKLY TOP DEALS EMAIL (every Monday)
// ============================================
exports.weeklyTopDeals = regionalFunctions.pubsub
  .schedule("every monday 08:00")
  .timeZone("Africa/Kampala")
  .onRun(async () => {
    try {
      // Get top 6 products by views
      const productsSnap = await db.collection("products")
        .where("status", "==", "active")
        .orderBy("views", "desc")
        .limit(6)
        .get();

      if (productsSnap.empty) return null;

      const products = productsSnap.docs.map(d => d.data());

      const productCards = products.map(p => `
        <div style="display:inline-block;width:45%;margin:8px 2%;vertical-align:top;background:#f9fafb;border-radius:8px;padding:12px">
          <img src="${p.images?.[0] || ''}" style="width:100%;height:120px;object-fit:cover;border-radius:6px;margin-bottom:8px">
          <p style="margin:0;font-weight:700;font-size:14px;color:#111827">${p.name}</p>
          <p style="margin:4px 0 0;color:#ff6600;font-weight:800">UGX ${Number(p.price).toLocaleString()}</p>
        </div>
      `).join("");

      // Get all user emails
      const usersSnap = await db.collection("users").get();
      const emails    = usersSnap.docs.map(d => d.data().email).filter(Boolean);

      const html = emailTemplate(
        "🔥 Top Deals This Week on ZiBuy",
        `<p>Here are the hottest deals in Uganda right now:</p>
         <div style="text-align:center">${productCards}</div>
         <p style="margin-top:16px">Don't miss out — these deals won't last!</p>`,
        "Shop All Deals",
        "https://zibuy-5deae.web.app"
      );

      await Promise.all(
        emails.map(email =>
          sendEmail(email, "🔥 Top Deals This Week on ZiBuy Uganda", html)
        )
      );

      console.log(`[Weekly] Sent to ${emails.length} users`);
      return null;
    } catch (err) {
      console.error("[Weekly] Failed:", err.message);
      return null;
    }
  });

// ============================================
// 8. AUTO-EXPIRE BOOSTS (daily)
// ============================================
exports.expireBoosts = regionalFunctions.pubsub
  .schedule("every 24 hours")
  .onRun(async () => {
    try {
      const now  = admin.firestore.Timestamp.now();
      const snap = await db.collection("products")
        .where("isPremium", "==", true)
        .where("premiumExpiresAt", "<=", now)
        .get();

      if (snap.empty) { console.log("[Boosts] Nothing to expire"); return null; }

      const batch = db.batch();
      snap.docs.forEach(d => batch.update(d.ref, { isPremium: false }));
      await batch.commit();

      // Also expire boost_requests
      const boostSnap = await db.collection("boost_requests")
        .where("status", "==", "approved").get();
      const boostBatch = db.batch();
      boostSnap.docs.forEach(d => {
        const exp = d.data().expiresAt?.toDate?.();
        if (exp && new Date() > exp) boostBatch.update(d.ref, { status: "expired" });
      });
      await boostBatch.commit();

      console.log(`[Boosts] Expired ${snap.size}`);
      return null;
    } catch (err) {
      console.error("[Boosts] Failed:", err.message);
      return null;
    }
  });

// ============================================
// 9. AUTO-EXPIRE SUBSCRIPTIONS (daily)
// ============================================
exports.expireSubscriptions = regionalFunctions.pubsub
  .schedule("every 24 hours")
  .onRun(async () => {
    try {
      const now  = new Date();
      const snap = await db.collection("business_accounts")
        .where("status", "==", "active").get();

      if (snap.empty) { console.log("[Subs] Nothing to expire"); return null; }

      const batch     = db.batch();
      const userBatch = db.batch();
      let   count     = 0;

      snap.docs.forEach(d => {
        const end = d.data().endDate?.toDate?.();
        if (end && now > end) {
          batch.update(d.ref, {
            status:    "expired",
            expiredAt: admin.firestore.FieldValue.serverTimestamp()
          });
          const userId = d.data().userId;
          if (userId) {
            userBatch.update(db.collection("users").doc(userId), {
              plan:             "free",
              isSellerVerified: false,
              planExpiredAt:    admin.firestore.FieldValue.serverTimestamp()
            });
          }
          count++;
        }
      });

      await batch.commit();
      await userBatch.commit();

      console.log(`[Subs] Expired ${count}`);
      return null;
    } catch (err) {
      console.error("[Subs] Failed:", err.message);
      return null;
    }
  });

// ============================================
// 10. SMS FOR GOLD SELLERS (via Africa's Talking)
//     Triggers when Gold seller gets a new order
// ============================================
exports.smsGoldSellers = regionalFunctions.firestore
  .document("orders/{orderId}")
  .onCreate(async (snap) => {
    try {
      const order = snap.data();
      if (!order.items?.length) return null;

      const productSnap = await db.collection("products")
        .doc(order.items[0].productId || "x").get();
      if (!productSnap.exists) return null;

      const sellerId   = productSnap.data().userId;
      const sellerData = await getUserData(sellerId);
      if (!sellerData || sellerData.plan !== "gold") return null;

      const phone = sellerData.phone;
      if (!phone) return null;

      // Africa's Talking SMS API
      const AfricasTalking = require("africastalking");
      const at = AfricasTalking({
        apiKey:   functions.config().africastalking?.apikey || "YOUR_AT_API_KEY",
        username: functions.config().africastalking?.username || "sandbox"
      });

      await at.SMS.send({
        to:      [phone.startsWith("+") ? phone : `+${phone}`],
        message: `ZiBuy: New order! ${order.customerName} ordered from you. Total: UGX ${Number(order.total).toLocaleString()}. Check your dashboard.`,
        from:    "ZiBuy"
      });

      console.log(`[SMS] Sent to Gold seller ${phone}`);
      return null;
    } catch (err) {
      console.error("[SMS] Failed:", err.message);
      return null;
    }
  });

// ============================================
// 11. AI PRODUCT RECOMMENDATIONS (weekly)
//     Sends personalised recommendations per user
// ============================================
exports.aiRecommendations = regionalFunctions.pubsub
  .schedule("every friday 10:00")
  .timeZone("Africa/Kampala")
  .onRun(async () => {
    try {
      const usersSnap    = await db.collection("users").get();
      const productsSnap = await db.collection("products")
        .where("status", "==", "active").limit(100).get();

      const allProducts = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      await Promise.all(usersSnap.docs.map(async userDoc => {
        const user = userDoc.data();
        if (!user.email) return;

        // Get user's viewed/ordered categories
        const ordersSnap = await db.collection("orders")
          .where("userEmail", "==", user.email).limit(10).get();

        const likedCategories = {};
        ordersSnap.docs.forEach(d => {
          const items = d.data().items || [];
          items.forEach(i => {
            if (i.category) likedCategories[i.category] = (likedCategories[i.category] || 0) + 1;
          });
        });

        // Score products by category match + views + likes
        const scored = allProducts.map(p => ({
          ...p,
          recScore:
            (likedCategories[p.category] || 0) * 10 +
            (p.views || 0) * 0.1 +
            (p.likes || 0) * 0.5
        })).sort((a, b) => b.recScore - a.recScore).slice(0, 4);

        if (scored.length === 0) return;

        const cards = scored.map(p => `
          <div style="display:inline-block;width:44%;margin:8px 2%;vertical-align:top;background:#f9fafb;border-radius:8px;padding:10px">
            <p style="margin:0;font-weight:700;font-size:13px;color:#111827">${p.name}</p>
            <p style="margin:4px 0 0;color:#ff6600;font-weight:800;font-size:13px">UGX ${Number(p.price).toLocaleString()}</p>
            <a href="https://zibuy-5deae.web.app/product.html?id=${p.id}"
              style="display:inline-block;margin-top:6px;background:#ff6600;color:white;padding:6px 12px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:700">
              View →
            </a>
          </div>
        `).join("");

        await sendEmail(
          user.email,
          "🎯 Picked for you on ZiBuy",
          emailTemplate(
            "We found deals you'll love! 🇺🇬",
            `<p>Hi ${user.email.split("@")[0]}, based on your activity here are some picks for you:</p>
             <div style="text-align:center">${cards}</div>`,
            "See More Deals",
            "https://zibuy-5deae.web.app"
          )
        );
      }));

      console.log(`[AI Recs] Sent to ${usersSnap.size} users`);
      return null;
    } catch (err) {
      console.error("[AI Recs] Failed:", err.message);
      return null;
    }
  });