import { db, auth, collection, addDoc, getDocs, query, where, orderBy } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let currentUser = null;
let activeConversation = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) loadConversations();
});

async function loadConversations() {
  try {
    const snapshot = await getDocs(query(
      collection(db, "messages"),
      where("participants", "array-contains", currentUser.email),
      orderBy("lastMessageTime", "desc")
    ));

    const convos = {};
    snapshot.forEach((doc) => {
      const msg = doc.data();
      const otherEmail = msg.participants.find(p => p !== currentUser.email);
      if (!convos[otherEmail]) {
        convos[otherEmail] = { lastMessage: msg.text, lastTime: msg.lastMessageTime };
      }
    });

    const container = document.getElementById("conversations-list");
    container.innerHTML = "";

    Object.entries(convos).forEach(([email, data]) => {
      const btn = document.createElement("button");
      btn.className = "conversation-item";
      btn.style.cssText = "border:none;background:#f3f4f6;padding:12px;border-radius:10px;text-align:left;cursor:pointer;font-size:14px;transition:.2s;font-family:inherit;margin-bottom:6px";
      btn.innerHTML = `
        <p style="margin:0;font-weight:700;color:#111827">${email.split("@")[0]}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${data.lastMessage}</p>
      `;
      btn.onclick = () => openConversation(email);
      container.appendChild(btn);
    });
  } catch (err) {
    console.error(err);
  }
}

window.openConversation = async function(email) {
  activeConversation = email;
  document.getElementById("chat-empty").style.display = "none";
  document.getElementById("chat-window").style.display = "flex";
  document.getElementById("chat-with-name").textContent = email.split("@")[0];

  try {
    const snapshot = await getDocs(query(
      collection(db, "messages"),
      where("participants", "array-contains", currentUser.email)
    ));

    const container = document.getElementById("messages-container");
    container.innerHTML = "";

    snapshot.forEach((doc) => {
      const msg = doc.data();
      if (msg.participants.includes(email) && msg.participants.includes(currentUser.email)) {
        const isOwn = msg.senderEmail === currentUser.email;
        const div = document.createElement("div");
        div.style.cssText = `display:flex;${isOwn ? "justify-content:flex-end" : "justify-content:flex-start"}`;
        div.innerHTML = `
          <div style="background:${isOwn ? "#ff6600" : "#e5e7eb"};color:${isOwn ? "white" : "#111827"};padding:10px 14px;border-radius:10px;max-width:60%;word-wrap:break-word;font-size:14px">
            ${msg.text}
            <p style="margin:4px 0 0;font-size:11px;opacity:.7">${new Date(msg.timestamp.toDate()).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</p>
          </div>
        `;
        container.appendChild(div);
      }
    });

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  } catch (err) {
    console.error(err);
  }
};

window.sendMessage = async function() {
  if (!activeConversation || !currentUser) return;

  const input = document.getElementById("message-input");
  const text = input.value.trim();
  if (!text) return;

  try {
    await addDoc(collection(db, "messages"), {
      participants: [currentUser.email, activeConversation],
      senderEmail: currentUser.email,
      text,
      timestamp: new Date(),
      lastMessageTime: new Date()
    });

    input.value = "";
    openConversation(activeConversation);
  } catch (err) {
    console.error(err);
    alert("Failed to send message");
  }
};

window.closeChat = function() {
  activeConversation = null;
  document.getElementById("chat-empty").style.display = "block";
  document.getElementById("chat-window").style.display = "none";
};

export async function startConversation(recipientEmail, productId, productName) {
  if (!currentUser) {
    alert("Login to message");
    return;
  }

  try {
    await addDoc(collection(db, "messages"), {
      participants: [currentUser.email, recipientEmail],
      senderEmail: currentUser.email,
      text: `Hi! I'm interested in: ${productName}`,
      productId,
      timestamp: new Date(),
      lastMessageTime: new Date()
    });

    window.location.href = "messages.html";
  } catch (err) {
    console.error(err);
  }
}