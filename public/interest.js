// ZiBuy: per-device interest tracking (guests and logged-in users alike)
const KEY = "zibuy_interest";

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
  catch (e) { return {}; }
}

export function getInterestMap() {
  return read();
}

export function getTopCategories(n = 3) {
  return Object.entries(read())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([cat]) => cat);
}

export function trackInterest(category, weight = 1) {
  if (!category || typeof category !== "string") return;
  try {
    const before = getTopCategories(2).join("|");

    const map = read();
    // fade older interests a little so tastes can change over time
    Object.keys(map).forEach(k => { map[k] = map[k] * 0.97; });
    map[category] = (map[category] || 0) + weight;

    const kept = Object.entries(map)
      .filter(([, v]) => v > 0.2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(kept)));

    // favourites changed: make the next home visit refresh quietly in the background
    if (before !== getTopCategories(2).join("|") && localStorage.getItem("zibuy_products_cache_time")) {
      localStorage.setItem("zibuy_products_cache_time", String(Date.now() - 120000));
    }
  } catch (e) { /* storage unavailable: ignore */ }
}