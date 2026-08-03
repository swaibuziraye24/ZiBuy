// ============================================
//   ZiBuy — Shared Product Compare Module
//   Used by: index.html (homepage), shop.html,
//   product.html — one shared compare list/tray
//   that works no matter which page you're on.
// ============================================

window._compareList = JSON.parse(sessionStorage.getItem("zibuy_compare") || "[]");

window.toggleCompareProduct = function(id, name, price, image, condition) {
  const existingIdx = window._compareList.findIndex(p => p.id === id);

  if (existingIdx > -1) {
    window._compareList.splice(existingIdx, 1);
  } else {
    if (window._compareList.length >= 3) {
      alert("You can compare up to 3 products at a time. Remove one first.");
      if (window.event?.target) window.event.target.checked = false;
      return;
    }
    window._compareList.push({ id, name, price, image, condition });
  }

  sessionStorage.setItem("zibuy_compare", JSON.stringify(window._compareList));
  renderCompareTray();
};

function renderCompareTray() {
  let tray = document.getElementById("compare-tray");
  if (window._compareList.length === 0) {
    if (tray) tray.remove();
    return;
  }

  if (!tray) {
    tray = document.createElement("div");
    tray.id = "compare-tray";
    tray.style.cssText = `position:fixed;bottom:70px;left:0;right:0;background:white;
      border-top:2px solid #ff6600;box-shadow:0 -4px 16px rgba(0,0,0,0.1);z-index:900;
      padding:12px 16px;display:flex;align-items:center;gap:10px`;
    document.body.appendChild(tray);
  }

  tray.innerHTML = `
    <span style="font-size:12px;font-weight:800;color:#111827;white-space:nowrap">📊 Compare (${window._compareList.length}/3)</span>
    <div style="display:flex;gap:6px;flex:1;overflow-x:auto">
      ${window._compareList.map(p => `<img src="${p.image}" style="width:36px;height:36px;object-fit:cover;border-radius:6px;flex-shrink:0">`).join("")}
    </div>
    <button onclick="openCompareModal()" style="background:#ff6600;color:white;border:none;padding:8px 14px;
      border-radius:8px;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap">View</button>
  `;
}

window.openCompareModal = function() {
  const list = window._compareList;
  if (list.length < 2) { alert("Select at least 2 products to compare"); return; }

  const modal = document.createElement("div");
  modal.id = "compare-modal";
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:99999;
    display:flex;align-items:center;justify-content:center;padding:16px`;
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  modal.innerHTML = `
    <div style="background:white;border-radius:20px;padding:20px;max-width:600px;width:100%;max-height:85vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;margin-bottom:16px">
        <h2 style="margin:0;font-size:17px;font-weight:800">📊 Compare Products</h2>
        <button onclick="document.getElementById('compare-modal').remove()"
          style="background:#f3f4f6;border:none;width:30px;height:30px;border-radius:50%;font-size:16px;cursor:pointer">×</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(${list.length},1fr);gap:10px">
        ${list.map(p => `
          <div style="border:1.5px solid #f0f0f0;border-radius:12px;overflow:hidden">
            <img src="${p.image}" style="width:100%;height:100px;object-fit:cover">
            <div style="padding:10px">
              <p style="font-size:11px;font-weight:700;margin:0 0 6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.name}</p>
              <p style="font-size:14px;font-weight:900;color:#ff6600;margin:0 0 6px">UGX ${Number(p.price).toLocaleString()}</p>
              <p style="font-size:10px;color:#6b7280;margin:0 0 10px">${p.condition || "—"}</p>
              <button onclick="window.location.href='product.html?id=${p.id}'"
                style="width:100%;background:#111827;color:white;border:none;padding:7px;border-radius:7px;font-size:10px;font-weight:700;cursor:pointer">View</button>
            </div>
          </div>`).join("")}
      </div>
      <button onclick="clearCompare()" style="width:100%;margin-top:14px;background:#fee2e2;color:#ef4444;
        border:none;padding:10px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">Clear Comparison</button>
    </div>`;
  document.body.appendChild(modal);
};

window.clearCompare = function() {
  window._compareList = [];
  sessionStorage.removeItem("zibuy_compare");
  renderCompareTray();
  document.getElementById("compare-modal")?.remove();
};

// Restore the tray immediately if the user already had items selected
// before navigating to this page — this is what makes compare work
// seamlessly ACROSS pages (homepage → shop → product, etc.)
renderCompareTray();