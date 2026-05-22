// ============================================
// ZiBuy — Post Ad Page
// ============================================

let currentStep = 1;
let selectedCategory = "";
let uploadedImages = [];

// ============================================
// CATEGORY SELECTION
// ============================================

window.selectCategory = function(category) {

  selectedCategory = category;

  // remove previous active state
  document.querySelectorAll(".cat-card").forEach(card => {
    card.classList.remove("selected");
  });

  // highlight clicked category
  event.currentTarget.classList.add("selected");

  // enable continue button
  document.getElementById("step1-next").disabled = false;

  console.log("Selected category:", category);
};

// ============================================
// NEXT STEP
// ============================================

window.nextStep = function() {

  if (currentStep >= 4) return;

  document
    .getElementById(`step-${currentStep}-content`)
    .classList.remove("active");

  currentStep++;

  document
    .getElementById(`step-${currentStep}-content`)
    .classList.add("active");

  document.getElementById("current-step").textContent = currentStep;

  // update indicators
  document
    .getElementById(`step-${currentStep}`)
    .classList.add("active");

  if (currentStep > 1) {
    document
      .getElementById(`line-${currentStep - 1}`)
      .classList.add("active");
  }

  // fill review step
  if (currentStep === 4) {
    updateReview();
  }
};

// ============================================
// PREVIOUS STEP
// ============================================

window.prevStep = function() {

  if (currentStep <= 1) return;

  document
    .getElementById(`step-${currentStep}-content`)
    .classList.remove("active");

  document
    .getElementById(`step-${currentStep}`)
    .classList.remove("active");

  if (currentStep > 1) {
    document
      .getElementById(`line-${currentStep - 1}`)
      .classList.remove("active");
  }

  currentStep--;

  document
    .getElementById(`step-${currentStep}-content`)
    .classList.add("active");

  document.getElementById("current-step").textContent = currentStep;
};

// ============================================
// IMAGE UPLOAD
// ============================================

window.handleImageUpload = function(event) {

  const files = Array.from(event.target.files);

  uploadedImages = files.slice(0, 5);

  document.getElementById("image-count").textContent =
    uploadedImages.length;

  const previewContainer = document.getElementById(
    "image-preview-container"
  );

  previewContainer.innerHTML = "";

  uploadedImages.forEach(file => {

    const reader = new FileReader();

    reader.onload = function(e) {

      previewContainer.innerHTML += `
        <div class="image-preview">
          <img src="${e.target.result}" alt="preview">
        </div>
      `;
    };

    reader.readAsDataURL(file);
  });

  document.getElementById("step3-next").disabled =
    uploadedImages.length === 0;
};

// ============================================
// REVIEW UPDATE
// ============================================

function updateReview() {

  document.getElementById("review-cat").textContent =
    selectedCategory;

  document.getElementById("review-title").textContent =
    document.getElementById("ad-title").value;

  document.getElementById("review-price").textContent =
    "UGX " +
    Number(document.getElementById("ad-price").value)
      .toLocaleString();

  document.getElementById("review-location").textContent =
    document.getElementById("ad-location").value;

  document.getElementById("review-desc").textContent =
    document.getElementById("ad-description").value;

  if (uploadedImages.length > 0) {

    const reader = new FileReader();

    reader.onload = function(e) {

      document.getElementById("review-image").innerHTML =
        `<img src="${e.target.result}" alt="preview">`;
    };

    reader.readAsDataURL(uploadedImages[0]);
  }
}

// ============================================
// SUBMIT AD
// ============================================

window.submitAd = async function() {

  alert("Ad posting system ready.");

  console.log({
    category: selectedCategory,
    title: document.getElementById("ad-title").value,
    description: document.getElementById("ad-description").value,
    price: document.getElementById("ad-price").value,
    location: document.getElementById("ad-location").value,
    images: uploadedImages
  });
};