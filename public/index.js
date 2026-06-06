const functions = require("firebase-functions");
const admin     = require("firebase-admin");
const nodemailer = require("nodemailer");


admin.initializeApp();

// Set region to match your Firestore (nam5 = us-central1 multi-region)
const regionalFunctions = functions.region("us-central1");


const gmailEmail =
  process.env.GMAIL_EMAIL;

const gmailPassword =
  process.env.GMAIL_PASSWORD;

const transporter =
  nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailEmail,
      pass: gmailPassword
    }
  });
// ============================================
// 1. PUSH NOTIFICATIONS (paid plans only)
// ============================================
exports.sendPushOnNotification = regionalFunctions.firestore
  .document("notifications/{notifId}")
  .onCreate(async (snap) => {
    try {
      const data = snap.data();
      if (!data?.userId) return null;

      const userDoc = await admin.firestore()
        .collection("users")
        .doc(data.userId)
        .get();

      if (!userDoc.exists) return null;

      const userData = userDoc.data();
      const token    = userData?.fcmToken;
      const plan     = userData?.plan || "free";

      // Free users get in-app notifications only — no push
      if (plan === "free") return null;
      if (!token) return null;

      await admin.messaging().send({
        token,
        notification: {
          title: data.title   || "ZiBuy",
          body:  data.message || "You have a new notification"
        },
        data: {
          type:      data.type      || "",
          relatedId: data.relatedId || "",
          url:       data.url       || "https://zibuy-5deae.web.app"
        },
        webpush: {
          notification: {
            icon:  "https://zibuy-5deae.web.app/my_logo.png",
            badge: "https://zibuy-5deae.web.app/my_logo.png"
          },
          fcmOptions: {
            link: data.url || "https://zibuy-5deae.web.app"
          }
        }
      });

      console.log(`[FCM] Push sent to user ${data.userId} (plan: ${plan})`);
      return null;

    } catch (err) {
      console.error("[FCM] Push failed:", err.message);
      return null;
    }
  });

// ============================================
// 2. AUTO-EXPIRE BOOSTS (runs every 24 hours)
// ============================================
exports.expireBoosts = regionalFunctions.pubsub
  .schedule("every 24 hours")
  .onRun(async () => {
    try {
      const now  = admin.firestore.Timestamp.now();
      const snap = await admin.firestore()
        .collection("products")
        .where("isPremium", "==", true)
        .where("premiumExpiresAt", "<=", now)
        .get();

      if (snap.empty) {
        console.log("[Boosts] Nothing to expire");
        return null;
      }

      const batch = admin.firestore().batch();
      snap.docs.forEach(d => {
        batch.update(d.ref, { isPremium: false });
      });
      await batch.commit();

      // Also update boost_requests to expired
      const boostSnap = await admin.firestore()
        .collection("boost_requests")
        .where("status", "==", "approved")
        .get();

      const boostBatch = admin.firestore().batch();
      boostSnap.docs.forEach(d => {
        const expiresAt = d.data().expiresAt?.toDate?.();
        if (expiresAt && new Date() > expiresAt) {
          boostBatch.update(d.ref, { status: "expired" });
        }
      });
      await boostBatch.commit();

      console.log(`[Boosts] Expired ${snap.size} boosted ads`);
      return null;

    } catch (err) {
      console.error("[Boosts] Expiry failed:", err.message);
      return null;
    }
  });

// ============================================
// 3. AUTO-EXPIRE SUBSCRIPTIONS (every 24 hours)
// ============================================
exports.expireSubscriptions = regionalFunctions.pubsub
  .schedule("every 24 hours")
  .onRun(async () => {
    try {
      const now  = new Date();
      const snap = await admin.firestore()
        .collection("business_accounts")
        .where("status", "==", "active")
        .get();

      if (snap.empty) {
        console.log("[Subs] Nothing to expire");
        return null;
      }

      const batch     = admin.firestore().batch();
      const userBatch = admin.firestore().batch();
      let   count     = 0;

      snap.docs.forEach(d => {
        const end = d.data().endDate?.toDate?.();
        if (end && now > end) {
          // Expire subscription
          batch.update(d.ref, {
            status:    "expired",
            expiredAt: admin.firestore.FieldValue.serverTimestamp()
          });

          // Downgrade user to free
          const userId = d.data().userId;
          if (userId) {
            const userRef = admin.firestore().collection("users").doc(userId);
            userBatch.update(userRef, {
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

      console.log(`[Subs] Expired ${count} subscriptions`);
      return null;

    } catch (err) {
      console.error("[Subs] Expiry failed:", err.message);
      return null;
    }
  });


  // ============================================
// 4. EMAIL BROADCAST (via Gmail/SendGrid)
// ============================================
exports.sendEmailBroadcast =
  regionalFunctions
    .runWith({
      secrets: [
        "GMAIL_EMAIL",
        "GMAIL_PASSWORD"
      ]
    })
    .firestore
  .document("email_broadcasts/{broadcastId}")
  .onCreate(async (snap) => {
    try {
      const data = snap.data();
      if (!data) return null;

      // Get all users with emails
      const usersSnap = await admin.firestore()
        .collection("users").get();

      const emails = usersSnap.docs
        .map(d => d.data().email)
        .filter(Boolean);

      if (emails.length === 0) return null;

      const emailPromises =
  emails.map(email =>
    transporter.sendMail({
      from: gmailEmail,
      to: email,
      subject: `ZiBuy: ${data.title}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#ff6600;padding:20px;text-align:center">
            <h1 style="color:white;margin:0">
              ZiBuy Uganda
            </h1>
          </div>

          <div style="padding:24px">

            <h2>${data.title}</h2>

            <p>
              ${data.message}
            </p>

            <a
              href="https://zibuy-5deae.web.app"
              style="
                display:inline-block;
                background:#ff6600;
                color:white;
                padding:12px 20px;
                text-decoration:none;
                border-radius:8px;
                font-weight:bold;
              ">
              Visit ZiBuy
            </a>

          </div>
        </div>
      `
    })
  );

await Promise.all(emailPromises);

      // Mark broadcast as sent
      await snap.ref.update({
        status:  "sent",
        sentAt:  admin.firestore.FieldValue.serverTimestamp(),
        sentTo:  emails.length
      });

      console.log(`[Email] Broadcast sent to ${emails.length} users`);
      return null;

    } catch (err) {
      console.error("[Email] Broadcast failed:", err.message);
      await snap.ref.update({ status: "failed", error: err.message });
      return null;
    }
  });