import { db, auth, collection, getDocs, query, where } from "./firebase.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let currentUser = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (!user || user.email !== "swaibuziraye22@gmail.com") {
    window.location.href = "index.html";
    return;
  }
  loadAnalytics();
});

async function loadAnalytics() {
  try {
    // Load products
    const productsSnap = await getDocs(collection(db, "products"));
    const products = productsSnap.docs.map(d => d.data());

    // Load orders
    const ordersSnap = await getDocs(collection(db, "orders"));
    const orders = ordersSnap.docs.map(d => d.data());

    // Calculate stats
    const totalProducts = products.length;
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const activeUsers = new Set(products.map(p => p.userId)).size;

    // Update stat cards
    document.getElementById("stat-products").textContent = totalProducts;
    document.getElementById("stat-orders").textContent = totalOrders;
    document.getElementById("stat-revenue").textContent = "UGX " + totalRevenue.toLocaleString();
    document.getElementById("stat-users").textContent = activeUsers;

    // Orders by status
    const statuses = {};
    orders.forEach(o => {
      const status = o.status || "Pending";
      statuses[status] = (statuses[status] || 0) + 1;
    });

    const statusHTML = Object.entries(statuses)
      .map(([status, count]) => `
        <div style="display:flex;justify-content:space-between;padding:8px;background:#f3f4f6;border-radius:8px">
          <span>${status}</span>
          <span style="font-weight:700">${count} orders</span>
        </div>
      `).join("");
    document.getElementById("orders-status").innerHTML = statusHTML;

    // Top products
    const productViews = {};
    products.forEach(p => {
      productViews[p.name] = (p.views || 0);
    });

    const topProducts = Object.entries(productViews)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, views]) => `
        <div style="display:flex;justify-content:space-between;padding:6px;border-bottom:1px solid #e5e7eb">
          <span style="max-width:60%;overflow:hidden;text-overflow:ellipsis">${name}</span>
          <span style="color:#ff6600;font-weight:700">👁️ ${views}</span>
        </div>
      `).join("");
    document.getElementById("top-products").innerHTML = topProducts || "<p style='color:#999'>No products yet</p>";

    // Recent orders
    const recentOrders = orders
      .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0))
      .slice(0, 10);

    const ordersHTML = recentOrders.map(o => `
      <tr>
        <td><strong>${o.orderId}</strong></td>
        <td>${o.customerName}</td>
        <td>${o.items?.length || 0} items</td>
        <td>UGX ${(o.total || 0).toLocaleString()}</td>
        <td><span style="background:${o.status === 'Pending' ? '#fef3c7' : '#dbeafe'};padding:4px 8px;border-radius:4px;font-size:11px;font-weight:700">${o.status || 'Pending'}</span></td>
        <td style="font-size:11px;color:#999">${new Date(o.createdAt?.toDate?.() || 0).toLocaleDateString()}</td>
      </tr>
    `).join("");
    document.getElementById("recent-orders").innerHTML = ordersHTML;

    // Seller activity
    const sellers = {};
    products.forEach(p => {
      if (p.userId) {
        sellers[p.userId] = (sellers[p.userId] || 0) + 1;
      }
    });

    const sellerHTML = Object.entries(sellers)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([uid, count]) => `
        <div style="display:flex;justify-content:space-between;padding:8px;background:#f3f4f6;border-radius:8px">
          <span>${uid.slice(0, 10)}...</span>
          <span style="font-weight:700">${count} products</span>
        </div>
      `).join("");
    document.getElementById("seller-activity").innerHTML = sellerHTML || "<p style='color:#999'>No seller activity</p>";

  } catch (err) {
    console.error(err);
    alert("Failed to load analytics");
  }
}

window.logout = async function() {
  await signOut(auth);
  window.location.href = "index.html";
};