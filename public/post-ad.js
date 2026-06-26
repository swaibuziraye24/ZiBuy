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

import { getDistricts, getSubLocations } from "./uganda-locations.js";

// Populate district dropdown on load
document.addEventListener("DOMContentLoaded", () => {
  const districtEl = document.getElementById("ad-district");
  if (districtEl) {
    getDistricts().forEach(d => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      districtEl.appendChild(opt);
    });
  }
});

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
  renderCategoryFields(category);
  toggleVideoUpload(category);



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

// ============================================
// CATEGORY-SPECIFIC FIELD DEFINITIONS
// All 12 categories — complete fields
// ============================================

const CATEGORY_FIELDS = {

  phones: [
    { id:"cf-brand",     label:"Brand",       type:"select",
      options:["Samsung","iPhone/Apple","Tecno","Itel","Infinix","Huawei","Nokia","Oppo","Xiaomi","Vivo", "Google Pixel", "OnePlus", "Nothing Phone", "Realme", "Alcatel", "Motorola", "Honor", "Lenovo", "Aquas", "Other"] },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Foreign Used (UK)","Foreign Used (Dubai)","Local Used", "Refurbished" ] },
    { id:"cf-storage",   label:"Storage",      type:"select",
      options:["16GB","32GB","64GB","128GB","256GB","512GB","1TB"] },
    { id:"cf-ram",       label:"RAM",          type:"select",
      options:["1GB","2GB","3GB","4GB","6GB","8GB","12GB","16GB"] },
    { id:"cf-network",   label:"Network",      type:"select",
      options:["4G LTE","5G","3G","Dual SIM 4G","Dual SIM 5G"] },
    { id:"cf-battery",   label:"Battery",      type:"select",
      options:["Below 3000mAh","3000–4000mAh","4000–5000mAh","Above 5000mAh"] },
    { id:"cf-os",        label:"Operating System", type:"select",
      options:["Android","iOS (iPhone)","Other"] },
    { id:"cf-warranty",  label:"Warranty",     type:"select",
      options:["No Warranty","Shop Warranty (1 month)","Shop Warranty (3 months)","Manufacturer Warranty"] },
    { id:"cf-color",     label:"Color",        type:"text", placeholder:"e.g. Midnight Black, Gold" },
  ],

  electronics: [
    { id:"cf-electronics-type", label:"Electronics Type", type:"select",
      options:["TV / Flat Screen","Speaker / Sound System","Camera","Decoder / DSTV","DVD Player / Radio","Generator","Solar Equipment","Air Conditioner","Fan","Iron Box / Kitchen Appliance"] },
  ],

  "electronics-TV / Flat Screen": [
    { id:"cf-brand",     label:"Brand",        type:"select",
      options:["Samsung","LG","Sony","Hisense","TCL","Skyworth","Other"] },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Foreign Used (UK)","Foreign Used (Dubai)","Local Used", "Refurbished" ] },
    { id:"cf-screen",    label:"Screen Size",  type:"select",
      options:["24 inch","32 inch","40 inch","43 inch","50 inch","55 inch","65 inch","75 inch","Other"] },
    { id:"cf-display",   label:"Display Type", type:"select",
      options:["LED","OLED","QLED","Smart TV","Plasma"] },
    { id:"cf-warranty",  label:"Warranty",     type:"select",
      options:["No Warranty","Shop Warranty","Manufacturer Warranty"] },
  ],

  "electronics-Speaker / Sound System": [
    { id:"cf-type",      label:"Type",         type:"select",
      options:["Bluetooth Speaker","Home Theatre","Woofer / Subwoofer","Sound Bar","PA / DJ System","Car Speaker"] },
    { id:"cf-brand",     label:"Brand",        type:"text", placeholder:"e.g. JBL, Sony, LG" },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Foreign Used (UK)","Foreign Used (Dubai)","Local Used", "Refurbished" ] },
    { id:"cf-power",     label:"Power Output (Watts)", type:"text", placeholder:"e.g. 500W" },
  ],

  "electronics-Camera": [
    { id:"cf-type",      label:"Camera Type",  type:"select",
      options:["DSLR","Mirrorless","Point & Shoot","Action Camera","CCTV / Security Camera","Drone Camera"] },
    { id:"cf-brand",     label:"Brand",        type:"select",
      options:["Canon","Nikon","Sony","GoPro","Fujifilm","Other"] },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Foreign Used (UK)","Foreign Used (Dubai)","Local Used", "Refurbished" ] },
    { id:"cf-accessories",label:"Accessories Included", type:"text", placeholder:"e.g. Tripod, extra lens, bag" },
  ],

  "electronics-Decoder / DSTV": [
    { id:"cf-provider",  label:"Provider",     type:"select",
      options:["DSTV","GOtv","StarTimes","Zuku","Other"] },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Used — Working"] },
    { id:"cf-dish",      label:"Dish Included?", type:"select",
      options:["Yes","No"] },
  ],

  "electronics-DVD Player / Radio": [
    { id:"cf-type",      label:"Type",         type:"select",
      options:["DVD Player","Radio / Boombox","Home Stereo System"] },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Foreign Used (UK)","Foreign Used (Dubai)","Local Used", "Refurbished" ] },
  ],

  "electronics-Generator": [
    { id:"cf-power",     label:"Power Output", type:"select",
      options:["1KVA","2KVA","3KVA","5KVA","7.5KVA","10KVA","Above 10KVA"] },
    { id:"cf-fuel",      label:"Fuel Type",    type:"select",
      options:["Petrol","Diesel"] },
    { id:"cf-brand",     label:"Brand",        type:"text", placeholder:"e.g. Kipor, Honda, Cummins" },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Foreign Used (UK)","Foreign Used (Dubai)","Local Used", "Refurbished" ] },
  ],

  "electronics-Solar Equipment": [
    { id:"cf-type",      label:"Item Type",    type:"select",
      options:["Solar Panel","Solar Battery","Solar Inverter","Complete Solar Kit","Solar Charge Controller"] },
    { id:"cf-capacity",  label:"Capacity",     type:"text", placeholder:"e.g. 200W panel, 200Ah battery" },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Used — Working"] },
  ],

  "electronics-Air Conditioner": [
    { id:"cf-capacity",  label:"Capacity (BTU/HP)", type:"select",
      options:["1HP","1.5HP","2HP","2.5HP","3HP","Above 3HP"] },
    { id:"cf-brand",     label:"Brand",        type:"text", placeholder:"e.g. LG, Samsung, Hisense" },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Foreign Used (UK)","Foreign Used (Dubai)","Local Used", "Refurbished" ] },
    { id:"cf-installation", label:"Installation Included?", type:"select",
      options:["Yes","No"] },
  ],

  "electronics-Fan": [
    { id:"cf-type",      label:"Fan Type",     type:"select",
      options:["Standing Fan","Ceiling Fan","Table Fan","Wall Fan","Rechargeable Fan"] },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Foreign Used (UK)","Foreign Used (Dubai)","Local Used", "Refurbished" ] },
  ],

  "electronics-Iron Box / Kitchen Appliance": [
    { id:"cf-type",      label:"Item Type",    type:"select",
      options:["Iron Box","Blender","Kettle","Toaster","Microwave","Rice Cooker","Other"] },
    { id:"cf-brand",     label:"Brand",        type:"text", placeholder:"e.g. Saachi, Ramtons" },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Foreign Used (UK)","Foreign Used (Dubai)","Local Used", "Refurbished" ] },
  ],

  fashion: [
    { id:"cf-fashion-type", label:"Clothing Category", type:"select",
      options:["Tops & Shirts","Dresses & Skirts","Trousers, Jeans & Shorts","Suits, Jackets & Coats","Sportswear & Activewear","Underwear & Sleepwear","Traditional & Cultural Wear","Mitumba / Thrift Bundles"]
    },
  ],

  "fashion-Tops & Shirts": [
    { id:"cf-type",      label:"Item Type",   type:"select",
      options:["T-Shirt","Shirt","Blouse","Hoodie / Sweater","Tank Top"] },
    { id:"cf-condition", label:"Condition",   type:"select",
      options:["Brand New","Foreign Used","Local Used","Thrift (Mivumba)"] },
    { id:"cf-gender",    label:"For",         type:"select",
      options:["Men","Women","Unisex"] },
    { id:"cf-size",      label:"Size",        type:"select",
      options:["XS","S","M","L","XL","XXL","3XL","Free Size"] },
    { id:"cf-color",     label:"Color",       type:"text", placeholder:"e.g. Red, Navy Blue" },
  ],

  "fashion-Dresses & Skirts": [
    { id:"cf-type",      label:"Item Type",   type:"select",
      options:["Casual Dress","Evening / Gown","Office Dress","Skirt","Maxi Dress"] },
    { id:"cf-condition", label:"Condition",   type:"select",
      options:["Brand New","Foreign Used","Local Used","Thrift (Mivumba)"] },
    { id:"cf-size",      label:"Size",        type:"select",
      options:["XS","S","M","L","XL","XXL","Free Size"] },
    { id:"cf-color",     label:"Color",       type:"text", placeholder:"e.g. Black, Floral Print" },
  ],

  "fashion-Trousers, Jeans & Shorts": [
    { id:"cf-type",      label:"Item Type",   type:"select",
      options:["Jeans","Trousers / Pants","Shorts","Leggings"] },
    { id:"cf-condition", label:"Condition",   type:"select",
      options:["Brand New","Foreign Used","Local Used","Thrift (Mivumba)"] },
    { id:"cf-gender",    label:"For",         type:"select",
      options:["Men","Women","Unisex"] },
    { id:"cf-size",      label:"Size",        type:"select",
      options:["28","30","32","34","36","38","40","XS","S","M","L","XL"] },
  ],

  "fashion-Suits, Jackets & Coats": [
    { id:"cf-type",      label:"Item Type",   type:"select",
      options:["Suit (Full Set)","Blazer","Jacket","Coat","Vest / Waistcoat"] },
    { id:"cf-condition", label:"Condition",   type:"select",
      options:["Brand New","Foreign Used","Local Used"] },
    { id:"cf-size",      label:"Size",        type:"select",
      options:["S","M","L","XL","XXL","Custom Tailored"] },
  ],

  "fashion-Sportswear & Activewear": [
    { id:"cf-type",      label:"Item Type",   type:"select",
      options:["Tracksuit","Jersey","Gym Wear","Swimwear","Sports Bra"] },
    { id:"cf-condition", label:"Condition",   type:"select",
      options:["Brand New","Foreign Used","Local Used"] },
    { id:"cf-brand",     label:"Brand",       type:"text", placeholder:"e.g. Nike, Adidas, Puma" },
  ],

  "fashion-Underwear & Sleepwear": [
    { id:"cf-type",      label:"Item Type",   type:"select",
      options:["Underwear","Pyjamas / Sleepwear","Nightgown","Bra / Lingerie"] },
    { id:"cf-condition", label:"Condition",   type:"select",
      options:["Brand New (Sealed)"] },
    { id:"cf-gender",    label:"For",         type:"select",
      options:["Men","Women"] },
  ],

  "fashion-Traditional & Cultural Wear": [
    { id:"cf-type",      label:"Item Type",   type:"select",
      options:["Gomesi","Kanzu","Kitenge / African Print Outfit","Wedding Traditional Wear","Other"] },
    { id:"cf-condition", label:"Condition",   type:"select",
      options:["Brand New","Custom Tailored","Used"] },
  ],

  "fashion-Mitumba / Thrift Bundles": [
    { id:"cf-type",      label:"Bundle Type", type:"select",
      options:["Mixed Clothes Bundle","Shirts Bundle","Dresses Bundle","Kids Clothes Bundle"] },
    { id:"cf-quantity",  label:"Quantity",    type:"text", placeholder:"e.g. 20 pieces, 1 bale" },
    { id:"cf-gender",    label:"For",         type:"select",
      options:["Men","Women","Unisex","Kids"] },
  ],

  shoes: [
    { id:"cf-type",      label:"Shoe Type",    type:"select",
      options:["Sneakers","Heels","Sandals","Boots","Loafers","Flip Flops","Formal Shoes","Sports Shoes","Kids Shoes","Other"] },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Foreign Used","Local Used"] },
    { id:"cf-gender",    label:"For",          type:"select",
      options:["Men","Women","Unisex","Boys","Girls","Babies"] },
    { id:"cf-size",      label:"Shoe Size",    type:"select",
      options:["28","29","30","31","32","33","34","35","36","37","38","39","40","41","42","43","44","45","46","47","48"] },
    { id:"cf-brand",     label:"Brand",        type:"select",
      options:["Nike","Adidas","Puma","Vans","Timberland","Bata","Converse","Reebok","Under Armour","No Brand","Other"] },
    { id:"cf-color",     label:"Color",        type:"text",  placeholder:"e.g. Black, White, Brown" },
    { id:"cf-material",  label:"Material",     type:"select",
      options:["Leather","Canvas","Rubber","Suede","Synthetic","Other"] },
  ],

  beauty: [
    { id:"cf-type",      label:"Product Type", type:"select",
      options:["Face Cream / Moisturiser","Body Lotion","Sunscreen","Foundation / BB Cream","Lipstick / Lip Gloss","Mascara / Eyeliner","Perfume / Cologne","Hair Oil / Relaxer","Shampoo / Conditioner","Weave / Wig / Extensions","Nail Polish","Soap / Body Wash","Deodorant","Men Grooming","Other"] },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New (Sealed)","Brand New (Open Box)"] },
    { id:"cf-brand",     label:"Brand",        type:"text",  placeholder:"e.g. Nivea, Neutrogena, L'Oreal" },
    { id:"cf-gender",    label:"Suitable For", type:"select",
      options:["Women","Men","Unisex","Kids","All"] },
    { id:"cf-origin",    label:"Made In",      type:"select",
      options:["Uganda","Kenya","South Africa","UK","USA","France","China","India","Other"] },
    { id:"cf-volume",    label:"Size / Volume", type:"text", placeholder:"e.g. 250ml, 100g, 1 piece" },
  ],

  bags: [
    { id:"cf-type",      label:"Bag Type",     type:"select",
      options:["Handbag","Backpack","Laptop Bag","Travel / Suitcase","School Bag","Clutch Bag","Wallet","Gym Bag","Shopping Bag","Other"] },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Foreign Used","Local Used"] },
    { id:"cf-gender",    label:"For",          type:"select",
      options:["Women","Men","Unisex","Kids"] },
    { id:"cf-brand",     label:"Brand",        type:"select",
      options:["Gucci","Louis Vuitton","Nike","Adidas","Puma","Samsonite","Local Brand","No Brand","Other"] },
    { id:"cf-material",  label:"Material",     type:"select",
      options:["Genuine Leather","Faux Leather","Canvas","Nylon","Polyester","Fabric","Other"] },
    { id:"cf-color",     label:"Color",        type:"text",  placeholder:"e.g. Black, Brown, Red" },
  ],

  groceries: [
    { id:"cf-type",      label:"Product Type", type:"select",
      options:["Rice","Maize Flour (Posho)","Cooking Oil","Sugar","Beans","Groundnuts","Matooke","Cassava","Sweet Potatoes","Meat / Chicken","Fish","Eggs","Milk / Dairy","Bread / Baked Goods","Beverages / Drinks","Spices & Seasoning","Processed / Canned Food","Baby Food","Other"] },
    { id:"cf-condition", label:"Freshness",    type:"select",
      options:["Fresh Today","Farm Fresh","Packaged / Sealed","Expires in 1 week","Expires in 1 month","Expires in 3+ months"] },
    { id:"cf-origin",    label:"Origin",       type:"select",
      options:["Uganda Grown","Imported","Organic / Chemical Free","Other"] },
    { id:"cf-quantity",  label:"Quantity / Unit", type:"text", placeholder:"e.g. 1 bag (100kg), 5 litres, 1 crate (30 eggs)" },
    { id:"cf-packaging", label:"Packaging",    type:"select",
      options:["Loose (Unpackaged)","Bagged","Bottled","Boxed","Wrapped"] },
  ],

  watches: [
    { id:"cf-brand",     label:"Brand",        type:"select",
      options:["Casio","Rolex","Seiko","Citizen","Fossil","Hublot","Tag Heuer","Timex","Armani","No Brand","Other"] },
    { id:"cf-type",      label:"Watch Type",   type:"select",
      options:["Analog","Digital","Smart Watch","Sports Watch","Luxury Watch","Kids Watch"] },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Foreign Used","Local Used"] },
    { id:"cf-gender",    label:"For",          type:"select",
      options:["Men","Women","Unisex","Kids"] },
    { id:"cf-movement",  label:"Movement",     type:"select",
      options:["Quartz (Battery)","Automatic","Solar","Smart / Connected","Manual Wind"] },
    { id:"cf-material",  label:"Strap Material", type:"select",
      options:["Leather","Stainless Steel","Rubber / Silicone","Fabric","Plastic","Other"] },
    { id:"cf-color",     label:"Color",        type:"text",  placeholder:"e.g. Black dial, Gold case" },
    { id:"cf-warranty",  label:"Warranty",     type:"select",
      options:["No Warranty","Shop Warranty","Manufacturer Warranty"] },
  ],

  computers: [
    { id:"cf-comp-type", label:"Item Category", type:"select",
      options:["Laptops","Desktop PCs","Tablets","Monitors","Printers & Scanners","Computer Accessories (Keyboard, Mouse, UPS)"]
    },
  ],

  "computers-Laptops": [
    { id:"cf-brand",     label:"Brand",        type:"select",
      options:["HP","Dell","Lenovo","Apple MacBook","Asus","Acer","Toshiba","MSI","Microsoft Surface","Other"] },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Foreign Used (UK)","Foreign Used (Dubai)","Local Used", "Refurbished" ] },
    { id:"cf-processor", label:"Processor",    type:"select",
      options:["Intel Core i3","Intel Core i5","Intel Core i7","Intel Core i9","AMD Ryzen 3","AMD Ryzen 5","AMD Ryzen 7","Apple M1","Apple M2","Apple M3","Celeron / Pentium"] },
    { id:"cf-ram",       label:"RAM",          type:"select",
      options:["4GB","8GB","16GB","32GB","64GB"] },
    { id:"cf-storage",   label:"Storage",      type:"select",
      options:["128GB SSD","256GB SSD","512GB SSD","1TB SSD", "128GB HDD","256GB HDD","512GB HDD","1TB HDD","320GB HDD"] },
    { id:"cf-screen",    label:"Screen Size",  type:"select",
      options:["11 inch","13 inch","14 inch","15 inch","15.6 inch","17 inch"] },
    { id:"cf-os",        label:"Operating System", type:"select",
      options:["Windows 11","Windows 10","macOS","Chrome OS", "Windows 8", "Windows 7","Windows xp", "No OS"] },
    { id:"cf-warranty",  label:"Warranty",     type:"select",
      options:["No Warranty","Shop Warranty","Manufacturer Warranty"] },
  ],

  "computers-Desktop PCs": [
    { id:"cf-brand",     label:"Brand",        type:"select",
      options:["HP","Dell","Lenovo","Apple iMac","Custom Built","Other"] },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Foreign Used (UK)","Foreign Used (Dubai)","Local Used", "Refurbished" ] },
    { id:"cf-processor", label:"Processor",    type:"select",
      options:["Intel Core i3","Intel Core i5","Intel Core i7","Intel Core i9","AMD Ryzen 5","AMD Ryzen 7","Other"] },
    { id:"cf-ram",       label:"RAM",          type:"select",
      options:["4GB","8GB","16GB","32GB","64GB"] },
    { id:"cf-storage",   label:"Storage",      type:"select",
      options:["256GB SSD","512GB SSD","1TB SSD","1TB HDD","2TB HDD", "128GB HDD", "256GB HDD", "128 SSD", "512GB HDD"] },
    { id:"cf-includes",  label:"Includes",     type:"text", placeholder:"e.g. Monitor, Keyboard, Mouse" },
  ],

  "computers-Tablets": [
    { id:"cf-brand",     label:"Brand",        type:"select",
      options:["Apple iPad","Samsung Galaxy Tab","Lenovo Tab","Huawei MatePad","Other"] },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Foreign Used (UK)","Foreign Used (Dubai)","Local Used", "Refurbished" ] },
    { id:"cf-storage",   label:"Storage",      type:"select",
      options:["32GB","64GB","128GB","256GB","512GB"] },
    { id:"cf-network",   label:"Connectivity", type:"select",
      options:["WiFi Only","WiFi + Cellular (SIM)"] },
  ],

  "computers-Monitors": [
    { id:"cf-brand",     label:"Brand",        type:"text", placeholder:"e.g. Dell, HP, Samsung, LG" },
    { id:"cf-size",       label:"Screen Size",  type:"select",
      options:["19 inch","21 inch","22 inch","24 inch","27 inch","32 inch","Other"] },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Foreign Used (UK)","Foreign Used (Dubai)","Local Used", "Refurbished" ] },
    { id:"cf-refresh",   label:"Refresh Rate", type:"select",
      options:["60Hz","75Hz","120Hz","144Hz+"] },
  ],

  "computers-Printers & Scanners": [
    { id:"cf-type",      label:"Item Type",    type:"select",
      options:["Printer (Inkjet)","Printer (Laser)","All-in-One (Print/Scan/Copy)","Scanner Only","Photocopier"] },
    { id:"cf-brand",     label:"Brand",        type:"text", placeholder:"e.g. HP, Canon, Epson" },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Foreign Used (UK)","Foreign Used (Dubai)","Local Used", "Refurbished" ] },
  ],

  "computers-Computer Accessories (Keyboard, Mouse, UPS)": [
    { id:"cf-type",      label:"Item Type",    type:"select",
      options:["Keyboard","Mouse","UPS / Battery Backup","Webcam","Computer Bag","External Hard Drive","Flash Disk","RAM / Internal Parts","Other"] },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Foreign Used (UK)","Foreign Used (Dubai)","Local Used", "Refurbished" ] },
  ],

  gaming: [
    { id:"cf-gaming-type", label:"Item Category", type:"select",
      options:["Console (Full Set or Console Only)","Games (CD / Cartridge / Digital)","Controllers & Accessories","Gaming Chair","Gaming Monitor & Headset","VR Headset"] },
  ],

  "gaming-Console (Full Set or Console Only)": [
    { id:"cf-platform",    label:"Platform",      type:"select",
      options:["PlayStation 5 (PS5)","PlayStation 4 (PS4)","PlayStation 3 (PS3)","Xbox Series X/S","Xbox One","Nintendo Switch","Retro Console","Other"] },
    { id:"cf-condition",   label:"Condition",     type:"select",
      options:["Brand New","Foreign Used (UK)","Foreign Used (Dubai)","Local Used", "Refurbished" ] },
    { id:"cf-storage",     label:"Storage",       type:"select",
      options:["256GB","500GB","512GB","1TB","2TB","Other"] },
    { id:"cf-controllers", label:"Controllers Included", type:"select",
      options:["No Controller","1 Controller","2 Controllers","3+ Controllers"] },
    { id:"cf-warranty",    label:"Warranty",      type:"select",
      options:["No Warranty","Shop Warranty","Manufacturer Warranty"] },
  ],

  "gaming-Games (CD / Cartridge / Digital)": [
    { id:"cf-platform",  label:"Platform",     type:"select",
      options:["PlayStation 5","PlayStation 4","Xbox Series X/S","Xbox One","Nintendo Switch","PC Gaming"] },
    { id:"cf-title",     label:"Game Title",   type:"text", placeholder:"e.g. FIFA 26, GTA V, Call of Duty" },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New (Sealed)","Used — Good Condition"] },
    { id:"cf-format",    label:"Format",       type:"select",
      options:["Physical Disc / Cartridge","Digital Code"] },
  ],

  "gaming-Controllers & Accessories": [
    { id:"cf-type",      label:"Item Type",    type:"select",
      options:["Controller / Gamepad","Charging Dock","Gaming Mouse","Gaming Keyboard","Steering Wheel","Memory Card / Storage"] },
    { id:"cf-platform",  label:"Compatible Platform", type:"select",
      options:["PlayStation","Xbox","Nintendo Switch","PC","Universal / Multi-Platform"] },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Foreign Used (UK)","Foreign Used (Dubai)","Local Used", "Refurbished" ] },
  ],

  "gaming-Gaming Chair": [
    { id:"cf-brand",     label:"Brand",        type:"text", placeholder:"e.g. Secretlab, No Brand" },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Foreign Used (UK)","Foreign Used (Dubai)","Local Used", "Refurbished" ] },
    { id:"cf-color",     label:"Color",        type:"text", placeholder:"e.g. Black/Red" },
  ],

  "gaming-Gaming Monitor & Headset": [
    { id:"cf-type",      label:"Item Type",    type:"select",
      options:["Gaming Monitor","Gaming Headset","Both"] },
    { id:"cf-size",      label:"Monitor Size (if applicable)", type:"select",
      options:["Not Applicable","22 inch","24 inch","27 inch","32 inch","Other"] },
    { id:"cf-refresh",   label:"Refresh Rate (if monitor)", type:"select",
      options:["Not Applicable","60Hz","75Hz","120Hz","144Hz","240Hz+"] },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Foreign Used (UK)","Foreign Used (Dubai)","Local Used", "Refurbished" ] },
  ],

  "gaming-VR Headset": [
    { id:"cf-brand",     label:"Brand",        type:"select",
      options:["Meta Quest","PlayStation VR","HTC Vive","Other"] },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Foreign Used (UK)","Foreign Used (Dubai)","Local Used", "Refurbished" ] },
    { id:"cf-accessories",label:"Accessories Included", type:"text", placeholder:"e.g. Controllers, charging cable" },
  ],

  home: [
    { id:"cf-home-type", label:"Item Category", type:"select",
      options:["Sofa / Living Room Furniture","Bed / Bedroom Furniture","Dining & Kitchen Furniture","Fridge / Freezer","Washing Machine","Curtains & Carpets","Wall Decor & Lighting","Kitchenware & Utensils","Office Furniture"] },
  ],

  "home-Sofa / Living Room Furniture": [
    { id:"cf-type",      label:"Item Type",   type:"select",
      options:["Sofa Set","Single Sofa Chair","Coffee Table","TV Stand","Bookshelf","Other"] },
    { id:"cf-material",  label:"Material",    type:"select",
      options:["Fabric","Leather","Wood","Mixed"] },
    { id:"cf-seats",     label:"Seater",      type:"select",
      options:["1 Seater","2 Seater","3 Seater","5+ Seater Set"] },
    { id:"cf-condition", label:"Condition",   type:"select",
      options:["Brand New","Foreign Used (UK)","Foreign Used (Dubai)","Local Used", "Refurbished" ] },
  ],

  "home-Bed / Bedroom Furniture": [
    { id:"cf-type",      label:"Item Type",   type:"select",
      options:["Bed Frame","Mattress","Wardrobe","Dressing Table","Bedside Table"] },
    { id:"cf-size",      label:"Size",        type:"select",
      options:["3x6","4x6","5x6","6x6","Queen","King","Not Applicable"] },
    { id:"cf-condition", label:"Condition",   type:"select",
      options:["Brand New","Foreign Used (UK)","Foreign Used (Dubai)","Local Used", "Refurbished" ] },
  ],

  "home-Dining & Kitchen Furniture": [
    { id:"cf-type",      label:"Item Type",   type:"select",
      options:["Dining Table & Chairs","Kitchen Cabinet","Kitchen Trolley","Bar Stool"] },
    { id:"cf-seats",     label:"Seats (if dining set)", type:"select",
      options:["4 Seater","6 Seater","8 Seater","Not Applicable"] },
    { id:"cf-condition", label:"Condition",   type:"select",
      options:["Brand New","Foreign Used","Local Used"] },
  ],

  "home-Fridge / Freezer": [
    { id:"cf-type",      label:"Type",        type:"select",
      options:["Single Door Fridge","Double Door Fridge","Chest Freezer","Upright Freezer","Mini Fridge"] },
    { id:"cf-capacity",  label:"Capacity (Litres)", type:"text", placeholder:"e.g. 200L" },
    { id:"cf-brand",     label:"Brand",       type:"text", placeholder:"e.g. Hisense, Samsung" },
    { id:"cf-condition", label:"Condition",   type:"select",
      options:["Brand New","Foreign Used","Local Used"] },
  ],

  "home-Washing Machine": [
    { id:"cf-type",      label:"Type",        type:"select",
      options:["Front Load","Top Load","Semi-Automatic","Manual"] },
    { id:"cf-capacity",  label:"Capacity (kg)", type:"select",
      options:["5kg","6kg","7kg","8kg","Above 8kg"] },
    { id:"cf-condition", label:"Condition",   type:"select",
      options:["Brand New","Foreign Used","Local Used"] },
  ],

  "home-Curtains & Carpets": [
    { id:"cf-type",      label:"Item Type",   type:"select",
      options:["Curtains","Carpet / Rug","Door Mat","Blinds"] },
    { id:"cf-size",      label:"Size",        type:"text", placeholder:"e.g. 6x9ft, Window size" },
    { id:"cf-condition", label:"Condition",   type:"select",
      options:["Brand New","Used"] },
  ],

  "home-Wall Decor & Lighting": [
    { id:"cf-type",      label:"Item Type",   type:"select",
      options:["Wall Art / Frames","Mirror","Chandelier","Lamp","LED Lights","Clock"] },
    { id:"cf-condition", label:"Condition",   type:"select",
      options:["Brand New","Used"] },
  ],

  "home-Kitchenware & Utensils": [
    { id:"cf-type",      label:"Item Type",   type:"select",
      options:["Cookware Set","Cutlery Set","Plates & Dishes","Storage Containers","Gas Cooker","Other"] },
    { id:"cf-condition", label:"Condition",   type:"select",
      options:["Brand New","Used"] },
  ],

  "home-Office Furniture": [
    { id:"cf-type",      label:"Item Type",   type:"select",
      options:["Office Desk","Office Chair","Filing Cabinet","Bookshelf","Conference Table"] },
    { id:"cf-condition", label:"Condition",   type:"select",
      options:["Brand New","Foreign Used","Local Used"] },
  ],

accessories: [
    { id:"cf-acc-type", label:"Accessory Category", type:"select",
      options:["Jewellery (Necklace, Rings, Earrings)","Sunglasses & Eyewear","Belts & Hats","Scarves & Hair Accessories","Phone Cases & Wallets"]
    },
  ],

  "accessories-Jewellery (Necklace, Rings, Earrings)": [
    { id:"cf-type",      label:"Item Type",   type:"select",
      options:["Necklace","Earrings","Bracelet / Bangle","Ring","Anklet","Chain","Brooch"] },
    { id:"cf-material",  label:"Material",    type:"select",
      options:["Gold (14k/18k)","Gold Plated","Silver","Stainless Steel","Beads","Crystal","Other"] },
    { id:"cf-gender",    label:"For",         type:"select",
      options:["Women","Men","Unisex","Kids"] },
    { id:"cf-condition", label:"Condition",   type:"select",
      options:["Brand New","Used"] },
    { id:"cf-brand",     label:"Brand (optional)", type:"text", placeholder:"e.g. Pandora, Local Artisan" },
  ],

  "accessories-Sunglasses & Eyewear": [
    { id:"cf-type",      label:"Item Type",   type:"select",
      options:["Sunglasses","Reading Glasses","Eyeglass Frames"] },
    { id:"cf-brand",     label:"Brand",       type:"text", placeholder:"e.g. Ray-Ban, Local Brand" },
    { id:"cf-condition", label:"Condition",   type:"select",
      options:["Brand New","Used"] },
  ],

  "accessories-Belts & Hats": [
    { id:"cf-type",      label:"Item Type",   type:"select",
      options:["Belt","Hat / Cap","Beanie"] },
    { id:"cf-material",  label:"Material",    type:"select",
      options:["Leather","Fabric","Synthetic"] },
    { id:"cf-gender",    label:"For",         type:"select",
      options:["Men","Women","Unisex"] },
    { id:"cf-condition", label:"Condition",   type:"select",
      options:["Brand New","Used"] },
  ],

  "accessories-Scarves & Hair Accessories": [
    { id:"cf-type",      label:"Item Type",   type:"select",
      options:["Scarf / Shawl","Hair Accessories","Wig","Hair Extensions","Hairband / Clips"] },
    { id:"cf-condition", label:"Condition",   type:"select",
      options:["Brand New","Used"] },
  ],

  "accessories-Phone Cases & Wallets": [
    { id:"cf-type",      label:"Item Type",   type:"select",
      options:["Phone Case","Wallet","Card Holder","Tie"] },
    { id:"cf-material",  label:"Material",    type:"select",
      options:["Leather","Silicone","Plastic","Fabric"] },
    { id:"cf-condition", label:"Condition",   type:"select",
      options:["Brand New","Used"] },
  ],

  services: [
    { id:"cf-service-type",  label:"Service Type",              type:"select",
      options:[
        "Plumbing & Pipe Fitting","Electrical Installation","Construction & Building",
        "Painting & Decoration","Cleaning & Fumigation","Salon & Hair Dressing",
        "Barbershop","Massage & Spa","Photography & Videography","Catering & Cooking",
        "Event Planning & Decoration","Transport & Moving","Boda Boda / Taxi",
        "Teaching & Tutoring","IT Support & Repair","Web & App Development",
        "Graphic Design & Printing","Tailoring & Fashion Design","Welding & Fabrication",
        "Carpentry & Furniture","Mechanics & Auto Repair","Tyre & Exhaust",
        "Generator Repair","CCTV & Security Installation","Solar Installation",
        "Borehole Drilling","Landscaping & Gardening","Pest Control",
        "Laundry & Dry Cleaning","Shoe Repair & Cobbling","Legal Services",
        "Accounting & Bookkeeping","Medical & Nursing Care","Veterinary Services",
        "Music & Entertainment","MC / Host","Other"
      ]
    },
    { id:"cf-service-mode",  label:"How Service is Delivered",  type:"select",
      options:[
        "I come to the client","Client comes to me","Both options available",
        "Online / Remote only"
      ]
    },
    { id:"cf-experience",    label:"Years of Experience",       type:"select",
      options:[
        "Less than 1 year","1–2 years","3–5 years","5–10 years","10+ years"
      ]
    },
    { id:"cf-pricing-type",  label:"Pricing Type",              type:"select",
      options:[
        "Fixed Price","Hourly Rate","Daily Rate","Per Project (Quote)","Negotiable"
      ]
    },
    { id:"cf-availability",  label:"Availability",              type:"select",
      options:[
        "Available Now","Monday – Friday","Weekends Only","Evenings Only",
        "24/7 Available","By Appointment Only","Flexible"
      ]
    },
    { id:"cf-response-time", label:"Response Time",             type:"select",
      options:[
        "Within 1 hour","Within a few hours","Same day","Next day","Within 2–3 days"
      ]
    },
    { id:"cf-area-covered",  label:"Area / Location Covered",   type:"select",
      options:[
        "Kampala only","Kampala & Wakiso","Greater Kampala","Central Uganda",
        "Eastern Uganda","Northern Uganda","Western Uganda","All Uganda",
        "Specific area – see description"
      ]
    },
    { id:"cf-team-size",     label:"Working As",                type:"select",
      options:[
        "Individual / Solo","Small team (2–5 people)","Company / Large team"
      ]
    },
    { id:"cf-qualification", label:"Qualifications / Certifications", type:"text",
      placeholder:"e.g. Certified Electrician, Makerere Degree, 5 years KCCA licensed"
    },
    { id:"cf-languages",     label:"Languages Spoken",          type:"select",
      options:[
        "English","Luganda","English & Luganda","Swahili","Runyankole",
        "Acholi","Ateso","Multiple languages"
      ]
    },
    { id:"cf-negotiable",    label:"Price Negotiable?",         type:"select",
      options:["Yes, open to negotiation","No, fixed price"]
    },
  ],


  vehicles: [
    { id:"cf-vehicle-type", label:"Vehicle Type",        type:"select",
      options:["Car","Motorcycle / Boda Boda","Bicycle","Truck / Lorry","Bus / Minibus","Tractor / Heavy Equipment","Trailer","Boat / Watercraft"] },
  ],

  "vehicles-Car": [
    { id:"cf-make",         label:"Make / Brand",        type:"select",
      options:["Toyota","Nissan","Honda","Suzuki","Mitsubishi","Mercedes-Benz","BMW","Land Rover","Isuzu","Tata","Volkswagen","Subaru","Mazda","Ford","Hyundai","Kia","Other"] },
    { id:"cf-model",        label:"Model",               type:"text",  placeholder:"e.g. Corolla, Premio, Ipsum, RAV4" },
    { id:"cf-year",         label:"Year of Manufacture", type:"select",
      options:["2024","2023","2022","2021","2020","2019","2018","2017","2016","2015","2014","2013","2012","2011","2010","2005–2009","Before 2005"] },
    { id:"cf-condition",    label:"Condition",           type:"select",
      options:["Brand New","Foreign Used","Local Used"] },
    { id:"cf-transmission", label:"Transmission",        type:"select",
      options:["Automatic","Manual","CVT"] },
    { id:"cf-fuel",         label:"Fuel Type",           type:"select",
      options:["Petrol","Diesel","Electric","Hybrid","LPG / Gas"] },
    { id:"cf-drive",        label:"Drive",               type:"select",
      options:["Right Hand Drive (RHD)","Left Hand Drive (LHD)","4WD / AWD","2WD"] },
    { id:"cf-mileage",      label:"Mileage (km)",        type:"text",  placeholder:"e.g. 45,000 km" },
    { id:"cf-color",        label:"Color",               type:"text",  placeholder:"e.g. Silver, Black, White" },
    { id:"cf-body",         label:"Body Type",           type:"select",
      options:["Saloon / Sedan","SUV / 4x4","Station Wagon","Coupe","Convertible","Other"] },
    { id:"cf-engine",       label:"Engine Size",         type:"select",
      options:["1000cc","1300cc","1500cc","1800cc","2000cc","2500cc","3000cc","3500cc","Above 4000cc","Other"] },
    { id:"cf-logbook",      label:"Logbook / Ownership Document", type:"select",
      options:["Available — Original Logbook","Available — Photocopy","Processing / Pending","Not Available"] },
    { id:"cf-negotiable",   label:"Price Negotiable?",   type:"select",
      options:["Yes, negotiable","No, fixed price"] },
  ],

  "vehicles-Motorcycle / Boda Boda": [
    { id:"cf-make",       label:"Make / Brand",          type:"select",
      options:["Bajaj","TVS","Honda","Yamaha","Haojue","Kibo","Hero","Royal Enfield","Suzuki","Other"] },
    { id:"cf-model",      label:"Model",                 type:"text",  placeholder:"e.g. Boxer, CT 125, Apsonic" },
    { id:"cf-year",       label:"Year of Manufacture",   type:"select",
      options:["2024","2023","2022","2021","2020","2019","2018","2017","Before 2017"] },
    { id:"cf-condition",  label:"Condition",             type:"select",
      options:["Brand New","Foreign Used","Local Used"] },
    { id:"cf-engine",     label:"Engine Size (CC)",      type:"select",
      options:["100cc","125cc","150cc","175cc","200cc","250cc","Above 250cc"] },
    { id:"cf-mileage",    label:"Mileage (km)",          type:"text",  placeholder:"e.g. 15,000 km" },
    { id:"cf-color",      label:"Color",                 type:"text",  placeholder:"e.g. Red, Black" },
    { id:"cf-purpose",    label:"Purpose",               type:"select",
      options:["Personal Use","Boda Boda / Commercial","Delivery / Courier","Sport / Racing"] },
    { id:"cf-logbook",    label:"Ownership Document",    type:"select",
      options:["Available — Number Plate Registered","Processing / Pending","Not Available (New, Pre-registration)"] },
    { id:"cf-negotiable", label:"Price Negotiable?",     type:"select",
      options:["Yes, negotiable","No, fixed price"] },
  ],

  "vehicles-Bicycle": [
    { id:"cf-type",      label:"Bicycle Type",  type:"select",
      options:["Mountain Bike","Road Bike","BMX","Kids Bicycle","Electric Bicycle","Cargo Bicycle","Cruiser","Other"] },
    { id:"cf-brand",     label:"Brand",         type:"text",  placeholder:"e.g. Hero, Phoenix, Trek, No Brand" },
    { id:"cf-condition", label:"Condition",     type:"select",
      options:["Brand New","Foreign Used","Local Used"] },
    { id:"cf-size",      label:"Frame / Wheel Size", type:"select",
      options:["12 inch (Kids)","16 inch (Kids)","20 inch","24 inch","26 inch","27.5 inch","29 inch / Other"] },
    { id:"cf-gears",     label:"Gears",         type:"select",
      options:["Single Speed","6 Gears","18 Gears","21 Gears","27+ Gears"] },
    { id:"cf-color",     label:"Color",         type:"text",  placeholder:"e.g. Black, Blue" },
  ],

  "vehicles-Truck / Lorry": [
    { id:"cf-make",         label:"Make / Brand",         type:"select",
      options:["Isuzu","Mitsubishi Fuso","Toyota","Mercedes-Benz","Tata","Howo / Sinotruk","Scania","Man","DAF","Other"] },
    { id:"cf-model",        label:"Model",                type:"text",  placeholder:"e.g. NQR, Canter, Actros" },
    { id:"cf-year",         label:"Year of Manufacture",  type:"select",
      options:["2024","2023","2022","2021","2020","2019","2018","2017","2016","2015","Before 2015"] },
    { id:"cf-condition",    label:"Condition",            type:"select",
      options:["Brand New","Foreign Used","Local Used"] },
    { id:"cf-capacity",     label:"Carrying Capacity",    type:"text",  placeholder:"e.g. 5 tonnes, 10 tonnes" },
    { id:"cf-body",         label:"Body Type",            type:"select",
      options:["Flatbed","Box Body","Tipper / Dump Truck","Tanker","Refrigerated","Curtain Side","Other"] },
    { id:"cf-transmission", label:"Transmission",         type:"select",
      options:["Manual","Automatic"] },
    { id:"cf-mileage",      label:"Mileage (km)",         type:"text",  placeholder:"e.g. 120,000 km" },
    { id:"cf-logbook",      label:"Logbook / Ownership Document", type:"select",
      options:["Available — Original Logbook","Processing / Pending","Not Available"] },
    { id:"cf-negotiable",   label:"Price Negotiable?",    type:"select",
      options:["Yes, negotiable","No, fixed price"] },
  ],

  "vehicles-Bus / Minibus": [
    { id:"cf-make",      label:"Make / Brand",          type:"select",
      options:["Toyota","Isuzu","Nissan","Mitsubishi","Mercedes-Benz","Other"] },
    { id:"cf-model",     label:"Model",                 type:"text",  placeholder:"e.g. Hiace, Coaster" },
    { id:"cf-year",      label:"Year of Manufacture",   type:"select",
      options:["2024","2023","2022","2021","2020","2019","2018","2017","2016","2015","Before 2015"] },
    { id:"cf-condition", label:"Condition",             type:"select",
      options:["Brand New","Foreign Used","Local Used"] },
    { id:"cf-seats",     label:"Seating Capacity",      type:"select",
      options:["7 Seater","11 Seater","14 Seater","18 Seater","25 Seater","30+ Seater"] },
    { id:"cf-fuel",      label:"Fuel Type",             type:"select",
      options:["Petrol","Diesel"] },
    { id:"cf-mileage",   label:"Mileage (km)",          type:"text",  placeholder:"e.g. 80,000 km" },
    { id:"cf-logbook",   label:"Logbook / Ownership Document", type:"select",
      options:["Available — Original Logbook","Processing / Pending","Not Available"] },
  ],

  "vehicles-Tractor / Heavy Equipment": [
    { id:"cf-type",      label:"Equipment Type",       type:"select",
      options:["Farm Tractor","Excavator","Bulldozer","Wheel Loader","Grader","Backhoe","Forklift","Crane","Other"] },
    { id:"cf-make",      label:"Make / Brand",         type:"text",  placeholder:"e.g. John Deere, Massey Ferguson, Komatsu" },
    { id:"cf-year",      label:"Year of Manufacture",  type:"select",
      options:["2024","2023","2022","2021","2020","Before 2020"] },
    { id:"cf-condition", label:"Condition",            type:"select",
      options:["Brand New","Foreign Used","Local Used","Needs Repair"] },
    { id:"cf-hours",     label:"Working Hours (if known)", type:"text", placeholder:"e.g. 2,500 hours" },
    { id:"cf-power",     label:"Horsepower / Capacity", type:"text", placeholder:"e.g. 75HP" },
  ],

  "vehicles-Trailer": [
    { id:"cf-type",      label:"Trailer Type",  type:"select",
      options:["Flatbed Trailer","Box Trailer","Tanker Trailer","Low Bed Trailer","Boat Trailer","Other"] },
    { id:"cf-capacity",  label:"Capacity",      type:"text", placeholder:"e.g. 10 tonnes" },
    { id:"cf-condition", label:"Condition",     type:"select",
      options:["Brand New","Foreign Used","Local Used"] },
  ],

  "vehicles-Boat / Watercraft": [
    { id:"cf-type",      label:"Watercraft Type", type:"select",
      options:["Fishing Boat","Speed Boat","Canoe","Ferry / Passenger Boat","Jet Ski","Other"] },
    { id:"cf-material",  label:"Material",        type:"select",
      options:["Fiberglass","Wood","Aluminum","Steel","Other"] },
    { id:"cf-condition", label:"Condition",       type:"select",
      options:["Brand New","Used — Good","Used — Needs Repair"] },
    { id:"cf-engine",    label:"Engine / Motor",  type:"text", placeholder:"e.g. 40HP Outboard, No Engine" },
  ],

  "repair-construction": [
    { id:"cf-rc-type", label:"Equipment / Material Category", type:"select",
      options:["Building Materials","Hand Tools & Power Tools","Welding & Fabrication Equipment","Plumbing Materials & Fittings","Electrical Materials & Wiring","Paint & Finishing Materials","Roofing Materials","Vehicle Repair Tools & Spare Parts"]
    },
  ],

  "repair-Building Materials": [
    { id:"cf-type",      label:"Material Type", type:"select",
      options:["Cement","Sand","Bricks / Blocks","Iron Bars / Rebar","Timber / Wood","Tiles","Glass","Ballast / Aggregate","Other"] },
    { id:"cf-quantity",  label:"Quantity",      type:"text", placeholder:"e.g. 100 bags, 500 bricks, 50 pieces" },
    { id:"cf-condition", label:"Condition",     type:"select",
      options:["Brand New","Surplus / Leftover (Good Condition)"] },
    { id:"cf-delivery",  label:"Delivery Available?", type:"select",
      options:["Yes – I can deliver","No – Buyer collects"] },
  ],

  "repair-Hand Tools & Power Tools": [
    { id:"cf-type",      label:"Tool Type",     type:"select",
      options:["Drill / Driver","Angle Grinder","Circular Saw","Hammer / Mallet","Spanner / Wrench Set","Toolbox / Tool Kit","Measuring Tools","Other"] },
    { id:"cf-brand",     label:"Brand",         type:"text", placeholder:"e.g. Bosch, DeWalt, Makita" },
    { id:"cf-condition", label:"Condition",     type:"select",
      options:["Brand New","Foreign Used","Local Used"] },
    { id:"cf-power-source",label:"Power Source", type:"select",
      options:["Electric (Corded)","Battery / Cordless","Manual","Not Applicable"] },
  ],

  "repair-Welding & Fabrication Equipment": [
    { id:"cf-type",      label:"Equipment Type", type:"select",
      options:["Welding Machine","Welding Rods / Electrodes","Cutting Torch / Gas Set","Grinding Disc / Accessories","Safety Gear (Helmet, Gloves)"] },
    { id:"cf-condition", label:"Condition",     type:"select",
      options:["Brand New","Foreign Used","Local Used"] },
    { id:"cf-power",     label:"Power Rating",  type:"text", placeholder:"e.g. 200A, 250A" },
  ],

  "repair-Plumbing Materials & Fittings": [
    { id:"cf-type",      label:"Material Type", type:"select",
      options:["Pipes (PVC/Galvanized)","Fittings / Connectors","Taps & Valves","Water Tank","Sanitary Ware (Toilet/Sink)","Plumbing Tools"] },
    { id:"cf-quantity",  label:"Quantity",      type:"text", placeholder:"e.g. 20 pipes, 1 tank (1000L)" },
    { id:"cf-condition", label:"Condition",     type:"select",
      options:["Brand New","Used – Good Condition"] },
  ],

  "repair-Electrical Materials & Wiring": [
    { id:"cf-type",      label:"Material Type", type:"select",
      options:["Electrical Wire / Cable","Switches & Sockets","Circuit Breakers / Distribution Board","Conduit Pipes","Light Fittings","Electrical Tools"] },
    { id:"cf-quantity",  label:"Quantity",      type:"text", placeholder:"e.g. 100m cable, 20 switches" },
    { id:"cf-condition", label:"Condition",     type:"select",
      options:["Brand New","Used – Good Condition"] },
  ],

  "repair-Paint & Finishing Materials": [
    { id:"cf-type",      label:"Material Type", type:"select",
      options:["Paint (Interior/Exterior)","Primer","Brushes & Rollers","Sandpaper / Filler","Spray Gun Equipment"] },
    { id:"cf-quantity",  label:"Quantity",      type:"text", placeholder:"e.g. 5 gallons, 2 rolls" },
    { id:"cf-condition", label:"Condition",     type:"select",
      options:["Brand New (Sealed)","Used / Surplus"] },
  ],

  "repair-Roofing Materials": [
    { id:"cf-type",      label:"Material Type", type:"select",
      options:["Roofing Sheets (Iron/Aluminum)","Roofing Tiles","Timber for Roofing","Gutters / Downpipes","Insulation Material","Roofing Nails / Fasteners"] },
    { id:"cf-quantity",  label:"Quantity",      type:"text", placeholder:"e.g. 50 sheets, 200 tiles" },
    { id:"cf-condition", label:"Condition",     type:"select",
      options:["Brand New","Surplus / Leftover (Good Condition)"] },
  ],

  "repair-Vehicle Repair Tools & Spare Parts": [
    { id:"cf-type",      label:"Item Type",     type:"select",
      options:["Vehicle Spare Parts","Mechanic Tool Set","Car Jack / Lifting Equipment","Diagnostic Scanner","Tyre Repair Equipment","Battery / Charging Equipment"] },
    { id:"cf-vehicle-make",label:"Compatible Vehicle Make", type:"text", placeholder:"e.g. Toyota, Universal Fit" },
    { id:"cf-condition", label:"Condition",     type:"select",
      options:["Brand New","Foreign Used","Local Used"] },
  ],


   property: [
    { id:"cf-property-type", label:"Property Type", type:"select",
      options:["Houses & Apartments for Rent","Houses & Apartments for Sale","Land for Sale","Land for Rent / Lease","Office & Commercial Space","Hostel / Student Housing","Guest House / Short-Stay"]
    },
  ],

  "property-Houses & Apartments for Rent": [
    { id:"cf-house-type",  label:"House Type",   type:"select",
      options:["Apartment / Flat","Bungalow","Maisonette","Single Room (Self-Contained)","Single Room (Shared)","Mansion / Villa"] },
    { id:"cf-bedrooms",    label:"Bedrooms",     type:"select",
      options:["Studio / Bedsitter","1 Bedroom","2 Bedrooms","3 Bedrooms","4 Bedrooms","5+ Bedrooms"] },
    { id:"cf-bathrooms",   label:"Bathrooms",    type:"select",
      options:["1","2","3","4+","Shared / Communal"] },
    { id:"cf-furnishing",  label:"Furnishing",   type:"select",
      options:["Fully Furnished","Semi Furnished","Unfurnished"] },
    { id:"cf-rent-period",label:"Rent Period",   type:"select",
      options:["Monthly","Quarterly","Yearly"] },
    { id:"cf-amenities",   label:"Amenities",    type:"text", placeholder:"e.g. Borehole, Electricity, Security, Parking" },
  ],

  "property-Houses & Apartments for Sale": [
    { id:"cf-house-type",  label:"House Type",   type:"select",
      options:["Bungalow","Maisonette","Apartment / Flat","Mansion / Villa","Townhouse"] },
    { id:"cf-bedrooms",    label:"Bedrooms",     type:"select",
      options:["1 Bedroom","2 Bedrooms","3 Bedrooms","4 Bedrooms","5+ Bedrooms"] },
    { id:"cf-bathrooms",   label:"Bathrooms",    type:"select",
      options:["1","2","3","4+"] },
    { id:"cf-size",        label:"Plot Size",    type:"text", placeholder:"e.g. 50x100ft, 0.25 acres" },
    { id:"cf-condition",   label:"Condition",    type:"select",
      options:["Brand New","Newly Renovated","Good Condition","Needs Renovation","Under Construction (Shell)"] },
    { id:"cf-title",       label:"Title / Ownership Document", type:"select",
      options:["Freehold Title","Leasehold Title","Mailo Land","Kibanja","Agreement Only","Processing / Pending"] },
    { id:"cf-payment-terms",label:"Payment Terms", type:"select",
      options:["Full Payment Only","Installments Accepted","Mortgage Friendly","Negotiable"] },
  ],

  "property-Land for Sale": [
    { id:"cf-land-type",   label:"Land Type",    type:"select",
      options:["Residential Plot","Commercial Plot","Agricultural Land","Industrial Land"] },
    { id:"cf-size",        label:"Size",         type:"text", placeholder:"e.g. 50x100ft, 5 acres" },
    { id:"cf-title",       label:"Title / Ownership Document", type:"select",
      options:["Freehold Title","Leasehold Title","Mailo Land","Kibanja","Agreement Only","Processing / Pending"] },
    { id:"cf-access",      label:"Road Access",  type:"select",
      options:["Tarmac Access","Murram Road Access","No Direct Road Access"] },
    { id:"cf-amenities",   label:"Nearby Amenities", type:"text", placeholder:"e.g. Near school, market, water source" },
    { id:"cf-payment-terms",label:"Payment Terms", type:"select",
      options:["Full Payment Only","Installments Accepted","Negotiable"] },
  ],

  "property-Land for Rent / Lease": [
    { id:"cf-land-type",   label:"Land Type",    type:"select",
      options:["Residential Plot","Commercial Plot","Agricultural Land","Event Grounds"] },
    { id:"cf-size",        label:"Size",         type:"text", placeholder:"e.g. 1 acre, 100x100ft" },
    { id:"cf-lease-period",label:"Lease Period",  type:"select",
      options:["Monthly","Yearly","5 Years","10+ Years","Negotiable"] },
  ],

  "property-Office & Commercial Space": [
    { id:"cf-space-type",  label:"Space Type",   type:"select",
      options:["Office Space","Shop / Retail Space","Warehouse","Showroom","Co-working Space"] },
    { id:"cf-size",        label:"Size (sq.ft)", type:"text", placeholder:"e.g. 1200 sq.ft" },
    { id:"cf-furnishing",  label:"Furnishing",   type:"select",
      options:["Fully Furnished","Semi Furnished","Unfurnished / Shell"] },
    { id:"cf-rent-period", label:"Rent Period",  type:"select",
      options:["Monthly","Yearly"] },
    { id:"cf-amenities",   label:"Amenities",    type:"text", placeholder:"e.g. Parking, Security, Generator backup" },
  ],

  "property-Hostel / Student Housing": [
    { id:"cf-room-type",   label:"Room Type",    type:"select",
      options:["Single Room","Double Sharing","Triple Sharing","Self-Contained"] },
    { id:"cf-nearby",      label:"Nearby Institution", type:"text", placeholder:"e.g. Makerere University, MUBS" },
    { id:"cf-rent-period", label:"Rent Period",  type:"select",
      options:["Per Semester","Per Year","Monthly"] },
    { id:"cf-amenities",   label:"Amenities",    type:"text", placeholder:"e.g. WiFi, Water, Security, Reading room" },
  ],

  "property-Guest House / Short-Stay": [
    { id:"cf-room-type",   label:"Room Type",    type:"select",
      options:["Single Room","Double Room","Self-Contained Suite","Whole House / Apartment"] },
    { id:"cf-pricing-type",label:"Pricing",      type:"select",
      options:["Per Night","Per Week","Per Month"] },
    { id:"cf-amenities",   label:"Amenities",    type:"text", placeholder:"e.g. WiFi, AC, Breakfast, Parking" },
  ],

    "leisure-activities": [
    { id:"cf-subcategory", label:"Subcategory", type:"select",
      options:["Personal Mobility","Sports Equipment","Massages","Musical Instruments & Gear","Books & Table Games","Arts, Crafts & Awards","Outdoor Gear","Smoking Accessories","Music & Video","Fitness & Personal Training Services"]
    },
  ],

  "leisure-Personal Mobility": [
    { id:"cf-type",      label:"Item Type",    type:"select",
      options:["Skateboard","Scooter (Kick)","Electric Scooter","Rollerblades / Skates","Hoverboard","Wheelchair","Walking Frame","Other"] },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Foreign Used","Local Used"] },
    { id:"cf-brand",     label:"Brand",        type:"text", placeholder:"e.g. Xiaomi, No Brand" },
  ],

  "leisure-Sports Equipment": [
    { id:"cf-sport",     label:"Sport",        type:"select",
      options:["Football","Basketball","Volleyball","Tennis","Badminton","Boxing","Gym Equipment","Swimming","Cycling","Cricket","Rugby","Athletics","Other"] },
    { id:"cf-type",      label:"Item Type",    type:"text", placeholder:"e.g. Ball, Net, Gloves, Jersey" },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Foreign Used","Local Used"] },
  ],

  "leisure-Massages": [
    { id:"cf-service-type", label:"Massage Type", type:"select",
      options:["Full Body Massage","Deep Tissue","Sports Massage","Swedish Massage","Hot Stone","Reflexology","Spa Package","Home Service Massage","Other"] },
    { id:"cf-gender",       label:"For",           type:"select",
      options:["Men","Women","Unisex"] },
    { id:"cf-service-mode", label:"Service Location", type:"select",
      options:["At my spa/salon","I come to client","Both options available"] },
    { id:"cf-pricing-type", label:"Pricing",       type:"select",
      options:["Per Session","Per Hour","Package Deal"] },
  ],

  "leisure-Musical Instruments & Gear": [
    { id:"cf-type",      label:"Instrument Type", type:"select",
      options:["Guitar","Keyboard / Piano","Drum Set","Microphone","Speaker / PA System","DJ Mixer","Violin","Saxophone","Other"] },
    { id:"cf-condition", label:"Condition",       type:"select",
      options:["Brand New","Foreign Used","Local Used"] },
    { id:"cf-brand",     label:"Brand",           type:"text", placeholder:"e.g. Yamaha, Casio" },
  ],

  "leisure-Books & Table Games": [
    { id:"cf-type",      label:"Item Type",    type:"select",
      options:["Novel / Fiction Book","Textbook","Religious Book","Chess Set","Ludo / Board Game","Card Games (e.g. Cards, UNO)","Puzzle","Other"] },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Used — Good","Used — Fair"] },
  ],

  "leisure-Arts, Crafts & Awards": [
    { id:"cf-type",      label:"Item Type",    type:"select",
      options:["Painting","Handmade Craft","Sculpture","Trophy / Award","Certificate Frame","Craft Materials","Other"] },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Used"] },
  ],

  "leisure-Outdoor Gear": [
    { id:"cf-type",      label:"Item Type",    type:"select",
      options:["Tent","Camping Chair","Sleeping Bag","Hiking Backpack","Cooler Box","Fishing Gear","BBQ / Grill","Other"] },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Foreign Used","Local Used"] },
  ],

  "leisure-Smoking Accessories": [
    { id:"cf-type",      label:"Item Type",    type:"select",
      options:["Lighter","Ashtray","Pipe","Rolling Accessories","Other"] },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Used"] },
  ],

  "leisure-Music & Video": [
    { id:"cf-type",      label:"Item Type",    type:"select",
      options:["CD / DVD Collection","Vinyl Records","Projector","Home Theatre System","Camera Equipment","Other"] },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Foreign Used","Local Used"] },
  ],

  "leisure-Fitness & Personal Training Services": [
    { id:"cf-service-type", label:"Service Type", type:"select",
      options:["Personal Trainer","Group Fitness Class","Yoga Instructor","Nutrition Coaching","Gym Membership","Home Workout Sessions","Other"] },
    { id:"cf-experience",   label:"Experience",    type:"select",
      options:["Less than 1 year","1–2 years","3–5 years","5+ years"] },
    { id:"cf-service-mode", label:"Service Location", type:"select",
      options:["At my gym/studio","I come to client","Online sessions","Both options available"] },
  ],


  animals: [
    { id:"cf-animal-type", label:"Animal Category", type:"select",
      options:["Dogs & Cats (Pets)","Livestock (Cattle, Goats, Sheep, Pigs)","Poultry (Chicken, Duck, Turkey)","Birds (Parrots, Pigeons)","Fish & Aquarium","Horses & Donkeys"]
    },
  ],

  "animals-Dogs & Cats (Pets)": [
    { id:"cf-type",      label:"Animal",         type:"select",
      options:["Dog","Cat"] },
    { id:"cf-breed",     label:"Breed",          type:"text", placeholder:"e.g. German Shepherd, Poodle, Persian" },
    { id:"cf-age",       label:"Age",            type:"select",
      options:["Puppy/Kitten (0–6 months)","6–12 months","1–2 years","2–5 years","5+ years"] },
    { id:"cf-gender",    label:"Gender",         type:"select",
      options:["Male","Female"] },
    { id:"cf-vaccinated",label:"Vaccinated?",    type:"select",
      options:["Yes – fully vaccinated","Partially vaccinated","Not vaccinated"] },
    { id:"cf-purpose",   label:"Purpose",        type:"select",
      options:["Pet / Companion","Breeding","Guard Dog","Show / Exhibition"] },
  ],

  "animals-Livestock (Cattle, Goats, Sheep, Pigs)": [
    { id:"cf-type",      label:"Animal",         type:"select",
      options:["Cow / Bull","Goat","Sheep","Pig"] },
    { id:"cf-breed",     label:"Breed",          type:"text", placeholder:"e.g. Friesian, Boer Goat" },
    { id:"cf-age",       label:"Age",            type:"select",
      options:["Newborn","3–6 months","6–12 months","1–2 years","2+ years"] },
    { id:"cf-gender",    label:"Gender",         type:"select",
      options:["Male","Female","Pair","Mixed Group / Herd"] },
    { id:"cf-purpose",   label:"Purpose",        type:"select",
      options:["Dairy (Milk)","Meat","Breeding","Work / Farm"] },
    { id:"cf-quantity",  label:"Quantity",       type:"text", placeholder:"e.g. 1 animal, 5 head of cattle" },
  ],

  "animals-Poultry (Chicken, Duck, Turkey)": [
    { id:"cf-type",      label:"Bird Type",      type:"select",
      options:["Chicken (Layers)","Chicken (Broilers)","Local / Kuroiler Chicken","Duck","Turkey"] },
    { id:"cf-age",       label:"Age",            type:"select",
      options:["Day-Old Chicks","1–4 weeks","1–3 months","Mature / Laying"] },
    { id:"cf-vaccinated",label:"Vaccinated?",    type:"select",
      options:["Yes","No","Not Applicable"] },
    { id:"cf-quantity",  label:"Quantity",       type:"text", placeholder:"e.g. 50 chicks, 10 layers" },
  ],

  "animals-Birds (Parrots, Pigeons)": [
    { id:"cf-type",      label:"Bird Type",      type:"select",
      options:["Parrot","Pigeon","Lovebird","Canary","Other"] },
    { id:"cf-age",       label:"Age",            type:"select",
      options:["Young","Adult"] },
    { id:"cf-quantity",  label:"Quantity",       type:"text", placeholder:"e.g. 1 bird, pair" },
  ],

  "animals-Fish & Aquarium": [
    { id:"cf-type",      label:"Type",           type:"select",
      options:["Aquarium Fish (Ornamental)","Tilapia / Farm Fish","Catfish","Complete Aquarium Set-up"] },
    { id:"cf-quantity",  label:"Quantity",       type:"text", placeholder:"e.g. 10 fish, 1 tank" },
  ],

  "animals-Horses & Donkeys": [
    { id:"cf-type",      label:"Animal",         type:"select",
      options:["Horse","Donkey"] },
    { id:"cf-age",       label:"Age",            type:"select",
      options:["Young (Under 2 years)","2–5 years","5+ years"] },
    { id:"cf-purpose",   label:"Purpose",        type:"select",
      options:["Riding","Work / Farm","Breeding"] },
  ],

  babies: [
    { id:"cf-baby-type", label:"Item Category", type:"select",
      options:["Baby Clothing & Shoes","Baby Gear (Pram, Cot, Car Seat)","Feeding & Nursing","Diapers & Baby Care","Baby Toys & Books","Kids Clothing & Shoes (2-12yrs)","Kids Furniture & School Items"]
    },
  ],

  "babies-Baby Clothing & Shoes": [
    { id:"cf-type",      label:"Item Type",    type:"select",
      options:["Baby Clothes","Baby Shoes","Baby Hats / Accessories"] },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Slightly Used","Used – Good Condition"] },
    { id:"cf-gender",    label:"For",          type:"select",
      options:["Boys","Girls","Unisex"] },
    { id:"cf-size",      label:"Size",         type:"select",
      options:["Newborn","0–3M","3–6M","6–9M","9–12M","12–18M","18–24M","2T","3T"] },
  ],

  "babies-Baby Gear (Pram, Cot, Car Seat)": [
    { id:"cf-type",      label:"Item Type",    type:"select",
      options:["Pram / Stroller","Baby Cot / Crib","Car Seat","Baby Carrier / Sling","Baby Bath Tub","Baby Monitor"] },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Slightly Used","Used – Good Condition"] },
    { id:"cf-brand",     label:"Brand",        type:"text", placeholder:"e.g. Chicco, Graco" },
  ],

  "babies-Feeding & Nursing": [
    { id:"cf-type",      label:"Item Type",    type:"select",
      options:["Feeding Bottles","Breast Pump","High Chair","Baby Food / Formula","Sterilizer","Bibs"] },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New (Sealed)","Used – Sanitized"] },
  ],

  "babies-Diapers & Baby Care": [
    { id:"cf-type",      label:"Item Type",    type:"select",
      options:["Diapers / Nappies","Baby Wipes","Baby Lotion / Powder","Baby Bathing Products"] },
    { id:"cf-size",      label:"Diaper Size (if applicable)", type:"select",
      options:["Newborn","Size 1","Size 2","Size 3","Size 4","Size 5","Size 6","Not Applicable"] },
    { id:"cf-quantity",  label:"Quantity",     type:"text", placeholder:"e.g. 1 pack, 50 pieces" },
  ],

  "babies-Baby Toys & Books": [
    { id:"cf-type",      label:"Item Type",    type:"select",
      options:["Baby Toys","Kids Books","Educational Toys","Soft Toys / Stuffed Animals"] },
    { id:"cf-age-group", label:"Suitable Age", type:"select",
      options:["0–1 years","1–3 years","3–5 years","5–8 years","8–12 years"] },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Used – Good Condition"] },
  ],

  "babies-Kids Clothing & Shoes (2-12yrs)": [
    { id:"cf-type",      label:"Item Type",    type:"select",
      options:["Kids Clothes","Kids Shoes","Kids Uniform"] },
    { id:"cf-gender",    label:"For",          type:"select",
      options:["Boys","Girls","Unisex"] },
    { id:"cf-size",      label:"Size",         type:"select",
      options:["2T","3T","4T","5T","6","8","10","12","14"] },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Used – Good Condition"] },
  ],

  "babies-Kids Furniture & School Items": [
    { id:"cf-type",      label:"Item Type",    type:"select",
      options:["Kids Bed / Furniture","Kids Bicycle","School Bag","School Books / Stationery","Study Desk"] },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Used – Good Condition"] },
  ],

  agriculture: [
    { id:"cf-agri-type", label:"Category", type:"select",
      options:["Crops & Produce","Livestock & Poultry","Seeds, Fertilizer & Farm Inputs","Farm Equipment & Machinery","Land for Farming","Agricultural Services"]
    },
  ],

  "agriculture-Crops & Produce": [
    { id:"cf-type",      label:"Crop Type",      type:"select",
      options:["Maize / Corn","Beans","Rice","Cassava","Sweet Potatoes","Matooke / Bananas","Coffee","Tea","Cotton","Groundnuts","Soybeans","Sunflower","Vegetables","Fruits","Other"] },
    { id:"cf-condition", label:"State",          type:"select",
      options:["Fresh Harvest","Dried / Processed","Ready for Market","Seedlings / Young Plants"] },
    { id:"cf-quantity",  label:"Quantity",       type:"text", placeholder:"e.g. 2 tonnes, 50 bags (100kg each)" },
    { id:"cf-organic",   label:"Farming Method", type:"select",
      options:["Conventional","Organic / No Chemicals","Mixed"] },
    { id:"cf-delivery",  label:"Delivery Available?", type:"select",
      options:["Yes – I can deliver","No – Buyer collects","Both options"] },
  ],

  "agriculture-Livestock & Poultry": [
    { id:"cf-type",      label:"Animal Type",    type:"select",
      options:["Cattle","Goats","Pigs","Poultry / Chicken","Fish (Farmed)","Other"] },
    { id:"cf-quantity",  label:"Quantity",       type:"text", placeholder:"e.g. 5 cows, 100 chicks" },
    { id:"cf-purpose",   label:"Purpose",        type:"select",
      options:["Dairy / Milk","Meat","Breeding","Eggs"] },
    { id:"cf-delivery",  label:"Delivery Available?", type:"select",
      options:["Yes – I can deliver","No – Buyer collects"] },
  ],

  "agriculture-Seeds, Fertilizer & Farm Inputs": [
    { id:"cf-type",      label:"Input Type",     type:"select",
      options:["Seeds / Seedlings","Fertilizer","Manure","Pesticides / Herbicides","Animal Feed"] },
    { id:"cf-crop",      label:"For Crop / Use",  type:"text", placeholder:"e.g. Maize seeds, Coffee fertilizer" },
    { id:"cf-quantity",  label:"Quantity",       type:"text", placeholder:"e.g. 1 bag (50kg), 1 kg" },
  ],

  "agriculture-Farm Equipment & Machinery": [
    { id:"cf-type",      label:"Equipment Type", type:"select",
      options:["Tractor","Irrigation Equipment","Farm Tools (Hand)","Milking Machine","Sprayer","Harvester","Other"] },
    { id:"cf-condition", label:"Condition",      type:"select",
      options:["Brand New","Foreign Used","Local Used"] },
    { id:"cf-negotiable",label:"Price Negotiable?", type:"select",
      options:["Yes, negotiable","No, fixed price"] },
  ],

  "agriculture-Land for Farming": [
    { id:"cf-size",      label:"Size",           type:"text", placeholder:"e.g. 5 acres, 2 hectares" },
    { id:"cf-soil-type", label:"Soil / Land Type", type:"select",
      options:["Fertile / Loam Soil","Sandy Soil","Clay Soil","Swampy / Wetland","Mixed"] },
    { id:"cf-listing-type", label:"Listing Type", type:"select",
      options:["For Sale","For Lease / Rent"] },
    { id:"cf-water-source", label:"Water Source", type:"select",
      options:["Borehole","River / Stream Nearby","Rain-fed Only","Irrigation System"] },
  ],

  "agriculture-Agricultural Services": [
    { id:"cf-service-type", label:"Service Type", type:"select",
      options:["Tractor / Ploughing Service","Crop Spraying Service","Land Clearing","Farm Consultancy","Veterinary Service","Harvesting Service"] },
    { id:"cf-pricing-type", label:"Pricing",       type:"select",
      options:["Per Acre","Per Hour","Per Job","Negotiable"] },
    { id:"cf-area-covered", label:"Area Covered",  type:"select",
      options:["Central Uganda","Eastern Uganda","Northern Uganda","Western Uganda","All Uganda"] },
  ],

  commercial: [
    { id:"cf-commercial-type", label:"Equipment Category", type:"select",
      options:["Power & Construction Equipment","Industrial Machinery","Security & Office Equipment","Catering & Cold Storage Equipment","Salon, Gym & Medical Equipment"]
    },
  ],

  "commercial-Power & Construction Equipment": [
    { id:"cf-type",       label:"Equipment Type",    type:"select",
      options:["Generator","Compressor","Borehole / Water Pump","Scaffolding","Forklift / Crane","Concrete Mixer","Solar System (Commercial)"] },
    { id:"cf-condition",  label:"Condition",         type:"select",
      options:["Brand New","Foreign Used","Local Used","Refurbished"] },
    { id:"cf-power",      label:"Power / Capacity",  type:"text", placeholder:"e.g. 5KVA, 10 tonnes" },
    { id:"cf-negotiable", label:"Price Negotiable?", type:"select",
      options:["Yes, negotiable","No, fixed price"] },
  ],

  "commercial-Industrial Machinery": [
    { id:"cf-type",       label:"Machine Type",      type:"select",
      options:["Welding Machine","Printing Machine","Cutting Machine","Lathe / CNC Machine","Sewing Machine (Industrial)","Other"] },
    { id:"cf-condition",  label:"Condition",         type:"select",
      options:["Brand New","Foreign Used","Local Used"] },
    { id:"cf-brand",      label:"Brand",             type:"text", placeholder:"e.g. Juki, Bosch" },
    { id:"cf-warranty",   label:"Warranty",          type:"select",
      options:["No Warranty","Shop Warranty","Manufacturer Warranty"] },
  ],

  "commercial-Security & Office Equipment": [
    { id:"cf-type",       label:"Item Type",         type:"select",
      options:["CCTV / Security System","POS / Cash Register","Office Furniture (Bulk)","Safe / Vault","Biometric System"] },
    { id:"cf-condition",  label:"Condition",         type:"select",
      options:["Brand New","Foreign Used","Local Used"] },
    { id:"cf-quantity",   label:"Quantity",          type:"text", placeholder:"e.g. 4 cameras, 10 desks" },
  ],

  "commercial-Catering & Cold Storage Equipment": [
    { id:"cf-type",       label:"Item Type",         type:"select",
      options:["Refrigeration / Cold Room","Industrial Oven / Bakery Equipment","Commercial Fridge / Freezer","Food Warmer","Other"] },
    { id:"cf-condition",  label:"Condition",         type:"select",
      options:["Brand New","Foreign Used","Local Used"] },
    { id:"cf-capacity",   label:"Capacity",          type:"text", placeholder:"e.g. 500L cold room" },
  ],

  "commercial-Salon, Gym & Medical Equipment": [
    { id:"cf-type",       label:"Item Type",         type:"select",
      options:["Salon Equipment","Gym Equipment","Medical Equipment","Spa Equipment"] },
    { id:"cf-condition",  label:"Condition",         type:"select",
      options:["Brand New","Foreign Used","Local Used"] },
    { id:"cf-warranty",   label:"Warranty",          type:"select",
      options:["No Warranty","Shop Warranty","Manufacturer Warranty"] },
  ],

  tours: [
    { id:"cf-tour-type", label:"Category", type:"select",
      options:["Wildlife & Nature Tours","Adventure & Outdoor Activities","Cultural & City Tours","Beach, Resort & Cruise","Holiday Packages & Group Trips"]
    },
  ],

  "tours-Wildlife & Nature Tours": [
    { id:"cf-type",        label:"Tour Type",    type:"select",
      options:["Safari (Wildlife)","Gorilla Trekking","Chimpanzee Trekking","Birdwatching"] },
    { id:"cf-destination", label:"Destination",  type:"text", placeholder:"e.g. Bwindi, Queen Elizabeth, Murchison Falls" },
    { id:"cf-duration",    label:"Duration",     type:"select",
      options:["Half Day","Full Day","2 Days","3 Days","4+ Days"] },
    { id:"cf-includes",    label:"Includes",     type:"text", placeholder:"e.g. Transport, Park Fees, Meals" },
  ],

  "tours-Adventure & Outdoor Activities": [
    { id:"cf-type",        label:"Activity Type", type:"select",
      options:["Mountain Hiking","White Water Rafting","Camping","Quad Biking","Bungee Jumping","Zip-lining"] },
    { id:"cf-destination", label:"Location",     type:"text", placeholder:"e.g. Jinja, Sipi Falls, Mt. Elgon" },
    { id:"cf-duration",    label:"Duration",     type:"select",
      options:["Few Hours","Half Day","Full Day","Weekend (2 days)","Multi-day"] },
    { id:"cf-group-size",  label:"Group Size",   type:"select",
      options:["Solo","Couple","Small Group (3–6)","Large Group (7+)"] },
  ],

  "tours-Cultural & City Tours": [
    { id:"cf-type",        label:"Tour Type",    type:"select",
      options:["City Tour","Cultural / Heritage Tour","Local Village Experience","Market Tour"] },
    { id:"cf-destination", label:"Destination",  type:"text", placeholder:"e.g. Kampala, Jinja, Fort Portal" },
    { id:"cf-duration",    label:"Duration",     type:"select",
      options:["Half Day","Full Day"] },
  ],

  "tours-Beach, Resort & Cruise": [
    { id:"cf-type",        label:"Type",         type:"select",
      options:["Beach / Resort Stay","Boat Cruise","Lake Trip","Island Getaway"] },
    { id:"cf-destination", label:"Destination",  type:"text", placeholder:"e.g. Lake Victoria, Lake Bunyonyi, Zanzibar" },
    { id:"cf-duration",    label:"Duration",     type:"select",
      options:["Half Day","Full Day","Weekend","3+ Days"] },
  ],

  "tours-Holiday Packages & Group Trips": [
    { id:"cf-type",        label:"Package Type", type:"select",
      options:["Honeymoon Package","Family Holiday","School Trip","Corporate Retreat","International Travel Package"] },
    { id:"cf-duration",    label:"Duration",     type:"select",
      options:["Weekend (2 days)","3 Days","5 Days","1 Week","2 Weeks","Custom / Flexible"] },
    { id:"cf-group-size",  label:"Group Size",   type:"select",
      options:["1 Person","Couple","Small Group (3–10)","Large Group (10+)"] },
    { id:"cf-includes",    label:"Includes",     type:"text", placeholder:"e.g. Transport, Accommodation, Meals" },
  ],

  "seeking-work": [
    { id:"cf-job-category", label:"Job Category", type:"select",
      options:["Domestic & Care Work","Technical & Skilled Trades","Office & Professional Jobs","Sales, Marketing & Customer Service","Creative & IT Services","Transport & Logistics"]
    },
  ],

  "seeking-Domestic & Care Work": [
    { id:"cf-type",        label:"Job Type",     type:"select",
      options:["Cleaner / Housekeeper","Cook / Chef","Nanny / Babysitter","Nurse / Caregiver","Gardener"] },
    { id:"cf-experience",  label:"Years of Experience", type:"select",
      options:["No experience","Less than 1 year","1–2 years","3–5 years","5+ years"] },
    { id:"cf-availability",label:"Availability", type:"select",
      options:["Immediately available","Live-in (Stay at employer's home)","Live-out (Daily/Part-time)","Weekends only"] },
    { id:"cf-salary",      label:"Expected Salary", type:"text", placeholder:"e.g. UGX 300,000/month or Negotiable" },
    { id:"cf-gender",      label:"Gender",       type:"select",
      options:["Male","Female","Prefer not to say"] },
  ],

  "seeking-Technical & Skilled Trades": [
    { id:"cf-type",        label:"Job Type",     type:"select",
      options:["Electrician","Plumber","Mason / Builder","Mechanic","Carpenter","Tailor / Seamstress","Welder","Driver / Chauffeur","Security Guard"] },
    { id:"cf-experience",  label:"Years of Experience", type:"select",
      options:["No experience","Less than 1 year","1–2 years","3–5 years","5–10 years","10+ years"] },
    { id:"cf-certification",label:"Certification / License", type:"text", placeholder:"e.g. Driving Permit Class B, Trade Test Cert" },
    { id:"cf-availability",label:"Availability", type:"select",
      options:["Immediately available","Available in 2 weeks","Part-time only","Flexible"] },
    { id:"cf-salary",      label:"Expected Salary", type:"text", placeholder:"e.g. UGX 500,000/month or Negotiable" },
  ],

  "seeking-Office & Professional Jobs": [
    { id:"cf-type",        label:"Job Type",     type:"select",
      options:["Accountant","Teacher / Tutor","Receptionist / Admin","Data Entry","HR Officer","Legal / Paralegal","Other Professional"] },
    { id:"cf-education",   label:"Highest Education", type:"select",
      options:["Certificate","Diploma","Bachelor's Degree","Master's Degree","PhD","Professional Certification"] },
    { id:"cf-experience",  label:"Years of Experience", type:"select",
      options:["No experience (fresh graduate)","1–2 years","3–5 years","5–10 years","10+ years"] },
    { id:"cf-location-pref",label:"Preferred Work Location", type:"select",
      options:["Kampala only","Any location in Uganda","Open to relocation","Remote"] },
    { id:"cf-salary",      label:"Expected Salary", type:"text", placeholder:"e.g. UGX 800,000/month or Negotiable" },
  ],

  "seeking-Sales, Marketing & Customer Service": [
    { id:"cf-type",        label:"Job Type",     type:"select",
      options:["Sales Person","Marketing Officer","Customer Service Agent","Social Media Manager","Telemarketer"] },
    { id:"cf-experience",  label:"Years of Experience", type:"select",
      options:["No experience","1–2 years","3–5 years","5+ years"] },
    { id:"cf-availability",label:"Availability", type:"select",
      options:["Full Time","Part Time","Commission-Based Work"] },
    { id:"cf-salary",      label:"Expected Salary", type:"text", placeholder:"e.g. UGX 400,000/month + commission" },
  ],

  "seeking-Creative & IT Services": [
    { id:"cf-type",        label:"Job Type",     type:"select",
      options:["IT / Developer","Graphic Designer","Photographer / Videographer","Event Planner","Web Designer"] },
    { id:"cf-experience",  label:"Years of Experience", type:"select",
      options:["No experience","1–2 years","3–5 years","5+ years"] },
    { id:"cf-portfolio",   label:"Portfolio / Sample Work Link", type:"text", placeholder:"e.g. Instagram page, website link" },
    { id:"cf-availability",label:"Availability", type:"select",
      options:["Remote / Online only","On-site","Both / Flexible"] },
    { id:"cf-salary",      label:"Expected Rate", type:"text", placeholder:"e.g. Per project, UGX 500,000/month" },
  ],

  "seeking-Transport & Logistics": [
    { id:"cf-type",        label:"Job Type",     type:"select",
      options:["Driver (Private)","Driver (Commercial/Truck)","Boda Boda Rider","Delivery Rider","Logistics Coordinator"] },
    { id:"cf-license",     label:"License Class", type:"select",
      options:["Class A (Motorcycle)","Class B (Light Vehicle)","Class C (Truck)","Class D (PSV)","No License"] },
    { id:"cf-experience",  label:"Years of Experience", type:"select",
      options:["Less than 1 year","1–2 years","3–5 years","5+ years"] },
    { id:"cf-salary",      label:"Expected Salary", type:"text", placeholder:"e.g. UGX 350,000/month" },
  ],

  "phone-accessories": [
    { id:"cf-phoneacc-type", label:"Item Category", type:"select",
      options:["Phone Cases & Covers","Screen Protectors / Tempered Glass","Chargers & Cables","Batteries & Power Banks","Phone Spare Parts (Screens, Buttons, etc.)","Earphones & Headsets","Memory Cards & Storage","SIM Trays & Small Accessories"]
    },
  ],

  "phone-Phone Cases & Covers": [
    { id:"cf-phone-model", label:"Compatible Phone Model", type:"text", placeholder:"e.g. iPhone 13, Samsung A14, Tecno Spark" },
    { id:"cf-type",        label:"Case Type",     type:"select",
      options:["Silicone Case","Leather Case","Hard Plastic Case","Flip Cover","Wallet Case","Shockproof Case"] },
    { id:"cf-condition",   label:"Condition",     type:"select",
      options:["Brand New"] },
    { id:"cf-color",       label:"Color",         type:"text", placeholder:"e.g. Black, Clear, Red" },
  ],

  "phone-Screen Protectors / Tempered Glass": [
    { id:"cf-phone-model", label:"Compatible Phone Model", type:"text", placeholder:"e.g. iPhone 13, Samsung A14" },
    { id:"cf-type",        label:"Protector Type", type:"select",
      options:["Tempered Glass","Privacy Glass","Plastic Film","Camera Lens Protector"] },
    { id:"cf-quantity",    label:"Quantity",      type:"text", placeholder:"e.g. 1 piece, pack of 3" },
  ],

  "phone-Chargers & Cables": [
    { id:"cf-type",        label:"Item Type",     type:"select",
      options:["Wall Charger / Adapter","USB Cable","Wireless Charger","Car Charger","Fast Charger"] },
    { id:"cf-port-type",   label:"Port Type",     type:"select",
      options:["Type-C","Lightning (iPhone)","Micro USB","Multiple / Universal"] },
    { id:"cf-condition",   label:"Condition",     type:"select",
      options:["Brand New","Used – Working"] },
    { id:"cf-brand",       label:"Brand (optional)", type:"text", placeholder:"e.g. Samsung, Anker, Original" },
  ],

  "phone-Batteries & Power Banks": [
    { id:"cf-type",        label:"Item Type",     type:"select",
      options:["Phone Battery (Internal Replacement)","Power Bank / Portable Charger"] },
    { id:"cf-phone-model", label:"Compatible Phone Model (if battery)", type:"text", placeholder:"e.g. iPhone 11, Samsung A10" },
    { id:"cf-capacity",    label:"Capacity (mAh)", type:"text", placeholder:"e.g. 3000mAh, 10000mAh" },
    { id:"cf-condition",   label:"Condition",     type:"select",
      options:["Brand New","Used – Working"] },
  ],

  "phone-Phone Spare Parts (Screens, Buttons, etc.)": [
    { id:"cf-type",        label:"Part Type",     type:"select",
      options:["Screen / Display","Back Glass / Cover","Battery (Internal)","Camera Module","Charging Port Flex","Power/Volume Buttons","Speaker / Earpiece","Motherboard","Other"] },
    { id:"cf-phone-model", label:"Compatible Phone Model", type:"text", placeholder:"e.g. iPhone X, Samsung S20" },
    { id:"cf-condition",   label:"Condition",     type:"select",
      options:["Brand New","Used – Working","Refurbished"] },
    { id:"cf-quality",     label:"Quality Grade",  type:"select",
      options:["Original / OEM","Copy / Aftermarket","Not Sure"] },
  ],

  "phone-Earphones & Headsets": [
    { id:"cf-type",        label:"Item Type",     type:"select",
      options:["Wired Earphones","Bluetooth Earbuds","Over-Ear Headphones","Gaming Headset"] },
    { id:"cf-brand",       label:"Brand",         type:"text", placeholder:"e.g. Samsung, JBL, Apple AirPods" },
    { id:"cf-condition",   label:"Condition",     type:"select",
      options:["Brand New","Foreign Used","Local Used"] },
  ],

  "phone-Memory Cards & Storage": [
    { id:"cf-type",        label:"Item Type",     type:"select",
      options:["Memory Card (SD/MicroSD)","USB Flash Drive","Phone Storage Adapter"] },
    { id:"cf-capacity",    label:"Capacity",      type:"select",
      options:["8GB","16GB","32GB","64GB","128GB","256GB","512GB"] },
    { id:"cf-condition",   label:"Condition",     type:"select",
      options:["Brand New","Used – Working"] },
  ],

  "phone-SIM Trays & Small Accessories": [
    { id:"cf-type",        label:"Item Type",     type:"select",
      options:["SIM Tray / Ejector Pin","Phone Stand / Holder","Pop Socket","Phone Ring Holder","Cleaning Kit","Other"] },
    { id:"cf-phone-model", label:"Compatible Phone Model (if applicable)", type:"text", placeholder:"e.g. Universal, iPhone 12" },
    { id:"cf-condition",   label:"Condition",     type:"select",
      options:["Brand New"] },
  ],

};

// ── Render dynamic fields into Step 2 ────────
// Categories that use the two-step (pick subtype → different fields) pattern
const TWO_STEP_CATEGORIES = [
  "vehicles", "leisure-activities", "electronics", "home", "gaming", "property",
  "repair-construction", "commercial", "animals", "babies",
  "agriculture", "tours", "seeking-work",
  "fashion", "computers", "accessories", "phone-accessories"
];

function renderCategoryFields(category) {
  const container = document.getElementById("category-fields");
  if (!container) return;

  if (TWO_STEP_CATEGORIES.includes(category)) {
    renderTwoStepFields(category);
    return;
  }

  const fields = CATEGORY_FIELDS[category] || [];
  if (fields.length === 0) { container.innerHTML = ""; return; }

  container.innerHTML = `
    <div style="border-top:1.5px solid #f0f0f0;margin:16px 0"></div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
      <span style="font-size:18px">${categoryEmoji(category)}</span>
      <p style="font-size:13px;font-weight:800;color:#ff6600;text-transform:uppercase;letter-spacing:.5px;margin:0">
        ${category.charAt(0).toUpperCase()+category.slice(1)} Details
      </p>
    </div>
    ${fields.map(f => `
      <div style="margin-bottom:14px">
        <label style="display:block;font-size:12px;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">
          ${f.label}
        </label>
        ${f.type === "select" ? `
          <select id="${f.id}" style="width:100%;padding:13px 14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:14px;font-family:var(--font);outline:none;background:white;box-sizing:border-box"
            onfocus="this.style.borderColor='#ff6600'" onblur="this.style.borderColor='#e5e7eb'">
            <option value="">Select ${f.label}</option>
            ${f.options.map(o => `<option value="${o}">${o}</option>`).join("")}
          </select>
        ` : `
          <input type="text" id="${f.id}" placeholder="${f.placeholder || ""}"
            style="width:100%;padding:13px 14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:14px;font-family:var(--font);outline:none;background:white;box-sizing:border-box"
            onfocus="this.style.borderColor='#ff6600'" onblur="this.style.borderColor='#e5e7eb'">
        `}
      </div>
    `).join("")}
  `;
}

// ── Generic two-step renderer for Electronics, Home, etc. ──
function renderTwoStepFields(category) {
  const container = document.getElementById("category-fields");

  // Vehicles and Leisure keep their existing custom renderers
  if (category === "vehicles") { renderVehicleFields(); return; }
  if (category === "leisure-activities") { renderLeisureFields(); return; }

  const baseField = CATEGORY_FIELDS[category]?.[0];
  if (!baseField) { container.innerHTML = ""; return; }

  container.innerHTML = `
    <div style="border-top:1.5px solid #f0f0f0;margin:16px 0"></div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
      <span style="font-size:18px">${categoryEmoji(category)}</span>
      <p style="font-size:13px;font-weight:800;color:#ff6600;text-transform:uppercase;letter-spacing:.5px;margin:0">
        ${category.charAt(0).toUpperCase() + category.slice(1)} Details
      </p>
    </div>
    <div style="margin-bottom:14px">
      <label style="display:block;font-size:12px;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">
        ${baseField.label}
      </label>
      <select id="${baseField.id}" onchange="onTwoStepChange('${category}', this.value)"
        style="width:100%;padding:13px 14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:14px;font-family:var(--font);outline:none;background:white;box-sizing:border-box">
        <option value="">Select ${baseField.label}</option>
        ${baseField.options.map(o => `<option value="${o}">${o}</option>`).join("")}
      </select>
    </div>
    <div id="two-step-sub-fields"></div>
  `;
}

window.onTwoStepChange = function(category, subValue) {
  const box = document.getElementById("two-step-sub-fields");
  if (!subValue) { box.innerHTML = ""; return; }

  const fields = CATEGORY_FIELDS[`${category}-${subValue}`] || [];

  box.innerHTML = fields.map(f => `
    <div style="margin-bottom:14px">
      <label style="display:block;font-size:12px;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">
        ${f.label}
      </label>
      ${f.type === "select" ? `
        <select id="${f.id}" style="width:100%;padding:13px 14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:14px;font-family:var(--font);outline:none;background:white;box-sizing:border-box">
          <option value="">Select ${f.label}</option>
          ${f.options.map(o => `<option value="${o}">${o}</option>`).join("")}
        </select>
      ` : `
        <input type="text" id="${f.id}" placeholder="${f.placeholder || ""}"
          style="width:100%;padding:13px 14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:14px;font-family:var(--font);outline:none;background:white;box-sizing:border-box">
      `}
    </div>
  `).join("");
};

// ── Vehicles: two-stage field reveal ──────────
function renderVehicleFields() {
  const container = document.getElementById("category-fields");

  container.innerHTML = `
    <div style="border-top:1.5px solid #f0f0f0;margin:16px 0"></div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
      <span style="font-size:18px">🚗</span>
      <p style="font-size:13px;font-weight:800;color:#ff6600;text-transform:uppercase;letter-spacing:.5px;margin:0">
        Vehicle Details
      </p>
    </div>
    <div style="margin-bottom:14px">
      <label style="display:block;font-size:12px;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">
        Vehicle Type
      </label>
      <select id="cf-vehicle-type" onchange="onVehicleTypeChange(this.value)"
        style="width:100%;padding:13px 14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:14px;font-family:var(--font);outline:none;background:white;box-sizing:border-box">
        <option value="">Select Vehicle Type</option>
        <option value="Car">🚗 Car</option>
        <option value="Motorcycle / Boda Boda">🏍️ Motorcycle / Boda Boda</option>
        <option value="Bicycle">🚲 Bicycle</option>
        <option value="Truck / Lorry">🚚 Truck / Lorry</option>
        <option value="Bus / Minibus">🚌 Bus / Minibus</option>
        <option value="Tractor / Heavy Equipment">🚜 Tractor / Heavy Equipment</option>
        <option value="Trailer">🚛 Trailer</option>
        <option value="Boat / Watercraft">🚤 Boat / Watercraft</option>
      </select>
    </div>
    <div id="vehicle-type-fields"></div>
  `;
}

window.onVehicleTypeChange = function(vehicleType) {
  const sub = document.getElementById("vehicle-type-fields");
  if (!vehicleType) { sub.innerHTML = ""; return; }

  const fields = CATEGORY_FIELDS[`vehicles-${vehicleType}`] || [];

  sub.innerHTML = fields.map(f => `
    <div style="margin-bottom:14px">
      <label style="display:block;font-size:12px;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">
        ${f.label}
      </label>
      ${f.type === "select" ? `
        <select id="${f.id}" style="width:100%;padding:13px 14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:14px;font-family:var(--font);outline:none;background:white;box-sizing:border-box">
          <option value="">Select ${f.label}</option>
          ${f.options.map(o => `<option value="${o}">${o}</option>`).join("")}
        </select>
      ` : `
        <input type="text" id="${f.id}" placeholder="${f.placeholder || ""}"
          style="width:100%;padding:13px 14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:14px;font-family:var(--font);outline:none;background:white;box-sizing:border-box">
      `}
    </div>
  `).join("");
};



function renderLeisureFields() {
  const container = document.getElementById("category-fields");
  container.innerHTML = `
    <div style="border-top:1.5px solid #f0f0f0;margin:16px 0"></div>
    <div style="margin-bottom:14px">
      <label style="display:block;font-size:12px;font-weight:800;color:#374151;text-transform:uppercase;margin-bottom:6px">Subcategory</label>
      <select id="cf-leisure-sub" onchange="onLeisureSubChange(this.value)"
        style="width:100%;padding:13px 14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:14px;background:white;box-sizing:border-box">
        <option value="">Select Subcategory</option>
        ${CATEGORY_FIELDS["leisure-activities"][0].options.map(o => `<option value="${o}">${o}</option>`).join("")}
      </select>
    </div>
    <div id="leisure-sub-fields"></div>
  `;
}
window.onLeisureSubChange = function(sub) {
  const box = document.getElementById("leisure-sub-fields");
  if (!sub) { box.innerHTML = ""; return; }
  const fields = CATEGORY_FIELDS[`leisure-${sub}`] || [];
  box.innerHTML = fields.map(f => `
    <div style="margin-bottom:14px">
      <label style="display:block;font-size:12px;font-weight:800;color:#374151;text-transform:uppercase;margin-bottom:6px">${f.label}</label>
      ${f.type === "select" ? `<select id="${f.id}" style="width:100%;padding:13px 14px;border:1.5px solid #e5e7eb;border-radius:12px;background:white;box-sizing:border-box"><option value="">Select ${f.label}</option>${f.options.map(o=>`<option value="${o}">${o}</option>`).join("")}</select>` : `<input type="text" id="${f.id}" placeholder="${f.placeholder||""}" style="width:100%;padding:13px 14px;border:1.5px solid #e5e7eb;border-radius:12px;background:white;box-sizing:border-box">`}
    </div>`).join("");
};

function categoryEmoji(cat) {
  const map = {
    phones:"📱", electronics:"💻", fashion:"👗", shoes:"👟", beauty:"💄",
    bags:"👜", groceries:"🛒", watches:"⌚", computers:"🖥️", gaming:"🎮",
    home:"🏠", accessories:"💎", vehicles:"🚗", animals:"🐾", babies:"👶",
    agriculture:"🌾", commercial:"🏗️", tours:"✈️", "seeking-work":"💼",
    services:"🔧", "repair-construction":"🔨", property:"🏘️"
  };
  return map[cat] || "📋";
}

const titleInput    = document.getElementById("ad-title");

const descInput     = document.getElementById("ad-description");

const priceInput    = document.getElementById("ad-price");

const locationInput = document.getElementById("ad-district");

// ── Collect all field values to save with the ad ─
function collectCategoryFields(category) {
  let fields = CATEGORY_FIELDS[category] || [];

  if (category === "vehicles") {
    const vType = document.getElementById("cf-vehicle-type")?.value || "";
    fields = [{ id: "cf-vehicle-type" }, ...(CATEGORY_FIELDS[`vehicles-${vType}`] || [])];
  }
  else if (category === "leisure-activities") {
    const sub = document.getElementById("cf-leisure-sub")?.value || "";
    fields = [{ id: "cf-leisure-sub" }, ...(CATEGORY_FIELDS[`leisure-${sub}`] || [])];
  }
  else if (TWO_STEP_CATEGORIES.includes(category)) {
    const baseField = CATEGORY_FIELDS[category]?.[0];
    if (baseField) {
      const subValue = document.getElementById(baseField.id)?.value || "";
      fields = [baseField, ...(CATEGORY_FIELDS[`${category}-${subValue}`] || [])];
    }
  }

  const data = {};
  fields.forEach(f => {
    const el = document.getElementById(f.id);
    if (el && el.value) data[f.id.replace("cf-", "")] = el.value;
  });
  return data;
}

window.validateStep2 = function() {
  const title    = titleInput.value.trim();
  const desc     = descInput.value.trim();
  const price    = priceInput.value.trim();
  const district = document.getElementById("ad-district")?.value || "";

  const valid =
    title !== "" &&
    desc !== "" &&
    price !== "" &&
    district !== "";

  document.getElementById("step2-next").disabled = !valid;
};

titleInput.addEventListener("input", validateStep2);
descInput.addEventListener("input", validateStep2);
priceInput.addEventListener("input", validateStep2);
document.getElementById("ad-district")?.addEventListener("change", validateStep2);
document.getElementById("ad-sublocation")?.addEventListener("change", validateStep2);

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
// VIDEO UPLOAD (Services category only)
// ============================================

let uploadedVideo = null;

window.handleVideoUpload = function(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  // Validate type
  if (!file.type.startsWith("video/")) {
    alert("Please select a video file (MP4, MOV, etc.)");
    return;
  }

  // Max 50MB
  if (file.size > 50 * 1024 * 1024) {
    alert("Video too large. Maximum size is 50MB.");
    event.target.value = "";
    return;
  }

  uploadedVideo = file;

  // Show preview
  const preview = document.getElementById("video-preview-wrap");
  if (preview) {
    const url = URL.createObjectURL(file);
    preview.innerHTML = `
      <video controls style="width:100%;border-radius:12px;margin-top:10px;max-height:220px;background:#000">
        <source src="${url}" type="${file.type}">
      </video>
      <p style="font-size:12px;color:#10b981;font-weight:700;margin-top:6px">
        ✅ Video ready: ${file.name} (${(file.size/1024/1024).toFixed(1)}MB)
      </p>
      <button type="button" onclick="removeVideo()"
        style="background:#fee2e2;color:#ef4444;border:none;padding:6px 14px;
        border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;margin-top:4px">
        🗑️ Remove Video
      </button>
    `;
  }
};

window.removeVideo = function() {
  uploadedVideo = null;
  const preview = document.getElementById("video-preview-wrap");
  if (preview) preview.innerHTML = "";
  const input = document.getElementById("service-video-input");
  if (input) input.value = "";
};

// Show/hide video upload section based on category
function toggleVideoUpload(category) {
  const section = document.getElementById("video-upload-section");
  if (!section) return;
  section.style.display = category === "services" ? "block" : "none";
  if (category !== "services") {
    uploadedVideo = null;
    const preview = document.getElementById("video-preview-wrap");
    if (preview) preview.innerHTML = "";
  }
}

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

  // Safe setter — skips if element doesn't exist
  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }
  function setHTML(id, val) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = val;
  }

  const emoji = { phones:"📱",electronics:"💻",fashion:"👗",shoes:"👟",
    beauty:"💄",bags:"👜",groceries:"🛒",watches:"⌚",computers:"🖥️",
    gaming:"🎮",home:"🏠",accessories:"💎",vehicles:"🚗",animals:"🐾",
    babies:"👶",agriculture:"🌾",commercial:"🏗️",tours:"✈️","seeking-work":"💼" };

  setText("review-cat",
    (emoji[selectedCategory] || "📋") + " " +
    selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1).replace("-"," ")
  );
  setText("review-title",    titleInput.value);
  setText("review-price",    "UGX " + Number(priceInput.value).toLocaleString());
  setText("review-desc",     descInput.value);

  const district = document.getElementById("ad-district")?.value || "";
  const subLoc   = document.getElementById("ad-sublocation")?.value || "";
  document.getElementById("review-location").textContent =
    subLoc ? `${subLoc}, ${district}` : district;

  // Category details summary
  const details  = typeof collectCategoryFields === "function"
    ? collectCategoryFields(selectedCategory) : {};
  const detailEl = document.getElementById("review-details");
  if (detailEl && Object.keys(details).length > 0) {
    detailEl.innerHTML = Object.entries(details)
      .map(([k, v]) => `
        <div style="display:flex;justify-content:space-between;
          padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:13px">
          <span style="color:#6b7280;text-transform:capitalize">${k.replace(/-/g," ")}</span>
          <strong style="color:#111827">${v}</strong>
        </div>`)
      .join("");
  }

  // Cover image preview
  if (uploadedImages.length > 0) {
    const reader = new FileReader();
    reader.onload = (e) => setHTML("review-image",
      `<img src="${e.target.result}" alt="preview" style="width:100%;height:100%;object-fit:cover">`
    );
    reader.readAsDataURL(uploadedImages[0]);
  }
}



// ── Pick the most relevant field to use as subcategory ──
function getAutoSubcategory(category) {
  // Priority field per category — whichever exists becomes the subcategory
  const priorityField = {
    phones:        "cf-brand",
    electronics:   "cf-type",
    fashion:       "cf-type",
    shoes:         "cf-type",
    beauty:        "cf-type",
    bags:          "cf-type",
    groceries:     "cf-type",
    watches:       "cf-type",
    computers:     "cf-type",
    gaming:        "cf-platform",
    home:          "cf-type",
    accessories:   "cf-type",
    vehicles:      "cf-make",
    animals:       "cf-type",
    babies:        "cf-type",
    agriculture:   "cf-type",
    commercial:    "cf-type",
    tours:         "cf-type",
    "seeking-work":"cf-type",
    services:      "cf-service-type"
  };

  const fieldId = priorityField[category];
  if (!fieldId) return "";

  const el = document.getElementById(fieldId);
  return el && el.value ? el.value : "";
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


    // ── Upload service video (if any) ──────────
    let videoUrl = "";
    if (uploadedVideo && selectedCategory === "services") {
      try {
        const vRef = ref(storage,
          `service-videos/${currentUser.uid}/${Date.now()}-${uploadedVideo.name}`
        );
        await uploadBytes(vRef, uploadedVideo, { contentType: uploadedVideo.type });
        videoUrl = await getDownloadURL(vRef);
      } catch (videoErr) {
        console.warn("Video upload failed:", videoErr.message);
        // Non-blocking — ad still posts without video
      }
    }


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
    
      location: (() => {
      const d = document.getElementById("ad-district")?.value || "";
      const s = document.getElementById("ad-sublocation")?.value || "";
      return s ? `${s}, ${d}` : d;
    })(),
      
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
      details:     collectCategoryFields(selectedCategory),
      condition:   document.getElementById("cf-condition")?.value || "",
      subcategory: getAutoSubcategory(selectedCategory),
      videoUrl:  videoUrl || ""
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

    // Check if this triggers a referral reward for whoever referred this user
    const { checkReferralReward } = await import("./referral.js");
    await checkReferralReward(auth.currentUser?.uid);

    alert("Ad submitted successfully!");

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

    window.open(`https://wa.me/256789157512?text=${waMsg}`, "_blank");

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


