import { db, auth, collection, addDoc, storage } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

let currentUser = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (!user) {
    window.location.href = "index.html";
  }
});

window.submitBusinessUpgrade = async function() {
  if (!currentUser) {
    alert("❌ You must be logged in");
    return;
  }

  const businessName = document.getElementById("business-name").value.trim();
  const businessCategory = document.getElementById("business-category").value;
  const businessDesc = document.getElementById("business-description").value.trim();
  const businessLocation = document.getElementById("business-location").value.trim();
  const businessPhone = document.getElementById("business-phone").value.trim();
  const businessWebsite = document.getElementById("business-website").value.trim();
  const logoFile = document.getElementById("business-logo").files[0];

  if (!businessName || !businessCategory || !businessDesc || !businessLocation || !businessPhone) {
    alert("❌ Please fill all required fields");
    return;
  }

  try {
    let logoUrl = "";

    // Upload logo if provided
    if (logoFile) {
      if (logoFile.size > 2 * 1024 * 1024) {
        alert("❌ Logo must be less than 2MB");
        return;
      }

      const logoRef = ref(storage, `business-logos/${currentUser.uid}/${Date.now()}`);
      await uploadBytes(logoRef, logoFile);
      logoUrl = await getDownloadURL(logoRef);
    }

    // Create business upgrade request
    const requestId = "BUSR-" + Date.now();

    const businessRequest = {
      requestId,
      userId: currentUser.uid,
      email: currentUser.email,
      businessName,
      category: businessCategory,
      description: businessDesc,
      location: businessLocation,
      phone: businessPhone,
      website: businessWebsite,
      logo: logoUrl,
      price: 10000,
      status: "pending",
      createdAt: new Date()
    };

    await addDoc(collection(db, "business_requests"), businessRequest);

    // Open WhatsApp with payment message
    const whatsappMessage = encodeURIComponent(
      `Hello, I want to upgrade to a Business Account.\n\n` +
      `Request ID: ${requestId}\n` +
      `Business Name: ${businessName}\n` +
      `Amount: UGX 10,000\n\n` +
      `Please confirm payment.`
    );

    const whatsappUrl = `https://wa.me/256790548910?text=${whatsappMessage}`;
    window.open(whatsappUrl, "_blank");

    // Show confirmation
    alert(
      `✅ Business request created!\n\n` +
      `Request ID: ${requestId}\n\n` +
      `Please send UGX 10,000 via the WhatsApp window that just opened.\n` +
      `Your request will be reviewed within 24 hours.`
    );

    // Redirect after a delay
    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 3000);

  } catch (err) {
    console.error("Error:", err);
    alert("❌ Error: " + err.message);
  }
};