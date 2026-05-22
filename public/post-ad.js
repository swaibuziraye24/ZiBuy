// ============================================
// ZiBuy — Post Ad Page
// ============================================

let currentStep = 1;
let selectedCategory = "";
let uploadedImages = [];

// ============================================
// STEP 2 INPUTS
// ============================================

const titleInput = document.getElementById("ad-title");
const descInput = document.getElementById("ad-description");
const priceInput = document.getElementById("ad-price");
const locationInput = document.getElementById("ad-location");

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

  document
    .getElementById(`step-${currentStep}-content`)
    .classList.remove("active");

  currentStep++;

  document
    .getElementById(`step-${currentStep}-content`)
    .classList.add("active");

  document.getElementById("current-step").textContent =
    currentStep;

  document
    .getElementById(`step-${currentStep}`)
    .classList.add("active");

  if (currentStep > 1) {

    document
      .getElementById(`line-${currentStep - 1}`)
      .classList.add("active");
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

  document.getElementById("current-step").textContent =
    currentStep;
};

// ============================================
// STEP 2 VALIDATION
// ============================================

function validateStep2() {

  const title = titleInput.value.trim();
  const desc = descInput.value.trim();
  const price = priceInput.value.trim();
  const location = locationInput.value;

  const valid =
    title !== "" &&
    desc !== "" &&
    price !== "" &&
    location !== "";

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

  document.getElementById("title-count").textContent =
    titleInput.value.length;
});

descInput.addEventListener("input", () => {

  document.getElementById("desc-count").textContent =
    descInput.value.length;
});

// ============================================
// IMAGE UPLOAD
// ============================================

window.handleImageUpload = function(event) {

  const files = Array.from(event.target.files);

  uploadedImages = files.slice(0, 5);

  document.getElementById("image-count").textContent =
    uploadedImages.length;

  const previewContainer =
    document.getElementById("image-preview-container");

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
    uploadedImages.length < 1;
};

// ============================================
// REVIEW STEP
// ============================================

function updateReview() {

  document.getElementById("review-cat").textContent =
    selectedCategory;

  document.getElementById("review-title").textContent =
    titleInput.value;

  document.getElementById("review-price").textContent =
    "UGX " + Number(priceInput.value).toLocaleString();

  document.getElementById("review-location").textContent =
    locationInput.value;

  document.getElementById("review-desc").textContent =
    descInput.value;

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

  alert("Ad submitted successfully!");

  console.log({
    category: selectedCategory,
    title: titleInput.value,
    description: descInput.value,
    price: priceInput.value,
    location: locationInput.value,
    images: uploadedImages
  });
};