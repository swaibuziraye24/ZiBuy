// ============================================
//   ZiBuy — Bulk Ad Posting
// ============================================

import { db, auth, collection, addDoc } from "./firebase.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { storage } from "./firebase.js";
import { getMyLimits, countActiveAds } from "./plan-limits.js";
import { getDistricts, getSubLocations } from "./uganda-locations.js";

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
let sellerDefaultPhone = "";
const rowImages   = {}; // rowId -> File[]  (never saved to draft — can't serialize Files)
const postedRows  = new Set(); // rowIds already successfully saved to Firestore this session

const DRAFT_KEY = "zibuy_bulk_draft";

function saveBulkDraft() {
  try {
    const rows = Array.from(document.querySelectorAll(".bulk-row")).map(row => {
      const rowId = row.id;
      return {
        rowId,
        name:        document.getElementById(`${rowId}-name`)?.value        || "",
        price:       document.getElementById(`${rowId}-price`)?.value       || "",
        category:    document.getElementById(`${rowId}-category`)?.value    || "",
        condition:   document.getElementById(`${rowId}-condition`)?.value   || "",
        district:    document.getElementById(`${rowId}-district`)?.value    || "",
        sublocation: document.getElementById(`${rowId}-sublocation`)?.value || "",
        phone:       document.getElementById(`${rowId}-phone`)?.value       || "",
        desc:        document.getElementById(`${rowId}-desc`)?.value        || "",
        posted:      postedRows.has(rowId)
      };
    });
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ rows, savedAt: Date.now() }));
  } catch (e) { /* storage full — not critical, just skip saving this time */ }
}

function restoreBulkDraftIfAny() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return false;
    const draft = JSON.parse(raw);

    // Discard stale drafts older than 24h
    if (!draft.savedAt || Date.now() - draft.savedAt > 86400000) {
      localStorage.removeItem(DRAFT_KEY);
      return false;
    }
    if (!draft.rows || draft.rows.length === 0) return false;

    const container = document.getElementById("bulk-rows-container");
    container.innerHTML = "";

    draft.rows.forEach(saved => {
      addBulkRow(saved.rowId); // reuse the same rowId so postedRows tracking lines up
      const rowId = saved.rowId;

      const setVal = (suffix, val) => {
        const el = document.getElementById(`${rowId}${suffix}`);
        if (el && val) el.value = val;
      };
      setVal("-name", saved.name);
      setVal("-price", saved.price);
      setVal("-category", saved.category);
      setVal("-condition", saved.condition);
      setVal("-district", saved.district);
      setVal("-phone", saved.phone);
      setVal("-desc", saved.desc);

      if (saved.district) {
        onBulkDistrictChange(rowId);
        setTimeout(() => setVal("-sublocation", saved.sublocation), 100);
      }

      if (saved.posted) {
        postedRows.add(rowId);
        markRowAsPosted(rowId);
      }
    });

    // Banner explaining what happened
    const banner = document.createElement("div");
    banner.style.cssText = "background:#fff4ee;border:1.5px solid #ffd9bf;border-radius:10px;padding:12px 14px;margin-bottom:14px;font-size:12.5px;color:#92400e";
    banner.innerHTML = `📋 <strong>Draft restored</strong> — your unsaved products were recovered. ${draft.rows.filter(r=>r.posted).length > 0 ? "Rows already posted are marked ✅ and won't be re-submitted." : ""} <button onclick="clearBulkDraft()" style="background:none;border:none;color:#92400e;text-decoration:underline;font-weight:700;cursor:pointer;font-family:inherit;margin-left:6px">Clear draft</button>`;
    document.getElementById("bulk-rows-container").before(banner);

    return true;
  } catch (e) { return false; }
}

window.clearBulkDraft = function() {
  localStorage.removeItem(DRAFT_KEY);
  location.reload();
};

function markRowAsPosted(rowId) {
  const row = document.getElementById(rowId);
  if (!row) return;
  row.style.opacity = "0.6";
  row.style.pointerEvents = "none";
  const badge = document.createElement("div");
  badge.style.cssText = "position:absolute;top:-10px;right:14px;background:#10b981;color:white;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:800";
  badge.textContent = "✅ Posted";
  row.appendChild(badge);
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("Please login to post ads");
    window.location.href = "index.html";
    return;
  }
  currentUser = user;
  await checkLimitsAndInit();
});

// Warn before an accidental refresh/close if there's unsaved work
window.addEventListener("beforeunload", (e) => {
  const hasContent = document.querySelectorAll(".bulk-row").length > 0;
  if (hasContent) {
    saveBulkDraft();
    e.preventDefault();
    e.returnValue = "";
  }
});

async function checkLimitsAndInit() {
  // Pull the seller's saved phone so every bulk row prefills it —
  // avoids retyping the same number 10+ times
  try {
    const { doc, getDoc } = await import("./firebase.js");
    const userSnap = await getDoc(doc(db, "users", currentUser.uid));
    if (userSnap.exists()) sellerDefaultPhone = userSnap.data().phone || "";
  } catch (e) { /* not critical — field just starts blank */ }

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

  // Restore any unsaved work first — only start with fresh empty
  // rows if there was nothing to recover
  const restored = restoreBulkDraftIfAny();
  if (!restored) {
    addBulkRow();
    addBulkRow();
    addBulkRow();
  }
}

window.addBulkRow = function(existingRowId) {
  const container = document.getElementById("bulk-rows-container");
  if (!container) return;

  const currentRows = container.querySelectorAll(".bulk-row").length;
  if (!existingRowId && currentRows >= remainingAdSlots) {
    alert(`You can only add ${remainingAdSlots} more ad${remainingAdSlots !== 1 ? "s" : ""} on your ${planId.toUpperCase()} plan.`);
    return;
  }

  let rowId;
  if (existingRowId) {
    rowId = existingRowId; // reused during draft restore, keeps ids stable
  } else {
    rowCount++;
    rowId = `row-${rowCount}`;
  }
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
        <select id="${rowId}-district" onchange="onBulkDistrictChange('${rowId}')">
          <option value="">Select district</option>
          ${districts.map(d => `<option value="${d}">${d}</option>`).join("")}
        </select>
      </div>

      <div id="${rowId}-sublocation-wrap" style="display:none">
        <label class="bulk-label">Town / Area</label>
        <select id="${rowId}-sublocation">
          <option value="">Select town/area</option>
        </select>
      </div>

      <div>
        <label class="bulk-label">Phone / WhatsApp</label>
        <input type="tel" id="${rowId}-phone" placeholder="256701234567" value="${sellerDefaultPhone}">
      </div>

      <div class="bulk-full">
        <label class="bulk-label">Description</label>
        <textarea id="${rowId}-desc" rows="2" placeholder="Brief description..." maxlength="500"></textarea>
      </div>
    </div>
  `;

  container.appendChild(row);
  renumberRows();

  // Auto-save the draft as the seller types — debounced lightly via blur
  row.addEventListener("change", saveBulkDraft);
  row.addEventListener("blur", saveBulkDraft, true);
};

window.onBulkDistrictChange = function(rowId) {
  const district = document.getElementById(`${rowId}-district`)?.value;
  const wrap     = document.getElementById(`${rowId}-sublocation-wrap`);
  const select   = document.getElementById(`${rowId}-sublocation`);
  if (!wrap || !select) return;

  const subs = district ? getSubLocations(district) : [];

  if (subs.length === 0) {
    wrap.style.display = "none";
    select.innerHTML = `<option value="">Select town/area</option>`;
    return;
  }

  select.innerHTML = `<option value="">Select town/area</option>` +
    subs.map(s => `<option value="${s}">${s}</option>`).join("");
  wrap.style.display = "block";
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

  const rowData = [];
  for (const row of rows) {
    const rowId = row.id;
    if (postedRows.has(rowId)) continue; // already posted in a previous attempt — skip silently

    const name  = document.getElementById(`${rowId}-name`)?.value.trim();
    const price = document.getElementById(`${rowId}-price`)?.value;
    const district = document.getElementById(`${rowId}-district`)?.value;
    const sublocation = document.getElementById(`${rowId}-sublocation`)?.value || "";
    const phone = document.getElementById(`${rowId}-phone`)?.value.trim();
    const photos = rowImages[rowId] || [];

    if (!name || !price || !district) {
      alert(`Row ${Array.from(rows).indexOf(row) + 1}: please fill in name, price, and district.`);
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!phone) {
      alert(`Row ${Array.from(rows).indexOf(row) + 1}: please add a phone number for buyers to contact.`);
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (photos.length === 0) {
      alert(`Row ${Array.from(rows).indexOf(row) + 1}: please add at least one photo.`);
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    rowData.push({ rowId, name, price: Number(price), category: document.getElementById(`${rowId}-category`)?.value, condition: document.getElementById(`${rowId}-condition`)?.value, district, sublocation, phone, description: document.getElementById(`${rowId}-desc`)?.value.trim(), photos });
  }

  if (rowData.length === 0) {
    alert("All products in this batch are already posted ✅");
    return;
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
    const rowEl = document.getElementById(item.rowId);
    setRowStatus(item.rowId, "posting", `Posting ${i + 1} of ${rowData.length}...`);
    btn.textContent = `Posting ${i + 1} of ${rowData.length}: ${item.name.slice(0, 20)}...`;

    try {
      const compressed = await Promise.all(item.photos.map(f => compressImage(f, 900, 0.62))); // smaller/lower quality specifically for bulk — many images at once
      const imageUrls = [];

      for (let p = 0; p < compressed.length; p++) {
        const file = compressed[p];
        const fileName = `products/${currentUser.uid}/${Date.now()}-${i}-${p}-${file.name}`;
        setRowStatus(item.rowId, "posting", `Uploading photo ${p + 1}/${compressed.length}...`);
        const url = await withRetry(async () => {
          const storageRef = ref(storage, fileName);
          await uploadBytes(storageRef, file, { contentType: file.type });
          return getDownloadURL(storageRef);
        }, { maxTries: 3, timeoutMs: 25000, baseDelay: 1500 }); // tighter than single post-ad — a stuck row in a batch of 10 shouldn't eat 5+ minutes alone
        imageUrls.push(url);
      }

      const fullLocation = item.sublocation ? `${item.sublocation}, ${item.district}` : item.district;

      await withRetry(() => addDoc(collection(db, "products"), {
        name: item.name, price: item.price, category: item.category, subcategory: "",
        condition: item.condition, description: item.description || "", location: fullLocation,
        images: imageUrls, userId: currentUser.uid, userEmail: currentUser.email,
        status: "active", views: 0,
        boost: { boosted: false, startDate: null, endDate: null, type: null },
        createdAt: new Date(), updatedAt: new Date(), expiresAt,
        seller: { name: currentUser.email.split("@")[0], phone: item.phone, location: fullLocation, isVerified: false },
        details: {}, postedViaBulk: true
      }), { maxTries: 3, timeoutMs: 20000, baseDelay: 1500 });

      posted++;
      postedRows.add(item.rowId);
      setRowStatus(item.rowId, "success", "✅ Posted successfully");
      saveBulkDraft(); // checkpoint immediately — a refresh now won't lose this row

    } catch (err) {
      console.error(`Bulk post failed for row ${i}:`, err);
      failed++;
      setRowStatus(item.rowId, "error", "❌ Failed — network issue. Will retry if you click Post All again.");
    }
  }

  sessionStorage.removeItem("zibuy_products_cache");
  sessionStorage.removeItem("zibuy_products_cache_time");

  btn.textContent = "🚀 Post All Ads";
  btn.disabled = false;

  if (failed === 0) {
    localStorage.removeItem(DRAFT_KEY);
    alert(`✅ All ${posted} ads posted successfully!`);
    window.location.href = "dashboard.html?tab=my-ads";
  } else {
    alert(`✅ ${posted} ads posted. ⚠️ ${failed} failed — their rows are marked below. Fix your connection and tap "Post All Ads" again; successful rows won't be re-submitted.`);
  }
};

function setRowStatus(rowId, state, text) {
  const row = document.getElementById(rowId);
  if (!row) return;

  let statusEl = row.querySelector(".bulk-row-status");
  if (!statusEl) {
    statusEl = document.createElement("div");
    statusEl.className = "bulk-row-status";
    statusEl.style.cssText = "margin-top:10px;padding:8px 12px;border-radius:8px;font-size:12px;font-weight:700";
    row.appendChild(statusEl);
  }

  const styles = {
    posting: "background:#eff6ff;color:#1e40af",
    success: "background:#f0fdf4;color:#166534",
    error:   "background:#fef2f2;color:#991b1b"
  };
  statusEl.setAttribute("style", `margin-top:10px;padding:8px 12px;border-radius:8px;font-size:12px;font-weight:700;${styles[state] || ""}`);
  statusEl.textContent = text;
}