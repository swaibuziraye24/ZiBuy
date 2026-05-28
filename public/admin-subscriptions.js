import {
  db,
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc
} from "./firebase.js";

/* =========================
   OPEN PAGE
========================= */
window.openSubscriptions = function () {
  window.location.href = "admin-subscriptions.html";
};

/* =========================
   LOAD REQUESTS
========================= */
export async function loadSubscriptions() {

  const container = document.getElementById("subs-container");

  const snap = await getDocs(
    query(
      collection(db, "business_accounts"),
      where("status", "==", "pending_payment")
    )
  );

  if (snap.empty) {
    container.innerHTML = "<p>No subscription requests</p>";
    return;
  }

  container.innerHTML = "";

  snap.forEach((d) => {
    const data = d.data();

    const div = document.createElement("div");
    div.className = "sub-card";

    div.innerHTML = `
      <h3>${data.plan.toUpperCase()}</h3>
      <p>Email: ${data.email}</p>
      <p>Price: UGX ${data.price}</p>
      <p>Billing: ${data.billingCycle}</p>

      <button onclick="approveSub('${d.id}', '${data.plan}')">
        ✅ Approve
      </button>

      <button onclick="rejectSub('${d.id}')">
        ❌ Reject
      </button>
    `;

    container.appendChild(div);
  });
}

/* =========================
   APPROVE
========================= */
window.approveSub = async function (id, plan) {
  await updateDoc(doc(db, "business_accounts", id), {
    status: "active",
    approvedAt: new Date()
  });

  alert("Subscription approved");
  location.reload();
};

/* =========================
   REJECT
========================= */
window.rejectSub = async function (id) {
  await updateDoc(doc(db, "business_accounts", id), {
    status: "rejected"
  });

  alert("Subscription rejected");
  location.reload();
};