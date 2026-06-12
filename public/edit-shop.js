// ============================================
//   ZiBuy — Edit / Create Shop (Jiji-style)
// ============================================

import {
  db, auth, storage,
  doc, getDoc, setDoc, updateDoc
} from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { getCurrentPlanId } from "./plan-limits.js";

let currentUser   = null;
let selectedCats  = new Set();
let bannerFile    = null;
let logoFile      = null;
let existingShop  = null;

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

// ── Default business hours ──────────────────
function defaultHours() {
  const h = {};
  DAYS.forEach(d => {
    h[d] = (d === "Sunday")
      ? { closed: true,  open: "09:00", close: "18:00" }
      : { closed: false, open: "09:00", close: "18:00" };
  });
  return h;
}

let businessHours = defaultHours();

// ── Auth & load existing shop ───────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "index.html"; return; }
  currentUser = user;

  renderCategoryChips();
  renderHoursEditor();
  await loadPlanBanner();
  await loadExistingShop();
});

// ── Category chip selection ─────────────────
function renderCategoryChips() {
  document.querySelectorAll("#category-chips .es-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const cat = chip.dataset.cat;
      if (selectedCats.has(cat)) {
        selectedCats.delete(cat);
        chip.classList.remove("selected");
      } else {
        if (selectedCats.size >= 5) {
          showToast("You can select up to 5 specialties", "info");
          return;
        }
        selectedCats.add(cat);
        chip.classList.add("selected");
      }
    });
  });
}

// ── Business hours editor ───────────────────
function renderHoursEditor() {
  const list = document.getElementById("hours-list");
  list.innerHTML = DAYS.map(day => {
    const h = businessHours[day];
    return `
      <div class="es-hours-row">
        <span class="day">${day}</span>
        <input type="time" id="open-${day}" value="${h.open}" ${h.closed ? "disabled" : ""}>
        <span style="color:#9ca3af">–</span>
        <input type="time" id="close-${day}" value="${h.close}" ${h.closed ? "disabled" : ""}>
        <label class="closed-toggle">
          <input type="checkbox" id="closed-${day}" ${h.closed ? "checked" : ""} onchange="toggleDayClosed('${day}')">
          Closed
        </label>
      </div>`;
  }).join("");
}

window.toggleDayClosed = function(day) {
  const checked = document.getElementById(`closed-${day}`).checked;
  document.getElementById(`open-${day}`).disabled  = checked;
  document.getElementById(`close-${day}`).disabled = checked;
};

// ── Plan banner (shop only for Bronze+) ─────
async function loadPlanBanner() {
  const planId = await getCurrentPlanId(currentUser.uid);
  const banner = document.getElementById("es-plan-banner");

  const labels = {
    bronze: "🥉 Bronze Plan — Business Profile included",
    silver: "🥈 Silver Plan — Business Profile + Priority Placement",
    gold:   "🥇 Gold Plan — Custom badge & 24/7 WhatsApp support shown on your shop"
  };

  if (labels[planId]) {
    banner.style.display = "flex";
    banner.innerHTML = `<span style="font-size:18px">${labels[planId].split(" ")[0]}</span> <span>${labels[planId].slice(labels[planId].indexOf(" ")+1)}</span>`;
  } else {
    banner.style.display = "none";
  }
}

// ── Load existing shop data ─────────────────
async function loadExistingShop() {
  try {
    const snap = await getDoc(doc(db, "business_profiles", currentUser.uid));
    if (!snap.exists()) return;

    existingShop = snap.data();

    document.getElementById("shop-name").value        = existingShop.name        || "";
    document.getElementById("shop-description").value = existingShop.description || "";
    document.getElementById("desc-count").textContent = (existingShop.description || "").length;
    document.getElementById("shop-location").value    = existingShop.location    || "";
    document.getElementById("shop-phone").value       = existingShop.phone       || "";
    document.getElementById("shop-whatsapp").value    = existingShop.whatsapp    || "";
    document.getElementById("shop-email").value       = existingShop.email       || currentUser.email;

    if (existingShop.logoUrl) {
      document.getElementById("logo-preview").src = existingShop.logoUrl;
      document.getElementById("logo-wrap").classList.add("has-img");
    }
    if (existingShop.bannerUrl) {
      document.getElementById("banner-preview").src = existingShop.bannerUrl;
      document.getElementById("banner-wrap").classList.add("has-img");
    }

    (existingShop.categories || []).forEach(cat => {
      selectedCats.add(cat);
      document.querySelectorAll("#category-chips .es-chip").forEach(chip => {
        if (chip.dataset.cat === cat) chip.classList.add("selected");
      });
    });

    if (existingShop.businessHours) {
      businessHours = { ...defaultHours(), ...existingShop.businessHours };
      renderHoursEditor();
    }

  } catch (e) {
    console.warn("loadExistingShop:", e.code);
    document.getElementById("shop-email").value = currentUser.email;
  }
}

// ── Image picker (logo/banner) ──────────────
window.handleImagePick = function(event, type) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showToast("Please select an image file", "error");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast("Image too large (max 5MB)", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    if (type === "banner") {
      bannerFile = file;
      document.getElementById("banner-preview").src = e.target.result;
      document.getElementById("banner-wrap").classList.add("has-img");
    } else {
      logoFile = file;
      document.getElementById("logo-preview").src = e.target.result;
      document.getElementById("logo-wrap").classList.add("has-img");
    }
  };
  reader.readAsDataURL(file);
};

// ── Description char counter ────────────────
document.getElementById("shop-description").addEventListener("input", (e) => {
  document.getElementById("desc-count").textContent = e.target.value.length;
});

// ── Collect business hours from form ────────
function collectHours() {
  const hours = {};
  DAYS.forEach(day => {
    const closed = document.getElementById(`closed-${day}`).checked;
    hours[day] = {
      closed,
      open:  document.getElementById(`open-${day}`).value,
      close: document.getElementById(`close-${day}`).value
    };
  });
  return hours;
}

// ── Preview (opens public shop page) ────────
window.previewShop = function() {
  window.open(`shop.html?seller=${currentUser.uid}`, "_blank");
};

// ── Save shop ────────────────────────────────
window.saveShop = async function() {
  const name        = document.getElementById("shop-name").value.trim();
  const description = document.getElementById("shop-description").value.trim();
  const location    = document.getElementById("shop-location").value;
  const phone       = document.getElementById("shop-phone").value.trim();
  const whatsapp    = document.getElementById("shop-whatsapp").value.trim() || phone;
  const email       = document.getElementById("shop-email").value.trim() || currentUser.email;

  if (!name) {
    document.getElementById("shop-name").style.borderColor = "#ef4444";
    document.getElementById("shop-name").focus();
    showToast("Shop name is required", "error");
    return;
  }
  if (!description) {
    document.getElementById("shop-description").style.borderColor = "#ef4444";
    showToast("Add a short description for your shop", "error");
    return;
  }
  if (!location) {
    document.getElementById("shop-location").style.borderColor = "#ef4444";
    showToast("Select your location", "error");
    return;
  }

  const btn = document.getElementById("save-btn");
  btn.textContent = "Saving...";
  btn.disabled    = true;

  try {
    let logoUrl   = existingShop?.logoUrl   || "";
    let bannerUrl = existingShop?.bannerUrl || "";

    if (logoFile) {
      const logoRef = ref(storage, `shop-logos/${currentUser.uid}`);
      await uploadBytes(logoRef, logoFile, { contentType: logoFile.type });
      logoUrl = await getDownloadURL(logoRef);
    }
    if (bannerFile) {
      const bannerRef = ref(storage, `shop-banners/${currentUser.uid}`);
      await uploadBytes(bannerRef, bannerFile, { contentType: bannerFile.type });
      bannerUrl = await getDownloadURL(bannerRef);
    }

    const planId = await getCurrentPlanId(currentUser.uid);

    // Pull verification status from users doc
    const userSnap  = await getDoc(doc(db, "users", currentUser.uid));
    const isVerified = userSnap.exists() ? !!userSnap.data().isSellerVerified : false;

    const shopData = {
      ownerId:     currentUser.uid,
      userId:      currentUser.uid,
      name,
      description,
      location,
      phone,
      whatsapp,
      email,
      logoUrl,
      bannerUrl,
      categories:    [...selectedCats],
      businessHours: collectHours(),
      plan:          planId,
      isVerified,
      updatedAt:     new Date(),
      createdAt:     existingShop?.createdAt || new Date()
    };

    // Save to business_profiles (source of truth)
    await setDoc(doc(db, "business_profiles", currentUser.uid), shopData, { merge: true });

    // Also mirror to "shops" collection for shop.js header compatibility
    await setDoc(doc(db, "shops", currentUser.uid), shopData, { merge: true });

    showToast("✅ Shop saved successfully!", "success");

    setTimeout(() => {
      window.location.href = `shop.html?seller=${currentUser.uid}`;
    }, 1000);

  } catch (err) {
    console.error("saveShop error:", err);
    showToast("Failed to save shop: " + err.message, "error");
    btn.textContent = "💾 Save Shop";
    btn.disabled    = false;
  }
};

// ── Toast helper ─────────────────────────────
function showToast(msg, type = "info") {
  const c = document.getElementById("toast-container");
  if (!c) return;
  const t = document.createElement("div");
  t.className   = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}