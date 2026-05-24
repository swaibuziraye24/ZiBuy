// ============================================
// ZiBuy — Post Ad Page
// ============================================

import { db, auth, collection, addDoc, storage } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

let currentStep = 1;
let selectedCategory = "";
let uploadedImages = [];
let currentUser = null;

// Check if user is logged in
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  
  // Hide loading indicator
  const authCheck = document.getElementById("auth-check");
  if (authCheck) authCheck.style.display = "none";
  
  if (!user) {
    // Show login prompt
    alert("❌ You must login first to post ads");
    window.location.href = "index.html";
  } else {
    console.log("✅ User logged in as:", user.email);
    // Form is ready to use
  }
});

// ============================================
// CATEGORY SELECTION
// ============================================

window.selectCategory = function(category) {
  selectedCategory = category;

  document.querySelectorAll(".cat-card").forEach(card => {
    card.classList.remove("selected");
  });

  event.currentTarget.classList.add("selected");
  document.getElementById("step1-next").disabled = false;
};

// ============================================
// NEXT STEP
// ============================================

window.nextStep = function() {
  if (currentStep >= 4) return;

  document.getElementById(`step-${currentStep}-content`).classList.remove("active");
  currentStep++;
  document.getElementById(`step-${currentStep}-content`).classList.add("active");
  document.getElementById("current-step").textContent = currentStep;
  document.getElementById(`step-${currentStep}`).classList.add("active");

  if (currentStep > 1) {
    document.getElementById(`line-${currentStep - 1}`).classList.add("active");
  }

  if (currentStep === 4) {
    updateReview();
  }
};

// ============================================
// PREVIOUS STEP
// ============================================

window.prevStep = function() {
  if (currentStep <= 1) return;

  document.getElementById(`step-${currentStep}-content`).classList.remove("active");
  document.getElementById(`step-${currentStep}`).classList.remove("active");

  if (currentStep > 1) {
    document.getElementById(`line-${currentStep - 1}`).classList.remove("active");
  }

  currentStep--;
  document.getElementById(`step-${currentStep}-content`).classList.add("active");
  document.getElementById("current-step").textContent = currentStep;
};

// ============================================
// STEP 2 VALIDATION
// ============================================

const titleInput = document.getElementById("ad-title");
const descInput = document.getElementById("ad-description");
const priceInput = document.getElementById("ad-price");
const locationInput = document.getElementById("ad-location");

function validateStep2() {
  const title = titleInput.value.trim();
  const desc = descInput.value.trim();
  const price = priceInput.value.trim();
  const location = locationInput.value;

  const valid = title !== "" && desc !== "" && price !== "" && location !== "";
  document.getElementById("step2-next").disabled = !valid;
}

titleInput.addEventListener("input", validateStep2);
descInput.addEventListener("input", validateStep2);
priceInput.addEventListener("input", validateStep2);
locationInput.addEventListener("change", validateStep2);

// ============================================
// CHARACTER COUNTERS
// ============================================

titleInput.addEventListener("input", () => {
  document.getElementById("title-count").textContent = titleInput.value.length;
});

descInput.addEventListener("input", () => {
  document.getElementById("desc-count").textContent = descInput.value.length;
});

// ============================================
// IMAGE UPLOAD
// ============================================

window.handleImageUpload = function(event) {
  const files = Array.from(event.target.files);
  uploadedImages = files.slice(0, 5);

  document.getElementById("image-count").textContent = uploadedImages.length;

  const previewContainer = document.getElementById("image-preview-container");
  previewContainer.innerHTML = "";

  uploadedImages.forEach((file, index) => {
    const reader = new FileReader();

    reader.onload = function(e) {
      previewContainer.innerHTML += `
        <div class="image-preview" style="position:relative">
          <img src="${e.target.result}" alt="preview ${index}">
          ${index === 0 ? '<span class="cover-badge">Cover</span>' : ''}
        </div>
      `;
    };

    reader.readAsDataURL(file);
  });

  document.getElementById("step3-next").disabled = uploadedImages.length < 1;
};

// ============================================
// REVIEW STEP
// ============================================

function updateReview() {
  document.getElementById("review-cat").textContent = selectedCategory;
  document.getElementById("review-title").textContent = titleInput.value;
  document.getElementById("review-price").textContent = "UGX " + Number(priceInput.value).toLocaleString();
  document.getElementById("review-location").textContent = locationInput.value;
  document.getElementById("review-desc").textContent = descInput.value;

  if (uploadedImages.length > 0) {
    const reader = new FileReader();
    reader.onload = function(e) {
      document.getElementById("review-image").innerHTML = `<img src="${e.target.result}" alt="preview">`;
    };
    reader.readAsDataURL(uploadedImages[0]);
  }
}

// ============================================
// SUBMIT AD - UPLOAD TO FIREBASE
// ============================================

window.submitAd = async function() {
  if (!currentUser) {
    alert("You must be logged in to post ads");
    return;
  }

  const btn = event.target;
  btn.textContent = "Publishing...";
  btn.disabled = true;

  try {
    // 1. Upload images to Firebase Storage
    const imageUrls = [];
    
   for (let i = 0; i < uploadedImages.length; i++) {
  const file = uploadedImages[i];
  const timestamp = Date.now();
  const fileName = `products/${currentUser.uid}/${timestamp}-${i}-${file.name}`;
  const storageRef = ref(storage, fileName);

  try {
    // Upload with metadata
    const metadata = {
      contentType: file.type,
      cacheControl: 'public, max-age=31536000'
    };
    
    await uploadBytes(storageRef, file, metadata);
    const downloadURL = await getDownloadURL(storageRef);
    
    // Add token to URL to ensure access
    imageUrls.push(downloadURL);
    console.log("Image uploaded:", downloadURL);
  } catch (uploadErr) {
    console.error("Image upload error:", uploadErr);
    throw new Error(`Failed to upload image ${i + 1}: ${uploadErr.message}`);
  }
}

const phoneInput = document.getElementById("seller-phone");
const sellerPhone = phoneInput ? phoneInput.value.trim() : "";

const productData = {
  name: titleInput.value.trim(),
  price: Number(priceInput.value),
  category: selectedCategory,
  description: descInput.value.trim(),
  location: locationInput.value,
  images: imageUrls,
  seller: {
    name: currentUser.email.split("@")[0],
    phone: sellerPhone, // ✅ NOW HAS PHONE!
    location: locationInput.value
  }
};

    const docRef = await addDoc(collection(db, "products"), productData);

    // 3. Success - show message and offer boost
const boostConfirm = confirm(
  "✅ Ad posted successfully!\n\n" +
  "Want to boost it to featured section?\n\n" +
  "⭐ 7 Days - UGX 5,000\n" +
  "⭐ 14 Days - UGX 8,000\n" +
  "⭐ 30 Days - UGX 15,000\n\n" +
  "Click OK to boost, Cancel to skip"
);

// Clear form
titleInput.value = "";
descInput.value = "";
priceInput.value = "";
locationInput.value = "";
uploadedImages = [];
selectedCategory = "";
currentStep = 1;

if (boostConfirm) {
  // Redirect to boost page with product ID
  setTimeout(() => {
    window.location.href = `boost-product.html?productId=${docRef.id}`;
  }, 500);
} else {
  // Just redirect to dashboard
  setTimeout(() => {
    window.location.href = `dashboard.html?tab=my-ads`;
  }, 1500);
}
  } catch (err) {
    console.error("Upload error:", err);
    alert("❌ Error posting ad: " + err.message);
    btn.textContent = "Post My Ad 🚀";
    btn.disabled = false;
  }
};