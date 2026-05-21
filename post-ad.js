// ============================================
//   ZiBuy — Post Ad Module
// ============================================

import {
  db, storage, auth,
  collection, addDoc, query, where, getDocs
} from "./firebase.js";

import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { showToast, renderCart } from "./app.js";

// ============ State ============
let currentStep = 1;
let selectedCategory = null;
let uploadedImages = [];

// ============ Auth Check ============
onAuthStateChanged(auth, (user) => {
  if (!user) {
    // Redirect to home if not logged in
    document.body.innerHTML = `
      <div style="text-align:center;padding:60px 20px">
        <h2>You must be logged in to post an ad</h2>
        <p style="color:#6b7280;margin:20px 0">Sign in to your account first</p>
        <button class="btn btn-orange" onclick="window.location.href='index.html'" style="padding:14px 28px;font-size:16px">
          Go to ZiBuy Home
        </button>
      </div>
    `;
    return;
  }

  // User is logged in, show the form
  const accountBtn = document.getElementById("account-btn");
  if (accountBtn) {
    const name = user.email.split("@")[0];
    accountBtn.textContent = "👤 " + name;
  }
});

// ============ STEP 1: CATEGORY ============

window.selectCategory = function(category) {
  selectedCategory = category;

  // Update button styles
  document.querySelectorAll(".cat-card").forEach(btn => {
    btn.classList.remove("selected");
  });
  event.target.closest(".cat-card").classList.add("selected");

  // Enable next button
  document.getElementById("step1-next").disabled = false;
};

// ============ STEP 2: DETAILS ============

document.getElementById("ad-title")?.addEventListener("input", (e) => {
  const count = e.target.value.length;
  document.getElementById("title-count").textContent = count;
  validateStep2();
});

document.getElementById("ad-description")?.addEventListener("input", (e) => {
  const count = e.target.value.length;
  document.getElementById("desc-count").textContent = count;
});

document.getElementById("ad-price")?.addEventListener("input", validateStep2);
document.getElementById("ad-location")?.addEventListener("change", validateStep2);

function validateStep2() {
  const title    = document.getElementById("ad-title").value.trim();
  const price    = document.getElementById("ad-price").value.trim();
  const location = document.getElementById("ad-location").value;

  const isValid = title && price && location;
  document.getElementById("step2-next").disabled = !isValid;
}

// ============ STEP 3: IMAGES ============

window.handleImageUpload = function(event) {
  const files = Array.from(event.target.files);

  if (uploadedImages.length + files.length > 5) {
    showToast("Maximum 5 photos allowed", "error");
    return;
  }

  files.forEach(file => {
    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      uploadedImages.push({
        file,
        preview: e.target.result
      });
      renderImagePreviews();
    };
    reader.readAsDataURL(file);
  });
};

function renderImagePreviews() {
  const container = document.getElementById("image-preview-container");
  container.innerHTML = "";

  uploadedImages.forEach((img, index) => {
    const div = document.createElement("div");
    div.className = "image-preview-item";
    div.innerHTML = `
      <img src="${img.preview}" alt="Preview ${index + 1}">
      ${index === 0 ? '<span class="cover-badge">Cover Photo</span>' : ''}
      <button class="remove-img-btn" onclick="removeImage(${index})">×</button>
    `;
    container.appendChild(div);
  });

  document.getElementById("image-count").textContent = uploadedImages.length;

  // Enable next button if at least 1 image
  document.getElementById("step3-next").disabled = uploadedImages.length === 0;
}

window.removeImage = function(index) {
  uploadedImages.splice(index, 1);
  renderImagePreviews();
};

// Drag and drop
const fileUploadArea = document.getElementById("file-upload-area");
if (fileUploadArea) {
  fileUploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    fileUploadArea.style.borderColor = "var(--orange)";
    fileUploadArea.style.background = "var(--orange-lt)";
  });

  fileUploadArea.addEventListener("dragleave", () => {
    fileUploadArea.style.borderColor = "#e5e7eb";
    fileUploadArea.style.background = "white";
  });

  fileUploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    fileUploadArea.style.borderColor = "#e5e7eb";
    fileUploadArea.style.background = "white";
    const fileInput = document.getElementById("ad-images");
    fileInput.files = e.dataTransfer.files;
    handleImageUpload({ target: fileInput });
  });
}

// ============ STEP NAVIGATION ============

window.nextStep = function() {
  if (currentStep === 1 && !selectedCategory) {
    showToast("Please select a category", "error");
    return;
  }

  if (currentStep === 2) {
    const title    = document.getElementById("ad-title").value.trim();
    const price    = document.getElementById("ad-price").value.trim();
    const location = document.getElementById("ad-location").value;

    if (!title || !price || !location) {
      showToast("Please fill in all fields", "error");
      return;
    }
  }

  if (currentStep === 3 && uploadedImages.length === 0) {
    showToast("Please upload at least 1 photo", "error");
    return;
  }

  if (currentStep === 4) return; // Last step

  // Hide current step
  document.getElementById(`step-${currentStep}-content`).classList.remove("active");

  // Show next step
  currentStep++;
  document.getElementById(`step-${currentStep}-content`).classList.add("active");

  // Update step indicators
  updateStepIndicators();

  // Update review if on step 4
  if (currentStep === 4) {
    updateReview();
  }

  // Scroll to top
  window.scrollTo(0, 0);
};

window.prevStep = function() {
  if (currentStep === 1) return;

  document.getElementById(`step-${currentStep}-content`).classList.remove("active");
  currentStep--;
  document.getElementById(`step-${currentStep}-content`).classList.add("active");

  updateStepIndicators();
  window.scrollTo(0, 0);
};

function updateStepIndicators() {
  document.getElementById("current-step").textContent = currentStep;

  for (let i = 1; i <= 4; i++) {
    const indicator = document.getElementById(`step-${i}`);
    if (i < currentStep) {
      indicator.classList.add("completed");
    } else if (i === currentStep) {
      indicator.classList.remove("completed");
      indicator.classList.add("active");
    } else {
      indicator.classList.remove("active", "completed");
    }

    const line = document.getElementById(`line-${i}`);
    if (line) {
      if (i < currentStep) {
        line.classList.add("completed");
      } else {
        line.classList.remove("completed");
      }
    }
  }
}

// ============ REVIEW ============

function updateReview() {
  const title       = document.getElementById("ad-title").value;
  const desc        = document.getElementById("ad-description").value;
  const price       = document.getElementById("ad-price").value;
  const location    = document.getElementById("ad-location").value;
  const category    = selectedCategory;

  document.getElementById("review-cat").textContent = category.charAt(0).toUpperCase() + category.slice(1);
  document.getElementById("review-title").textContent = title;
  document.getElementById("review-price").textContent = "UGX " + Number(price).toLocaleString();
  document.getElementById("review-location").textContent = "📍 " + location;
  document.getElementById("review-desc").textContent = desc || "No description provided";

  // Show first image
  if (uploadedImages.length > 0) {
    document.getElementById("review-image").innerHTML = `
      <img src="${uploadedImages[0].preview}" alt="Cover">
      <span style="position:absolute;bottom:10px;right:10px;background:var(--orange);color:white;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:700">${uploadedImages.length} photo${uploadedImages.length > 1 ? 's' : ''}</span>
    `;
  }
}

// ============ SUBMIT AD ============

window.submitAd = async function() {
  const submitBtn = document.getElementById("submit-btn");
  submitBtn.textContent = "Posting...";
  submitBtn.disabled = true;

  try {
    // Check if user is logged in
    if (!auth.currentUser) {
      showToast("You must be logged in to post", "error");
      submitBtn.textContent = "Post My Ad 🚀";
      submitBtn.disabled = false;
      return;
    }

    const title       = document.getElementById("ad-title").value.trim();
    const desc        = document.getElementById("ad-description").value.trim();
    const price       = document.getElementById("ad-price").value.trim();
    const location    = document.getElementById("ad-location").value;
    const category    = selectedCategory;

    // Upload all images
    let imageUrls = [];
    for (const imgObj of uploadedImages) {
      const storageRef = ref(storage, `user-ads/${auth.currentUser.uid}/${Date.now()}_${imgObj.file.name}`);
      await uploadBytes(storageRef, imgObj.file);
      const url = await getDownloadURL(storageRef);
      imageUrls.push(url);
    }

    // Save ad to Firestore
    await addDoc(collection(db, "products"), {
      name:        title,
      description: desc,
      price:       Number(price),
      category,
      location,
      images:      imageUrls,
      seller: {
        name:     auth.currentUser.email.split("@")[0],
        phone:    "", // User can add later in dashboard
        location: location
      },
      userId:      auth.currentUser.uid,
      userEmail:   auth.currentUser.email,
      isUserPost:  true,
      status:      "active",
      views:       0,
      createdAt:   new Date(),
      expiresAt:   new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    });

    showToast("Your ad posted successfully! 🎉", "success");

    // Redirect after 2 seconds
    setTimeout(() => {
      window.location.href = "index.html";
    }, 2000);

  } catch (err) {
    console.error(err);
    showToast("Failed to post ad: " + err.message, "error");
    submitBtn.textContent = "Post My Ad 🚀";
    submitBtn.disabled = false;
  }
};

// ============ IMPORT APP.JS FUNCTIONS ============
// Cart functionality
import "./app.js";