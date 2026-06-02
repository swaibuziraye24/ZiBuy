const functions = require("firebase-functions");
const admin     = require("firebase-admin");
admin.initializeApp();

// Triggers automatically when a new notification document is created
exports.sendPushOnNotification = functions.firestore
  .document("notifications/{notifId}")
  .onCreate(async (snap) => {
    const data = snap.data();
    if (!data.userId) return;

    // Get user's FCM token
    const userDoc = await admin.firestore()
      .collection("users")
      .doc(data.userId)
      .get();

    const token = userDoc.data()?.fcmToken;
    if (!token) return;

    // Send push
    await admin.messaging().send({
      token,
      notification: {
        title: data.title,
        body:  data.message
      },
      data: {
        type:      data.type      || "",
        relatedId: data.relatedId || ""
      }
    });
  });