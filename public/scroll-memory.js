// ============================================
//   ZiBuy — Scroll Memory
//   Puts people back exactly where they were on the
//   homepage after they view a product and come back.
// ============================================

const KEY        = "zb_home_scroll";
const MAX_AGE_MS = 30 * 60 * 1000;   // forget positions older than 30 minutes
const HOLD_MS    = 7000;             // keep correcting for up to 7 seconds
const DEBUG      = true;             // set to false once you're happy with it

const log = (...args) => { if (DEBUG) console.log("[scroll-memory]", ...args); };

const normPath = (p) => p.replace(/\/(index(\.html)?)?$/, "/");
const here     = () => normPath(location.pathname) + location.search;

const ANY_PRODUCT = '[onclick*="product.html?id="], a[href*="product.html?id="]';
const selFor = (id) => `[onclick*="product.html?id=${id}"], a[href*="product.html?id=${id}"]`;

const onHome =
  /^\/(index(\.html)?)?$/.test(location.pathname) &&
  !!document.getElementById("products");

let restoring = false;
let saveTimer = null;

function readEntry()   { try { return JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (e) { return null; } }
function writeEntry(v) { try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} }

function jumpBy(dy) { try { window.scrollBy({ top: dy, behavior: "instant" }); } catch (e) { window.scrollBy(0, dy); } }
function jumpTo(y)  { try { window.scrollTo({ top: y,  behavior: "instant" }); } catch (e) { window.scrollTo(0, y); } }

// Plain "you were about here" save — never wipes a fresh product-tap note
function savePlain() {
  if (restoring) return;
  const prev = readEntry();
  if (prev && prev.id && Date.now() - prev.ts < 5000) return;
  writeEntry({ y: Math.round(window.scrollY), loc: here(), ts: Date.now() });
}

function shouldRestore(entry) {
  if (!entry)                             { log("nothing saved yet"); return false; }
  if (Date.now() - entry.ts > MAX_AGE_MS) { log("saved position is too old"); return false; }
  if (entry.loc !== here())               { log("saved for a different page address:", entry.loc); return false; }

  const nav  = performance.getEntriesByType("navigation")[0];
  const type = nav ? nav.type : "navigate";
  if (type === "reload")       { log("page was refreshed — not restoring"); return false; }
  if (type === "back_forward") { return true; }

  try {
    const ref = new URL(document.referrer);
    if (ref.origin === location.origin && normPath(ref.pathname) !== normPath(location.pathname)) return true;
  } catch (e) {}

  log("arrived from outside the site — starting at the top");
  return false;
}

function hold(entry) {
  restoring = true;
  let stopped   = false;
  let cached    = null;
  let announced = false;

  const stop = (why) => {
    if (stopped) return;
    stopped = true;
    restoring = false;
    log("stopped:", why);
  };

  // The moment the person scrolls or taps, this is their page again
  ["wheel", "touchstart", "keydown", "mousedown", "pointerdown"].forEach((type) => {
    window.addEventListener(type, () => stop("you took over scrolling"), { once: true, passive: true, capture: true });
  });

  const t0 = performance.now();

  const tick = () => {
    if (stopped) return;
    const elapsed = performance.now() - t0;
    if (elapsed > HOLD_MS) { stop("finished holding your position"); return; }

    let anchored = false;

    if (entry.id) {
      if (!cached || !cached.isConnected) {
        const list = document.querySelectorAll(selFor(entry.id));
        cached = list[entry.nth] || list[0] || null;
      }
      if (cached) {
        anchored = true;
        const delta = cached.getBoundingClientRect().top - entry.off;
        if (Math.abs(delta) > 2) jumpBy(delta);
        else if (!announced) { announced = true; log("back on the product you opened"); }
      }
    }

    // No product card to line up with (or it never appeared) — go by distance
    if (!anchored && (!entry.id || elapsed > 2500)) {
      if (Math.abs(window.scrollY - entry.y) > 2) jumpTo(entry.y);
    }

    requestAnimationFrame(tick);
  };

  log("restoring…", entry);
  requestAnimationFrame(tick);
}

if (onHome) {
  // Remember exactly which product was tapped, and where it sat on screen
  document.addEventListener("click", (ev) => {
    const el = ev.target && ev.target.closest ? ev.target.closest(ANY_PRODUCT) : null;
    if (!el) return;
    const src = el.getAttribute("onclick") || el.getAttribute("href") || "";
    const m = /product\.html\?id=([A-Za-z0-9_-]+)/.exec(src);
    if (!m) return;

    const id  = m[1];
    const nth = Array.from(document.querySelectorAll(selFor(id))).indexOf(el);
    const entry = {
      y: Math.round(window.scrollY), loc: here(), ts: Date.now(),
      id, nth: Math.max(0, nth), off: Math.round(el.getBoundingClientRect().top)
    };
    writeEntry(entry);
    log("saved your place at product", id, entry);
  }, true);

  // Keep a plain scroll position too, for leaving the page any other way
  window.addEventListener("scroll", () => {
    if (restoring) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(savePlain, 150);
  }, { passive: true });
  window.addEventListener("pagehide", savePlain);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") savePlain();
  });

  const entry = readEntry();
  log("homepage ready. saved:", entry);
  if (shouldRestore(entry)) hold(entry);
}