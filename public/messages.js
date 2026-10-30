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

// Chat links may carry a user ID instead of an email. Ask the server for the contact.
async function zbResolveChatTarget(to) {
  if (!to) return "";
  if (to.includes("@")) return to;
  try {
    const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js");
    const r = await httpsCallable(getFunctions(), "getChatContact")({ userId: to });
    return r.data?.email || "";
  } catch (e) {
    console.warn("getChatContact:", e.message);
    return "";
  }
}

// Finds a user's ID from their email using the safe public copy.
async function zbUidByEmail(email) {
  try {
    const s = await getDocs(query(collection(db, "public_profiles"), where("emailHash", "==", await zbEmailHash(email))));
    return s.empty ? "" : s.docs[0].id;
  } catch (e) { return ""; }
}

// SHA-256 of a trimmed, lowercase email. Matches "emailHash" in public_profiles.
async function zbEmailHash(email) {
  const data = new TextEncoder().encode(String(email || "").trim().toLowerCase());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}


// ============================================
// Prevent HTML injection in chat messages
// ============================================
function escapeHTML(text = "") {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let currentUser = null;
let activeConversation = null;

let unsubscribeConversations = null;
let unsubscribeMessages      = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;

  if (!user) {
    if (unsubscribeConversations) {
      unsubscribeConversations();
      unsubscribeConversations = null;
    }

    if (unsubscribeMessages) {
      unsubscribeMessages();
      unsubscribeMessages = null;
    }

    activeConversation = null;
    return;
  }

  loadConversations();

  const to = new URLSearchParams(window.location.search).get("to");

  if (to) {
    setTimeout(() => {
      zbResolveChatTarget(to).then((toEmail) => toEmail ? openConversation(toEmail) : null).then(() => {
        // coming from "Get help with this order": start the message for them
        const qs  = new URLSearchParams(window.location.search);
        const oid = qs.get("oid");
        if (oid) {
          window.__zbOrderCtx = { orderId: oid, orderRef: qs.get("ref") || "" };
          const inp = document.getElementById("message-input");
          if (inp && !inp.value) {
            inp.value = `Hi ZiBuy, I need help with order ${window.__zbOrderCtx.orderRef}. `;
            inp.focus();
          }
        }
      });
    }, 400);
  }
});


async function trackSellerResponse(sellerEmail, buyerEmail, conversationStartTime) {
  try {
    const { getDoc, setDoc, doc: fdoc } = await import("./firebase.js");
    const sellerSnap = await getDocs(query(collection(db, "public_profiles"), where("emailHash", "==", await zbEmailHash(sellerEmail))));
    if (sellerSnap.empty) return;

    const sellerId = sellerSnap.docs[0].id;
    const responseMs = Date.now() - conversationStartTime;

    const statsRef = fdoc(db, "response_stats", sellerId);
    const statsSnap = await getDoc(statsRef);
    const current = statsSnap.exists() ? statsSnap.data() : { totalResponses: 0, totalMs: 0, totalConvos: 0 };

    await setDoc(statsRef, {
      totalResponses: (current.totalResponses || 0) + 1,
      totalMs:        (current.totalMs || 0) + responseMs,
      totalConvos:    current.totalConvos || 0,
      updatedAt:      new Date()
    }, { merge: true });

  } catch (e) { console.warn("trackSellerResponse:", e.message); }
}

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
        <p style="margin:0;font-weight:700;color:#111827">${escapeHTML(email.split("@")[0])}</p>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
          <span style="font-size:11px;color:#9ca3af">${timeText}</span>
          ${data.unread ? `<span style="width:9px;height:9px;background:#ff6600;border-radius:50%"></span>` : ""}
        </div>
      </div>
      <p style="margin:4px 0 0;font-size:12px;color:#6b7280;overflow:hidden;text-overflow:ellipsis;
        white-space:nowrap;font-weight:${data.unread ? "700" : "400"}">${escapeHTML(data.lastMessage)}</p>
    `;
    btn.onclick = () => openConversation(email);
    container.appendChild(btn);
  });
}

// ============================================
// OPEN A CONVERSATION — live message stream
// ============================================
window.openConversation = async function(email) {
  renderQuickReplies();
  if (unsubscribeMessages) { unsubscribeMessages(); unsubscribeMessages = null; }

  activeConversation = email;

  zbChatSafety(email);

  document.getElementById("chat-empty").style.display  = "none";
  document.getElementById("chat-window").style.display = "flex";
  document.getElementById("chat-with-name").textContent = email.split("@")[0];

  if (window.innerWidth <= 768) {
    document.querySelector(".messages-sidebar")?.classList.add("chat-open");
    document.querySelector(".messages-main")?.classList.add("chat-open");
  }

  // Buyer rating badge, if this contact has one
  try {
    const userSnap = await getDocs(query(collection(db, "public_profiles"), where("emailHash", "==", await zbEmailHash(email))));
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


// ══════════════════════════════════════════════
//  CHAT SAFETY
// ══════════════════════════════════════════════
const ZB_SUPPORT_EMAIL = "swaibuziraye22@gmail.com";

// Returns "code" (sharing a code or password), "payment" (money outside ZiBuy), or null
function zbMessageRisk(text) {
  const t = String(text || "").toLowerCase();
  if (!t) return null;

  // sharing a code or password
  if (/^\s*\d{4}\s*$/.test(t) || /^\s*\d{6}\s*$/.test(t)) return "code";
  if (/(delivery|verification|confirmation|security|otp|pin|code)[^\d]{0,25}\d{4,6}\b/.test(t)) return "code";
  if (/(my|the)\s+password\s*(is|:)/.test(t)) return "code";

  // asking for or offering money outside ZiBuy
  const money   = /(send|sent|pay|paid|deposit|transfer|wire)\s+(me\s+|us\s+)?(the\s+|some\s+|your\s+|a\s+)?(money|cash|deposit|advance|fee|fees|payment|balance)/;
  const channel = /(mtn|airtel|momo|mobile money|western union|paypal|bitcoin|crypto|usdt|bank (account|details)|account number)/;
  const phone   = /(\+?256|0)7\d{8}/;
  const advance = /(pay|send)\s+(first|before|in advance|upfront)|advance (payment|fee)|booking fee|transport (fee|money)|registration fee|processing fee|release fee/;
  const outside = /(outside|off)\s+(of\s+)?(the\s+)?(zibuy|app|platform)/;

  if (advance.test(t)) return "payment";
  if (outside.test(t)) return "payment";
  if (money.test(t) && (channel.test(t) || phone.test(t))) return "payment";
  if (channel.test(t) && phone.test(t)) return "payment";
  return null;
}

// "Are you sure?" window shown before a risky message is sent
function zbRiskConfirm(risk) {
  return new Promise(resolve => {
    const copy = risk === "code"
      ? { title: "🔐 Don't share codes or passwords",
          body:  "Your delivery code, verification codes and password are private. ZiBuy staff will never ask for them in chat, and a seller should only get your delivery code from you in person, when you are holding your item. Do you really want to send this?" }
      : { title: "⚠️ Keep payments on ZiBuy",
          body:  "This message mentions sending money outside ZiBuy. Orders paid through Buy Now or Add to Cart are protected: ZiBuy holds your payment until the item is delivered. Payments sent outside ZiBuy are not protected and are a common scam. Send anyway?" };

    const m = document.createElement("div");
    m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px";
    m.innerHTML = `
      <div style="background:white;border-radius:16px;padding:22px;max-width:380px;width:100%">
        <h3 style="margin:0 0 8px;font-size:17px">${copy.title}</h3>
        <p style="margin:0 0 16px;font-size:13.5px;color:#374151;line-height:1.6">${copy.body}</p>
        <button id="zb-risk-no" style="width:100%;background:#ff6600;color:white;border:none;padding:12px;border-radius:10px;font-weight:800;cursor:pointer;margin-bottom:8px">Don't send</button>
        <button id="zb-risk-yes" style="width:100%;background:#f3f4f6;color:#6b7280;border:none;padding:11px;border-radius:10px;font-weight:700;cursor:pointer">Send anyway</button>
      </div>`;
    document.body.appendChild(m);
    m.querySelector("#zb-risk-no").onclick  = () => { m.remove(); resolve(false); };
    m.querySelector("#zb-risk-yes").onclick = () => { m.remove(); resolve(true); };
  });
}

// Safety banner at the top of every chat (hidden in chats with ZiBuy support)
function zbChatSafety(otherEmail) {
  const box = document.getElementById("messages-container");
  if (!box) return;

  let b = document.getElementById("zb-chat-safety");
  if (!b) {
    b = document.createElement("div");
    b.id = "zb-chat-safety";
    b.style.cssText = "background:#fffbeb;border-bottom:1px solid #fde68a;color:#92400e;font-size:12px;line-height:1.5;padding:8px 12px;display:flex;gap:8px;align-items:flex-start";
    b.innerHTML = `<span>🛡️</span><span style="flex:1"><strong>Stay safe:</strong> pay only through ZiBuy (Buy Now or Add to Cart). Never send money in advance, and never share your delivery code, password or email codes in chat. <a href="safety.html" target="_blank" style="color:#b45309;font-weight:700">Learn more</a></span>`;
    box.insertAdjacentElement("beforebegin", b);
  }
  b.style.display = (otherEmail === ZB_SUPPORT_EMAIL) ? "none" : "flex";
}

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
        ${msg.orderRef ? `<div style="font-size:11px;font-weight:800;margin-bottom:6px;padding:3px 8px;border-radius:8px;background:${isOwn ? "rgba(255,255,255,.25)" : "#fff"};display:inline-block">📦 Order ${escapeHTML(msg.orderRef)}${(currentUser.email === "swaibuziraye22@gmail.com" && msg.orderId) ? ` · <a href="admin.html?openOrder=${encodeURIComponent(msg.orderId)}" target="_blank" style="color:inherit;text-decoration:underline">Open order</a>` : ""}</div><br>` : ""}${escapeHTML(msg.text)}
        ${(!isOwn && zbMessageRisk(msg.text)) ? `<div style="margin-top:8px;padding:6px 8px;border-radius:8px;background:#fef2f2;color:#991b1b;font-size:11.5px;font-weight:700;line-height:1.4">⚠️ ${zbMessageRisk(msg.text) === "code" ? "Never share your delivery code, password or email codes." : "This message may ask for payment outside ZiBuy. Don't send money outside ZiBuy."}</div>` : ""}
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

  // Warn before sending something that looks risky (never in chats with ZiBuy support)
  const zbRisk = zbMessageRisk(text);
  if (zbRisk && activeConversation !== ZB_SUPPORT_EMAIL) {
    const sendIt = await zbRiskConfirm(zbRisk);
    if (!sendIt) return;
  }

  // If this is the FIRST reply from the seller in this thread, record
  // how long it took — this is what powers the response-time badge
  if (!window._firstReplyTracked?.[activeConversation]) {
    const q = query(
      collection(db, "messages"),
      where("participants", "array-contains", currentUser.email)
    );
    const snap = await getDocs(q);
    let earliestBuyerMsg = null;
    let sellerAlreadyReplied = false;

    snap.forEach(d => {
      const m = d.data();
      if (!m.participants.includes(activeConversation)) return;
      if (m.senderEmail === activeConversation) {
        const t = m.timestamp?.toDate?.() || new Date(m.timestamp);
        if (!earliestBuyerMsg || t < earliestBuyerMsg) earliestBuyerMsg = t;
      } else if (m.senderEmail === currentUser.email) {
        sellerAlreadyReplied = true;
      }
    });

    if (earliestBuyerMsg && !sellerAlreadyReplied) {
      trackSellerResponse(currentUser.email, activeConversation, earliestBuyerMsg.getTime());
    }

    window._firstReplyTracked = window._firstReplyTracked || {};
    window._firstReplyTracked[activeConversation] = true;
  }

  input.value = "";
  input.focus();

  try {
    await addDoc(collection(db, "messages"), {
      participants:    [currentUser.email, activeConversation],
      participantUids: [currentUser.uid, await zbUidByEmail(activeConversation)],
      senderUid:       currentUser.uid,
      senderEmail:     currentUser.email,
      text,
      read:            false,
      timestamp: serverTimestamp(),
      lastMessageTime: serverTimestamp(),
      ...((window.__zbOrderCtx && activeConversation === "swaibuziraye22@gmail.com")
        ? { orderId: window.__zbOrderCtx.orderId, orderRef: window.__zbOrderCtx.orderRef }
        : {})
    });

    // Notify recipient — in-app + push, no manual UI refresh needed here;
    // the onSnapshot listener already open on this conversation renders
    // the new message instantly for both sides
    const recipientSnap = await getDocs(query(
      collection(db, "public_profiles"),
      where("emailHash", "==", await zbEmailHash(activeConversation))
    ));

    if (!recipientSnap.empty) {
      const recipientId = recipientSnap.docs[0].id;
      notifyNewMessage(currentUser.uid, recipientId, currentUser.email);

      const container = document.getElementById("messages-container");

setTimeout(() => {
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}, 100);
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
    // Track total conversations started so response RATE can be calculated,
    // not just response speed
    const { getDoc, setDoc, doc: fdoc } = await import("./firebase.js");
    const sellerSnap = await getDocs(query(collection(db, "public_profiles"), where("emailHash", "==", await zbEmailHash(recipientEmail))));
    if (!sellerSnap.empty) {
      const sellerId  = sellerSnap.docs[0].id;
      const statsRef  = fdoc(db, "response_stats", sellerId);
      const statsSnap = await getDoc(statsRef);
      const current   = statsSnap.exists() ? statsSnap.data() : { totalResponses: 0, totalMs: 0, totalConvos: 0 };
      await setDoc(statsRef, { totalConvos: (current.totalConvos || 0) + 1 }, { merge: true });
    }

    await addDoc(collection(db, "messages"), {
      participants:    [currentUser.email, recipientEmail],
      participantUids: [currentUser.uid, await zbUidByEmail(recipientEmail)],
      senderUid:       currentUser.uid,
      senderEmail:     currentUser.email,
      text:            `Hi! I'm interested in: ${productName}`,
      productId,
      read:            false,
      timestamp: serverTimestamp(),
      lastMessageTime: serverTimestamp(),
      ...((window.__zbOrderCtx && activeConversation === "swaibuziraye22@gmail.com")
        ? { orderId: window.__zbOrderCtx.orderId, orderRef: window.__zbOrderCtx.orderRef }
        : {})
    });

    window.location.href =
`messages.html?to=${encodeURIComponent(recipientEmail)}`;
  } catch (err) {
    console.error(err);
    alert("Failed to start conversation. Try again.");
  }
}

// ============================================
// QUICK REPLY TEMPLATES
// ============================================

const QUICK_REPLIES = [
  "✅ Yes, still available",
  "💰 Price is negotiable",
  "❌ Sorry, already sold",
  "📦 Can deliver within 1-2 days",
  "📍 Can meet in person to view it"
];

function renderQuickReplies() {
  const row = document.getElementById("quick-reply-row");
  if (!row) return;

  row.innerHTML = QUICK_REPLIES.map(text => `
    <button onclick="fillQuickReply('${text.replace(/'/g,"\\'")}')"
      style="flex-shrink:0;padding:7px 12px;border-radius:20px;font-size:12px;font-weight:700;
      background:#f3f4f6;color:#374151;border:none;cursor:pointer;white-space:nowrap;font-family:inherit">
      ${text}
    </button>
  `).join("");
}

window.fillQuickReply = function(text) {
  const input = document.getElementById("message-input");
  if (!input) return;
  input.value = text;
  input.focus();
};