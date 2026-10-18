import { db, auth, doc, getDoc, collection, getDocs, query, where } from "./firebase.js";
import {
  onAuthStateChanged, EmailAuthProvider, GoogleAuthProvider,
  reauthenticateWithCredential, reauthenticateWithPopup
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const id = new URLSearchParams(location.search).get("order");
const el = document.getElementById("note");

let currentUser = null;
let order = null;
let sigs  = {};

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

// Same key-sorted form the server uses, so signatures can be re-checked here
function canon(v) {
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if (v && typeof v === "object") {
    return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
  }
  return JSON.stringify(v === undefined ? null : v);
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

const fmt = (ms) => new Date(ms).toLocaleString("en-UG", {
  timeZone: "Africa/Kampala", day: "numeric", month: "short", year: "numeric",
  hour: "2-digit", minute: "2-digit"
});

// What the note says before anyone has signed (the signed copy is stored by the server)
function previewSnapshot(o) {
  const items = (Array.isArray(o.items) && o.items.length)
    ? o.items.map(i => ({ name: i.name, qty: i.qty || 1, price: i.price || 0 }))
    : [{ name: o.productName, qty: o.quantity || 1, price: o.unitPrice || o.price || 0 }];
  const received = (o.trackingEvents || []).filter(e => e.status === "received").map(e => e.at).pop() || 0;
  return {
    orderRef: o.orderRef || "", items, total: o.total || 0,
    buyerName: o.customerName || "", buyerPhone: o.customerPhone || "", buyerEmail: o.userEmail || "",
    sellerName: o.sellerName || "", sellerPhone: o.sellerPhone || "",
    deliveryLocation: o.customerLocation || "",
    deliveredAtMs: received,
    deliveryMethod: o.deliveryProof?.method || "buyer_confirmation",
    photoSha256: o.deliveryProof?.photoSha256 || ""
  };
}

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "index.html"; return; }
  currentUser = user;
  if (!id) { el.textContent = "No order specified."; return; }
  await load();
});

async function load() {
  try {
    const snap = await getDoc(doc(db, "orders", id));
    if (!snap.exists()) { el.textContent = "Order not found."; return; }
    order = snap.data();

    const myRole = myRoleIn(order);
    const base = [collection(db, "order_signatures"), where("orderId", "==", id)];
    let q;
    if (myRole === "buyer")       q = query(...base, where("buyerUid", "==", currentUser.uid));
    else if (myRole === "seller") q = query(...base, where("sellerId", "==", currentUser.uid));
    else                          q = query(...base);   // admins

    const res = await getDocs(q);
    sigs = {};
    res.docs.forEach(d => { sigs[d.data().role] = d.data(); });

    await render(myRole);
  } catch (e) {
    console.error(e);
    el.textContent = "You don't have access to this note, or it couldn't be loaded.";
  }
}

function myRoleIn(o) {
  if ((o.buyerUid && o.buyerUid === currentUser.uid) || (o.userEmail && o.userEmail === currentUser.email)) return "buyer";
  if ((o.sellerId && o.sellerId === currentUser.uid) || (o.sellerEmail && o.sellerEmail === currentUser.email)) return "seller";
  return null;
}

async function render(myRole) {
  const s = (sigs.buyer || sigs.seller)?.snapshot || previewSnapshot(order);
  const received = order.trackingStatus === "received";

  // re-check each signature against the document it signed
  const verified = {};
  for (const r of ["buyer", "seller"]) {
    if (sigs[r]) verified[r] = (await sha256Hex(canon(sigs[r].snapshot))) === sigs[r].documentHash;
  }
  const bothSame = sigs.buyer && sigs.seller && sigs.buyer.documentHash === sigs.seller.documentHash;

  const when = s.deliveredAtMs ? fmt(s.deliveredAtMs) : "—";
  const methodText = s.deliveryMethod === "pin"
    ? "Delivery code verified by the seller" + (s.photoSha256 ? ", with a handover photo" : "")
    : "Receipt confirmed by the buyer";

  const items = s.items.map(i =>
    `<tr><td>${esc(i.name)}</td><td>${i.qty}</td><td>UGX ${Number(i.price).toLocaleString()}</td></tr>`).join("");

  const providerId = currentUser.providerData.find(p => p.providerId === "password" || p.providerId === "google.com")?.providerId
                  || currentUser.providerData[0]?.providerId;

  const sigBlock = (role, label, statement) => {
    const sig = sigs[role];
    if (sig) {
      return `<div class="sig done">
        <div style="font-weight:800;color:#166534;margin-bottom:4px">✅ ${label} signed</div>
        <div style="font-size:13px">Signed electronically by <strong>${esc(sig.name)}</strong> on ${esc(fmt(sig.atMs))} (Kampala time)</div>
        <div class="small" style="margin-top:6px">Signed with account ${sig.provider === "google.com" ? "Google login" : "password"} ·
          Document fingerprint: ${esc(sig.documentHash)} ${verified[role] ? "· ✔ matches" : "· ⚠ does not match"}</div>
      </div>`;
    }
    if (myRole === role && received) {
      return `<div class="sig">
        <div style="font-weight:800;margin-bottom:6px">✍️ ${label} signature</div>
        <p class="stmt" style="margin:0 0 8px">${statement}</p>
        <div style="font-size:13px">You are signing as <strong>${esc(currentUser.displayName || currentUser.email)}</strong>
          <span class="small">(${esc(currentUser.email)})</span></div>
        ${providerId === "password"
          ? `<input type="password" id="sign-pass" placeholder="Enter your account password to sign" autocomplete="current-password">`
          : `<p class="small" style="margin:8px 0">You will be asked to confirm with your Google account.</p>`}
        <label style="display:flex;gap:8px;align-items:flex-start;font-size:12.5px;line-height:1.5;margin:8px 0 12px">
          <input type="checkbox" id="sign-agree" style="margin-top:3px">
          <span>I have read this note and I agree it is correct. I understand that confirming my account
          ${providerId === "password" ? "password" : "login"} is my electronic signature and is legally binding.</span>
        </label>
        <button onclick="signNow()">✍️ Sign this note</button>
      </div>`;
    }
    return `<div class="sig"><div style="font-weight:800">⏳ ${label} has not signed yet</div>
      ${!received && myRole === role ? `<div class="small" style="margin-top:4px">You can sign once the order has been received.</div>` : ""}</div>`;
  };

  el.innerHTML = `
    <h1>Handover &amp; Receipt Note</h1>
    <div class="small" style="word-break:normal">Order ${esc(s.orderRef)} · issued by ZiBuy</div>

    <h2>Items handed over</h2>
    <table><tr><th>Item</th><th>Qty</th><th>Price each</th></tr>${items}</table>
    <p style="font-size:13px;margin:10px 0 0"><strong>Total paid: UGX ${Number(s.total).toLocaleString()}</strong></p>

    <h2>Parties and delivery</h2>
    <table>
      <tr><th>Buyer</th><td>${esc(s.buyerName)} · ${esc(s.buyerPhone)}<br>${esc(s.buyerEmail)}</td></tr>
      <tr><th>Seller</th><td>${esc(s.sellerName)} · ${esc(s.sellerPhone)}</td></tr>
      <tr><th>Delivery location</th><td>${esc(s.deliveryLocation)}</td></tr>
      <tr><th>Delivered on</th><td>${esc(when)}</td></tr>
      <tr><th>How it was proven</th><td>${esc(methodText)}</td></tr>
    </table>

    <h2>Buyer's confirmation</h2>
    ${sigBlock("buyer", "Buyer",
      `I, <strong>${esc(s.buyerName)}</strong>, confirm that I received the items listed above from <strong>${esc(s.sellerName)}</strong> on ${esc(when)}, at the delivery location shown.`)}

    <h2>Seller's confirmation</h2>
    ${sigBlock("seller", "Seller",
      `I, <strong>${esc(s.sellerName)}</strong>, confirm that I handed over the items listed above to <strong>${esc(s.buyerName)}</strong> on ${esc(when)}, at the delivery location shown.`)}

    ${bothSame ? `<div class="ok">✅ Both signatures cover the identical document.</div>` : ""}
    <p class="small" style="word-break:normal;margin-top:16px">
      This is an electronic document created by ZiBuy. Each signature is made by confirming the signer's own account login
      and is recorded permanently with the time. Signed copies cannot be edited or deleted by buyers or sellers.
    </p>`;
}

window.signNow = async function () {
  const btn = document.querySelector(".sig button");
  if (!document.getElementById("sign-agree")?.checked) { alert("Please tick the box to confirm you agree."); return; }

  const user = auth.currentUser;
  const providerId = user.providerData.find(p => p.providerId === "password" || p.providerId === "google.com")?.providerId
                  || user.providerData[0]?.providerId;

  btn.disabled = true;
  btn.textContent = "Signing...";

  try {
    // 1) the person proves it is really them, right now
    if (providerId === "password") {
      const password = document.getElementById("sign-pass")?.value || "";
      if (!password) throw { code: "app/no-password" };
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    } else if (providerId === "google.com") {
      await reauthenticateWithPopup(user, new GoogleAuthProvider());
    } else {
      throw { code: "app/unsupported" };
    }
    await user.getIdToken(true);

    // 2) the server records the signature
    const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js");
    await httpsCallable(getFunctions(), "signHandoverNote")({ orderId: id });

    await load();
  } catch (e) {
    console.error(e);
    const code = e.code || "";
    let msg = e.message || "Couldn't sign. Please try again.";
    if (code === "app/no-password")                                   msg = "Please enter your account password.";
    else if (code === "app/unsupported")                              msg = "Please log in again with your email and password, or with Google, to sign.";
    else if (code === "auth/wrong-password" || code === "auth/invalid-credential") msg = "Wrong password. Please try again.";
    else if (code === "auth/too-many-requests")                       msg = "Too many attempts. Please wait a few minutes and try again.";
    else if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") msg = "Sign-in was cancelled.";
    alert(msg);
    btn.disabled = false;
    btn.textContent = "✍️ Sign this note";
  }
};