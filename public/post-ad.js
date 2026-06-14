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

// ============================================
// CATEGORY-SPECIFIC FIELD DEFINITIONS
// All 12 categories — complete fields
// ============================================

const CATEGORY_FIELDS = {

  phones: [
    { id:"cf-brand",     label:"Brand",       type:"select",
      options:["Samsung","iPhone/Apple","Tecno","Itel","Infinix","Huawei","Nokia","Oppo","Xiaomi","Vivo","Other"] },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Foreign Used (UK)","Foreign Used (Dubai)","Local Used"] },
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
    { id:"cf-type",      label:"Type",         type:"select",
      options:["TV","Flat Screen","Speaker / Sound System","Camera","Decoder / DSTV","DVD Player","Radio","Generator","Solar Panel","Air Conditioner","Fan","Iron Box","Other"] },
    { id:"cf-brand",     label:"Brand",        type:"select",
      options:["Samsung","LG","Sony","Hisense","TCL","Panasonic","Canon","Nikon","Sayona","Bruhm","Ramtons","Other"] },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Foreign Used","Local Used"] },
    { id:"cf-screen",    label:"Screen Size (TVs)", type:"select",
      options:["Not Applicable","24 inch","32 inch","40 inch","43 inch","50 inch","55 inch","65 inch","75 inch","Other"] },
    { id:"cf-warranty",  label:"Warranty",     type:"select",
      options:["No Warranty","Shop Warranty","Manufacturer Warranty"] },
  ],

  fashion: [
    { id:"cf-type",      label:"Clothing Type", type:"select",
      options:["T-Shirt","Shirt","Dress","Trousers / Jeans","Skirt","Suit","Jacket / Coat","Hoodie / Sweater","Underwear","Sportswear","Traditional Wear","Kids Clothing","Other"] },
    { id:"cf-condition", label:"Condition",     type:"select",
      options:["Brand New","Foreign Used","Local Used","Thrift (Mitumba)"] },
    { id:"cf-gender",    label:"For",           type:"select",
      options:["Men","Women","Unisex","Boys","Girls","Babies"] },
    { id:"cf-size",      label:"Size",          type:"select",
      options:["XS (Extra Small)","S (Small)","M (Medium)","L (Large)","XL (Extra Large)","XXL","3XL","Free Size","Other"] },
    { id:"cf-material",  label:"Material",      type:"text",  placeholder:"e.g. Cotton, Polyester, Silk" },
    { id:"cf-color",     label:"Color",         type:"text",  placeholder:"e.g. Red, Navy Blue, Multi-color" },
    { id:"cf-brand",     label:"Brand (optional)", type:"text", placeholder:"e.g. Nike, H&M, Local Brand" },
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
    { id:"cf-type",      label:"Type",         type:"select",
      options:["Laptop","Desktop PC","MacBook","iMac","Tablet","Monitor","Printer","Keyboard & Mouse","UPS / Battery Backup","Other"] },
    { id:"cf-brand",     label:"Brand",        type:"select",
      options:["HP","Dell","Lenovo","Apple","Asus","Acer","Samsung","Toshiba","MSI","Microsoft Surface","Other"] },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Foreign Used","Local Used"] },
    { id:"cf-processor", label:"Processor",    type:"select",
      options:["Intel Core i3","Intel Core i5","Intel Core i7","Intel Core i9","AMD Ryzen 3","AMD Ryzen 5","AMD Ryzen 7","Apple M1","Apple M2","Apple M3","Celeron / Pentium","Other"] },
    { id:"cf-ram",       label:"RAM",          type:"select",
      options:["2GB","4GB","8GB","16GB","32GB","64GB","Other"] },
    { id:"cf-storage",   label:"Storage",      type:"select",
      options:["128GB SSD","256GB SSD","512GB SSD","1TB SSD","1TB HDD","2TB HDD","Other"] },
    { id:"cf-screen",    label:"Screen Size",  type:"select",
      options:["11 inch","13 inch","14 inch","15 inch","15.6 inch","17 inch","Not Applicable"] },
    { id:"cf-os",        label:"Operating System", type:"select",
      options:["Windows 11","Windows 10","Windows 7","macOS","Chrome OS","No OS (Freedos)","Other"] },
    { id:"cf-warranty",  label:"Warranty",     type:"select",
      options:["No Warranty","Shop Warranty","Manufacturer Warranty"] },
  ],

  gaming: [
    { id:"cf-platform",  label:"Platform",     type:"select",
      options:["PlayStation 5 (PS5)","PlayStation 4 (PS4)","PlayStation 3 (PS3)","Xbox Series X/S","Xbox One","Nintendo Switch","PC Gaming","Mobile Gaming","Retro Console","Other"] },
    { id:"cf-type",      label:"Item Type",    type:"select",
      options:["Console (Full Set)","Console Only","Controller / Gamepad","Game CD / Cartridge","Gaming Chair","Gaming Headset","Gaming Monitor","Gaming Keyboard & Mouse","VR Headset","Other"] },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Foreign Used","Local Used"] },
    { id:"cf-storage",   label:"Console Storage", type:"select",
      options:["Not Applicable","256GB","512GB","1TB","2TB","Other"] },
    { id:"cf-controllers", label:"Controllers Included", type:"select",
      options:["Not Applicable","1 Controller","2 Controllers","No Controller"] },
    { id:"cf-warranty",  label:"Warranty",     type:"select",
      options:["No Warranty","Shop Warranty","Manufacturer Warranty"] },
  ],

  home: [
    { id:"cf-type",      label:"Item Type",    type:"select",
      options:["Sofa / Couch","Bed Frame","Mattress","Dining Table & Chairs","Wardrobe / Closet","Fridge / Refrigerator","Freezer","Washing Machine","Microwave","Gas Cooker / Stove","Water Dispenser","Curtains","Carpet / Rug","Wall Decor","Lighting / Lamps","Kitchenware","Bedding / Linen","Baby Furniture","Office Desk & Chair","Other"] },
    { id:"cf-condition", label:"Condition",    type:"select",
      options:["Brand New","Foreign Used","Local Used","Refurbished"] },
    { id:"cf-brand",     label:"Brand (optional)", type:"text", placeholder:"e.g. Mika, Ramtons, Ariston, IKEA" },
    { id:"cf-material",  label:"Material",     type:"select",
      options:["Wood","Metal","Plastic","Glass","Fabric / Upholstery","Foam","Mixed","Other"] },
    { id:"cf-color",     label:"Color",        type:"text",  placeholder:"e.g. Brown, White, Grey" },
    { id:"cf-dimensions",label:"Size / Dimensions", type:"text", placeholder:"e.g. 6x6 bed, 3-seater, 50 litres" },
  ],

accessories: [
    { id:"cf-type",      label:"Accessory Type", type:"select",
      options:["Necklace","Earrings","Bracelet / Bangle","Ring","Anklet","Brooch","Chain","Sunglasses","Belt","Hat / Cap","Scarf / Shawl","Tie","Hair Accessories","Phone Case","Wallet","Other"] },
    { id:"cf-condition", label:"Condition",      type:"select",
      options:["Brand New","Foreign Used","Local Used"] },
    { id:"cf-gender",    label:"For",            type:"select",
      options:["Women","Men","Unisex","Kids"] },
    { id:"cf-material",  label:"Material",       type:"select",
      options:["Gold (14k/18k)","Gold Plated","Silver","Stainless Steel","Beads","Plastic","Fabric","Crystal","Other"] },
    { id:"cf-color",     label:"Color / Finish", type:"text",  placeholder:"e.g. Rose Gold, Silver, Black" },
    { id:"cf-brand",     label:"Brand (optional)", type:"text", placeholder:"e.g. Pandora, Local Artisan" },
  ],

  vehicles: [
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
      options:["Saloon / Sedan","SUV / 4x4","Station Wagon","Pick-Up Truck","Mini Van","Coupe","Convertible","Bus / Minibus","Lorry / Truck","Motorcycle / Boda","Tractor","Other"] },
    { id:"cf-engine",       label:"Engine Size",         type:"select",
      options:["1000cc","1300cc","1500cc","1800cc","2000cc","2500cc","3000cc","3500cc","Above 4000cc","Other"] },
    { id:"cf-negotiable",   label:"Price Negotiable?",   type:"select",
      options:["Yes, negotiable","No, fixed price"] },
  ],

  animals: [
    { id:"cf-type",       label:"Animal Type",      type:"select",
      options:["Dog","Cat","Cow / Bull","Goat","Sheep","Pig","Rabbit","Chicken / Poultry","Duck","Turkey","Parrot / Bird","Fish (Aquarium)","Horse","Donkey","Other"] },
    { id:"cf-breed",      label:"Breed / Variety",  type:"text",  placeholder:"e.g. German Shepherd, Friesian Cow, Boer Goat" },
    { id:"cf-age",        label:"Age",              type:"select",
      options:["Newborn / Chick","1–3 months","3–6 months","6–12 months","1–2 years","2–5 years","5+ years"] },
    { id:"cf-gender",     label:"Gender",           type:"select",
      options:["Male","Female","Pair (Male & Female)","Mixed Group"] },
    { id:"cf-vaccinated", label:"Vaccinated?",      type:"select",
      options:["Yes – fully vaccinated","Partially vaccinated","Not vaccinated","Not applicable"] },
    { id:"cf-purpose",    label:"Purpose",          type:"select",
      options:["Pet / Companion","Breeding","Dairy (Milk)","Meat","Work / Farm","Show / Exhibition","Other"] },
    { id:"cf-quantity",   label:"Quantity",         type:"text",  placeholder:"e.g. 1 animal, 10 chicks, 1 pair" },
  ],

  babies: [
    { id:"cf-type",       label:"Item Type",        type:"select",
      options:["Baby Clothes","Baby Shoes","Diapers / Nappies","Baby Food / Formula","Pram / Stroller","Baby Cot / Crib","Car Seat","Baby Monitor","Baby Carrier","Breast Pump","Feeding Bottles","Baby Toys","Kids Books","Kids Bicycle","Kids Clothes (2–12 yrs)","Kids Shoes (2–12 yrs)","School Bag","Kids Furniture","Other"] },
    { id:"cf-condition",  label:"Condition",        type:"select",
      options:["Brand New","Slightly Used","Used – Good Condition","Used – Fair Condition"] },
    { id:"cf-age-group",  label:"Suitable Age",     type:"select",
      options:["0–3 months","3–6 months","6–12 months","1–2 years","2–3 years","3–5 years","5–8 years","8–12 years","All ages"] },
    { id:"cf-gender",     label:"For",              type:"select",
      options:["Boys","Girls","Unisex"] },
    { id:"cf-brand",      label:"Brand (optional)", type:"text",  placeholder:"e.g. Chicco, Graco, Pampers, Local Brand" },
    { id:"cf-size",       label:"Size / Clothing Size", type:"select",
      options:["Newborn","0–3M","3–6M","6–9M","9–12M","12–18M","18–24M","2T","3T","4T","5T","6","8","10","12","14","Other"] },
  ],

  agriculture: [
    { id:"cf-type",       label:"Product / Service Type", type:"select",
      options:["Maize / Corn","Beans","Rice","Cassava","Sweet Potatoes","Matooke / Bananas","Coffee","Tea","Cotton","Groundnuts","Soybeans","Sunflower","Vegetables","Fruits","Fish (Farmed)","Cattle","Goats","Pigs","Poultry","Seeds","Fertilizer / Manure","Pesticides / Herbicides","Irrigation Equipment","Farm Tools","Tractor / Ploughing Service","Land for Farming","Other"] },
    { id:"cf-condition",  label:"Condition / State",     type:"select",
      options:["Fresh Harvest","Dried / Processed","Ready for Market","Seedlings / Young Plants","Brand New (Equipment)","Used (Equipment)"] },
    { id:"cf-quantity",   label:"Quantity / Volume",     type:"text",  placeholder:"e.g. 2 tonnes, 50 bags (100kg each), 1 acre" },
    { id:"cf-origin",     label:"Farm Location",         type:"select",
      options:["Kampala Region","Eastern Uganda","Northern Uganda","Western Uganda","Central Uganda","Other"] },
    { id:"cf-organic",    label:"Farming Method",        type:"select",
      options:["Conventional","Organic / No Chemicals","Mixed","Not Applicable"] },
    { id:"cf-delivery",   label:"Delivery Available?",   type:"select",
      options:["Yes – I can deliver","No – Buyer collects","Both options"] },
  ],

  commercial: [
    { id:"cf-type",       label:"Equipment Type",    type:"select",
      options:["Generator","Compressor","Welding Machine","Printing Machine","Cutting Machine","Lathe / CNC Machine","Borehole / Water Pump","Scaffolding","Forklift / Crane","Concrete Mixer","Solar Panels (Commercial)","CCTV / Security System","POS / Cash Register","Refrigeration / Cold Room","Industrial Oven / Bakery","Sewing Machine (Industrial)","Salon Equipment","Gym Equipment","Medical Equipment","Office Furniture (Bulk)","Other"] },
    { id:"cf-condition",  label:"Condition",         type:"select",
      options:["Brand New","Foreign Used","Local Used","Refurbished / Serviced"] },
    { id:"cf-brand",      label:"Brand",             type:"text",  placeholder:"e.g. Cummins, Kipor, Honda, Local Brand" },
    { id:"cf-power",      label:"Power / Capacity",  type:"text",  placeholder:"e.g. 5KVA, 10 tonnes, 500 litres/hr" },
    { id:"cf-warranty",   label:"Warranty",          type:"select",
      options:["No Warranty","Shop Warranty (1 month)","Shop Warranty (3 months)","Manufacturer Warranty"] },
    { id:"cf-negotiable", label:"Price Negotiable?", type:"select",
      options:["Yes, negotiable","No, fixed price"] },
  ],

  tours: [
    { id:"cf-type",       label:"Tour / Experience Type", type:"select",
      options:["Safari (Wildlife)","Gorilla Trekking","Chimpanzee Trekking","Mountain Hiking","Boat Cruise","Beach / Resort","City Tour","Cultural / Heritage Tour","Birdwatching","White Water Rafting","Camping","Honeymoon Package","Family Holiday","School Trip","Corporate Retreat","International Travel Package","Other"] },
    { id:"cf-destination",label:"Destination",            type:"text",  placeholder:"e.g. Bwindi, Queen Elizabeth, Lake Victoria, Zanzibar" },
    { id:"cf-duration",   label:"Duration",               type:"select",
      options:["Half Day (4–6 hours)","Full Day","Weekend (2 days)","3 Days","4 Days","5 Days","1 Week","2 Weeks","Custom / Flexible"] },
    { id:"cf-group-size", label:"Group Size",             type:"select",
      options:["1 Person (Solo)","2 People (Couple)","Small Group (3–6)","Medium Group (7–15)","Large Group (15+)","Any Size"] },
    { id:"cf-includes",   label:"Includes",               type:"text",  placeholder:"e.g. Transport, Accommodation, Meals, Park Fees" },
    { id:"cf-availability",label:"Availability",          type:"select",
      options:["Any time","Weekends only","School holidays","Seasonal","Specific dates – contact me"] },
    { id:"cf-negotiable", label:"Price Negotiable?",      type:"select",
      options:["Yes, negotiable","No, fixed price"] },
  ],

  "seeking-work": [
    { id:"cf-type",       label:"Job / Service Type",   type:"select",
      options:["Driver / Chauffeur","Security Guard","Cleaner / Housekeeper","Cook / Chef","Gardener","Nanny / Babysitter","Nurse / Caregiver","Teacher / Tutor","Accountant","IT / Developer","Designer","Electrician","Plumber","Mason / Builder","Mechanic","Carpenter","Tailor / Seamstress","Sales Person","Receptionist / Admin","Data Entry","Social Media Manager","Event Planner","Photographer / Videographer","Other"] },
    { id:"cf-experience", label:"Years of Experience",  type:"select",
      options:["No experience (fresh graduate)","Less than 1 year","1–2 years","3–5 years","5–10 years","10+ years"] },
    { id:"cf-education",  label:"Highest Education",    type:"select",
      options:["Primary Level","O-Level (UCE)","A-Level (UACE)","Certificate","Diploma","Bachelor's Degree","Master's Degree","PhD","Professional Certification","Other"] },
    { id:"cf-availability",label:"Availability",        type:"select",
      options:["Immediately available","Available in 2 weeks","Available in 1 month","Part-time only","Weekends only","Remote / Online only","Flexible"] },
    { id:"cf-location-pref",label:"Preferred Work Location", type:"select",
      options:["Kampala only","Any location in Uganda","Open to relocation","Remote / Work from Home","Flexible"] },
    { id:"cf-salary",     label:"Expected Salary",      type:"text",  placeholder:"e.g. UGX 500,000/month or Negotiable" },
    { id:"cf-gender",     label:"Gender",               type:"select",
      options:["Male","Female","Prefer not to say"] },
  ],

};

// ── Render dynamic fields into Step 2 ────────
function renderCategoryFields(category) {
  const container = document.getElementById("category-fields");
  if (!container) return;

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

function categoryEmoji(cat) {
  const map = {
    phones:"📱", electronics:"💻", fashion:"👗", shoes:"👟", beauty:"💄",
    bags:"👜", groceries:"🛒", watches:"⌚", computers:"🖥️", gaming:"🎮",
    home:"🏠", accessories:"💎", vehicles:"🚗", animals:"🐾", babies:"👶",
    agriculture:"🌾", commercial:"🏗️", tours:"✈️", "seeking-work":"💼"
  };
  return map[cat] || "📋";
}



const titleInput    = document.getElementById("ad-title");

const descInput     = document.getElementById("ad-description");

const priceInput    = document.getElementById("ad-price");

const locationInput = document.getElementById("ad-location");

// ── Collect all field values to save with the ad ─
function collectCategoryFields(category) {
  const fields = CATEGORY_FIELDS[category] || [];
  const data   = {};
  fields.forEach(f => {
    const el = document.getElementById(f.id);
    if (el && el.value) data[f.id.replace("cf-","")] = el.value;
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
  setText("review-location", locationInput.value);
  setText("review-desc",     descInput.value);

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