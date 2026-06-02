import { db, auth, collection, addDoc, getDocs, query, where, updateDoc, doc } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let currentUser = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
});

export async function createNotification(type, userId, title, message, relatedId = null) {
  try {
    await addDoc(collection(db, "notifications"), {
      userId,
      type, // "message", "order", "review", "ad_view", "payment"
      title,
      message,
      relatedId,
      read: false,
      createdAt: new Date()
    });

    // Trigger email/SMS (integrate with service)
    await sendEmailNotification(userId, title, message, type);
  } catch (err) {
    console.error("Notification creation failed:", err);
  }
}

export async function getUnreadNotifications(userId) {
  try {
    const snapshot = await getDocs(query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      where("read", "==", false)
    ));

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error(err);
    return [];
  }
}

export async function markNotificationRead(notificationId) {
  try {
    await updateDoc(doc(db, "notifications", notificationId), { read: true });
  } catch (err) {
    console.error(err);
  }
}

export async function getUserNotifications(userId, limit = 20) {
  try {
    const snapshot = await getDocs(query(
      collection(db, "notifications"),
      where("userId", "==", userId)
    ));

    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate())
      .slice(0, limit);
  } catch (err) {
    console.error(err);
    return [];
  }
}

async function sendEmailNotification(userId, title, message, type) {
  // ── Email/SMS delivery is handled via FCM push to the user's device ──
  // When the user has granted notification permission and has an FCM token,
  // the notification is delivered via Firebase Cloud Messaging.
  // To add email/SMS later: integrate SendGrid or Twilio in a
  // Firebase Cloud Function triggered on new "notifications" collection writes.

  try {
    // Look up the user's FCM token and send a push via FCM if available
    const { getDocs, query, where, collection } = await import(
      "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
    );
    const { db } = await import("./firebase.js");

    const userSnap = await getDocs(
      query(collection(db, "users"), where("__name__", "==", userId))
    );

    if (userSnap.empty) return;

    const userData = userSnap.docs[0].data();
    const fcmToken = userData.fcmToken;

    if (!fcmToken) return; // User hasn't granted notification permission

    // Deliver push via Firebase Cloud Messaging REST API
    // NOTE: In production move this call to a Cloud Function so your
    // server key is never exposed in client-side code.
    // For now this uses the client-side approach which works for testing.
    await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": "key=YOUR_FCM_SERVER_KEY" // replace in Cloud Function
      },
      body: JSON.stringify({
        to: fcmToken,
        notification: { title, body: message },
        data: { type, userId }
      })
    });

  } catch (err) {
    // Non-critical — in-app notification already saved to Firestore
    // The user will see it when they open the notifications page
    console.info("[Notifications] Push delivery skipped:", err.message);
  }
}

// Trigger notifications on key actions
export async function notifyNewMessage(senderId, recipientId, senderEmail) {
  await createNotification(
    "message",
    recipientId,
    `New message from ${senderEmail.split("@")[0]}`,
    "You have a new message. Check your inbox.",
    senderId
  );
}

export async function notifyOrderPlaced(userId, orderId, total) {
  await createNotification(
    "order",
    userId,
    `Order ${orderId} Confirmed ✅`,
    `Order placed for UGX ${total.toLocaleString()}. Total cost including delivery.`,
    orderId
  );
}

export async function notifyNewReview(sellerId, rating) {
  await createNotification(
    "review",
    sellerId,
    `New ${rating}⭐ Review`,
    "Someone left a review on your product!",
    null
  );
}

export async function notifyAdActivity(userId, adId, views) {
  await createNotification(
    "ad_view",
    userId,
    `${views} views on your ad!`,
    "Your ad is getting attention. Check performance.",
    adId
  );
}