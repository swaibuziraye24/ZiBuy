// ============================================
//  ZiBuy: Android app mode
//  Inside the Google Play app, paid digital features
//  (plans, boosts, pins, verification fee, job-post fees)
//  are hidden. The website works exactly as before.
// ============================================
(function () {
  var inApp = false;

  try {
    var ref = document.referrer || "";
    var q = new URLSearchParams(location.search);
    // the Play app opens the site with an "android-app://" referrer, or with ?app=android
    if (ref.indexOf("android-app://") === 0 || q.get("app") === "android") {
      sessionStorage.setItem("zb_android_app", "1");
    }
    inApp = sessionStorage.getItem("zb_android_app") === "1";
  } catch (e) {}

  window.__zbAndroid = inApp;
  if (!inApp) return;

  document.documentElement.classList.add("zb-android");

  // 1) Hide every button and link that starts a paid purchase
  var hide = [
    'a[href*="business-plans"]', '[onclick*="business-plans"]',
    'a[href*="business-upgrade"]', '[onclick*="business-upgrade"]',
    'a[href*="seller-verification"]', '[onclick*="seller-verification"]',
    'a[href*="hiring.html"]', '[onclick*="hiring.html"]',
    '[onclick*="boostFromDashboard"]', '[onclick*="boostCV"]', '[onclick*="showBoostModal"]',
    '[onclick*="openAutoRenewModal"]', '[onclick*="pinToTop"]', '[onclick*="upgradeToBusiness"]',
    '#upgrade-btn', '.btn-featured'
  ];
  var style = document.createElement("style");
  style.textContent = hide.map(function (s) { return ".zb-android " + s; }).join(",") + "{display:none !important}";
  document.head.appendChild(style);

  // 2) Small friendly message
  function notice(text) {
    var t = document.createElement("div");
    t.textContent = text;
    t.style.cssText = "position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#111827;color:white;padding:12px 18px;border-radius:12px;font-size:14px;font-weight:600;z-index:100001;max-width:86%;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,.25)";
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3200);
  }
  var MESSAGE = "This isn't available in the app right now.";

  // 3) Switch off the paid actions in code, whichever script defines them
  function blocked() { notice(MESSAGE); }
  [
    "boostFromDashboard", "boostCV", "showBoostModal", "selectBoost", "processBoost",
    "openAutoRenewModal", "requestAutoRenew", "pinToTop", "upgradeToBusiness"
  ].forEach(function (name) {
    try {
      Object.defineProperty(window, name, { get: function () { return blocked; }, set: function () {}, configurable: true });
    } catch (e) {}
  });

  // 4) If someone reaches a paid page anyway, send them home
  var blockedPages = ["business-plans.html", "business-upgrade.html", "hiring.html", "seller-verification.html", "boost-product.html"];
  var page = location.pathname.split("/").pop();
  if (blockedPages.indexOf(page) !== -1) {
    try { sessionStorage.setItem("zb_android_notice", "1"); } catch (e) {}
    location.replace("index.html");
    return;
  }

  // 5) After the page loads: show the message if we just sent someone home, and tidy the help page
  document.addEventListener("DOMContentLoaded", function () {
    try {
      if (sessionStorage.getItem("zb_android_notice") === "1") {
        sessionStorage.removeItem("zb_android_notice");
        notice(MESSAGE);
      }
    } catch (e) {}

    document.querySelectorAll(".faq-q").forEach(function (q) {
      var text = (q.textContent + " " + (q.nextElementSibling ? q.nextElementSibling.textContent : "")).toLowerCase();
      if (text.indexOf("upgrade") !== -1 || text.indexOf("business plan") !== -1 || text.indexOf("boost") !== -1 || text.indexOf("verification fee") !== -1) {
        q.style.display = "none";
        if (q.nextElementSibling) q.nextElementSibling.style.display = "none";
      }
    });
  });
})();