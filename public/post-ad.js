// ============================================
// ZiBuy — Post Ad Page
// ============================================

import { db, auth, collection, addDoc, storage } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import {
  getDocs,
  query,
  where,
  getDoc,
  doc
} from "./firebase.js";

import {
  canUserPost
} from "./subscription-check.js";

import { updateDoc } from "./firebase.js";

let currentStep = 1;
let selectedCategory = "";
let uploadedImages = [];
let currentUser = null;
const productId = new URLSearchParams(window.location.search).get("id"); // ← add this

// Check if user is logged in
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  

onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.href = "index.html"; return; }
  currentUser = user;
  if (productId) loadProductPreview();

  // Enable plan selection only after auth confirmed
  document.querySelectorAll(".boost-plan-card").forEach(card => {
    card.style.opacity  = "1";
    card.style.pointerEvents = "auto";
  });
});

// Disable cards until auth confirmed
document.querySelectorAll(".boost-plan-card").forEach(card => {
  card.style.opacity  = "0.5";
  card.style.pointerEvents = "none";
});


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

  // Pre-render category-specific fields ready for Step 2
  renderCategoryFields(category);



  const container =
    document.getElementById("subcategory-container");

  const select =
    document.getElementById("subcategory-select");

  select.innerHTML =
    '<option value="">Select Subcategory</option>';

  const list =
    SUBCATEGORIES[category] || [];

  if (list.length) {

    container.style.display = "block";

    list.forEach(item => {

      const option =
        document.createElement("option");

      option.value = item;
      option.textContent = item;

      select.appendChild(option);

    });

  } else {

    container.style.display = "none";

  }

};

// ============================================
// NEXT STEP
// ============================================

let selectedSubcategory = "";

const SUBCATEGORIES = {

  phones: [
    "Smartphones",
    "Feature Phones",
    "Tablets",
    "Chargers",
    "Power Banks",
    "Phone Cases",
    "Screen Protectors",
    "Phone Accessories"
  ],

  electronics: [
    "Televisions",
    "Speakers",
    "Headphones",
    "Cameras",
    "Projectors",
    "Audio Systems",
    "Electronic Accessories"
  ],

  fashion: [
    "Men's Clothing",
    "Women's Clothing",
    "Children's Clothing",
    "Traditional Wear",
    "Sportswear",
    "Underwear",
    "Fashion Accessories"
  ],

  shoes: [
    "Men's Shoes",
    "Women's Shoes",
    "Children's Shoes",
    "Sports Shoes",
    "Boots",
    "Sandals",
    "Slippers"
  ],

  beauty: [
    "Makeup",
    "Skincare",
    "Hair Care",
    "Perfumes",
    "Beauty Tools",
    "Personal Care"
  ],

  bags: [
    "Handbags",
    "Backpacks",
    "Travel Bags",
    "School Bags",
    "Laptop Bags",
    "Wallets"
  ],

  groceries: [
    "Food",
    "Drinks",
    "Snacks",
    "Cooking Ingredients",
    "Fresh Produce",
    "Household Supplies"
  ],

  watches: [
    "Men's Watches",
    "Women's Watches",
    "Smart Watches",
    "Luxury Watches",
    "Watch Accessories"
  ],

  computers: [
    "Laptops",
    "Desktop Computers",
    "Monitors",
    "Printers",
    "Computer Accessories",
    "Networking Equipment"
  ],

  gaming: [
    "Gaming Consoles",
    "Video Games",
    "Gaming Accessories",
    "Gaming PCs",
    "Gaming Chairs"
  ],

  home: [
    "Furniture",
    "Home Appliances",
    "Kitchen Appliances",
    "Kitchenware & Cookware",
    "Lighting",
    "Garden Supplies",
    "Household Chemicals",
    "Home Accessories"
  ],

  accessories: [
    "Jewelry",
    "Sunglasses",
    "Belts",
    "Hats",
    "Scarves",
    "Fashion Accessories"
  ],

  vehicles: [
    "Cars",
    "Motorcycles",
    "Trucks",
    "Buses",
    "SUVs",
    "Vehicle Accessories"
  ],

  "motor-equipment": [
    "Engine Parts",
    "Tyres",
    "Batteries",
    "Lubricants",
    "Motor Accessories",
    "Spare Parts"
  ],

  services: [
    "Cleaning",
    "Repairs",
    "Transport",
    "Photography",
    "Graphic Design",
    "Programming",
    "Construction",
    "Other Services"
  ],

  "babies-kids": [
    "Baby Clothing",
    "Toys",
    "Baby Gear",
    "School Supplies",
    "Children's Furniture"
  ],

  "animals-pets": [
    "Dogs",
    "Cats",
    "Birds",
    "Fish",
    "Pet Food",
    "Pet Accessories"
  ],

  agriculture: [
    "Seeds",
    "Fertilizers",
    "Farm Machinery",
    "Livestock",
    "Animal Feed",
    "Agricultural Tools"
  ],

  "commercial-equipment": [
    "Industrial Machines",
    "Restaurant Equipment",
    "Shop Equipment",
    "Office Equipment",
    "Manufacturing Equipment"
  ],

  "tours-leisure": [
    "Travel Packages",
    "Hotels",
    "Tour Services",
    "Camping Equipment",
    "Sports Equipment"
  ],

  "seeking-work": [
    "Full-Time Jobs",
    "Part-Time Jobs",
    "Remote Jobs",
    "Internships",
    "Freelance Opportunities"
  ]

};

document
  .getElementById("subcategory-select")
  .addEventListener("change", (e) => {

    selectedSubcategory = e.target.value;

  });

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

// ============================================
// CATEGORY-SPECIFIC FIELD DEFINITIONS
// ============================================

const CATEGORY_FIELDS = {

  phones: [
    { id: "cf-brand",     label: "Brand",           type: "select",
      options: ["Samsung","iPhone/Apple","Tecno","Itel","Infinix","Huawei","Nokia","Oppo","Xiaomi","Other"] },
    { id: "cf-condition", label: "Condition",        type: "select",
      options: ["Brand New","Foreign Used (UK)","Foreign Used (Dubai)","Local Used"] },
    { id: "cf-storage",   label: "Storage",          type: "select",
      options: ["16GB","32GB","64GB","128GB","256GB","512GB","1TB","Other"] },
    { id: "cf-ram",       label: "RAM",              type: "select",
      options: ["1GB","2GB","3GB","4GB","6GB","8GB","12GB","16GB","Other"] },
    { id: "cf-network",   label: "Network",          type: "select",
      options: ["4G LTE","5G","3G","Dual SIM"] },
    { id: "cf-warranty",  label: "Warranty",         type: "select",
      options: ["No Warranty","Shop Warranty (1 month)","Shop Warranty (3 months)","Manufacturer Warranty"] },
  ],

  electronics: [
    { id: "cf-type",      label: "Type",             type: "select",
      options: ["TV","Speaker","Camera","Laptop","Tablet","Radio","DVD Player","Decoder","Generator","Other"] },
    { id: "cf-brand",     label: "Brand",            type: "select",
      options: ["Samsung","LG","Sony","Hisense","TCL","Panasonic","Canon","Nikon","HP","Dell","Other"] },
    { id: "cf-condition", label: "Condition",        type: "select",
      options: ["Brand New","Foreign Used","Local Used"] },
    { id: "cf-warranty",  label: "Warranty",         type: "select",
      options: ["No Warranty","Shop Warranty","Manufacturer Warranty"] },
  ],

  vehicles: [
    { id: "cf-make",      label: "Make / Brand",     type: "select",
      options: ["Toyota","Nissan","Honda","Suzuki","Mitsubishi","Mercedes","BMW","Land Rover","Isuzu","Tata","Other"] },
    { id: "cf-year",      label: "Year of Manufacture", type: "select",
      options: ["2024","2023","2022","2021","2020","2019","2018","2017","2016","2015","2014","2013","2012","Before 2012"] },
    { id: "cf-condition", label: "Condition",        type: "select",
      options: ["Brand New","Foreign Used","Local Used"] },
    { id: "cf-transmission", label: "Transmission",  type: "select",
      options: ["Automatic","Manual"] },
    { id: "cf-fuel",      label: "Fuel Type",        type: "select",
      options: ["Petrol","Diesel","Electric","Hybrid"] },
    { id: "cf-mileage",   label: "Mileage (km)",     type: "text",  placeholder: "e.g. 45000" },
    { id: "cf-color",     label: "Color",            type: "text",  placeholder: "e.g. Silver" },
    { id: "cf-drive",     label: "Drive",            type: "select",
      options: ["Right Hand Drive","Left Hand Drive"] },
  ],

  fashion: [
    { id: "cf-condition", label: "Condition",        type: "select",
      options: ["Brand New","Foreign Used","Local Used","Thrift (Mitumba)"] },
    { id: "cf-gender",    label: "For",              type: "select",
      options: ["Men","Women","Unisex","Kids"] },
    { id: "cf-size",      label: "Size",             type: "select",
      options: ["XS","S","M","L","XL","XXL","3XL","Free Size","Other"] },
    { id: "cf-material",  label: "Material",         type: "text",  placeholder: "e.g. Cotton, Polyester" },
  ],

  shoes: [
    { id: "cf-condition", label: "Condition",        type: "select",
      options: ["Brand New","Foreign Used","Local Used"] },
    { id: "cf-gender",    label: "For",              type: "select",
      options: ["Men","Women","Unisex","Kids"] },
    { id: "cf-size",      label: "Shoe Size",        type: "select",
      options: ["36","37","38","39","40","41","42","43","44","45","46","47"] },
    { id: "cf-brand",     label: "Brand",            type: "select",
      options: ["Nike","Adidas","Puma","Vans","Timberland","Bata","Converse","Other"] },
  ],

  home: [
    { id: "cf-type",      label: "Item Type",        type: "select",
      options: ["Sofa / Furniture","Bed / Mattress","Kitchen Appliance","Fridge / Freezer","Washing Machine","Curtains","Carpet","Decoration","Other"] },
    { id: "cf-condition", label: "Condition",        type: "select",
      options: ["Brand New","Foreign Used","Local Used"] },
    { id: "cf-brand",     label: "Brand (optional)", type: "text",  placeholder: "e.g. Mika, Ramtons" },
  ],

  beauty: [
    { id: "cf-type",      label: "Product Type",     type: "select",
      options: ["Skincare","Haircare","Makeup","Perfume","Nail Care","Body Lotion","Soap","Other"] },
    { id: "cf-condition", label: "Condition",        type: "select",
      options: ["Brand New","Open Box"] },
    { id: "cf-brand",     label: "Brand",            type: "text",  placeholder: "e.g. Nivea, Neutrogena" },
    { id: "cf-origin",    label: "Made In",          type: "select",
      options: ["Uganda","Kenya","South Africa","UK","USA","China","Other"] },
  ],

  computers: [
    { id: "cf-type",      label: "Type",             type: "select",
      options: ["Laptop","Desktop PC","MacBook","Tablet","Monitor","Printer","Keyboard/Mouse","Other"] },
    { id: "cf-brand",     label: "Brand",            type: "select",
      options: ["HP","Dell","Lenovo","Apple","Asus","Acer","Samsung","Toshiba","Other"] },
    { id: "cf-condition", label: "Condition",        type: "select",
      options: ["Brand New","Foreign Used","Local Used"] },
    { id: "cf-ram",       label: "RAM",              type: "select",
      options: ["2GB","4GB","8GB","16GB","32GB","Other"] },
    { id: "cf-storage",   label: "Storage",          type: "select",
      options: ["128GB","256GB","512GB","1TB","2TB","Other"] },
    { id: "cf-processor", label: "Processor",        type: "select",
      options: ["Intel Core i3","Intel Core i5","Intel Core i7","Intel Core i9","AMD Ryzen 3","AMD Ryzen 5","AMD Ryzen 7","Apple M1","Apple M2","Other"] },
  ],

  gaming: [
    { id: "cf-platform",  label: "Platform",         type: "select",
      options: ["PlayStation 5","PlayStation 4","Xbox Series X","Xbox One","Nintendo Switch","PC Gaming","Mobile Gaming","Other"] },
    { id: "cf-type",      label: "Item Type",        type: "select",
      options: ["Console","Controller","Game (CD/Digital)","Gaming Chair","Headset","Monitor","Other"] },
    { id: "cf-condition", label: "Condition",        type: "select",
      options: ["Brand New","Foreign Used","Local Used"] },
  ],

  services: [
    { id: "cf-service-type", label: "Service Type",  type: "select",
      options: ["Plumbing","Electrical","Construction","Cleaning","Painting","Salon & Beauty","Photography","Catering","Transport","Teaching/Tutoring","IT & Tech","Event Planning","Design","Legal","Medical","Other"] },
    { id: "cf-experience",   label: "Experience",    type: "select",
      options: ["Less than 1 year","1–2 years","3–5 years","5–10 years","10+ years"] },
    { id: "cf-availability", label: "Availability",  type: "select",
      options: ["Full Time","Part Time","Weekdays Only","Weekends Only","Flexible"] },
    { id: "cf-delivery",     label: "Can Travel To Client?", type: "select",
      options: ["Yes – I come to you","No – Client comes to me","Both options available"] },
  ],

  agriculture: [
    { id: "cf-type",      label: "Product Type",     type: "select",
      options: ["Crops / Produce","Livestock","Poultry","Fish","Seeds","Fertilizer","Farm Equipment","Land","Other"] },
    { id: "cf-condition", label: "Condition",        type: "select",
      options: ["Fresh","Dried / Processed","Brand New Equipment","Used Equipment"] },
    { id: "cf-quantity",  label: "Quantity / Unit",  type: "text",  placeholder: "e.g. 1 tonne, 50 bags, 100 birds" },
  ],

  bags: [
    { id: "cf-type",      label: "Bag Type",         type: "select",
      options: ["Handbag","Backpack","Laptop Bag","Travel Bag","School Bag","Clutch","Wallet","Other"] },
    { id: "cf-condition", label: "Condition",        type: "select",
      options: ["Brand New","Foreign Used","Local Used"] },
    { id: "cf-brand",     label: "Brand",            type: "select",
      options: ["Gucci","Louis Vuitton","Nike","Adidas","Local Brand","No Brand","Other"] },
    { id: "cf-material",  label: "Material",         type: "select",
      options: ["Leather","Canvas","Nylon","Polyester","Other"] },
  ],

  watches: [
    { id: "cf-brand",     label: "Brand",            type: "select",
      options: ["Casio","Rolex","Seiko","Citizen","Fossil","Hublot","Tag Heuer","No Brand","Other"] },
    { id: "cf-condition", label: "Condition",        type: "select",
      options: ["Brand New","Foreign Used","Local Used"] },
    { id: "cf-gender",    label: "For",              type: "select",
      options: ["Men","Women","Unisex","Kids"] },
    { id: "cf-type",      label: "Type",             type: "select",
      options: ["Analog","Digital","Smart Watch","Sports Watch"] },
  ],

  groceries: [
    { id: "cf-type",      label: "Product Type",     type: "select",
      options: ["Rice","Maize Flour","Cooking Oil","Sugar","Beans","Meat","Fish","Vegetables","Fruits","Bread","Beverages","Dairy","Other"] },
    { id: "cf-origin",    label: "Origin",           type: "select",
      options: ["Uganda Made","Imported","Organic / Farm Fresh"] },
    { id: "cf-quantity",  label: "Quantity / Unit",  type: "text",  placeholder: "e.g. 1kg, 5 litres, 1 crate" },
  ],

  accessories: [
    { id: "cf-type",      label: "Accessory Type",   type: "select",
      options: ["Jewellery","Sunglasses","Belt","Hat/Cap","Scarf","Tie","Bracelet","Necklace","Earrings","Other"] },
    { id: "cf-condition", label: "Condition",        type: "select",
      options: ["Brand New","Foreign Used","Local Used"] },
    { id: "cf-material",  label: "Material",         type: "select",
      options: ["Gold","Silver","Stainless Steel","Plastic","Leather","Fabric","Other"] },
  ],
};

// ============================================
// STEP 2 INPUTS
// ============================================

const titleInput    = document.getElementById("ad-title");
const descInput     = document.getElementById("ad-description");
const priceInput    = document.getElementById("ad-price");
const locationInput = document.getElementById("ad-location");

// ============================================
// RENDER CATEGORY-SPECIFIC FIELDS
// ============================================

function renderCategoryFields(category) {
  const container = document.getElementById("category-fields");
  if (!container) return;

  const fields = CATEGORY_FIELDS[category] || [];

  if (fields.length === 0) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <div style="border-top:1.5px solid #f0f0f0;margin:12px 0 16px"></div>
    <p style="font-size:13px;font-weight:800;color:#ff6600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:14px">
      📋 ${category.charAt(0).toUpperCase()+category.slice(1)} Details
    </p>
    ${fields.map(f => `
      <div style="margin-bottom:12px">
        <label style="display:block;font-size:12px;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">
          ${f.label}
        </label>
        ${f.type === "select" ? `
          <select id="${f.id}" style="width:100%;padding:13px 14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:14px;font-family:var(--font);outline:none;background:white;transition:border-color .2s" onfocus="this.style.borderColor='#ff6600'" onblur="this.style.borderColor='#e5e7eb'">
            <option value="">Select ${f.label}</option>
            ${f.options.map(o => `<option value="${o}">${o}</option>`).join("")}
          </select>
        ` : `
          <input type="text" id="${f.id}" placeholder="${f.placeholder || ""}"
            style="width:100%;padding:13px 14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:14px;font-family:var(--font);outline:none;background:white;box-sizing:border-box;transition:border-color .2s"
            onfocus="this.style.borderColor='#ff6600'" onblur="this.style.borderColor='#e5e7eb'">
        `}
      </div>
    `).join("")}
  `;
}

// Collect category field values to save with the ad
function collectCategoryFields(category) {
  const fields = CATEGORY_FIELDS[category] || [];
  const data   = {};
  fields.forEach(f => {
    const el = document.getElementById(f.id);
    if (el && el.value) data[f.id.replace("cf-", "")] = el.value;
  });
  return data;
}

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

  const files = Array.from(event.target.files || []);

  if (!files.length) return;

  // Slice to max 5
  uploadedImages = files.slice(0, 5);

  document.getElementById("image-count").textContent =
    uploadedImages.length;

  const previewContainer =
    document.getElementById("image-preview-container");

  previewContainer.innerHTML = "";

  // Use Promise-based reading so all images load reliably on mobile
  const readPromises = uploadedImages.map((file, index) => {
    return new Promise((resolve) => {
      const reader = new FileReader();

      reader.onload = function(e) {
        const div = document.createElement("div");
        div.className = "image-preview";
        div.style.cssText = "position:relative;display:inline-block;margin:4px";

        const img = document.createElement("img");
        img.src   = e.target.result;
        img.alt   = `preview ${index + 1}`;
        img.style.cssText = "width:80px;height:80px;object-fit:cover;border-radius:10px;border:2px solid #e5e7eb;display:block";

        // Cover badge on first image
        if (index === 0) {
          const badge = document.createElement("span");
          badge.textContent = "Cover";
          badge.style.cssText = "position:absolute;top:4px;left:4px;background:#ff6600;color:white;font-size:9px;font-weight:800;padding:2px 5px;border-radius:4px";
          div.appendChild(badge);
        }

        div.appendChild(img);
        previewContainer.appendChild(div);
        resolve();
      };

      reader.onerror = function() {
        console.warn("Failed to read file:", file.name);
        resolve(); // don't block others
      };

      reader.readAsDataURL(file);
    });
  });

  Promise.all(readPromises).then(() => {
    // Scroll to preview so user sees the images
    previewContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });

    // Enable next button
    document.getElementById("step3-next").disabled = false;
  });
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
  document.getElementById("review-subcat").textContent = selectedSubcategory;
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

  // ── 1. Check banned status ──────────────────
  let userDoc = null;
  try {
    const userSnap = await getDoc(doc(db, "users", currentUser.uid));
    if (userSnap.exists()) userDoc = userSnap.data();
  } catch (err) {
    console.warn("User fetch failed:", err);
  }

  if (userDoc?.banned === true) {
    alert("⚠️ Your ZiBuy account has been restricted due to policy violations.");
    return;
  }

  // ── SUBSCRIPTION CHECK ─────────────────
try {

  const check =
    await canUserPost(currentUser.uid);

  if (!check.allowed) {

    alert(
      `⚠️ Your ${check.plan} plan has reached its ad limit.`
    );

    window.location.href =
      "business-plans.html";

    return;
  }

} catch (err) {

  console.error("Subscription check failed:", err);
  return;
}

  // ── 3. Lock button ──────────────────────────
  const btn = document.getElementById("submit-ad-btn");
  if (btn) {
    btn.textContent = "Publishing...";
    btn.disabled = true;
  }


  const { getActiveSubscription } =
  await import("./subscription-check.js");

const sub =
  await getActiveSubscription(currentUser.uid);

const limit =
  sub.details.images || 3;

if (uploadedImages.length > limit) {

  alert(
    `❌ You can only upload ${limit} images on your plan`
  );

  return;
}

  try {
    // ── 4. Upload images ────────────────────────
    const imageUrls = [];

    for (let i = 0; i < uploadedImages.length; i++) {
      const file      = uploadedImages[i];
      const fileName  = `products/${currentUser.uid}/${Date.now()}-${i}-${file.name}`;
      const storageRef = ref(storage, fileName);

      try {
        await uploadBytes(storageRef, file, {
          contentType: file.type,
          cacheControl: "public, max-age=31536000"
        });
        imageUrls.push(await getDownloadURL(storageRef));
      } catch (uploadErr) {
        throw new Error(`Failed to upload image ${i + 1}: ${uploadErr.message}`);
      }
    }

    // ── 5. Build product object ─────────────────
    const sellerPhone = document.getElementById("seller-phone")?.value.trim() || "";

// ── PLAN AD EXPIRY ───────────────────────

// ── PLAN AD EXPIRY ───────────────────────
const plan = sub.details;
const adDays = plan.adDays || 30;

const expiresAt = new Date();
expiresAt.setDate(expiresAt.getDate() + adDays);

    const productData = {
      name:        titleInput.value.trim(),
      price:       Number(priceInput.value),
      category:    selectedCategory,
      subcategory: selectedSubcategory || "",
      description: descInput.value.trim(),
      location:    locationInput.value,
      images:      imageUrls,
      userId:      currentUser.uid,
      userEmail:   currentUser.email,
      status: "active",
views: 0,

boost: {
  active: false,
  startDate: null,
  endDate: null,
  type: null // 7d, 14d, 30d
},
      createdAt:   new Date(),
      updatedAt:   new Date(),
      expiresAt,
     seller: {
        name:       currentUser.email.split("@")[0],
        phone:      sellerPhone,
        location:   locationInput.value,
        isVerified: false
      },
      details:   collectCategoryFields(selectedCategory),
      condition: document.getElementById("cf-condition")?.value || ""
    };

    // ── 6. Save to Firestore ────────────────────
    const docRef = await addDoc(collection(db, "products"), productData);

// ── UPDATE ADS COUNT ───────────────────────
try {
  if (window._subscriptionDocId) {

  const subRef = doc(
  db,
  "business_accounts",
  window._subscriptionDocId
);

    await updateDoc(subRef, {
      usedAds: (window._subscriptionData.usedAds || 0) + 1
    });
  }
} catch (err) {
  console.warn("Failed updating subscription:", err);
}

    console.log("Product saved:", docRef.id);

    // ── 7. Reset form ───────────────────────────
    titleInput.value    = "";
    descInput.value     = "";
    priceInput.value    = "";
    locationInput.value = "";
    uploadedImages      = [];
    selectedCategory    = "";
    currentStep         = 1;

   // ── 8. Offer boost ──────────────────────────
    window._newProductId   = docRef.id;
    window._newProductName = titleInput.value.trim() || productData.name;
    showBoostPrompt(docRef.id, productData.name);

  } catch (err) {
    console.error("Upload error:", err);
    alert("❌ Error posting ad: " + err.message);
    if (btn) {
      btn.textContent = "Post My Ad 🚀";
      btn.disabled    = false;
    }
  }
};

/* ============================================
   BOOST PROMPT MODAL — after ad is posted
============================================ */
function showBoostPrompt(productId, productName) {
  const existing = document.getElementById("boost-prompt-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "boost-prompt-modal";
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.65);
    z-index:99999;display:flex;align-items:center;
    justify-content:center;padding:16px
  `;

  modal.innerHTML = `
    <div style="background:white;border-radius:20px;padding:28px;max-width:460px;width:100%;animation:slideUp .3s ease;max-height:90vh;overflow-y:auto">

      <div style="text-align:center;margin-bottom:20px">
        <p style="font-size:48px;margin-bottom:8px">🎉</p>
        <h2 style="font-size:20px;font-weight:800;color:#111827;margin-bottom:6px">Ad Posted Successfully!</h2>
        <p style="font-size:14px;color:#6b7280">Your ad <strong>"${productName}"</strong> is now live on ZiBuy.</p>
      </div>

      <div style="background:linear-gradient(135deg,#fff4ee,#fffbeb);border:2px solid #ff6600;border-radius:16px;padding:20px;margin-bottom:16px">
        <h3 style="font-size:16px;font-weight:800;color:#ff6600;margin-bottom:6px">⭐ Want more buyers to see it?</h3>
        <p style="font-size:13px;color:#374151;margin-bottom:14px;line-height:1.6">
          Boost your ad to the <strong>Featured</strong> section and get <strong>3× more views</strong>. Boosted ads sell faster!
        </p>

        <div style="display:flex;flex-direction:column;gap:8px">
          <div onclick="selectBoostPlan(this,'7',5000)"
            data-days="7" data-price="5000"
            style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border:2px solid #e5e7eb;border-radius:10px;cursor:pointer;transition:.2s;background:white">
            <span style="font-weight:700;font-size:14px">🔥 7 Days</span>
            <span style="font-weight:800;color:#ff6600">UGX 5,000</span>
          </div>
          <div onclick="selectBoostPlan(this,'14',8000)"
            data-days="14" data-price="8000"
            style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border:2px solid #e5e7eb;border-radius:10px;cursor:pointer;transition:.2s;background:white">
            <span style="font-weight:700;font-size:14px">
              ⭐ 14 Days
              <span style="font-size:11px;background:#dcfce7;color:#16a34a;padding:2px 7px;border-radius:20px;margin-left:6px">Popular</span>
            </span>
            <span style="font-weight:800;color:#ff6600">UGX 8,000</span>
          </div>
          <div onclick="selectBoostPlan(this,'30',15000)"
            data-days="30" data-price="15000"
            style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border:2px solid #e5e7eb;border-radius:10px;cursor:pointer;transition:.2s;background:white">
            <span style="font-weight:700;font-size:14px">💎 30 Days</span>
            <span style="font-weight:800;color:#ff6600">UGX 15,000</span>
          </div>
        </div>
      </div>

      <!-- Payment instructions — revealed after plan selected -->
      <div id="boost-payment-instructions" style="display:none;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:16px;font-size:13px">
       <p style="font-weight:800;margin-bottom:12px;color:#111827">📱 Choose how to pay:</p>

        <!-- MTN Mobile Money -->
        <div style="background:white;border:2px solid #ffcc00;border-radius:12px;padding:14px;margin-bottom:10px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <div style="background:#ffcc00;border-radius:8px;padding:6px 10px;font-weight:900;font-size:13px;color:#111">MTN</div>
            <span style="font-weight:800;font-size:14px">MTN Mobile Money</span>
          </div>
          <ol style="padding-left:18px;color:#374151;line-height:2.2;font-size:13px;margin:0">
            <li>Dial <strong style="color:#ff6600">*165#</strong> on your MTN line</li>
            <li>Select <strong>Pay With Momo</strong></li>
            <li>Enter Merchant Code: <strong style="color:#ff6600;font-size:15px">27868095</strong></li>
            <li>Enter amount: <strong id="boost-amount-mtn" style="color:#ff6600"></strong></li>
            <li>Enter your PIN to confirm</li>
          </ol>
        </div>

        <!-- Airtel Money -->
        <div style="background:white;border:2px solid #ef4444;border-radius:12px;padding:14px;margin-bottom:10px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <div style="background:#ef4444;border-radius:8px;padding:6px 10px;font-weight:900;font-size:13px;color:white">AIRTEL</div>
            <span style="font-weight:800;font-size:14px">Airtel Money</span>
          </div>
          <ol style="padding-left:18px;color:#374151;line-height:2.2;font-size:13px;margin:0">
            <li>Dial <strong style="color:#ef4444">*185#</strong> on your Airtel line</li>
            <li>Select <strong>Send Money</strong></li>
            <li>Send to number: <strong style="color:#ef4444;font-size:15px">+256575996624</strong></li>
            <li>Enter amount: <strong id="boost-amount-airtel" style="color:#ef4444"></strong></li>
            <li>Enter your PIN to confirm</li>
          </ol>
        </div>

        <p style="margin-top:10px;padding:10px;background:#fffbeb;border-radius:8px;font-size:12px;color:#92400e">
          ⏱️ After paying, click <strong>"I've Paid — Request Boost"</strong> below.
          Admin will verify and activate your boost within <strong>1 hour</strong>.
        </p>
      </div>

<!-- Transaction reference input -->
      <div id="boost-txn-wrap" style="display:none;margin-bottom:14px">
        <label style="font-size:13px;font-weight:800;color:#111827;display:block;margin-bottom:8px">
          📋 Enter your transaction reference / ID
        </label>
        <input type="text" id="boost-txn-ref"
          placeholder="e.g. 1234567890 or REF123456"
          style="width:100%;padding:12px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box"
          onfocus="this.style.borderColor='#ff6600'"
          onblur="this.style.borderColor='#e5e7eb'"
        >
        <p style="font-size:12px;color:#6b7280;margin-top:6px">
          The confirmation ID you received on your phone after paying
        </p>
      </div>

      <div style="display:flex;flex-direction:column;gap:10px">
        <button id="request-boost-btn" onclick="requestBoost('${productId}')"
          style="display:none;background:#ff6600;color:white;border:none;padding:14px;border-radius:12px;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit;width:100%;transition:.2s">
          📲 Send Reference to Admin WhatsApp
        </button>
        <button onclick="skipBoost()"
          style="background:#f3f4f6;color:#6b7280;border:none;padding:12px;border-radius:12px;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit;width:100%">
          Skip for now — Go to Dashboard
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(modal);
}

/* ---- Plan selection ---- */
window.selectedBoostPlan = null;

window.selectBoostPlan = function (el, days, price) {
  // Reset all options
  document.querySelectorAll("[data-days]").forEach(opt => {
    opt.style.border     = "2px solid #e5e7eb";
    opt.style.background = "white";
  });

  // Highlight chosen
  el.style.border     = "2px solid #ff6600";
  el.style.background = "#fff4ee";

  window.selectedBoostPlan = { days: Number(days), price: Number(price) };

  // Build payment reference from product ID
  const ref = `BOOST-${window._newProductId.slice(0, 8).toUpperCase()}`;

  // Reveal payment instructions
  const instructions = document.getElementById("boost-payment-instructions");
  const requestBtn   = document.getElementById("request-boost-btn");

  // Fill MTN fields
  const mtnAmount = document.getElementById("boost-amount-mtn");
  const mtnRef    = document.getElementById("boost-ref-mtn");
  if (mtnAmount) mtnAmount.textContent = `UGX ${Number(price).toLocaleString()}`;
  if (mtnRef)    mtnRef.textContent    = ref;

  // Fill Airtel fields
  const airtelAmount = document.getElementById("boost-amount-airtel");
  const airtelRef    = document.getElementById("boost-ref-airtel");
  if (airtelAmount) airtelAmount.textContent = `UGX ${Number(price).toLocaleString()}`;
  if (airtelRef)    airtelRef.textContent    = ref;

   if (instructions) instructions.style.display = "block";
  if (requestBtn)   requestBtn.style.display    = "block";

  const txnWrap = document.getElementById("boost-txn-wrap");
  if (txnWrap) txnWrap.style.display = "block";
  
};

/* ---- Seller submits boost request after paying ---- */
window.requestBoost = async function (productId) {
  if (!window.selectedBoostPlan) {
    alert("Please select a boost plan first");
    return;
  }

  // Validate transaction reference
  const txnInput = document.getElementById("boost-txn-ref");
  const txnRef   = txnInput ? txnInput.value.trim() : "";

  if (!txnRef) {
    if (txnInput) {
      txnInput.style.borderColor = "#ef4444";
      txnInput.placeholder = "⚠️ Please enter your transaction reference";
      txnInput.focus();
    }
    return;
  }

  // ── Plan boost limit check ──────────────────
  const { checkCanBoost } = await import("./plan-limits.js");
  const boostCheck = await checkCanBoost();
  if (!boostCheck.allowed) {
    alert(`⚠️ ${boostCheck.reason}`);
    return;
  }

  const btn = document.getElementById("request-boost-btn");
  if (btn) { btn.textContent = "Opening WhatsApp..."; btn.disabled = true; }

  try {
    const { db, auth, collection, addDoc } = await import("./firebase.js");

    const paymentRef = `BOOST-${productId.slice(0, 8).toUpperCase()}`;

    // Save boost request to Firestore
    await addDoc(collection(db, "boost_requests"), {
      productId,
      productName:    window._newProductName || "",
      userId:         auth.currentUser?.uid   || "",
      userEmail:      auth.currentUser?.email || "",
      userPhone:      auth.currentUser?.phoneNumber || "",
      days:           window.selectedBoostPlan.days,
      price:          window.selectedBoostPlan.price,
      paymentRef,
      transactionRef: txnRef,
      paymentMethod:  window.selectedPaymentMethod || "MTN/Airtel",
      status:         "pending",
      requestedAt:    new Date()
    });

    document.getElementById("boost-prompt-modal")?.remove();

    // Send to admin WhatsApp with all details
    const waMsg = encodeURIComponent(
      `Hello ZiBuy Admin 👋\n\n` +
      `I have paid for an *Ad Boost*.\n\n` +
      `📋 *Boost Details:*\n` +
      `• Ad: *${window._newProductName || productId}*\n` +
      `• Duration: *${window.selectedBoostPlan.days} Days*\n` +
      `• Amount: *UGX ${Number(window.selectedBoostPlan.price).toLocaleString()}*\n` +
      `• My Reference Code: *${paymentRef}*\n` +
      `• Transaction ID: *${txnRef}*\n` +
      `• Email: *${auth.currentUser?.email || ""}*\n\n` +
      `Please verify and activate my boost. Thank you! 🙏`
    );

    window.open(`https://wa.me/256790548910?text=${waMsg}`, "_blank");

    // Show confirmation screen
    showBoostConfirmation(paymentRef, txnRef);

  } catch (err) {
    console.error("Boost request error:", err);
    alert("Failed to send request. Please try again.");
    if (btn) { btn.textContent = "📲 Send Reference to Admin WhatsApp"; btn.disabled = false; }
  }
};
/* ---- Success screen ---- */
function showBoostConfirmation(paymentRef, txnRef) {
  const modal = document.createElement("div");
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.65);
    z-index:99999;display:flex;align-items:center;
    justify-content:center;padding:16px
  `;
  modal.innerHTML = `
    <div style="background:white;border-radius:20px;padding:32px;max-width:400px;width:100%;text-align:center">
      <p style="font-size:52px;margin-bottom:12px">✅</p>
      <h2 style="font-size:20px;font-weight:800;color:#111827;margin-bottom:8px">Reference Sent!</h2>
      <p style="color:#6b7280;font-size:14px;margin-bottom:12px">
        Your transaction reference has been sent to admin via WhatsApp.
      </p>
      <div style="background:#f9fafb;border-radius:10px;padding:14px;margin-bottom:16px;text-align:left">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px">
          <span style="color:#6b7280">Reference Code</span>
          <strong style="color:#ff6600">${paymentRef}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px">
          <span style="color:#6b7280">Transaction ID</span>
          <strong style="color:#ff6600">${txnRef}</strong>
        </div>
      </div>
      <div style="background:#f9fafb;border-radius:10px;padding:12px;margin-bottom:16px;font-size:13px;text-align:left">
        <p style="margin:0 0 6px;font-weight:800;color:#111827">What happens next:</p>
        <p style="margin:0 0 4px;color:#374151">1. Admin verifies your Mobile Money payment</p>
        <p style="margin:0 0 4px;color:#374151">2. Your ad gets the ⭐ Featured badge</p>
        <p style="margin:0;color:#374151">3. You get a notification when active ✅</p>
      </div>
      <p style="font-size:12px;color:#6b7280;margin-bottom:20px">
        ⏱️ Usually activated within <strong>1 hour</strong>
      </p>
      <button onclick="this.closest('div').parentElement.remove();window.location.href='dashboard.html?tab=my-ads'"
        style="background:#ff6600;color:white;border:none;padding:14px;border-radius:12px;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit;width:100%">
        Go to My Ads →
      </button>
    </div>
  `;
  document.body.appendChild(modal);
}

/* ---- Skip boost ---- */
window.skipBoost = function () {
  document.getElementById("boost-prompt-modal")?.remove();
  window.location.href = `dashboard.html?tab=my-ads`;
};