import { db, auth, collection, addDoc } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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

  const delivery = 5000; // Fixed delivery fee
  const total = subtotal + delivery;

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
  const selected = document.querySelector("input[name='payment']:checked").value;
  const container = document.getElementById("payment-details");

  if (selected === "cod") {
    container.innerHTML = `
      <div style="background:#fffbeb;border:1px solid #fde68a;padding:14px;border-radius:10px;color:#92400e;font-size:13px;margin-top:16px">
        ℹ️ Pay the driver when your order arrives
      </div>
    `;
  } else if (selected === "mobile") {
    container.innerHTML = `
      <div style="margin-top:16px">
        <label style="display:block;font-size:14px;font-weight:700;margin-bottom:8px">Phone Number</label>
        <input type="tel" id="phone-number" placeholder="256701234567" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:inherit">
        <p style="font-size:12px;color:#6b7280;margin-top:8px">MTN or Airtel Mobile Money. You'll receive a prompt.</p>
      </div>
    `;
  } else if (selected === "card") {
    container.innerHTML = `
      <div style="margin-top:16px;background:#f3f4f6;padding:14px;border-radius:10px">
        <input type="text" placeholder="Card Number" maxlength="19" style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:8px;font-family:inherit">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <input type="text" placeholder="MM/YY" maxlength="5" style="padding:10px;border:1px solid #e5e7eb;border-radius:8px;font-family:inherit">
          <input type="text" placeholder="CVV" maxlength="3" style="padding:10px;border:1px solid #e5e7eb;border-radius:8px;font-family:inherit">
        </div>
      </div>
    `;
  }
}

window.placeOrder = async function() {
  const name = document.getElementById("delivery-name").value.trim();
  const phone = document.getElementById("delivery-phone").value.trim();
  const address = document.getElementById("delivery-address").value.trim();
  const location = document.getElementById("delivery-location").value;
  const payment = document.querySelector("input[name='payment']:checked").value;

  if (!name || !phone || !address || !location) {
    alert("Please fill all delivery details");
    return;
  }

  const btn = event.target;
  btn.textContent = "Processing...";
  btn.disabled = true;

  try {
    let total = 0;
    cart.forEach(item => total += item.price * item.qty);
    total += 5000; // delivery

    const orderId = "ZB-" + Date.now();

    // Create order
    await addDoc(collection(db, "orders"), {
      orderId,
      userEmail: currentUser.email,
      customerName: name,
      customerPhone: phone,
      customerLocation: location,
      deliveryAddress: address,
      items: cart,
      total,
      paymentMethod: payment,
      status: "Pending",
      createdAt: new Date()
    });

    // Save transaction if not COD
    if (payment !== "cod") {
      await addDoc(collection(db, "transactions"), {
        orderId,
        amount: total,
        method: payment,
        status: "pending",
        createdAt: new Date()
      });
    }

    // Clear cart
    localStorage.removeItem("zibuy-cart");

    // Show success
    document.body.innerHTML = `
      <div style="text-align:center;padding:60px 20px">
        <p style="font-size:48px;margin-bottom:16px">✅</p>
        <h1 style="font-size:24px;font-weight:800;margin-bottom:8px">Order Placed!</h1>
        <p style="color:#6b7280;margin-bottom:20px">Order ID: <strong>${orderId}</strong></p>
        <p style="color:#6b7280;margin-bottom:20px">We'll contact you shortly to confirm delivery</p>
        <a href="index.html" class="btn btn-orange" style="display:inline-block;padding:12px 24px">← Back to Home</a>
      </div>
    `;
  } catch (err) {
    console.error(err);
    alert("Order failed. Try again.");
    btn.textContent = "Place Order";
    btn.disabled = false;
  }
};

loadCheckout();