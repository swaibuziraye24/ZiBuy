import {
  db,
  auth,
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  doc
} from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const ADMIN_EMAIL = "swaibuziraye22@gmail.com";

onAuthStateChanged(auth, async (user) => {

  if (!user || user.email !== ADMIN_EMAIL) {
    window.location.href = "index.html";
    return;
  }

  loadReports();

});

async function loadReports() {

  const container =
    document.getElementById("reports-container");

  try {

    const snapshot =
      await getDocs(collection(db, "reports"));

    if (snapshot.empty) {

      container.innerHTML = `
        <p>No reports found</p>
      `;

      return;
    }

    let html = "";

    snapshot.forEach((docSnap) => {

      const report = {
        id: docSnap.id,
        ...docSnap.data()
      };

      html += `
        <div class="report-card">

          <h3>
            🚨 ${report.reason}
          </h3>

          <div class="report-meta">
            Product ID:
            ${report.productId}
          </div>

          <div class="report-meta">
            Status:
            ${report.status}
          </div>

          <p>
            ${report.description}
          </p>

<div class="report-meta">
  Seller ID:
  ${report.reportedBy || "Unknown"}
</div>

          <div class="report-actions">

            <button
              class="btn btn-delete"
              onclick="deleteProduct('${report.productId}')"
            >
              Delete Product
            </button>

            <button
              class="btn btn-resolve"
              onclick="resolveReport('${report.id}')"
            >
              Mark Resolved
            </button>

          </div>

        </div>
      `;

    });

    container.innerHTML = html;

  } catch (err) {

    console.error(err);

    container.innerHTML = `
      <p>Failed to load reports</p>
    `;

  }

}

window.resolveReport = async function(reportId) {

  try {

    await updateDoc(
      doc(db, "reports", reportId),
      {
        status: "resolved"
      }
    );

    alert("✅ Report resolved");

    loadReports();

  } catch (err) {

    console.error(err);

    alert("Failed");

  }

};

window.deleteProduct = async function(productId) {

  const confirmDelete = confirm(
    "Delete this product permanently?"
  );

  if (!confirmDelete) return;

  try {


    const reportsSnapshot = await getDocs(
  collection(db, "reports")
);

let totalReports = 0;

reportsSnapshot.forEach((docSnap) => {

  const data = docSnap.data();

  if (
    data.productId === productId
    && data.resolved !== true
  ) {
    totalReports++;
  }

});

    if (totalReports >= 3) {

// Seller strike system
const userRef = doc(db, "users", productData.userId);

const usersSnapshot = await getDocs(
  collection(db, "users")
);

let currentStrikes = 0;

usersSnapshot.forEach((docSnap) => {

  const data = docSnap.data();

  if (data.userId === productData.userId) {
    currentStrikes = data.strikes || 0;
  }

});

await updateDoc(userRef, {
  strikes: currentStrikes + 1
});

// Auto ban seller after 3 strikes
if (currentStrikes + 1 >= 3) {

  await updateDoc(userRef, {
    banned: true,
    bannedAt: new Date()
  });

}

// Get product details first
const productRef = doc(db, "products", productId);

const productsSnapshot = await getDocs(
  collection(db, "products")
);

let productData = null;

productsSnapshot.forEach((docSnap) => {

  if (docSnap.id === productId) {
    productData = {
      id: docSnap.id,
      ...docSnap.data()
    };
  }

});

if (!productData) {
  alert("Product not found");
  return;
}

  await updateDoc(
    doc(db, "products", productId),
    {
      hidden: true,
      hiddenReason: "Too many reports"
    }
  );

} else {

  await deleteDoc(
    doc(db, "products", productId)
  );

}

    alert("✅ Product deleted");

  } catch (err) {

    console.error(err);

    alert("Failed to delete");

  }

};