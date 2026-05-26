import {
  db,
  auth,
  addDoc,
  collection
} from "./firebase.js";

window.submitReport = async function () {

  const productId = document
    .getElementById("report-product-id")
    .value
    .trim();

  const reason = document
    .getElementById("report-reason")
    .value;

  const description = document
    .getElementById("report-description")
    .value
    .trim();

  if (!productId || !description) {
    alert("Please complete all fields");
    return;
  }

  try {

    await addDoc(collection(db, "reports"), {

      productId,
      reason,
      description,

      reportedBy: auth.currentUser
        ? auth.currentUser.uid
        : "anonymous",

      createdAt: new Date(),

      status: "pending"

    });

    alert("✅ Report submitted successfully");

    window.location.href = "index.html";

  } catch (err) {

    console.error(err);

    alert("Failed to submit report");

  }

};