import { db, auth, collection, addDoc } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";


import { getDistricts } from "./uganda-locations.js";

document.addEventListener("DOMContentLoaded", () => {
  const el = document.getElementById("delivery-district");
  if (el) {
    getDistricts().forEach(d => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      el.appendChild(opt);
    });
  }
});

let currentUser = null;
let cart = JSON.parse(localStorage.getItem("zibuy-cart")) || [];

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  loadCheckout();
});

function loadCheckout() {
  if (cart.length === 0) {
    document.body.innerHTML = "<div style='text-align:center;padding:60px 20px'><p>Cart is empty</p><a href='index.html' class='btn btn-orange' style='display:inline-block;padding:12px 24px;margin-top:20px'>← Back to Shopping</a></div>";
    return;
  }

  // Load order items
  const container = document.getElementById("order-items");
  let subtotal = 0;

  cart.forEach((item) => {
    subtotal += item.price * item.qty;
    container.innerHTML += `
      <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px">
        <span>${item.name} × ${item.qty}</span>
        <span>UGX ${(item.price * item.qty).toLocaleString()}</span>
      </div>
    `;
  });

 const delivery      = 5000;
    const platformFee   = Math.round(subtotal * 0.03); // 3% ZiBuy fee
    const total         = subtotal + delivery + platformFee;

    document.getElementById("subtotal").textContent  = "UGX " + subtotal.toLocaleString();
    document.getElementById("delivery").textContent  = "UGX " + delivery.toLocaleString();

    // Show platform fee line
    const feeEl = document.getElementById("platform-fee");
    if (feeEl) feeEl.textContent = "UGX " + platformFee.toLocaleString();

  document.getElementById("subtotal").textContent = "UGX " + subtotal.toLocaleString();
  document.getElementById("delivery").textContent = "UGX " + delivery.toLocaleString();
  document.getElementById("total-price").textContent = "UGX " + total.toLocaleString();

  // Prefill user data
  const name = currentUser.email.split("@")[0];
  document.getElementById("delivery-name").value = name;

  // Show payment details based on selection
  document.querySelectorAll("input[name='payment']").forEach((radio) => {
    radio.addEventListener("change", showPaymentDetails);
  });
}

function showPaymentDetails() {
  document.getElementById("payment-details").innerHTML = `
    <div style="background:#e7f9ef;border:1px solid #86efac;padding:14px;border-radius:10px;color:#166534;font-size:13px;margin-top:16px;display:flex;align-items:center;gap:10px">
      <span style="font-size:20px">💬</span>
      <span>After placing your order you'll be redirected to WhatsApp to confirm payment with our team.</span>
    </div>
  `;
}


// ── ZiBuy Admin WhatsApp ─────────────────────
const ZIBUY_WHATSAPP = "256789157512"; // ← replace with your number

window.placeOrder = async function() {
  const name     = document.getElementById("delivery-name").value.trim();
  const phone    = document.getElementById("delivery-phone").value.trim();
  const address  = document.getElementById("delivery-address").value.trim();
  const district  = document.getElementById("delivery-district")?.value || "";
  const subLoc    = document.getElementById("delivery-sublocation")?.value || "";
  const location  = subLoc ? `${subLoc}, ${district}` : district;

  if (!name || !phone || !address || !location) {
    alert("Please fill all delivery details");
    return;
  }

  const btn = event.target;
  btn.textContent = "Processing...";
  btn.disabled = true;

  try {
    let subtotal = 0;
    cart.forEach(item => subtotal += item.price * item.qty);
    const total   = subtotal + 5000;
    const orderId = "ZB-" + Date.now();

    // Save pending order to Firestore
    await addDoc(collection(db, "orders"), {
      orderId,
      userEmail:        currentUser.email,
      customerName:     name,
      customerPhone:    phone,
      customerLocation: location,
      deliveryAddress:  address,
      items:            cart,
      total,
      paymentMethod:    "whatsapp",
      status:           "pending_payment",
      createdAt:        new Date()
    });

    // Clear cart
    localStorage.removeItem("zibuy-cart");

    // Build WhatsApp message
    const itemLines = cart.map(i =>
      `• ${i.name} x${i.qty} — UGX ${(i.price * i.qty).toLocaleString()}`
    ).join("\n");

    const msg = encodeURIComponent(
      `🛒 *New ZiBuy Order*\n` +
      `Order ID: *${orderId}*\n\n` +
      `*Items:*\n${itemLines}\n\n` +
      `Subtotal: UGX ${subtotal.toLocaleString()}\n` +
      `Delivery: UGX 5,000\n` +
      `*Total: UGX ${total.toLocaleString()}*\n\n` +
      `*Delivery Details:*\n` +
      `Name: ${name}\n` +
      `Phone: ${phone}\n` +
      `Address: ${address}\n` +
      `Location: ${location}`
    );

    window.location.href = `https://wa.me/${ZIBUY_WHATSAPP}?text=${msg}`;

  } catch (err) {
    console.error(err);
    alert("Order failed. Try again.");
    btn.textContent = "Place Order";
    btn.disabled = false;
  }
};

loadCheckout();