import {
  db, auth, collection, addDoc, getDocs,
  doc, query, where, updateDoc
} from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { notifyNewMessage } from "./notifications.js";

let currentUser      = null;
let activeConversation = null;
let chatUnsubscribe  = null;  // holds live chat listener
let convoUnsubscribe = null;  // holds conversations listener

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    listenConversations();
    // Open conversation from URL param e.g. messages.html?to=email
    const to = new URLSearchParams(location.search).get("to");
    if (to) setTimeout(() => openConversation(to), 800);
  } else {
    window.location.href = "index.html";
  }
});


// ── Real-time conversations list ──────────────
function listenConversations() {
  if (convoUnsubscribe) convoUnsubscribe();

  const q = query(
    collection(db, "messages"),
    where("participants", "array-contains", currentUser.email)
  );

  convoUnsubscribe = onSnapshot(q, (snapshot) => {
    const convos = {};

    snapshot.forEach((d) => {
      const msg = d.data();
      const otherEmail = msg.participants.find(p => p !== currentUser.email);
      if (!otherEmail) return;

      const existing = convos[otherEmail];
      const ts = msg.lastMessageTime?.toDate?.()?.getTime() || 0;

      if (!existing || ts > existing.ts) {
        convos[otherEmail] = {
          lastMessage: msg.text,
          ts,
          unread: !msg.read && msg.senderEmail !== currentUser.email
        };
      }
    });

    renderConversations(convos);
  }, (err) => console.error("Conversations listener:", err));
}

function renderConversations(convos) {
  const container = document.getElementById("conversations-list");
  if (!container) return;

  const sorted = Object.entries(convos)
    .sort((a, b) => b[1].ts - a[1].ts);

  if (sorted.length === 0) {
    container.innerHTML = `<p style="color:#6b7280;font-size:13px;text-align:center;padding:20px">No conversations yet</p>`;
    return;
  }

  container.innerHTML = "";
  sorted.forEach(([email, data]) => {
    const btn = document.createElement("button");
    btn.style.cssText = `
      width:100%;border:none;background:${data.unread ? "#fff4ee" : "#f3f4f6"};
      padding:12px;border-radius:10px;text-align:left;cursor:pointer;
      font-size:14px;transition:.2s;font-family:inherit;margin-bottom:6px;
      border-left:3px solid ${data.unread ? "#ff6600" : "transparent"};
    `;
    btn.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <p style="margin:0;font-weight:${data.unread ? "800" : "700"};color:#111827">
          ${email.split("@")[0]}
        </p>
        ${data.unread ? '<span style="width:8px;height:8px;border-radius:50%;background:#ff6600;display:inline-block"></span>' : ""}
      </div>
      <p style="margin:4px 0 0;font-size:12px;color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
        ${data.lastMessage || ""}
      </p>
    `;
    btn.onclick = () => openConversation(email);

    if (email === activeConversation) btn.style.background = "#ff6600";
    container.appendChild(btn);
  });
}

// ── Real-time chat window ─────────────────────
window.openConversation = function(email) {
  activeConversation = email;

  document.getElementById("chat-empty").style.display  = "none";
  document.getElementById("chat-window").style.display = "flex";
  document.getElementById("chat-with-name").textContent = email.split("@")[0];

  if (chatUnsubscribe) chatUnsubscribe();

  const q = query(
    collection(db, "messages"),
    where("participants", "array-contains", currentUser.email)
  );

  chatUnsubscribe = onSnapshot(q, (snapshot) => {
    const container = document.getElementById("messages-container");
    if (!container) return;

    const msgs = [];
    snapshot.forEach((d) => {
      const msg = d.data();
      if (
        msg.participants.includes(email) &&
        msg.participants.includes(currentUser.email)
      ) {
        msgs.push({ id: d.id, ...msg });
      }
    });

    // Sort by timestamp client-side (no index needed)
    msgs.sort((a, b) => {
      const at = a.timestamp?.toDate?.()?.getTime() || 0;
      const bt = b.timestamp?.toDate?.()?.getTime() || 0;
      return at - bt;
    });

    container.innerHTML = "";
    msgs.forEach((msg) => {
      const isOwn = msg.senderEmail === currentUser.email;
      const div   = document.createElement("div");
      div.style.cssText = `display:flex;${isOwn ? "justify-content:flex-end" : "justify-content:flex-start"}`;

      const ts = msg.timestamp?.toDate?.()
        ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })
        : "";

      div.innerHTML = `
        <div style="
          background:${isOwn ? "#ff6600" : "#e5e7eb"};
          color:${isOwn ? "white" : "#111827"};
          padding:10px 14px;border-radius:${isOwn ? "14px 14px 0 14px" : "14px 14px 14px 0"};
          max-width:65%;word-wrap:break-word;font-size:14px;
          box-shadow:0 1px 4px rgba(0,0,0,0.08)
        ">
          ${msg.text}
          <p style="margin:4px 0 0;font-size:10px;opacity:.6;text-align:right">${ts}</p>
        </div>
      `;
      container.appendChild(div);
    });

    container.scrollTop = container.scrollHeight;
  }, (err) => console.error("Chat listener:", err));
};

// ── Send message ──────────────────────────────
window.sendMessage = async function() {
  if (!activeConversation || !currentUser) return;

  const input = document.getElementById("message-input");
  const text  = input.value.trim();
  if (!text) return;

  input.value    = "";
  input.disabled = true;

  try {
    await addDoc(collection(db, "messages"), {
      participants:    [currentUser.email, activeConversation],
      senderEmail:     currentUser.email,
      text,
      read:            false,
      timestamp:       new Date(),
      lastMessageTime: new Date()
    });

    // Notify recipient
    const recipientSnap = await getDocs(query(
      collection(db, "users"),
      where("email", "==", activeConversation)
    ));
    if (!recipientSnap.empty) {
      notifyNewMessage(currentUser.uid, recipientSnap.docs[0].id, currentUser.email);
    }
  } catch (err) {
    console.error(err);
    alert("Failed to send message");
  } finally {
    input.disabled = false;
    input.focus();
  }
};

window.closeChat = function() {
  if (chatUnsubscribe) { chatUnsubscribe(); chatUnsubscribe = null; }
  activeConversation = null;
  document.getElementById("chat-empty").style.display  = "block";
  document.getElementById("chat-window").style.display = "none";
};

// ── startConversation (called from product page) ──
export async function startConversation(recipientEmail, productId, productName) {
  if (!currentUser) { alert("Login to message"); return; }
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
    window.location.href = `messages.html?to=${recipientEmail}`;
  } catch (err) { console.error(err); }
}

// ──────────────────────────────────────────────
//   MOBILE: Toggle conversations & back button
// ──────────────────────────────────────────────

window.closeChatMobile = function() {
  const sidebar = document.querySelector(".messages-sidebar");
  if (sidebar) sidebar.classList.remove("active");
};

// Wrap openConversation to show sidebar toggle on mobile
const originalOpenConversation = window.openConversation;
window.openConversation = function(email) {
  originalOpenConversation(email);

  if (window.innerWidth <= 768) {
    document.querySelector(".messages-sidebar")?.classList.add("chat-open");
    document.querySelector(".messages-main")?.classList.add("chat-open");
  }
};

const originalCloseChat = window.closeChat;
window.closeChat = function() {
  originalCloseChat();

  if (window.innerWidth <= 768) {
    document.querySelector(".messages-sidebar")?.classList.remove("chat-open");
    document.querySelector(".messages-main")?.classList.remove("chat-open");
  }
};