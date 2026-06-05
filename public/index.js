const functions = require("firebase-functions");
const admin     = require("firebase-admin");
admin.initializeApp();

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

      const token = userDoc.data()?.fcmToken;
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
            link: "https://zibuy-5deae.web.app"
          }
        }
      });

      console.log(`[FCM] Push sent to user ${data.userId}`);
      return null;

    } catch (err) {
      console.error("[FCM] Push failed:", err.message);
      return null;
    }
  });


  // functions/index.js — add this export
exports.expireBoosts = functions.pubsub
  .schedule("every 24 hours")
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now();
    const snap = await admin.firestore()
      .collection("products")
      .where("isPremium", "==", true)
      .where("premiumExpiresAt", "<=", now)
      .get();

    const batch = admin.firestore().batch();
    snap.docs.forEach(d => {
      batch.update(d.ref, { isPremium: false });
    });
    await batch.commit();
    console.log(`Expired ${snap.size} boosts`);
  });


  // functions/index.js — add this export
exports.expireSubscriptions = functions.pubsub
  .schedule("every 24 hours")
  .onRun(async () => {
    const now = new Date();
    const snap = await admin.firestore()
      .collection("business_accounts")
      .where("status", "==", "active")
      .get();

    const batch = admin.firestore().batch();
    snap.docs.forEach(d => {
      const end = d.data().endDate?.toDate?.();
      if (end && now > end) {
        batch.update(d.ref, { status: "expired" });
      }
    });
    await batch.commit();
  });


  exports.sendPushOnNotification = functions.firestore
  .document("notifications/{notifId}")
  .onCreate(async (snap) => {
    const data = snap.data();

    // Only send push to paid plan users
    const userDoc = await admin.firestore()
      .collection("users").doc(data.userId).get();
    const plan = userDoc.data()?.plan || "free";

    if (plan === "free") return null; // Free users get in-app only

    // ... rest of push logic
  });