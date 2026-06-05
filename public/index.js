const functions = require("firebase-functions");
const admin     = require("firebase-admin");
admin.initializeApp();

// ============================================
// 1. PUSH NOTIFICATIONS (paid plans only)
// ============================================
exports.sendPushOnNotification = functions.firestore
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
exports.expireBoosts = functions.pubsub
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
exports.expireSubscriptions = functions.pubsub
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