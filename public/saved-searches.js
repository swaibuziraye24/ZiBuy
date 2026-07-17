import { db, auth, collection, addDoc, getDocs, query, where, deleteDoc, doc } from "./firebase.js";

// ── Save the current search as an alert ──
window.openSaveSearchModal = function() {
  if (!auth.currentUser) { alert("Login to save searches and get alerts"); return; }

  const state = window.getCurrentSearchState ? window.getCurrentSearchState() : {};

  const existing = document.getElementById("save-search-modal");
  if (existing) existing.remove();

  const summary = [
    state.keyword ? `"${state.keyword}"` : null,
    state.category && state.category !== "all" ? state.category : null,
    (state.priceMin || state.priceMax) ? `UGX ${Number(state.priceMin||0).toLocaleString()}–${Number(state.priceMax||99999999).toLocaleString()}` : null,
    state.location ? `in ${state.location}` : null
  ].filter(Boolean).join(" · ") || "All listings";

  const modal = document.createElement("div");
  modal.id = "save-search-modal";
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px`;

  modal.innerHTML = `
    <div style="background:white;border-radius:20px;padding:24px;max-width:420px;width:100%">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <h2 style="margin:0;font-size:18px;font-weight:800;color:#111827">🔔 Save This Search</h2>
        <button onclick="document.getElementById('save-search-modal').remove()"
          style="background:#f3f4f6;border:none;width:32px;height:32px;border-radius:50%;font-size:18px;cursor:pointer">×</button>
      </div>

      <div style="background:#f9fafb;border-radius:10px;padding:12px;margin-bottom:16px">
        <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;font-weight:800;letter-spacing:.5px">Search Criteria</p>
        <p style="margin:6px 0 0;font-size:14px;font-weight:700;color:#111827">${summary}</p>
      </div>

      <label style="display:block;font-size:12px;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">
        Name this alert
      </label>
      <input type="text" id="ss-label" placeholder="e.g. Cheap phones in Kampala"
        style="width:100%;padding:12px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;margin-bottom:16px">

      <p style="font-size:12px;color:#6b7280;margin-bottom:16px;line-height:1.5">
        We'll notify you the moment a new ad matches these criteria.
      </p>

      <button id="ss-save-btn" onclick="saveCurrentSearchAlert()"
        style="width:100%;background:#ff6600;color:white;border:none;padding:14px;border-radius:12px;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit">
        🔔 Save & Notify Me
      </button>
      <p id="ss-error" style="color:#ef4444;font-size:13px;margin-top:10px;display:none"></p>
    </div>
  `;

  document.body.appendChild(modal);
  window._pendingSearchState = state;
};

window.saveCurrentSearchAlert = async function() {
  if (!auth.currentUser) { alert("Login first"); return; }

  const state      = window._pendingSearchState || {};
  const labelInput = document.getElementById("ss-label");
  const label      = (labelInput?.value || "").trim() || "My Saved Search";
  const errorEl    = document.getElementById("ss-error");
  const btn        = document.getElementById("ss-save-btn");

  try {
    // Enforce a sane limit per user
    const existingSnap = await getDocs(query(
      collection(db, "saved_searches"),
      where("userId", "==", auth.currentUser.uid)
    ));

    if (existingSnap.size >= 20) {
      if (errorEl) { errorEl.textContent = "You've reached the 20 saved search limit. Delete one to add more."; errorEl.style.display = "block"; }
      return;
    }

    if (btn) { btn.textContent = "Saving..."; btn.disabled = true; }

    await addDoc(collection(db, "saved_searches"), {
      userId:         auth.currentUser.uid,
      userEmail:      auth.currentUser.email,
      label,
      keyword:        (state.keyword  || "").toLowerCase().trim(),
      category:       state.category  || "all",
      priceMin:       state.priceMin != null ? Number(state.priceMin) : null,
      priceMax:       state.priceMax != null ? Number(state.priceMax) : null,
      location:       (state.location || "").toLowerCase().trim(),
      createdAt:      new Date(),
      lastNotifiedAt: null
    });

    document.getElementById("save-search-modal")?.remove();

    const toast = document.createElement("div");
    toast.style.cssText = `position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:#10b981;color:white;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,0.15)`;
    toast.textContent = "✅ Alert saved! We'll notify you of new matches.";
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);

  } catch (err) {
    console.error(err);
    if (errorEl) { errorEl.textContent = "Failed to save. Try again."; errorEl.style.display = "block"; }
  } finally {
    if (btn) { btn.textContent = "🔔 Save & Notify Me"; btn.disabled = false; }
  }
};

// ── Manage saved searches ──
window.openMySavedSearchesModal = async function() {
  if (!auth.currentUser) { alert("Login to view saved searches"); return; }

  const existing = document.getElementById("my-searches-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "my-searches-modal";
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px`;

  modal.innerHTML = `
    <div style="background:white;border-radius:20px;padding:24px;max-width:480px;width:100%;max-height:80vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h2 style="margin:0;font-size:18px;font-weight:800;color:#111827">🔔 My Saved Searches</h2>
        <button onclick="document.getElementById('my-searches-modal').remove()"
          style="background:#f3f4f6;border:none;width:32px;height:32px;border-radius:50%;font-size:18px;cursor:pointer">×</button>
      </div>
      <div id="my-searches-list">
        <p style="text-align:center;color:#6b7280;padding:30px">Loading...</p>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  loadMySavedSearches();
};

async function loadMySavedSearches() {
  const list = document.getElementById("my-searches-list");
  if (!list) return;

  try {
    const snap = await getDocs(query(
      collection(db, "saved_searches"),
      where("userId", "==", auth.currentUser.uid)
    ));

    if (snap.empty) {
      list.innerHTML = `<p style="text-align:center;color:#6b7280;padding:30px">No saved searches yet. Save a search from the filters panel to get notified of new matches.</p>`;
      return;
    }

    const searches = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));

    list.innerHTML = searches.map(s => `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;
        padding:14px;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:10px">
        <div>
          <p style="margin:0;font-weight:800;font-size:14px;color:#111827">${s.label}</p>
          <p style="margin:3px 0 0;font-size:12px;color:#6b7280">
            ${s.category !== "all" ? s.category + " · " : ""}${s.keyword ? `"${s.keyword}" · ` : ""}${s.location ? "in " + s.location : "All Uganda"}
          </p>
        </div>
        <button onclick="deleteSavedSearch('${s.id}')"
          style="background:#fee2e2;color:#ef4444;border:none;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">
          🗑️
        </button>
      </div>
    `).join("");

  } catch (err) {
    list.innerHTML = `<p style="color:#ef4444;text-align:center;padding:20px">Failed to load</p>`;
  }
}

window.deleteSavedSearch = async function(searchId) {
  try {
    await deleteDoc(doc(db, "saved_searches", searchId));
    loadMySavedSearches();
  } catch (err) {
    console.error(err);
  }
};