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

async function sendEmailNotification() {
  // Push notifications are now handled automatically by
  // the Firebase Cloud Function "sendPushOnNotification"
  // which triggers on every new document in the notifications collection.
  // No client-side action needed here.
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