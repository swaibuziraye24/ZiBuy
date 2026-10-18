import { db, auth, collection, query, where, doc, updateDoc } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const STEPS = [
  { key: "placed",           label: "Order placed" },
  { key: "payment_verified", label: "Payment confirmed" },
  { key: "packed",           label: "Packed" },
  { key: "on_the_way",       label: "On the way" },
  { key: "arrived",          label: "Arrived at delivery location" },
  { key: "received",         label: "Received by buyer" }
];

// What the seller is allowed to do next from each step
const NEXT = {
  payment_verified: { to: "packed",     label: "📦 Mark as Packed" },
  packed:           { to: "on_the_way", label: "🚚 Mark as On the Way" },
  on_the_way:       { to: "arrived",    label: "📍 I've Arrived at the Delivery Location" }
};

const BADGES = {
  placed:           { bg: "#fef3c7", color: "#92400e", label: "⏳ Waiting for payment check" },
  payment_verified: { bg: "#dbeafe", color: "#1e40af", label: "💰 Paid: start packing" },
  packed:           { bg: "#e0e7ff", color: "#3730a3", label: "📦 Packed" },
  on_the_way:       { bg: "#ede9fe", color: "#5b21b6", label: "🚚 On the way" },
  arrived:          { bg: "#ffedd5", color: "#9a3412", label: "📍 Arrived" },
  received:         { bg: "#dcfce7", color: "#166534", label: "✅ Received" }
};

let orders = [];
const listEl = document.getElementById("seller-orders-list");

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function ts(x) {
  return x?.toDate?.().getTime() || new Date(x || 0).getTime() || 0;
}

function timelineHTML(o) {
  const idx = STEPS.findIndex(s => s.key === o.trackingStatus);
  const events = {};
  (o.trackingEvents || []).forEach(e => { events[e.status] = e.at; });

  return `<div style="margin:12px 0;padding:12px 14px;background:#f9fafb;border-radius:12px">` +
    STEPS.map((s, i) => {
      const done = i <= idx;
      const t = events[s.key]
        ? new Date(events[s.key]).toLocaleString("en-UG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
        : "";
      return `<div style="display:flex;gap:10px;align-items:flex-start;padding-bottom:${i === STEPS.length - 1 ? 0 : 10}px">
        <span style="width:18px;height:18px;border-radius:50%;flex-shrink:0;margin-top:1px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;background:${done ? "#10b981" : "#e5e7eb"};color:${done ? "white" : "#9ca3af"}">${done ? "✓" : ""}</span>
        <div>
          <div style="font-size:13px;font-weight:${done ? 800 : 600};color:${done ? "#111827" : "#9ca3af"}">${s.label}</div>
          ${t ? `<div style="font-size:11px;color:#6b7280">${t}</div>` : ""}
        </div>
      </div>`;
    }).join("") + `</div>`;
}


let payouts = {};   // by order id

function payoutBox(o) {
  const p = payouts[o.id];
  if (!p) {
    return `<p style="margin:10px 0 0;font-size:12.5px;color:#6b7280;background:#f9fafb;padding:10px;border-radius:10px">
      💸 ZiBuy will send your payment soon. You'll be asked to confirm once it arrives.</p>`;
  }
  if (p.status === "acknowledged") {
    return `<div style="margin-top:10px;background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;padding:12px;font-size:13px;color:#166534">
      ✅ <strong>You confirmed receiving UGX ${Number(p.amount).toLocaleString()}</strong><br>
      <span style="font-size:11.5px">${new Date(p.acknowledgement?.atMs || 0).toLocaleString("en-UG")} · signed as ${esc(p.acknowledgement?.nameTyped)}</span>
    </div>`;
  }
  return `<div style="margin-top:10px;background:#fffbeb;border:1.5px solid #fcd34d;border-radius:12px;padding:12px">
    <p style="margin:0 0 4px;font-weight:800;font-size:14px;color:#92400e">💸 Payment sent: UGX ${Number(p.amount).toLocaleString()}</p>
    <p style="margin:0 0 10px;font-size:12px;color:#92400e;line-height:1.5">
      Sent via ${esc(String(p.method).toUpperCase())} · transaction ${esc(p.txnId)}. Check your phone, then confirm below.</p>
    <button onclick="zbOpenSign('${p.id}')"
      style="width:100%;background:#f59e0b;color:white;border:none;padding:11px;border-radius:10px;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit">
      ✍️ Confirm I received it &amp; sign</button>
  </div>`;
}

window.zbOpenSign = function (payoutId) {
  const p = Object.values(payouts).find(x => x.id === payoutId);
  if (!p) return;

  document.getElementById("sign-modal")?.remove();
  const m = document.createElement("div");
  m.id = "sign-modal";
  m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px";

  const field = "width:100%;padding:11px;border:1.5px solid #d1d5db;border-radius:10px;font-size:15px;margin-bottom:10px;box-sizing:border-box;font-family:inherit";
  const amount = Number(p.amount).toLocaleString();
  const ref = esc(p.orderRef || "");

  m.innerHTML = `
    <div style="background:white;border-radius:16px;padding:22px;max-width:420px;width:100%;max-height:90vh;overflow:auto">
      <h3 style="margin:0 0 6px">✍️ Confirm your payment</h3>
      <p style="margin:0 0 14px;font-size:13px;color:#374151;line-height:1.5">
        You are confirming that you received <strong>UGX ${amount}</strong> from ZiBuy for order <strong>${ref}</strong>.</p>

      <div id="sign-step1">
        <button onclick="zbSendCode('${payoutId}', this)"
          style="width:100%;background:#ff6600;color:white;border:none;padding:12px;border-radius:10px;font-weight:800;cursor:pointer;font-family:inherit">
          📧 Email me a confirmation code</button>
      </div>

      <div id="sign-step2" style="display:none">
        <p id="sign-sent-to" style="margin:0 0 10px;font-size:12.5px;color:#166534"></p>
        <input id="sign-code" inputmode="numeric" maxlength="6" placeholder="6-digit code" style="${field};letter-spacing:4px;text-align:center;font-weight:800">
        <input id="sign-name" type="text" placeholder="Type your full name to sign" style="${field}">
        <label style="display:flex;gap:8px;align-items:flex-start;font-size:12px;color:#374151;line-height:1.5;margin-bottom:12px">
          <input type="checkbox" id="sign-agree" style="margin-top:3px">
          <span>I confirm that I have received UGX ${amount} from ZiBuy as payment for order ${ref}.
          I understand that typing my name here is my electronic signature and is legally binding.</span>
        </label>
        <button onclick="zbSubmitSign('${payoutId}', this)"
          style="width:100%;background:#10b981;color:white;border:none;padding:12px;border-radius:10px;font-weight:800;cursor:pointer;font-family:inherit">
          Sign &amp; confirm</button>
      </div>

      <button onclick="this.closest('#sign-modal').remove()"
        style="width:100%;margin-top:10px;background:#e5e7eb;border:none;padding:11px;border-radius:10px;font-weight:700;cursor:pointer;font-family:inherit">Cancel</button>
    </div>`;
  document.body.appendChild(m);
};

window.zbSendCode = async function (payoutId, btn) {
  btn.disabled = true;
  btn.textContent = "Sending...";
  try {
    const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js");
    const res = await httpsCallable(getFunctions(), "requestPayoutCode")({ payoutId });
    document.getElementById("sign-step1").style.display = "none";
    document.getElementById("sign-step2").style.display = "block";
    document.getElementById("sign-sent-to").textContent = "✅ Code sent to " + res.data.sentTo + ". It expires in 10 minutes.";
  } catch (e) {
    alert(e.message || "Couldn't send the code.");
    btn.disabled = false;
    btn.textContent = "📧 Email me a confirmation code";
  }
};

window.zbSubmitSign = async function (payoutId, btn) {
  const code     = (document.getElementById("sign-code")?.value || "").trim();
  const fullName = (document.getElementById("sign-name")?.value || "").trim();
  const agree    = !!document.getElementById("sign-agree")?.checked;

  btn.disabled = true;
  btn.textContent = "Signing...";
  try {
    const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js");
    await httpsCallable(getFunctions(), "acknowledgePayout")({ payoutId, code, fullName, agree });
    document.getElementById("sign-modal")?.remove();
  } catch (e) {
    alert(e.message || "Couldn't complete the signature.");
    btn.disabled = false;
    btn.textContent = "Sign & confirm";
  }
};

// Shrinks a phone photo so it uploads quickly, even on a weak connection
async function shrinkImage(file, maxSide = 1280, quality = 0.7) {
  const bmp   = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width  = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise(res => c.toBlob(res, "image/jpeg", quality));
}

async function sha256Blob(blob) {
  const buf = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function pinBox(o) {
  return `
    <div style="margin-top:10px;padding:12px;border:1.5px dashed #6ee7b7;border-radius:12px;background:#f0fdf4">
      <p style="margin:0 0 6px;font-size:13px;font-weight:800;color:#166534">🔐 Handover proof</p>
      <p style="margin:0 0 10px;font-size:12px;color:#15803d;line-height:1.5">
        When you hand over the item: <strong>1)</strong> take a photo of the handover,
        <strong>2)</strong> ask the buyer for their 4-digit delivery code and enter it.
        Your location is saved with it (allow location when your phone asks).
      </p>
      <label style="display:block;margin-bottom:8px">
        <span style="display:block;font-size:12px;font-weight:800;color:#166534;margin-bottom:4px">📸 Photo of the handover (required)</span>
        <input id="photo-${o.id}" type="file" accept="image/*" capture="environment"
          style="width:100%;font-size:13px;font-family:inherit">
      </label>
      <div style="display:flex;gap:8px">
        <input id="pin-${o.id}" inputmode="numeric" maxlength="4" placeholder="0000"
          style="width:100px;padding:10px;border:1.5px solid #d1d5db;border-radius:10px;font-size:18px;letter-spacing:4px;text-align:center;font-weight:800">
        <button onclick="zbVerifyPin('${o.id}', this)"
          style="flex:1;background:#10b981;color:white;border:none;padding:10px;border-radius:10px;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit">
          Confirm handover
        </button>
      </div>
    </div>`;
}

function __oldPinBox(o) {
  return `
    <div style="margin-top:10px;padding:12px;border:1.5px dashed #6ee7b7;border-radius:12px;background:#f0fdf4">
      <p style="margin:0 0 6px;font-size:13px;font-weight:800;color:#166534">🔐 Handover code</p>
      <p style="margin:0 0 8px;font-size:12px;color:#15803d;line-height:1.5">
        When you hand over the item, ask the buyer for their 4-digit delivery code and enter it here.
        This completes the delivery and records proof that the buyer received it.
      </p>
      <div style="display:flex;gap:8px">
        <input id="pin-${o.id}" inputmode="numeric" maxlength="4" placeholder="0000"
          style="width:100px;padding:10px;border:1.5px solid #d1d5db;border-radius:10px;font-size:18px;letter-spacing:4px;text-align:center;font-weight:800">
        <button onclick="zbVerifyPin('${o.id}', this)"
          style="flex:1;background:#10b981;color:white;border:none;padding:10px;border-radius:10px;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit">
          Confirm handover
        </button>
      </div>
    </div>`;
}

window.zbVerifyPin = async function (orderId, btn) {
  const code = (document.getElementById("pin-" + orderId)?.value || "").trim();
  const file = document.getElementById("photo-" + orderId)?.files?.[0];

  if (!/^\d{4}$/.test(code)) { alert("Enter the 4-digit code from the buyer."); return; }
  if (!file)                 { alert("Please take a photo of the handover first."); return; }

  btn.disabled = true;
  btn.textContent = "Getting location...";

  // location is best-effort: if the seller refuses, the handover still goes through
  const location = await new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, atMs: Date.now() }),
      ()  => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });

  try {
    btn.textContent = "Uploading photo...";
    const blob = await shrinkImage(file);
    const sha  = await sha256Blob(blob);

    const { storage } = await import("./firebase.js");
    const { ref, uploadBytes } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js");
    const path = `handover-photos/${auth.currentUser.uid}/${orderId}-${Date.now()}.jpg`;
    await uploadBytes(ref(storage, path), blob, { contentType: "image/jpeg" });

    btn.textContent = "Checking code...";
    const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js");
    await httpsCallable(getFunctions(), "verifyDeliveryCode")({
      orderId, code, evidence: { photoPath: path, photoSha256: sha, location }
    });
    // the page updates by itself through the live listener
  } catch (e) {
    console.error(e);
    alert(e.message || "Couldn't complete the handover. Please try again.");
    btn.disabled = false;
    btn.textContent = "Confirm handover";
  }
};

window.__oldZbVerifyPin = async function (orderId, btn) {
  const code = (document.getElementById("pin-" + orderId)?.value || "").trim();
  if (!/^\d{4}$/.test(code)) { alert("Enter the 4-digit code from the buyer."); return; }

  btn.disabled = true;
  btn.textContent = "Checking...";
  try {
    const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js");
    await httpsCallable(getFunctions(), "verifyDeliveryCode")({ orderId, code });
    // the page updates by itself through the live listener
  } catch (e) {
    alert(e.message || "Couldn't verify the code. Please try again.");
    btn.disabled = false;
    btn.textContent = "Confirm handover";
  }
};

function render() {
  if (orders.length === 0) {
    listEl.innerHTML = `<p style="text-align:center;color:#6b7280;padding:40px">📦 No orders to deliver yet</p>`;
    return;
  }

  listEl.innerHTML = orders.map(o => {
    const status    = o.trackingStatus || "placed";
    const badge     = BADGES[status] || BADGES.placed;
    const cancelled = o.status === "cancelled_by_buyer" || o.refunded === true;
    const disputed  = o.disputeStatus === "open";
    const next      = NEXT[status];
    const phone     = (o.customerPhone || "").replace(/\D/g, "");
    const fee       = Number(o.deliveryFee || 0);

    let action = "";
    if (cancelled) {
      action = `<p style="margin:0;font-size:13px;color:#6b7280">${o.refunded ? "🚫 This order was refunded to the buyer. Do not deliver it." : "🚫 This order was cancelled by the buyer."}</p>`;
    } else if (disputed) {
      action = `<p style="margin:0;font-size:13px;color:#991b1b;background:#fee2e2;padding:10px;border-radius:8px">🚨 The buyer reported a problem. ZiBuy support will contact you.</p>`;
    } else if (next) {
      action = `<button onclick="zbSellerStep('${o.id}', this)"
        style="width:100%;background:#ff6600;color:white;border:none;padding:13px;border-radius:12px;font-weight:800;font-size:14px;cursor:pointer;font-family:inherit">
        ${next.label}</button>`;
    } else if (status === "placed") {
      action = `<p style="margin:0;font-size:13px;color:#92400e;background:#fffbeb;padding:10px;border-radius:8px">⏳ Waiting for ZiBuy to confirm the buyer's payment. Don't ship yet.</p>`;
    } else if (status === "arrived") {
      action = `<p style="margin:0;font-size:13px;color:#9a3412;background:#fff7ed;padding:10px;border-radius:8px">Waiting for the buyer to confirm they received the item.</p>`;
    } else if (status === "received") {
      action = `<p style="margin:0;font-size:13px;color:#166534;background:#f0fdf4;padding:10px;border-radius:8px">✅ Delivered and confirmed by the buyer. ZiBuy will release your payment.</p>`;
    }

    return `
      <div style="border:1px solid #e5e7eb;border-radius:16px;padding:16px;margin-bottom:14px;background:white">
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start">
          <div>
            <p style="margin:0;font-weight:800;font-size:15px">${esc(o.productName || "Order")}</p>
            ${Array.isArray(o.items) && o.items.length > 1 ? `<div style="margin-top:4px;font-size:12px;color:#6b7280">${o.items.map(i => `${esc(i.name)} × ${i.qty}`).join("<br>")}</div>` : ""}
            <p style="margin:2px 0 0;font-size:12px;color:#6b7280">${esc(o.orderRef || o.orderId || o.id.slice(0, 8))}</p>
          </div>
          <span style="background:${badge.bg};color:${badge.color};padding:4px 10px;border-radius:20px;font-size:11px;font-weight:800;white-space:nowrap">${badge.label}</span>
        </div>

        <div style="margin:12px 0;font-size:13px;line-height:1.7;color:#374151">
          <div><strong>Deliver to:</strong> ${esc(o.customerName)}</div>
          <div><strong>Location:</strong> ${esc(o.customerLocation)}</div>
          <div><strong>Phone:</strong> ${esc(o.customerPhone)}
            ${phone ? ` · <a href="tel:+${phone}" style="color:#ff6600;font-weight:700">Call</a> · <a href="https://wa.me/${phone}" target="_blank" style="color:#16a34a;font-weight:700">WhatsApp</a>` : ""}
          </div>
          <div><strong>Item price:</strong> UGX ${Number(o.price || 0).toLocaleString()}${fee ? ` · <strong>Delivery fee:</strong> UGX ${fee.toLocaleString()}` : (o.deliveryMode === "free" ? " · Free delivery" : "")}</div>
        </div>

        ${timelineHTML(o)}
        ${action}
        ${(status === "on_the_way" || status === "arrived") && !cancelled && !disputed ? pinBox(o) : ""}
        ${status === "received" ? payoutBox(o) : ""}
        ${status === "received" ? `<a href="handover-note.html?order=${o.id}" target="_blank" style="display:block;margin-top:10px;text-align:center;background:${o.noteSigned?.seller ? "#f0fdf4" : "#ff6600"};color:${o.noteSigned?.seller ? "#166534" : "white"};padding:11px;border-radius:10px;font-weight:800;font-size:13px;text-decoration:none">${o.noteSigned?.seller ? "✅ Handover note signed · view" : "✍️ Review & sign handover note"}</a>` : ""}
        ${status === "received" ? `<a href="certificate.html?order=${o.id}" target="_blank" style="display:block;margin-top:10px;text-align:center;background:#f3f4f6;color:#374151;padding:10px;border-radius:10px;font-weight:700;font-size:13px;text-decoration:none">📄 Delivery certificate</a>` : ""}
      </div>`;
  }).join("");
}

window.zbSellerStep = async function (orderId, btn) {
  const o    = orders.find(x => x.id === orderId);
  const next = o && NEXT[o.trackingStatus];
  if (!next) return;

  if (next.to === "arrived" && !confirm("Confirm you have reached the buyer's delivery location?")) return;

  if (btn) { btn.disabled = true; btn.textContent = "Updating..."; }

  try {
    await updateDoc(doc(db, "orders", orderId), {
      trackingStatus: next.to,
      trackingEvents: [...(o.trackingEvents || []), { status: next.to, at: Date.now(), by: "seller" }],
      updatedAt:      new Date()
    });
  } catch (err) {
    console.error(err);
    alert("Couldn't update this order: " + err.message);
    render();
  }
};

onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.href = "index.html"; return; }

  
  onSnapshot(
    query(collection(db, "payouts"), where("sellerId", "==", user.uid)),
    (snap) => {
      payouts = {};
      snap.docs.forEach(d => { payouts[d.data().orderId] = { id: d.id, ...d.data() }; });
      render();
    },
    (err) => console.error(err)
  );

  onSnapshot(
    query(collection(db, "orders"), where("sellerId", "==", user.uid)),
    (snap) => {
      orders = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(o => o.trackingStatus)
        .sort((a, b) => ts(b.createdAt) - ts(a.createdAt));
      render();
    },
    (err) => {
      console.error(err);
      listEl.innerHTML = `<p style="color:#ef4444;text-align:center;padding:30px">Couldn't load orders. Please refresh.</p>`;
    }
  );
});