import { db, auth, doc, getDoc, collection, getDocs, query, where } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const id = new URLSearchParams(location.search).get("order");
const el = document.getElementById("cert");

const LABELS = {
  order_placed:            "Order placed by buyer",
  status_placed:           "Order placed",
  status_payment_verified: "Payment received and confirmed by ZiBuy",
  status_packed:           "Packed by the seller",
  status_on_the_way:       "Seller on the way to the buyer",
  status_arrived:          "Seller arrived at the delivery location",
  status_received:         "Order marked as received",
  delivery_pin_verified:   "Delivery code verified by the seller (the buyer was present at handover)",
  delivery_pin_failed:     "Wrong delivery code attempt",
  payout_recorded:         "ZiBuy sent the seller's payment",
  payout_acknowledged:     "Seller confirmed receiving the payment and signed (email code)",
  refund_recorded:         "ZiBuy sent a refund to the buyer",
  refund_acknowledged:     "Buyer confirmed receiving the refund (confirmed with account login)",
  note_signed_buyer:       "Buyer signed the handover note (confirmed with account login)",
  note_signed_seller:      "Seller signed the handover note (confirmed with account login)"
};

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

// Must match the server's canonical form exactly
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
  hour: "2-digit", minute: "2-digit", second: "2-digit"
});

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "index.html"; return; }
  if (!id)   { el.textContent = "No order specified."; return; }

  try {
    const snap = await getDoc(doc(db, "orders", id));
    if (!snap.exists()) { el.textContent = "Order not found."; return; }
    const o = snap.data();

    const base = [collection(db, "order_proofs"), where("orderId", "==", id)];
    let q;
    if (o.buyerUid === user.uid)       q = query(...base, where("buyerUid", "==", user.uid));
    else if (o.sellerId === user.uid)  q = query(...base, where("sellerId", "==", user.uid));
    else                               q = query(...base);   // admins

    const ps     = await getDocs(q);
    const proofs = ps.docs.map(d => d.data()).sort((a, b) => a.seq - b.seq);

    // Re-check the fingerprint chain
    let prev = "GENESIS", intact = proofs.length > 0;
    for (const p of proofs) {
      const core = { orderId: p.orderId, seq: p.seq, type: p.type, atMs: p.atMs,
                     actorUid: p.actorUid, actorRole: p.actorRole, data: p.data };
      const h = await sha256Hex(prev + canon(core));
      if (p.prevHash !== prev || p.hash !== h) { intact = false; break; }
      prev = p.hash;
    }


    let evidenceHTML = "";
    const dp = o.deliveryProof;
    if (dp?.method === "pin") {
      let photoLink = "";
      if (dp.photoPath && o.buyerUid !== user.uid) {   // buyers see that a photo exists, not the photo
        try {
          const { storage } = await import("./firebase.js");
          const { ref, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js");
          const url = await getDownloadURL(ref(storage, dp.photoPath));
          photoLink = ` · <a href="${esc(url)}" target="_blank">View photo</a>`;
        } catch (e) { /* not available to this viewer */ }
      }
      const loc = dp.location;
      evidenceHTML = `
        <h2>Handover evidence</h2>
        <table>
          <tr><th>Delivery code</th><td>✅ Verified by the seller using the buyer's code</td></tr>
          <tr><th>Handover photo</th><td>${dp.photoPath
            ? `📸 Recorded${photoLink}<div class="small">Photo fingerprint: ${esc(dp.photoSha256 || "")}</div>`
            : "—"}</td></tr>
          <tr><th>Seller's location at handover</th><td>${loc
            ? `📍 <a href="https://www.google.com/maps?q=${loc.lat},${loc.lng}" target="_blank">${loc.lat}, ${loc.lng}</a> (±${loc.accuracy} m)`
            : "Not shared"}</td></tr>
        </table>`;
    }


    let refundHTML = "";
    try {
      if (o.sellerId !== user.uid) {   // sellers never see refund amounts
        const rq = o.buyerUid === user.uid
          ? query(collection(db, "refunds"), where("orderId", "==", id), where("buyerUid", "==", user.uid))
          : query(collection(db, "refunds"), where("orderId", "==", id));
        const rr = await getDocs(rq);
        if (!rr.empty) {
          refundHTML = `<h2>Refund</h2><table>` + rr.docs.map(d => {
            const r = d.data();
            return `<tr><th>Amount</th><td>UGX ${Number(r.amount).toLocaleString()} via ${esc(String(r.method).toUpperCase())} · ${esc(r.txnId)}</td></tr>
              <tr><th>Reason</th><td>${esc(r.reason)}</td></tr>
              <tr><th>Buyer confirmation</th><td>${r.acknowledgement
                ? `✅ Confirmed on ${esc(fmt(r.acknowledgement.atMs))} by ${esc(r.acknowledgement.name)}`
                : "⏳ Waiting for the buyer to confirm"}</td></tr>`;
          }).join("") + `</table>`;
        }
      }
    } catch (e) { /* not available to this viewer */ }


    // Amount and transaction ID are shown to the seller and admin only, never to the buyer
    let payoutHTML = "";
    try {
      if (o.buyerUid !== user.uid) {
        const pq = o.sellerId === user.uid
          ? query(collection(db, "payouts"), where("orderId", "==", id), where("sellerId", "==", user.uid))
          : query(collection(db, "payouts"), where("orderId", "==", id));
        const pr = await getDocs(pq);
        if (!pr.empty) {
          const p = pr.docs[0].data();
          const a = p.acknowledgement;
          payoutHTML = `
            <h2>Seller payment</h2>
            <table>
              <tr><th>Amount sent</th><td>UGX ${Number(p.amount).toLocaleString()}</td></tr>
              <tr><th>Method / transaction ID</th><td>${esc(String(p.method).toUpperCase())} · ${esc(p.txnId)}</td></tr>
              <tr><th>Seller confirmation</th><td>${a
                ? `✅ Signed as <strong>${esc(a.nameTyped)}</strong> on ${esc(fmt(a.atMs))}<br>Code sent to ${esc(a.email)}`
                : "⏳ Waiting for the seller to confirm"}</td></tr>
              ${p.screenshotUrl ? `<tr><th>Payment screenshot</th><td><a href="${esc(p.screenshotUrl)}" target="_blank">View</a></td></tr>` : ""}
            </table>`;
        }
      }
    } catch (e) { /* not available to this viewer */ }

    const items = Array.isArray(o.items) && o.items.length
      ? o.items.map(i => `<tr><td>${esc(i.name)}</td><td>${i.qty || 1}</td><td>UGX ${Number(i.price || 0).toLocaleString()}</td></tr>`).join("")
      : `<tr><td>${esc(o.productName)}</td><td>${o.quantity || 1}</td><td>UGX ${Number(o.unitPrice || o.price || 0).toLocaleString()}</td></tr>`;

    el.innerHTML = `
      <h1>Delivery &amp; Payment Certificate</h1>
      <div class="small" style="word-break:normal">Issued by ZiBuy · generated ${esc(fmt(Date.now()))}</div>

      <h2>Order</h2>
      <table>
        <tr><th>Reference</th><td>${esc(o.orderRef || id)}</td></tr>
        <tr><th>Payment transaction ID</th><td>${esc(o.transactionRef || "—")}</td></tr>
        <tr><th>Buyer</th><td>${esc(o.customerName)} · ${esc(o.customerPhone)}<br>${esc(o.userEmail)}</td></tr>
        <tr><th>Delivery location</th><td>${esc(o.customerLocation)}</td></tr>
        <tr><th>Seller</th><td>${esc(o.sellerName)} · ${esc(o.sellerPhone)}</td></tr>
      </table>

      <h2>Items</h2>
      <table><tr><th>Item</th><th>Qty</th><th>Price each</th></tr>${items}</table>

      <h2>Amounts</h2>
      <table>
        <tr><th>Items</th><td>UGX ${Number(o.price || 0).toLocaleString()}</td></tr>
        <tr><th>Delivery</th><td>UGX ${Number(o.deliveryFee || 0).toLocaleString()}</td></tr>
        <tr><th>ZiBuy Protect fee</th><td>UGX ${Number(o.protectionFee || 0).toLocaleString()}</td></tr>
        <tr><th><strong>Total paid by buyer</strong></th><td><strong>UGX ${Number(o.total || 0).toLocaleString()}</strong></td></tr>
      </table>

      <h2>Permanent record of events</h2>
      <table>
        <tr><th>Time (Kampala)</th><th>Event</th><th>By</th></tr>
        ${proofs.map(p => `<tr>
          <td>${esc(fmt(p.atMs))}</td>
          <td>${esc(LABELS[p.type] || p.type)}</td>
          <td>${esc(p.actorRole)}</td></tr>`).join("") || `<tr><td colspan="3">No events recorded yet.</td></tr>`}
      </table>

      ${evidenceHTML}
      ${refundHTML}
      ${payoutHTML}

      <h2>Record integrity</h2>
      <div class="${intact ? "ok" : "bad"}">
        ${intact
          ? "✅ Verified: every entry's fingerprint matches, so no event has been changed or removed since it was recorded."
          : "⚠️ The fingerprints do not match. This record may have been altered. Contact ZiBuy support."}
      </div>
      ${proofs.length ? `<p class="small">Final fingerprint: ${esc(proofs[proofs.length - 1].hash)}</p>` : ""}

      <p class="small" style="word-break:normal;margin-top:18px">
        This is an electronic record created and time-stamped by ZiBuy's servers.
        Entries cannot be edited or deleted by buyers or sellers.
      </p>`;
  } catch (e) {
    console.error(e);
    el.textContent = "You don't have access to this certificate, or it couldn't be loaded.";
  }
});