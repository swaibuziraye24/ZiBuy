import { db, auth, collection, getDocs, query, where, deleteDoc, doc } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let currentUser = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (!user || user.email !== "swaibuziraye22@gmail.com") {
    window.location.href = "index.html";
    return;
  }
  loadPremiumAds();
});

async function loadPremiumAds() {
  try {
    const snapshot = await getDocs(collection(db, "premium_ads"));
    const allPremium = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Filter active
    const activePremium = allPremium.filter(p => 
      p.status === "active" && new Date(p.expiresAt.toDate()) > new Date()
    );

    // Calculate stats
    const totalRevenue = allPremium.reduce((sum, p) => sum + (p.price || 0), 0);
    const adminCut = Math.round(totalRevenue * 0.2); // 20% commission
    const avgClicks = activePremium.length > 0 
      ? Math.round(activePremium.reduce((sum, p) => sum + (p.clicks || 0), 0) / activePremium.length)
      : 0;

    document.getElementById("total-revenue").textContent = "UGX " + adminCut.toLocaleString();
    document.getElementById("active-boosts").textContent = activePremium.length;
    document.getElementById("avg-clicks").textContent = avgClicks;

    // Get product details for active ads
    const { collection: col, getDocs: gd, query: q, where: w } = await import("./firebase.js");
    const productsSnap = await gd(col(db, "products"));
    const products = {};
    productsSnap.forEach(doc => {
      products[doc.id] = doc.data();
    });

    // Render table
    const tableHTML = activePremium
      .sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate())
      .map(p => {
        const product = products[p.productId] || {};
        const expiresDate = new Date(p.expiresAt.toDate()).toLocaleDateString();
        return `
          <tr>
            <td>${product.name || "Unknown"}</td>
            <td>${product.seller?.name || "—"}</td>
            <td>${p.days} days</td>
            <td>UGX ${p.price?.toLocaleString() || 0}</td>
            <td>${p.clicks || 0}</td>
            <td>${expiresDate}</td>
            <td>
              <button onclick="removePremium('${p.id}')" style="background:#ef4444;color:white;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px">Remove</button>
            </td>
          </tr>
        `;
      })
      .join("");

    document.getElementById("premium-ads-table").innerHTML = tableHTML || 
      "<tr><td colspan='7' style='text-align:center;color:#6b7280'>No active premium ads</td></tr>";

  } catch (err) {
    console.error(err);
  }
}

window.removePremium = async function(premiumId) {
  if (!confirm("Remove this premium ad?")) return;

  try {
    await deleteDoc(doc(db, "premium_ads", premiumId));
    loadPremiumAds();
  } catch (err) {
    console.error(err);
    alert("Failed to remove");
  }
};