// ============================================
//  ZiBuy: optional seller options, shared by
//  post-ad, bulk-post and edit-product
//   1. Bulk prices (cheaper per item for bigger quantities)
//   2. Delivery locations and fees
// ============================================
import { getDistricts } from "./uganda-locations.js";

// ── Pricing rules (used everywhere a price is worked out) ──
export function cleanTiers(tiers) {
  if (!Array.isArray(tiers)) return [];
  const byQty = new Map();
  tiers.forEach(t => {
    const minQty = Math.floor(Number(t.minQty));
    const type   = t.type === "percent" ? "percent" : "price";
    const value  = Number(t.value);
    if (minQty >= 2 && value > 0 && (type === "price" || value < 100)) {
      byQty.set(minQty, { minQty, type, value });
    }
  });
  return [...byQty.values()].sort((a, b) => a.minQty - b.minQty);
}

export function unitPriceFor(basePrice, tiers, qty) {
  const base = Number(basePrice) || 0;
  const q    = Math.max(1, Math.floor(Number(qty)) || 1);
  let unit   = base;
  cleanTiers(tiers).forEach(t => {
    if (q >= t.minQty) {
      unit = t.type === "percent" ? Math.round(base * (1 - t.value / 100)) : t.value;
    }
  });
  return Math.min(unit, base);   // a bulk price is never higher than the normal price
}

// Rows for the price table: 1 item, 3-5 items, 6+ items ...
export function tierRanges(basePrice, tiers) {
  const base = Number(basePrice) || 0;
  const t    = cleanTiers(tiers);
  if (!t.length) return [];

  const spans = [{ from: 1, to: t[0].minQty - 1 }];
  t.forEach((x, i) => spans.push({ from: x.minQty, to: t[i + 1] ? t[i + 1].minQty - 1 : null }));

  return spans.map(r => {
    const unit = unitPriceFor(base, t, r.from);
    return { from: r.from, to: r.to, unit, savePct: base > 0 ? Math.round((1 - unit / base) * 100) : 0 };
  });
}

const FIELD = "padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:13px;font-family:inherit;box-sizing:border-box;background:white;outline:none";

// ══════════════════════════════════════════════
//  BULK PRICES form
// ══════════════════════════════════════════════
export function mountPriceTiers(container, { initial = [], getBasePrice = () => 0, percentOnly = false } = {}) {
  container.innerHTML = `
    <div style="border:1.5px solid #e5e7eb;border-radius:12px;padding:12px 14px;background:#fffaf5">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:800;font-size:14px;color:#9a3412">
        <input type="checkbox" class="zb-tiers-on" style="width:18px;height:18px;accent-color:#ff6600">
        💰 Offer bulk prices (optional)
      </label>
      <div class="zb-tiers-body" style="display:none;margin-top:10px">
        <p style="font-size:12px;color:#6b7280;margin:0 0 10px;line-height:1.5">
          Give buyers a better price when they buy more. For example:
          <strong>3 or more at UGX 280,000 each</strong>${percentOnly ? "" : ","} or <strong>10% off for 5 or more</strong>.
          Leave this off to sell at one fixed price.
        </p>
        <div class="zb-tier-rows"></div>
        <button type="button" class="zb-tier-add"
          style="background:#fff7ed;color:#9a3412;border:1.5px dashed #fdba74;padding:9px 14px;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit">
          + Add a price level
        </button>
      </div>
    </div>`;

  const on   = container.querySelector(".zb-tiers-on");
  const body = container.querySelector(".zb-tiers-body");
  const rows = container.querySelector(".zb-tier-rows");

  function updatePreviews() {
    const base = Number(getBasePrice()) || 0;
    rows.querySelectorAll(".zb-tier-row").forEach(row => {
      const prev = row.querySelector(".zb-tier-preview");
      const ok   = cleanTiers([{
        minQty: row.querySelector(".zb-tier-qty").value,
        type:   row.querySelector(".zb-tier-type").value,
        value:  row.querySelector(".zb-tier-value").value
      }]);
      if (!ok.length) { prev.textContent = ""; return; }
      if (!base)      { prev.textContent = "Enter the normal price above to see the saving."; return; }
      const unit = unitPriceFor(base, ok, ok[0].minQty);
      const save = Math.round((1 - unit / base) * 100);
      prev.textContent = `Buying ${ok[0].minQty}+ → UGX ${unit.toLocaleString()} each${save > 0 ? " (saves " + save + "%)" : ""}`;
    });
  }

  function addRow(t = {}) {
    const row = document.createElement("div");
    row.className = "zb-tier-row";
    row.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:10px";
    row.innerHTML = `
      <span style="font-size:12px;color:#374151">Buy</span>
      <input type="number" class="zb-tier-qty" min="2" placeholder="Qty" style="width:68px;${FIELD}">
      <span style="font-size:12px;color:#374151">or more:</span>
      <select class="zb-tier-type" style="${FIELD}${percentOnly ? ";display:none" : ""}">
        <option value="price">UGX per item</option>
        <option value="percent">% off</option>
      </select>
      <input type="number" class="zb-tier-value" min="1" placeholder="${percentOnly ? "% off" : "Amount"}" style="width:100px;${FIELD}">
      <button type="button" class="zb-tier-del"
        style="background:#fee2e2;color:#b91c1c;border:none;width:32px;height:32px;border-radius:8px;font-size:16px;cursor:pointer">×</button>
      <div class="zb-tier-preview" style="width:100%;font-size:11.5px;color:#059669;font-weight:700"></div>`;

    row.querySelector(".zb-tier-qty").value   = t.minQty ?? "";
    row.querySelector(".zb-tier-type").value  = percentOnly ? "percent" : (t.type || "price");
    row.querySelector(".zb-tier-value").value = t.value ?? "";
    row.querySelector(".zb-tier-del").onclick = () => { row.remove(); };
    rows.appendChild(row);
  }

  on.addEventListener("change", () => {
    body.style.display = on.checked ? "block" : "none";
    if (on.checked && !rows.children.length) addRow();
    updatePreviews();
  });
  container.querySelector(".zb-tier-add").onclick = () => addRow();
  document.addEventListener("input", updatePreviews);
  container.addEventListener("change", updatePreviews);

  const init = cleanTiers(initial);
  if (init.length) {
    on.checked = true;
    body.style.display = "block";
    init.forEach(addRow);
    updatePreviews();
  }
}

export function collectPriceTiers(container) {
  if (!container?.querySelector(".zb-tiers-on")?.checked) return [];
  const raw = [];
  container.querySelectorAll(".zb-tier-row").forEach(row => {
    raw.push({
      minQty: row.querySelector(".zb-tier-qty").value,
      type:   row.querySelector(".zb-tier-type").value,
      value:  row.querySelector(".zb-tier-value").value
    });
  });
  return cleanTiers(raw);
}

// ══════════════════════════════════════════════
//  DELIVERY form
// ══════════════════════════════════════════════
export function mountDelivery(container, { initial = null } = {}) {
  const areaOptions = ["All of Uganda", ...getDistricts()]
    .map(d => `<option value="${d}">${d}</option>`).join("");

  container.innerHTML = `
    <div style="border:1.5px solid #e5e7eb;border-radius:12px;padding:12px 14px;background:#f7fffb">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:800;font-size:14px;color:#065f46">
        <input type="checkbox" class="zb-del-on" style="width:18px;height:18px;accent-color:#10b981">
        🚚 I offer delivery (optional)
      </label>
      <div class="zb-del-body" style="display:none;margin-top:10px">
        <p style="font-size:12px;color:#6b7280;margin:0 0 8px;line-height:1.5">
          Add the places you deliver to. Enter <strong>0</strong> for free delivery, or the delivery fee in UGX.
        </p>
        <div class="zb-del-rows"></div>
        <button type="button" class="zb-del-add"
          style="background:#ecfdf5;color:#065f46;border:1.5px dashed #6ee7b7;padding:9px 14px;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit">
          + Add a location
        </button>
        <input type="text" class="zb-del-note" maxlength="120"
          placeholder="Optional note (e.g. Delivered within 24 hours)"
          style="width:100%;margin-top:10px;${FIELD}">
      </div>
    </div>`;

  const on   = container.querySelector(".zb-del-on");
  const body = container.querySelector(".zb-del-body");
  const rows = container.querySelector(".zb-del-rows");

  function addRow(z = {}) {
    const row = document.createElement("div");
    row.className = "zb-del-row";
    row.style.cssText = "display:flex;gap:8px;margin-bottom:8px;align-items:center";
    row.innerHTML = `
      <select class="zb-del-area" style="flex:1;${FIELD}">
        <option value="">Select location</option>${areaOptions}
      </select>
      <input type="number" class="zb-del-fee" min="0" placeholder="Fee UGX (0 = free)" style="width:130px;${FIELD}">
      <button type="button" class="zb-del-del"
        style="background:#fee2e2;color:#b91c1c;border:none;width:32px;height:32px;border-radius:8px;font-size:16px;cursor:pointer">×</button>`;
    row.querySelector(".zb-del-area").value = z.area || "";
    row.querySelector(".zb-del-fee").value  = z.fee ?? "";
    row.querySelector(".zb-del-del").onclick = () => row.remove();
    rows.appendChild(row);
  }

  on.addEventListener("change", () => {
    body.style.display = on.checked ? "block" : "none";
    if (on.checked && !rows.children.length) addRow();
  });
  container.querySelector(".zb-del-add").onclick = () => addRow();

  if (initial && initial.available && Array.isArray(initial.zones) && initial.zones.length) {
    on.checked = true;
    body.style.display = "block";
    initial.zones.forEach(addRow);
    container.querySelector(".zb-del-note").value = initial.note || "";
  }
}

export function collectDelivery(container) {
  if (!container?.querySelector(".zb-del-on")?.checked) {
    return { available: false, zones: [], note: "" };
  }
  const zones = [];
  container.querySelectorAll(".zb-del-row").forEach(row => {
    const area = row.querySelector(".zb-del-area").value;
    const fee  = Math.max(0, Number(row.querySelector(".zb-del-fee").value) || 0);
    if (area) zones.push({ area, fee });
  });
  return {
    available: zones.length > 0,
    zones,
    note: (container.querySelector(".zb-del-note").value || "").trim()
  };
}



// Small label shown on product cards when an ad has bulk prices
export function bulkBadgeHTML(p) {
  return cleanTiers(p?.priceTiers).length
    ? '<span style="display:block;width:fit-content;margin-top:3px;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;border-radius:6px;padding:1px 6px;font-size:9.5px;font-weight:800;line-height:1.5;white-space:nowrap">📦 Bulk prices</span>'
    : "";
}