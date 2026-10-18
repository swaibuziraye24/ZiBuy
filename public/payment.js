import { db, auth, collection, doc, getDoc } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDistricts, getSubLocations } from "./uganda-locations.js";

import { unitPriceFor } from "./seller-options.js";

const ADMIN_EMAIL = "swaibuziraye22@gmail.com";

// ── District / area pickers ──
document.addEventListener("DOMContentLoaded", () => {
  buildSearchableSelect({
    inputId:    "delivery-district-input",
    dropdownId: "delivery-district-dropdown",
    hiddenId:   "delivery-district",
    options:    getDistricts(),
    onSelect:   (district) => {
      if (window.zbCartRecalc) window.zbCartRecalc();

      const subs = getSubLocations(district);
      const wrap = document.getElementById("delivery-sublocation-wrap");
      if (!wrap) return;

      if (subs.length === 0) {
        wrap.style.display = "none";
      } else {
        wrap.style.display = "block";
        buildSearchableSelect({
          inputId:    "delivery-sublocation-input",
          dropdownId: "delivery-sublocation-dropdown",
          hiddenId:   "delivery-sublocation",
          options:    subs,
          onSelect:   () => {}
        });
      }
    }
  });
});

function buildSearchableSelect({ inputId, dropdownId, hiddenId, options, onSelect }) {
  const input    = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  if (!input || !dropdown) return;

  function renderOptions(filter = "") {
    const q = filter.toLowerCase();
    const filtered = options.filter(o => o.toLowerCase().includes(q));
    dropdown.innerHTML = filtered.length === 0
      ? `<div class="loc-option" style="color:#9ca3af">No results</div>`
      : filtered.map(o => `<div class="loc-option" data-val="${o}">${o}</div>`).join("");

    dropdown.querySelectorAll(".loc-option").forEach(el => {
      el.onclick = () => {
        input.value = el.dataset.val || el.textContent;
        const hidden = document.getElementById(hiddenId);
        if (hidden) hidden.value = el.dataset.val || el.textContent;
        dropdown.classList.remove("open");
        if (onSelect) onSelect(el.dataset.val || el.textContent);
      };
    });
  }

  input.addEventListener("focus", () => { renderOptions(input.value); dropdown.classList.add("open"); });
  input.addEventListener("input", () => { renderOptions(input.value); dropdown.classList.add("open"); });
  document.addEventListener("click", (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove("open");
    }
  });

  renderOptions();
}

// ── State ──
let currentUser = null;
let cart        = JSON.parse(localStorage.getItem("zibuy-cart")) || [];
let groups      = [];      // one group per seller
let problems    = [];      // items that can't be bought right now
let loaded      = false;

// One reference for the whole payment, shown in the MTN / Airtel steps
const cartRef = "ZB-C" + Date.now().toString(36).toUpperCase().slice(-6);

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (!user) { window.location.href = "index.html"; return; }
  if (loaded) return;
  loaded = true;
  loadCheckout();
});

// ── Delivery rules (same as Buy Now) ──
function deliveryFor(delivery, district) {
  if (!delivery || !delivery.available || !Array.isArray(delivery.zones) || delivery.zones.length === 0) {
    return { mode: "arranged", fee: 0 };
  }
  const zone = delivery.zones.find(z => z.area === district)
            || delivery.zones.find(z => z.area === "All of Uganda");
  if (!zone) return { mode: "unavailable", fee: 0 };
  const fee = Number(zone.fee) || 0;
  return { mode: fee === 0 ? "free" : "paid", fee, area: zone.area };
}

// One delivery fee per seller: the highest fee among that seller's items
function groupDelivery(g, district) {
  if (!district) return { mode: "pending", fee: 0 };

  let fee = 0, anyFree = false;
  const blockers = [];

  g.items.forEach(i => {
    const d = deliveryFor(i.delivery, district);
    if (d.mode === "unavailable") blockers.push(i.name);
    else if (d.mode === "paid")   fee = Math.max(fee, d.fee);
    else if (d.mode === "free")   anyFree = true;
  });

  if (blockers.length) return { mode: "unavailable", fee: 0, blockers };
  if (fee > 0)         return { mode: "paid", fee };
  if (anyFree)         return { mode: "free", fee: 0 };
  return { mode: "arranged", fee: 0 };
}

function calculate() {
  const district = document.getElementById("delivery-district")?.value || "";
  const protect  = !!document.getElementById("cart-protect-toggle")?.checked;

  let subtotal = 0, protectTotal = 0, deliveryTotal = 0;
  const blocked = [];

  groups.forEach(g => {
    g.protectFee   = protect ? Math.max(1000, Math.round(g.subtotal * 0.025)) : 0;
    g.deliveryInfo = groupDelivery(g, district);
    g.total        = g.subtotal + g.protectFee + g.deliveryInfo.fee;

    subtotal      += g.subtotal;
    protectTotal  += g.protectFee;
    deliveryTotal += g.deliveryInfo.fee;

    if (g.deliveryInfo.mode === "unavailable") {
      blocked.push(`${g.sellerName} doesn't deliver ${g.deliveryInfo.blockers.join(", ")} to ${district}`);
    }
  });

  return {
    district, protect, subtotal, protectTotal, deliveryTotal, blocked,
    total: subtotal + protectTotal + deliveryTotal
  };
}

// ── Load the cart and check every item against the live listing ──
async function loadCheckout() {
  if (cart.length === 0) {
    document.body.innerHTML = "<div style='text-align:center;padding:60px 20px'><p>Your cart is empty</p><a href='index.html' class='btn btn-orange' style='display:inline-block;margin-top:12px'>Browse listings</a></div>";
    return;
  }

  const wrap = document.getElementById("order-items");
  if (wrap) wrap.innerHTML = `<p style="color:#6b7280;font-size:14px">Loading your items...</p>`;

  const withId = cart.filter(i => i.productId);
  problems = cart
    .filter(i => !i.productId)
    .map(i => ({ name: i.name, reason: "added before an update, so please remove it and add it again" }));

  const snaps = await Promise.all(
    withId.map(i => getDoc(doc(db, "products", i.productId)).catch(() => null))
  );

  const bySeller = new Map();

  withId.forEach((item, idx) => {
    const snap = snaps[idx];
    if (!snap || !snap.exists()) {
      problems.push({ name: item.name, reason: "no longer available", productId: item.productId });
      return;
    }

    const p = snap.data();
    const expired = p.expiresAt?.toDate?.() && p.expiresAt.toDate() < new Date();

    if ((p.status && p.status !== "active") || expired || p.vacationPaused) {
      problems.push({ name: p.name || item.name, reason: "already sold or unavailable", productId: item.productId });
      return;
    }
    if (p.userId === currentUser.uid) {
      problems.push({ name: p.name || item.name, reason: "this is your own listing", productId: item.productId });
      return;
    }

    const sellerId = p.userId || "unknown";
    if (!bySeller.has(sellerId)) {
      bySeller.set(sellerId, {
        sellerId,
        sellerEmail: p.userEmail || "",
        sellerName:  p.userEmail === ADMIN_EMAIL
          ? "ZiBuy Official"
          : (p.seller?.name || (p.userEmail || "").split("@")[0] || "Seller"),
        sellerPhone: p.seller?.phone || "",
        items:       [],
        subtotal:    0
      });
    }

    const g     = bySeller.get(sellerId);
    const basePrice = Number(p.price) || 0;
    const qty   = Math.max(1, Number(item.qty) || 1);
    const price = unitPriceFor(basePrice, p.priceTiers, qty);

    g.items.push({
      productId: item.productId,
      name:      p.name || item.name,
      price, qty,
      image:     p.images?.[0] || item.image || "",
      delivery:  p.delivery || null
    });
    g.subtotal += price * qty;
  });

  groups = [...bySeller.values()];

  const nameEl = document.getElementById("delivery-name");
  if (nameEl && currentUser?.email) nameEl.value = currentUser.email.split("@")[0];

  document.querySelectorAll(".cart-ref").forEach(el => { el.textContent = cartRef; });

  renderCheckout();
}

window.zbCartRecalc = function () { renderCheckout(); };

function renderCheckout() {
  const c  = calculate();
  const el = document.getElementById("order-items");
  if (!el) return;

  let html = "";

  if (problems.length) {
    html += `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:12px;margin-bottom:12px;font-size:13px;color:#991b1b">
      <strong>⚠️ Please remove these items to continue:</strong>
      <ul style="margin:8px 0;padding-left:18px">
        ${problems.map(p => `<li>${esc(p.name)}: ${esc(p.reason)}</li>`).join("")}
      </ul>
      <button onclick="removeProblemItems()" style="background:#ef4444;color:white;border:none;padding:8px 14px;border-radius:8px;font-weight:700;cursor:pointer">Remove them</button>
    </div>`;
  }

  groups.forEach(g => {
    const d = g.deliveryInfo || { mode: "pending", fee: 0 };
    let deliveryText;
    if (d.mode === "pending")          deliveryText = `<span style="color:#6b7280">🚚 Select your district for the delivery fee</span>`;
    else if (d.mode === "free")        deliveryText = `<span style="color:#059669;font-weight:700">🚚 FREE delivery</span>`;
    else if (d.mode === "paid")        deliveryText = `<span style="color:#111827;font-weight:700">🚚 Delivery: UGX ${d.fee.toLocaleString()}</span>`;
    else if (d.mode === "arranged")    deliveryText = `<span style="color:#6b7280">🚚 Delivery arranged with the seller</span>`;
    else                               deliveryText = `<span style="color:#b91c1c;font-weight:700">🚫 Not delivered to ${esc(c.district)}: ${esc(d.blockers.join(", "))}</span>`;

    html += `<div style="border:1px solid #e5e7eb;border-radius:12px;padding:12px;margin-bottom:12px">
      <p style="margin:0 0 8px;font-weight:800;font-size:14px">🏪 ${esc(g.sellerName)}</p>
      ${g.items.map(i => `
        <div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;font-size:14px">
          <span>${esc(i.name)} × ${i.qty}</span>
          <span>UGX ${(i.price * i.qty).toLocaleString()}</span>
        </div>`).join("")}
      <div style="margin-top:6px;padding-top:8px;border-top:1px dashed #e5e7eb;font-size:12.5px">${deliveryText}</div>
    </div>`;
  });

  el.innerHTML = html;

  const set = (id, text) => { const n = document.getElementById(id); if (n) n.textContent = text; };
  set("subtotal",    "UGX " + c.subtotal.toLocaleString());
  set("platform-fee", c.protect ? "+ UGX " + c.protectTotal.toLocaleString() : "Off");
  set("delivery",    !c.district ? "Select your district" : (c.deliveryTotal > 0 ? "+ UGX " + c.deliveryTotal.toLocaleString() : "FREE / arranged"));
  const t = "UGX " + c.total.toLocaleString();
  ["total-price", "cart-total-display", "cart-total-mtn", "cart-total-airtel"].forEach(id => set(id, t));

  const warn = document.getElementById("cart-warning");
  if (warn) {
    warn.textContent   = c.blocked.join(". ");
    warn.style.display = c.blocked.length ? "block" : "none";
  }
}

window.removeProblemItems = function () {
  const bad = new Set(problems.filter(p => p.productId).map(p => p.productId));
  cart = cart.filter(i => i.productId && !bad.has(i.productId));
  localStorage.setItem("zibuy-cart", JSON.stringify(cart));
  window.location.reload();
};

// ── Place the orders (one per seller, saved together) ──
window.placeOrder = async function () {
  const btn = event.target;

  const name        = document.getElementById("delivery-name")?.value.trim()    || "";
  const phone       = document.getElementById("delivery-phone")?.value.trim()   || "";
  const address     = document.getElementById("delivery-address")?.value.trim() || "";
  const district    = document.getElementById("delivery-district")?.value       || "";
  const sublocation = document.getElementById("delivery-sublocation")?.value    || "";
  const txnInput    = document.getElementById("cart-txn-ref");
  const txnRef      = txnInput ? txnInput.value.trim() : "";

  if (problems.length) {
    alert("Please remove the unavailable items from your order first.");
    return;
  }
  if (groups.length === 0) {
    alert("Your order has no available items.");
    return;
  }
  if (!name || !phone || !district) {
    alert("Please fill in your name, phone, and district so the sellers know where to deliver.");
    return;
  }

  const c = calculate();
  if (c.blocked.length) {
    alert(c.blocked.join(".\n") + ".\n\nPlease choose another location or remove those items.");
    return;
  }

  if (!txnRef) {
    if (txnInput) {
      txnInput.style.borderColor = "#ef4444";
      txnInput.focus();
      txnInput.placeholder = "⚠️ Please enter your transaction ID";
    }
    return;
  }

  const location = sublocation
    ? `${address ? address + ", " : ""}${sublocation}, ${district}`
    : (address ? `${address}, ${district}` : district);

  btn.textContent = "Saving your orders...";
  btn.disabled    = true;

  try {
    const { writeBatch } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    const batch = writeBatch(db);
    const refs  = [];

    groups.forEach((g, i) => {
      const orderRef = groups.length > 1 ? `${cartRef}-${i + 1}` : cartRef;
      refs.push(orderRef);

      const first = g.items[0];
      batch.set(doc(collection(db, "orders")), {
        orderRef,
        paymentGroupId:     cartRef,
        paymentGroupTotal:  c.total,
        paymentGroupOrders: groups.length,

        productId:    first.productId,
        productName:  g.items.length > 1 ? `${first.name} + ${g.items.length - 1} more` : first.name,
        items:        g.items.map(it => ({ productId: it.productId, name: it.name, price: it.price, qty: it.qty, image: it.image })),
        price:        g.subtotal,

        protected:     c.protect,
        protectionFee: g.protectFee,
        deliveryFee:   g.deliveryInfo.fee,
        deliveryZone:  g.deliveryInfo.area || district,
        deliveryMode:  g.deliveryInfo.mode,
        total:         g.total,

        sellerId:    g.sellerId,
        sellerEmail: g.sellerEmail,
        sellerName:  g.sellerName,
        sellerPhone: g.sellerPhone,

        customerName:     name,
        customerPhone:    phone,
        customerLocation: location,
        deliveryAddress:  address,
        userEmail:        currentUser.email,
        buyerUid:         currentUser.uid,

        transactionRef:    txnRef,
        paymentMethod:     "mobile_money",
        status:            "pending_verification",
        deliveryConfirmed: false,

        trackingStatus: "placed",
        trackingEvents: [{ status: "placed", at: Date.now(), by: "buyer" }],

        createdAt: new Date()
      });
    });

    await batch.commit();
    localStorage.removeItem("zibuy-cart");

    const success = document.createElement("div");
    success.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px";
    success.innerHTML = `
      <div style="background:white;border-radius:20px;padding:32px;max-width:400px;width:100%;text-align:center">
        <p style="font-size:52px;margin-bottom:12px">✅</p>
        <h2 style="font-size:20px;font-weight:800;margin-bottom:8px">Order Submitted!</h2>
        <div style="background:#f9fafb;border-radius:10px;padding:14px;margin-bottom:16px;text-align:left">
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px">
            <span style="color:#6b7280">Reference</span>
            <strong style="color:#ff6600">${esc(cartRef)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px">
            <span style="color:#6b7280">Transaction ID</span>
            <strong style="color:#ff6600">${esc(txnRef)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:13px">
            <span style="color:#6b7280">${refs.length} order${refs.length > 1 ? "s" : ""}</span>
            <strong>UGX ${c.total.toLocaleString()}</strong>
          </div>
        </div>
        <p style="color:#6b7280;font-size:13px;margin-bottom:16px;line-height:1.6">
          ZiBuy will confirm your payment, then each seller packs and delivers.
          You'll get a notification at every step and can track it live in "My Orders".
        </p>
        <button onclick="window.location.href='dashboard.html?tab=orders'"
          style="background:#ff6600;color:white;border:none;padding:14px;border-radius:12px;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit;width:100%">
          View My Orders →
        </button>
      </div>`;
    document.body.appendChild(success);

  } catch (err) {
    console.error(err);
    alert("Failed to save your order. Please try again.");
    btn.textContent = "✅ Submit Payment Reference";
    btn.disabled    = false;
  }
};