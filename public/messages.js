// ============================================
//   ZiBuy — Real-Time Messaging
// ============================================

import {
  db, auth, collection, addDoc, getDocs, query, where, orderBy,
  doc, updateDoc, serverTimestamp
} from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { notifyNewMessage } from "./notifications.js";

let currentUser = null;
let activeConversation = null;

let unsubscribeConversations = null;
let unsubscribeMessages      = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;

  // Logged out — detach live listeners so they don't fire against a null user
  if (!user) {
    if (unsubscribeConversations) { unsubscribeConversations(); unsubscribeConversations = null; }
    if (unsubscribeMessages)      { unsubscribeMessages();      unsubscribeMessages      = null; }
    return;
  }

  loadConversations();
});

// ============================================
// CONVERSATIONS LIST — live, reorders and
// updates instantly as new messages arrive
// ============================================
function loadConversations() {
  if (unsubscribeConversations) unsubscribeConversations();

  const q = query(
    collection(db, "messages"),
    where("participants", "array-contains", currentUser.email),
    orderBy("lastMessageTime", "desc")
  );

  unsubscribeConversations = onSnapshot(q, (snapshot) => {
    const convos = {};

    snapshot.forEach((docSnap) => {
      const msg = docSnap.data();
      const otherEmail = msg.participants.find(p => p !== currentUser.email);
      if (!otherEmail) return;

      // Docs arrive sorted newest-first, so the first one seen per
      // contact is automatically that conversation's latest message
      if (!convos[otherEmail]) {
        convos[otherEmail] = {
          lastMessage: msg.text || "",
          lastTime:    msg.lastMessageTime,
          unread:      msg.senderEmail !== currentUser.email && msg.read !== true
        };
      }
    });

    renderConversationsList(convos);
  }, (err) => {
    console.error("loadConversations:", err);
  });
}

function getRelativeTime(date) {
  if (!date) return "";
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60)    return "now";
  if (seconds < 3600)  return Math.floor(seconds / 60) + "m";
  if (seconds < 86400) return Math.floor(seconds / 3600) + "h";
  if (seconds < 604800) return Math.floor(seconds / 86400) + "d";
  return date.toLocaleDateString();
}

function renderConversationsList(convos) {
  const container = document.getElementById("conversations-list");
  if (!container) return;

  const entries = Object.entries(convos);

  if (entries.length === 0) {
    container.innerHTML = `<p style="text-align:center;color:#9ca3af;font-size:13px;padding:20px">No conversations yet</p>`;
    return;
  }

  container.innerHTML = "";

  entries.forEach(([email, data]) => {
    const timeText = data.lastTime?.toDate ? getRelativeTime(data.lastTime.toDate()) : "";

    const btn = document.createElement("button");
    btn.className = "conversation-item";
    btn.style.cssText = `
      border:none;background:${email === activeConversation ? "#fff4ee" : "#f3f4f6"};
      padding:12px;border-radius:10px;text-align:left;cursor:pointer;font-size:14px;
      transition:.2s;font-family:inherit;margin-bottom:6px;width:100%`;

    btn.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <p style="margin:0;font-weight:700;color:#111827">${email.split("@")[0]}</p>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
          <span style="font-size:11px;color:#9ca3af">${timeText}</span>
          ${data.unread ? `<span style="width:9px;height:9px;background:#ff6600;border-radius:50%"></span>` : ""}
        </div>
      </div>
      <p style="margin:4px 0 0;font-size:12px;color:#6b7280;overflow:hidden;text-overflow:ellipsis;
        white-space:nowrap;font-weight:${data.unread ? "700" : "400"}">${data.lastMessage}</p>
    `;
    btn.onclick = () => openConversation(email);
    container.appendChild(btn);
  });
}

// ============================================
// OPEN A CONVERSATION — live message stream
// ============================================
window.openConversation = async function(email) {
  if (unsubscribeMessages) { unsubscribeMessages(); unsubscribeMessages = null; }

  activeConversation = email;

  document.getElementById("chat-empty").style.display  = "none";
  document.getElementById("chat-window").style.display = "flex";
  document.getElementById("chat-with-name").textContent = email.split("@")[0];

  if (window.innerWidth <= 768) {
    document.querySelector(".messages-sidebar")?.classList.add("chat-open");
    document.querySelector(".messages-main")?.classList.add("chat-open");
  }

  // Buyer rating badge, if this contact has one
  try {
    const userSnap = await getDocs(query(collection(db, "users"), where("email", "==", email)));
    const badgeEl = document.getElementById("chat-buyer-rating");
    if (badgeEl) {
      if (!userSnap.empty && userSnap.docs[0].data().buyerRating) {
        const uData = userSnap.docs[0].data();
        badgeEl.textContent   = `⭐ ${uData.buyerRating} Buyer Rating (${uData.buyerRatingCount || 0})`;
        badgeEl.style.display = "inline-block";
      } else {
        badgeEl.style.display = "none";
      }
    }
  } catch (e) {}

  const container = document.getElementById("messages-container");
  container.innerHTML = `<p style="text-align:center;color:#9ca3af;padding:20px;font-size:13px">Loading messages...</p>`;

  const q = query(
    collection(db, "messages"),
    where("participants", "array-contains", currentUser.email)
  );

  unsubscribeMessages = onSnapshot(q, (snapshot) => {
    const thread = [];

    snapshot.forEach((docSnap) => {
      const msg = docSnap.data();
      if (msg.participants.includes(email) && msg.participants.includes(currentUser.email)) {
        thread.push({ id: docSnap.id, ...msg });
      }
    });

    thread.sort((a, b) => {
      const at = a.timestamp?.toDate?.() ? a.timestamp.toDate() : new Date(a.timestamp || 0);
      const bt = b.timestamp?.toDate?.() ? b.timestamp.toDate() : new Date(b.timestamp || 0);
      return at - bt;
    });

    renderMessages(thread, container);
    markIncomingMessagesRead(thread, email);
    // Note: no need to manually refresh the conversations list here —
    // the listener from loadConversations() automatically re-fires the
    // instant any matching message doc changes, including read:true writes

  }, (err) => {
    console.error("openConversation listener:", err);
    container.innerHTML = `<p style="text-align:center;color:#ef4444;padding:20px;font-size:13px">Failed to load messages</p>`;
  });
};

function renderMessages(thread, container) {
  const wasNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 80;

  container.innerHTML = "";

  thread.forEach((msg) => {
    const isOwn = msg.senderEmail === currentUser.email;
    const time  = msg.timestamp?.toDate
      ? msg.timestamp.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";

    const ticks = isOwn
      ? (msg.read ? `<span style="color:#3b82f6">✓✓</span>` : `<span style="opacity:.6">✓</span>`)
      : "";

    const div = document.createElement("div");
    div.style.cssText = `display:flex;${isOwn ? "justify-content:flex-end" : "justify-content:flex-start"}`;
    div.innerHTML = `
      <div style="background:${isOwn ? "#ff6600" : "#e5e7eb"};color:${isOwn ? "white" : "#111827"};
        padding:10px 14px;border-radius:10px;max-width:70%;word-wrap:break-word;font-size:14px">
        ${msg.text}
        <p style="margin:4px 0 0;font-size:11px;opacity:.75;display:flex;gap:6px;align-items:center;justify-content:flex-end">
          ${time} ${ticks}
        </p>
      </div>
    `;
    container.appendChild(div);
  });

  // Only auto-scroll if the user was already near the bottom — never
  // yank them down while they're reading older messages
  if (wasNearBottom) {
    container.scrollTop = container.scrollHeight;
  }
}

async function markIncomingMessagesRead(thread, otherEmail) {
  const unread = thread.filter(m => m.senderEmail === otherEmail && m.read !== true);
  if (unread.length === 0) return;

  try {
    await Promise.all(unread.map(m =>
      updateDoc(doc(db, "messages", m.id), { read: true, readAt: serverTimestamp() })
    ));
  } catch (e) {
    // Read receipts failing silently should never break the chat itself
    console.warn("markIncomingMessagesRead:", e.message);
  }
}

// ============================================
// SEND MESSAGE
// ============================================
window.sendMessage = async function() {
  if (!activeConversation || !currentUser) return;

  const input = document.getElementById("message-input");
  const text  = input.value.trim();
  if (!text) return;

  input.value = "";
  input.focus();

  try {
    await addDoc(collection(db, "messages"), {
      participants:    [currentUser.email, activeConversation],
      senderEmail:     currentUser.email,
      text,
      read:            false,
      timestamp:       new Date(),
      lastMessageTime: new Date()
    });

    // Notify recipient — in-app + push, no manual UI refresh needed here;
    // the onSnapshot listener already open on this conversation renders
    // the new message instantly for both sides
    const recipientSnap = await getDocs(query(
      collection(db, "users"),
      where("email", "==", activeConversation)
    ));

    if (!recipientSnap.empty) {
      const recipientId = recipientSnap.docs[0].id;
      notifyNewMessage(currentUser.uid, recipientId, currentUser.email);
    }

  } catch (err) {
    console.error(err);
    input.value = text; // restore so the user doesn't lose what they typed
    alert("Failed to send message. Check your connection and try again.");
  }
};

// ============================================
// CLOSE CHAT
// ============================================
window.closeChat = function() {
  if (unsubscribeMessages) { unsubscribeMessages(); unsubscribeMessages = null; }

  activeConversation = null;
  document.getElementById("chat-empty").style.display  = "block";
  document.getElementById("chat-window").style.display = "none";

  if (window.innerWidth <= 768) {
    document.querySelector(".messages-sidebar")?.classList.remove("chat-open");
    document.querySelector(".messages-main")?.classList.remove("chat-open");
  }
};

// ============================================
// START A NEW CONVERSATION (from product pages)
// ============================================
export async function startConversation(recipientEmail, productId, productName) {
  if (!currentUser) {
    alert("Login to message the seller");
    return;
  }

  try {
    await addDoc(collection(db, "messages"), {
      participants:    [currentUser.email, recipientEmail],
      senderEmail:     currentUser.email,
      text:            `Hi! I'm interested in: ${productName}`,
      productId,
      read:            false,
      timestamp:       new Date(),
      lastMessageTime: new Date()
    });

    window.location.href = "messages.html";
  } catch (err) {
    console.error(err);
    alert("Failed to start conversation. Try again.");
  }
}