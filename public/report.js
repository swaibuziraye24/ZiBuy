import { db, auth, addDoc, collection } from "./firebase.js";

window.submitReport = async function () {

  const sellerName  = document.getElementById("report-seller-name").value.trim();
  const productRef  = document.getElementById("report-product-id").value.trim();
  const reason      = document.getElementById("report-reason").value;
  const description = document.getElementById("report-description").value.trim();

  if (!sellerName || !description) {
    alert("Please enter the seller name/email and describe the issue");
    return;
  }

  const btn = document.querySelector(".submit-btn");
  btn.textContent = "Submitting...";
  btn.disabled    = true;

  try {
    await addDoc(collection(db, "reports"), {
      sellerName,
      productRef:  productRef || "—",
      reason,
      description,
      reportedBy:  auth.currentUser?.uid   || "anonymous",
      reporterEmail: auth.currentUser?.email || "anonymous",
      createdAt:   new Date(),
      status:      "open",
      resolved:    false
    });

    alert("✅ Report submitted. Our team will review within 24 hours.");
    window.location.href = "index.html";

  } catch (err) {
    console.error(err);
    alert("Failed to submit report. Please try again.");
    btn.textContent = "Submit Report";
    btn.disabled    = false;
  }
};