// ============================================
//   ZiBuy — Bulk Ad Posting
// ============================================

import { db, auth, collection, addDoc } from "./firebase.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { storage } from "./firebase.js";
import { getMyLimits, countActiveAds } from "./plan-limits.js";
import { getDistricts } from "./uganda-locations.js";

function escapeHTML(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const CATEGORIES = [
  "phones","electronics","fashion","shoes","beauty","bags","groceries","watches",
  "computers","gaming","home","accessories","vehicles","animals","babies",
  "agriculture","commercial","tours","seeking-work","services","repair-construction",
  "property","leisure-activities","phone-accessories"
];

let currentUser = null;
let remainingAdSlots = 0;
let planId = "free";
let rowCount = 0;
const rowImages = {}; // rowId -> File[]

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("Please login to post ads");
    window.location.href = "index.html";
    return;
  }
  currentUser = user;
  await checkLimitsAndInit();
});

async function checkLimitsAndInit() {
  const limits = await getMyLimits(currentUser.uid);
  const activeCount = await countActiveAds(currentUser.uid);
  planId = limits.planId;

  remainingAdSlots = limits.maxAds === Infinity ? 999 : Math.max(0, limits.maxAds - activeCount);

  const noteEl = document.getElementById("bulk-limit-note");
  if (noteEl) {
    noteEl.style.display = "block";
    if (remainingAdSlots <= 0) {
      noteEl.innerHTML = `⚠️ You've reached your <strong>${planId.toUpperCase()}</strong> plan's ad limit. <a href="business-plans.html" style="color:#ff6600;font-weight:800">Upgrade your plan</a> to post more.`;
      document.getElementById("add-row-btn").style.display = "none";
      document.getElementById("post-all-btn").disabled = true;
      return;
    }
    noteEl.innerHTML = limits.maxAds === Infinity
      ? `✅ Your <strong>${planId.toUpperCase()}</strong> plan allows unlimited ads.`
      : `📊 You can post up to <strong>${remainingAdSlots}</strong> more ad${remainingAdSlots !== 1 ? "s" : ""} on your <strong>${planId.toUpperCase()}</strong> plan.`;
  }

  // Start with 3 empty rows to get sellers going quickly
  addBulkRow();
  addBulkRow();
  addBulkRow();
}

window.addBulkRow = function() {
  const container = document.getElementById("bulk-rows-container");
  if (!container) return;

  const currentRows = container.querySelectorAll(".bulk-row").length;
  if (currentRows >= remainingAdSlots) {
    alert(`You can only add ${remainingAdSlots} more ad${remainingAdSlots !== 1 ? "s" : ""} on your ${planId.toUpperCase()} plan.`);
    return;
  }

  rowCount++;
  const rowId = `row-${rowCount}`;
  rowImages[rowId] = [];

  const districts = getDistricts();

  const row = document.createElement("div");
  row.className = "bulk-row";
  row.id = rowId;
  row.innerHTML = `
    <span class="bulk-row-number">${currentRows + 1}</span>
    <button class="bulk-row-remove" onclick="removeBulkRow('${rowId}')" title="Remove">×</button>

    <label class="bulk-photo-picker" for="${rowId}-photos">
      📷 <strong style="font-size:13px">Tap to add photos</strong>
      <p style="margin:4px 0 0;font-size:11px;color:#9ca3af">Up to 5 · First photo becomes cover</p>
      <input type="file" id="${rowId}-photos" accept="image/*" multiple style="display:none"
        onchange="handleBulkRowPhotos('${rowId}', event)">
    </label>
    <div class="bulk-photo-preview" id="${rowId}-preview"></div>

    <div class="bulk-grid">
      <div class="bulk-full">
        <label class="bulk-label">Product Name</label>
        <input type="text" id="${rowId}-name" placeholder="e.g. iPhone 13 Pro Max" maxlength="80">
      </div>

      <div>
        <label class="bulk-label">Category</label>
        <select id="${rowId}-category">
          ${CATEGORIES.map(c => `<option value="${c}">${c.charAt(0).toUpperCase() + c.slice(1).replace(/-/g," ")}</option>`).join("")}
        </select>
      </div>

      <div>
        <label class="bulk-label">Price (UGX)</label>
        <input type="number" id="${rowId}-price" placeholder="e.g. 500000">
      </div>

      <div>
        <label class="bulk-label">Condition</label>
        <select id="${rowId}-condition">
          <option value="Brand New">Brand New</option>
          <option value="Foreign Used">Foreign Used</option>
          <option value="Local Used">Local Used</option>
          <option value="Refurbished">Refurbished</option>
        </select>
      </div>

      <div>
        <label class="bulk-label">District</label>
        <select id="${rowId}-district">
          <option value="">Select district</option>
          ${districts.map(d => `<option value="${d}">${d}</option>`).join("")}
        </select>
      </div>

      <div class="bulk-full">
        <label class="bulk-label">Description</label>
        <textarea id="${rowId}-desc" rows="2" placeholder="Brief description..." maxlength="500"></textarea>
      </div>
    </div>
  `;

  container.appendChild(row);
  renumberRows();
};

window.removeBulkRow = function(rowId) {
  const row = document.getElementById(rowId);
  if (row) row.remove();
  delete rowImages[rowId];
  renumberRows();
};

function renumberRows() {
  const rows = document.querySelectorAll(".bulk-row");
  rows.forEach((row, i) => {
    const numEl = row.querySelector(".bulk-row-number");
    if (numEl) numEl.textContent = i + 1;
  });
}

window.handleBulkRowPhotos = function(rowId, event) {
  const files = Array.from(event.target.files || []).slice(0, 5);
  rowImages[rowId] = files;

  const preview = document.getElementById(`${rowId}-preview`);
  if (!preview) return;
  preview.innerHTML = "";

  files.forEach((file, i) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement("img");
      img.src = e.target.result;
      img.alt = `photo ${i + 1}`;
      preview.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
};

// ── Same compression approach as post-ad.js — critical for bulk
// uploads on slow networks since this can be 10-20 images total ──
async function compressImage(file, maxWidth = 1100, quality = 0.7) {
  if (file.size < 200 * 1024) return file;
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name, { type: "image/jpeg" }));
        }, "image/jpeg", quality);
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

async function withRetry(operation, { maxTries = 5, timeoutMs = 40000, baseDelay = 2000 } = {}) {
  let attempt = 0;
  while (attempt < maxTries) {
    try {
      return await Promise.race([
        operation(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs))
      ]);
    } catch (err) {
      attempt++;
      if (attempt >= maxTries) throw err;
      const wait = Math.min(baseDelay * Math.pow(2, attempt - 1), 15000);
      if (!navigator.onLine) {
        await new Promise((resolve) => {
          const h = () => { window.removeEventListener("online", h); resolve(); };
          window.addEventListener("online", h);
          setTimeout(resolve, wait);
        });
      } else {
        await new Promise(r => setTimeout(r, wait));
      }
    }
  }
}

window.postAllBulkAds = async function() {
  const rows = document.querySelectorAll(".bulk-row");
  if (rows.length === 0) {
    alert("Add at least one product first");
    return;
  }

  // Validate every row before uploading anything
  const rowData = [];
  for (const row of rows) {
    const rowId = row.id;
    const name  = document.getElementById(`${rowId}-name`)?.value.trim();
    const price = document.getElementById(`${rowId}-price`)?.value;
    const district = document.getElementById(`${rowId}-district`)?.value;
    const photos = rowImages[rowId] || [];

    if (!name || !price || !district) {
      alert(`Row ${Array.from(rows).indexOf(row) + 1}: please fill in name, price, and district.`);
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (photos.length === 0) {
      alert(`Row ${Array.from(rows).indexOf(row) + 1}: please add at least one photo.`);
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    rowData.push({
      rowId,
      name,
      price: Number(price),
      category: document.getElementById(`${rowId}-category`)?.value,
      condition: document.getElementById(`${rowId}-condition`)?.value,
      district,
      description: document.getElementById(`${rowId}-desc`)?.value.trim(),
      photos
    });
  }

  const btn = document.getElementById("post-all-btn");
  btn.disabled = true;

  const { getMyLimits: getLimitsNow } = await import("./plan-limits.js");
  const limits = await getLimitsNow(currentUser.uid);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (limits.duration || 30));

  let posted = 0;
  let failed = 0;

  for (let i = 0; i < rowData.length; i++) {
    const item = rowData[i];
    btn.textContent = `Posting ${i + 1} of ${rowData.length}: ${item.name.slice(0, 20)}...`;

    try {
      const compressed = await Promise.all(item.photos.map(f => compressImage(f)));
      const imageUrls = [];

      for (let p = 0; p < compressed.length; p++) {
        const file = compressed[p];
        const fileName = `products/${currentUser.uid}/${Date.now()}-${i}-${p}-${file.name}`;
        const url = await withRetry(async () => {
          const storageRef = ref(storage, fileName);
          await uploadBytes(storageRef, file, { contentType: file.type });
          return getDownloadURL(storageRef);
        });
        imageUrls.push(url);
      }

      await withRetry(() => addDoc(collection(db, "products"), {
        name:        item.name,
        price:       item.price,
        category:    item.category,
        subcategory: "",
        condition:   item.condition,
        description: item.description || "",
        location:    item.district,
        images:      imageUrls,
        userId:      currentUser.uid,
        userEmail:   currentUser.email,
        status:      "active",
        views:       0,
        boost: { boosted: false, startDate: null, endDate: null, type: null },
        createdAt:   new Date(),
        updatedAt:   new Date(),
        expiresAt,
        seller: {
          name:       currentUser.email.split("@")[0],
          phone:      "",
          location:   item.district,
          isVerified: false
        },
        details:    {},
        postedViaBulk: true
      }));

      posted++;

    } catch (err) {
      console.error(`Bulk post failed for row ${i}:`, err);
      failed++;
    }
  }

  sessionStorage.removeItem("zibuy_products_cache");
  sessionStorage.removeItem("zibuy_products_cache_time");

  btn.textContent = "🚀 Post All Ads";
  btn.disabled = false;

  if (failed === 0) {
    alert(`✅ All ${posted} ads posted successfully!`);
  } else {
    alert(`✅ ${posted} ads posted. ⚠️ ${failed} failed — check your connection and try posting those individually.`);
  }

  window.location.href = "dashboard.html?tab=my-ads";
};