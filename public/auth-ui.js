// ============================================
//  ZiBuy: login, sign-up, email verification, terms acceptance
// ============================================
import { auth, db, doc, getDoc, setDoc } from "./firebase.js";
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, GoogleAuthProvider, sendPasswordResetEmail, updateProfile,
  EmailAuthProvider, linkWithCredential, reauthenticateWithCredential,
  reauthenticateWithPopup, updatePassword
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const FUNCTIONS_URL = "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";
const DEFAULT_LEGAL = { termsVersion: "2026-10-15", privacyVersion: "2026-10-15", gateEnabled: true };

// ───────── helpers ─────────
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

function normPhone(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("0") && d.length === 10) d = "256" + d.slice(1);
  if (d.length === 9) d = "256" + d;
  return /^256\d{9}$/.test(d) ? d : null;
}

async function callFn(name, data) {
  const { getFunctions, httpsCallable } = await import(FUNCTIONS_URL);
  const res = await httpsCallable(getFunctions(), name)(data || {});
  return res.data;
}

function toast(msg) {
  if (typeof window.showToast === "function") { window.showToast(msg); return; }
  const t = document.createElement("div");
  t.textContent = msg;
  t.style.cssText = "position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#111827;color:white;padding:12px 18px;border-radius:12px;font-size:14px;font-weight:600;z-index:100001;box-shadow:0 8px 24px rgba(0,0,0,.25)";
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

function redirectAfterLogin() {
  try {
    const dest = sessionStorage.getItem("zibuy_post_login_redirect");
    if (dest) { sessionStorage.removeItem("zibuy_post_login_redirect"); window.location.href = dest; }
  } catch (e) {}
}

let legalCache = null;
async function getLegal() {
  if (legalCache) return legalCache;
  try {
    const snap = await getDoc(doc(db, "system_config", "legal"));
    legalCache = { ...DEFAULT_LEGAL, ...(snap.exists() ? snap.data() : {}) };
  } catch (e) {
    legalCache = { ...DEFAULT_LEGAL };
  }
  legalCache.termsVersion   = String(legalCache.termsVersion);
  legalCache.privacyVersion = String(legalCache.privacyVersion);
  return legalCache;
}

function passwordProblem(p) {
  if (p.length < 8) return "Use at least 8 characters for your password.";
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return "Your password needs at least one letter and one number.";
  return "";
}

function mapFnError(e) {
  const msg = String(e?.message || "");
  if (e?.code && String(e.code).startsWith("functions/") && msg && !/^internal$/i.test(msg)) return msg;
  return "Something went wrong. Please try again.";
}

function mapAuthError(e) {
  if (e?.zb) return e.zb;
  const wrong = "Wrong email/phone or password. If you signed up with Google, use “Continue with Google”.";
  const m = {
    "auth/invalid-credential":    wrong,
    "auth/wrong-password":        wrong,
    "auth/user-not-found":        wrong,
    "auth/invalid-email":         "That email address doesn't look right.",
    "auth/email-already-in-use":  "This email already has an account. Log in instead, or use Forgot password.",
    "auth/weak-password":         "Please choose a stronger password.",
    "auth/too-many-requests":     "Too many attempts. Please wait a few minutes and try again.",
    "auth/network-request-failed":"No internet connection. Please check your network and try again.",
    "auth/user-disabled":         "This account has been disabled. Please contact support.",
    "auth/account-exists-with-different-credential": "This email is already registered. Log in with your email and password instead.",
    "auth/operation-not-allowed": "This sign-in method isn't enabled yet.",
    "auth/requires-recent-login": "For your security, please log in again and retry."
  };
  return m[e?.code] || mapFnError(e);
}

// ───────── look and feel ─────────
const CSS = `
#auth-modal { display:none !important; }
.zb-auth{position:fixed;inset:0;z-index:100000;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(17,24,39,.6);backdrop-filter:blur(3px)}
.zb-auth.open{display:flex}
.zb-card{background:#fff;width:100%;max-width:420px;max-height:calc(100vh - 32px);overflow:auto;border-radius:20px;padding:26px 24px 22px;box-shadow:0 24px 60px rgba(0,0,0,.35);position:relative;font-family:inherit;color:#111827}
.zb-x{position:absolute;top:12px;right:12px;width:34px;height:34px;border-radius:50%;border:none;background:#f3f4f6;font-size:16px;cursor:pointer;color:#374151}
.zb-logo{display:block;margin:0 auto 10px;height:44px;width:auto}
.zb-title{font-size:21px;font-weight:900;text-align:center;margin:0 0 4px}
.zb-sub{font-size:13px;color:#6b7280;text-align:center;margin:0 0 16px;line-height:1.5}
.zb-tabs{display:flex;background:#f3f4f6;border-radius:12px;padding:4px;margin-bottom:16px}
.zb-tabs button{flex:1;border:none;background:transparent;padding:10px;border-radius:9px;font-weight:800;font-size:14px;color:#6b7280;cursor:pointer;font-family:inherit}
.zb-tabs button.on{background:#fff;color:#ff6600;box-shadow:0 1px 4px rgba(0,0,0,.12)}
.zb-google{width:100%;display:flex;align-items:center;justify-content:center;gap:10px;background:#fff;border:1.5px solid #d1d5db;border-radius:12px;padding:12px;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit;color:#111827}
.zb-google:hover{background:#f9fafb}
.zb-google:disabled{opacity:.6}
.zb-or{display:flex;align-items:center;gap:10px;color:#9ca3af;font-size:12px;margin:14px 0}
.zb-or::before,.zb-or::after{content:"";flex:1;height:1px;background:#e5e7eb}
.zb-lab{display:block;font-size:12px;font-weight:800;color:#374151;margin:12px 0 5px}
.zb-in{width:100%;padding:12px 14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:15px;font-family:inherit;box-sizing:border-box;outline:none;background:#fff}
.zb-in:focus{border-color:#ff6600;box-shadow:0 0 0 3px rgba(255,102,0,.12)}
.zb-pw{position:relative}
.zb-pw .zb-in{padding-right:46px}
.zb-eye{position:absolute;right:6px;top:50%;transform:translateY(-50%);border:none;background:transparent;font-size:18px;cursor:pointer;padding:8px}
.zb-primary{width:100%;margin-top:16px;background:#ff6600;color:#fff;border:none;border-radius:12px;padding:14px;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit}
.zb-primary:disabled{opacity:.6;cursor:not-allowed}
.zb-link{background:none;border:none;color:#ff6600;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit;padding:0}
.zb-row{display:flex;justify-content:space-between;align-items:center;margin-top:8px}
.zb-err{display:none;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;padding:10px 12px;border-radius:10px;font-size:13px;font-weight:600;line-height:1.5;margin:0 0 4px}
.zb-ok{display:none;background:#f0fdf4;border:1px solid #86efac;color:#166534;padding:10px 12px;border-radius:10px;font-size:13px;font-weight:600;line-height:1.5;margin:0 0 4px}
.zb-meter{height:5px;border-radius:3px;background:#e5e7eb;margin-top:8px;overflow:hidden}
.zb-meter i{display:block;height:100%;width:0;background:#ef4444;transition:width .2s,background .2s}
.zb-hint{font-size:11.5px;color:#6b7280;margin-top:5px;line-height:1.5}
.zb-code{text-align:center;font-size:28px;letter-spacing:10px;font-weight:900}
.zb-terms{display:flex;gap:10px;align-items:flex-start;font-size:12.5px;color:#374151;line-height:1.6;margin-top:14px;cursor:pointer}
.zb-terms input{margin-top:3px;width:18px;height:18px;accent-color:#ff6600;flex-shrink:0}
.zb-terms a, .zb-box a{color:#ff6600;font-weight:700}
.zb-box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:12px 14px;font-size:13px;color:#374151;line-height:1.7}
.zb-foot{text-align:center;font-size:13px;color:#6b7280;margin-top:14px}
@media (max-width:480px){.zb-auth{align-items:flex-end;padding:0}.zb-card{max-width:none;border-radius:20px 20px 0 0;max-height:92vh}}
`;

const GOOGLE_SVG = `<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>`;

const head = (title, sub) => `
  <img class="zb-logo" src="my_logo.png" alt="ZiBuy">
  <h2 class="zb-title">${title}</h2>
  <p class="zb-sub">${sub}</p>`;

const tabs = (on) => `
  <div class="zb-tabs">
    <button data-a="tab-login"  class="${on === "login" ? "on" : ""}">Log in</button>
    <button data-a="tab-signup" class="${on === "signup" ? "on" : ""}">Sign up</button>
  </div>`;

const pwField = (id, label, auto, ph) => `
  <label class="zb-lab" for="${id}">${label}</label>
  <div class="zb-pw">
    <input class="zb-in" id="${id}" type="password" autocomplete="${auto}" placeholder="${ph}">
    <button type="button" class="zb-eye" data-a="eye" aria-label="Show or hide password">👁️</button>
  </div>`;

const VIEWS = {
  login: (S) => `
    ${head("Welcome back", "Log in to buy, sell and track your orders")}
    ${tabs("login")}
    <button class="zb-google" data-a="google">${GOOGLE_SVG} Continue with Google</button>
    <div class="zb-or"><span>or log in with your password</span></div>
    <div class="zb-err" id="zb-err"></div>
    <label class="zb-lab" for="zb-id">Email or phone number</label>
    <input class="zb-in" id="zb-id" type="text" autocomplete="username" autocapitalize="none" placeholder="you@example.com or 0701234567" value="${esc(S.email || "")}">
    ${pwField("zb-pass", "Password", "current-password", "Your password")}
    <div class="zb-row"><span></span><button class="zb-link" data-a="forgot">Forgot password?</button></div>
    <button class="zb-primary" data-a="login">Log in</button>
    <p class="zb-foot">New to ZiBuy? <button class="zb-link" data-a="tab-signup">Create an account</button></p>`,

  signup: () => `
    ${head("Create your account", "Join ZiBuy to buy and sell safely")}
    ${tabs("signup")}
    <button class="zb-google" data-a="google">${GOOGLE_SVG} Sign up with Google</button>
    <div class="zb-or"><span>or sign up with your email</span></div>
    <div class="zb-err" id="zb-err"></div>
    <label class="zb-lab" for="zb-name">Full name</label>
    <input class="zb-in" id="zb-name" type="text" autocomplete="name" placeholder="e.g. Aisha Nakato">
    <label class="zb-lab" for="zb-email">Email address</label>
    <input class="zb-in" id="zb-email" type="email" autocomplete="email" autocapitalize="none" placeholder="you@example.com">
    <label class="zb-lab" for="zb-phone">Phone number</label>
    <input class="zb-in" id="zb-phone" type="tel" autocomplete="tel" placeholder="0701234567">
    <div class="zb-hint">Used for delivery and so buyers can reach you. You can log in with it too.</div>
    ${pwField("zb-pass", "Password", "new-password", "At least 8 characters")}
    <div class="zb-meter"><i id="zb-meter"></i></div>
    <div class="zb-hint" id="zb-meter-text">Use at least 8 characters, with a letter and a number.</div>
    ${pwField("zb-pass2", "Confirm password", "new-password", "Type it again")}
    <label class="zb-terms">
      <input type="checkbox" id="zb-agree">
      <span>I have read and agree to the <a href="terms.html" target="_blank">Terms &amp; Conditions</a> and the <a href="privacy.html" target="_blank">Privacy Policy</a>. I understand my acceptance is recorded with the date and time.</span>
    </label>
    <button class="zb-primary" data-a="signup">Create account</button>
    <p class="zb-foot">Already have an account? <button class="zb-link" data-a="tab-login">Log in</button></p>`,

  verify: (S) => `
    ${head("Verify your email", S.sentTo ? `We sent a 6-digit code to <strong>${esc(S.sentTo)}</strong>` : "We'll send a 6-digit code to your email")}
    <div class="zb-err" id="zb-err"></div>
    <div class="zb-ok" id="zb-ok"></div>
    <label class="zb-lab" for="zb-code">Enter the code</label>
    <input class="zb-in zb-code" id="zb-code" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="••••••">
    <button class="zb-primary" data-a="verify">Verify and continue</button>
    <div class="zb-row" style="margin-top:14px">
      <button class="zb-link" data-a="resend" id="zb-resend">Resend code</button>
      <button class="zb-link" data-a="logout" style="color:#6b7280">Use a different account</button>
    </div>
    <p class="zb-hint" style="text-align:center;margin-top:12px">Can't find it? Check your spam folder. The code expires in 10 minutes.</p>`,

  terms: (S) => `
    ${head(S.opts.method === "reaccept" ? "We've updated our terms" : "One last step", "Please review and accept to continue using ZiBuy")}
    <div class="zb-err" id="zb-err"></div>
    <div class="zb-box">
      ZiBuy handles payments, deliveries and signed records. Our
      <a href="terms.html" target="_blank">Terms &amp; Conditions</a> and
      <a href="privacy.html" target="_blank">Privacy Policy</a> explain your rights and how your data is used.
    </div>
    <label class="zb-terms">
      <input type="checkbox" id="zb-agree">
      <span>I have read and agree to the Terms &amp; Conditions and the Privacy Policy. I understand my acceptance is recorded with the date and time.</span>
    </label>
    <button class="zb-primary" data-a="accept">Accept and continue</button>
    <div class="zb-row" style="justify-content:center;margin-top:12px"><button class="zb-link" data-a="logout" style="color:#6b7280">Log out</button></div>`,

  forgot: (S) => `
    ${head("Reset your password", "Enter your email and we'll send you a reset link")}
    <div class="zb-err" id="zb-err"></div>
    <div class="zb-ok" id="zb-ok"></div>
    <label class="zb-lab" for="zb-email">Email address</label>
    <input class="zb-in" id="zb-email" type="email" autocomplete="email" autocapitalize="none" placeholder="you@example.com" value="${esc(S.email && S.email.includes("@") ? S.email : "")}">
    <button class="zb-primary" data-a="sendreset">Send reset link</button>
    <p class="zb-foot"><button class="zb-link" data-a="tab-login">← Back to log in</button></p>
    <p class="zb-hint" style="text-align:center">Signed up with Google? Use “Continue with Google”, or set a password in Dashboard → Account Settings.</p>`,

  password: () => {
    const hasPw = !!auth.currentUser?.providerData.some(p => p.providerId === "password");
    return `
    ${head(hasPw ? "Change password" : "Set a password", hasPw ? "Choose a new password for your account" : "Add a password so you can also log in with your email and password")}
    <div class="zb-err" id="zb-err"></div>
    ${hasPw ? pwField("zb-cur", "Current password", "current-password", "Your current password") : ""}
    ${pwField("zb-pass", hasPw ? "New password" : "Password", "new-password", "At least 8 characters")}
    <div class="zb-meter"><i id="zb-meter"></i></div>
    <div class="zb-hint" id="zb-meter-text">Use at least 8 characters, with a letter and a number.</div>
    ${pwField("zb-pass2", "Confirm password", "new-password", "Type it again")}
    <button class="zb-primary" data-a="savepw">Save password</button>`;
  }
};

// ───────── the window ─────────
const S = { view: "login", blocking: false, opts: {}, email: "", sentTo: "", resendAt: 0, autoSent: false };
let root = null;
let timer = null;

function ensureRoot() {
  if (root) return;
  root = document.createElement("div");
  root.className = "zb-auth";
  root.id = "zb-auth";
  root.addEventListener("click", onClick);
  root.addEventListener("input", onInput);
  root.addEventListener("keydown", onKey);
  document.body.appendChild(root);
}

function render(view) {
  S.view = view;
  const x = S.blocking ? "" : `<button class="zb-x" data-a="close" aria-label="Close">✕</button>`;
  root.innerHTML = `<div class="zb-card" role="dialog" aria-modal="true">${x}${VIEWS[view](S)}</div>`;

  const first = root.querySelector("input:not([type=checkbox]):not([type=hidden])");
  if (first) setTimeout(() => first.focus(), 60);

  if (view === "verify") {
    startCountdown();
    if (S.opts.autoSend && !S.autoSent) { S.autoSent = true; sendCode(true); }
  }
}

function open(view, opts = {}) {
  ensureRoot();
  if (S.blocking && root.classList.contains("open") && !opts.blocking) return;   // never cover a required step
  S.blocking = !!opts.blocking;
  S.opts = opts;
  render(view);
  root.classList.add("open");
  document.body.style.overflow = "hidden";
}

function close() {
  if (!root) return;
  root.classList.remove("open");
  document.body.style.overflow = "";
  clearInterval(timer);
}

const el  = (id) => document.getElementById(id);
const val = (id) => (el(id)?.value || "").trim();
const raw = (id) => el(id)?.value || "";

function showErr(msg) {
  const e = el("zb-err"); if (!e) return;
  const ok = el("zb-ok"); if (ok) ok.style.display = "none";
  e.textContent = msg; e.style.display = "block";
}
function showOk(msg) {
  const e = el("zb-err"); if (e) e.style.display = "none";
  const ok = el("zb-ok"); if (!ok) return;
  ok.textContent = msg; ok.style.display = "block";
}
function setBusy(btn, label) {
  if (!btn) return () => {};
  const old = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = label;
  return () => { btn.disabled = false; btn.innerHTML = old; };
}

function startCountdown() {
  clearInterval(timer);
  const btn = () => el("zb-resend");
  const tick = () => {
    const b = btn(); if (!b) { clearInterval(timer); return; }
    const left = Math.ceil((S.resendAt - Date.now()) / 1000);
    if (left > 0) { b.disabled = true; b.textContent = `Resend code in ${left}s`; }
    else { b.disabled = false; b.textContent = "Resend code"; clearInterval(timer); }
  };
  tick();
  timer = setInterval(tick, 1000);
}

// ───────── events ─────────
function onClick(e) {
  const target = e.target.closest("[data-a]");
  if (!target) { if (e.target === root && !S.blocking) close(); return; }
  const actions = {
    close: () => { if (!S.blocking) close(); },
    "tab-login":  () => render("login"),
    "tab-signup": () => render("signup"),
    forgot:   () => render("forgot"),
    eye: () => { const i = target.parentElement.querySelector("input"); i.type = i.type === "password" ? "text" : "password"; },
    google:    () => doGoogle(target),
    login:     () => doLogin(target),
    signup:    () => doSignup(target),
    verify:    () => doVerify(target),
    resend:    () => sendCode(false),
    accept:    () => doAccept(target),
    logout:    () => doLogout(),
    sendreset: () => doReset(target),
    savepw:    () => doSavePassword(target)
  };
  (actions[target.dataset.a] || (() => {}))();
}

function onInput(e) {
  if (e.target.id === "zb-pass" && el("zb-meter")) {
    const p = e.target.value;
    let score = 0;
    if (p.length >= 8) score++;
    if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
    if (/\d/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    const names  = ["Too weak", "Weak", "Fair", "Good", "Strong"];
    const colors = ["#ef4444", "#ef4444", "#f59e0b", "#10b981", "#059669"];
    el("zb-meter").style.width = (p ? score * 25 : 0) + "%";
    el("zb-meter").style.background = colors[score];
    el("zb-meter-text").textContent = p ? "Password strength: " + names[score] : "Use at least 8 characters, with a letter and a number.";
  }
  if (e.target.id === "zb-code") e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6);
}

function onKey(e) {
  if (e.key === "Escape" && !S.blocking) { close(); return; }
  if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "checkbox") {
    e.preventDefault();
    root.querySelector(".zb-primary")?.click();
  }
}

// ───────── actions ─────────
async function doLogin(btn) {
  const id = val("zb-id"), pass = raw("zb-pass");
  S.email = id;
  if (!id || !pass) return showErr("Enter your email or phone number, and your password.");

  const done = setBusy(btn, "Logging in…");
  try {
    let email = id;
    if (!id.includes("@")) {
      if (!normPhone(id)) throw { zb: "That doesn't look like a valid email or phone number." };
      const r = await callFn("phoneLoginLookup", { phone: id, password: pass });
      email = r.email;
    }
    await signInWithEmailAndPassword(auth, email, pass);
    const blocked = await runGate(auth.currentUser);
    if (!blocked) { close(); toast("✅ Logged in successfully"); redirectAfterLogin(); }
  } catch (e) {
    showErr(mapAuthError(e));
  } finally { done(); }
}

async function doGoogle(btn) {
  const done = setBusy(btn, "Opening Google…");
  try {
    const result = await signInWithPopup(auth, new GoogleAuthProvider());
    const blocked = await runGate(result.user);
    if (!blocked) { close(); toast("✅ Signed in with Google"); redirectAfterLogin(); }
  } catch (e) {
    if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") return;
    showErr(mapAuthError(e));
  } finally { done(); }
}

async function doSignup(btn) {
  const name = val("zb-name"), email = val("zb-email").toLowerCase(), phoneRaw = val("zb-phone");
  const pass = raw("zb-pass"), pass2 = raw("zb-pass2");
  const agree = el("zb-agree")?.checked;
  const phone = normPhone(phoneRaw);

  if (name.length < 3)                    return showErr("Please enter your full name.");
  if (!/^\S+@\S+\.\S+$/.test(email))      return showErr("Enter a valid email address.");
  if (!phone)                             return showErr("Enter a valid Ugandan phone number, like 0701234567.");
  const problem = passwordProblem(pass);
  if (problem)                            return showErr(problem);
  if (pass !== pass2)                     return showErr("The two passwords don't match.");
  if (!agree) {
    el("zb-agree").parentElement.style.color = "#ef4444";
    return showErr("Please accept the Terms & Conditions and the Privacy Policy to continue.");
  }

  const done = setBusy(btn, "Creating your account…");
  window.__zbSigningUp = true;
  try {
    // friendly "already registered" checks
    try {
      const av = await callFn("checkSignupAvailability", { email, phone: phoneRaw });
      if (av.emailTaken) throw { zb: "This email already has an account. Log in instead, or use Forgot password." };
      if (av.phoneTaken) throw { zb: "This phone number is already registered. Log in instead, or use a different number." };
    } catch (e) {
      if (e.zb) throw e;
      if (e.code === "functions/resource-exhausted") throw { zb: e.message };
      /* the check itself is unavailable: carry on */
    }

    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const user = cred.user;
    await updateProfile(user, { displayName: name }).catch(() => {});

    await setDoc(doc(db, "users", user.uid), {
      email: user.email, uid: user.uid, displayName: name, phone,
      plan: "free", accountType: "normal", isSellerVerified: false, banned: false,
      createdAt: new Date()
    });

    // permanent record that this person accepted the Terms and Privacy Policy
    try {
      const legal = await getLegal();
      await callFn("recordTermsAcceptance", {
        agreed: true, termsVersion: legal.termsVersion, privacyVersion: legal.privacyVersion, method: "signup_form"
      });
    } catch (e) { console.warn("Terms acceptance will be asked again after verification:", e); }

    try {
      const r = await import("./referral.js");
      await r.attachReferral(user.uid);
      await r.ensureReferralCode(user.uid);
    } catch (e) { /* referral is optional */ }

    const sent = await callFn("sendEmailCode");
    S.email = email;
    S.sentTo = sent.sentTo || email;
    S.resendAt = Date.now() + 30000;
    S.autoSent = true;
    window.__zbSigningUp = false;
    S.blocking = true;
    S.opts = {};
    render("verify");
  } catch (e) {
    window.__zbSigningUp = false;
    showErr(mapAuthError(e));
  } finally { done(); }
}

async function sendCode(silent) {
  try {
    const r = await callFn("sendEmailCode");
    if (r.alreadyVerified) { await finishVerified(); return; }
    S.sentTo = r.sentTo || S.sentTo;
    S.resendAt = Date.now() + 30000;
    if (S.view === "verify") {
      render("verify");
      if (!silent) showOk("A new code is on its way. Check your inbox.");
    }
  } catch (e) {
    if (S.view === "verify") showErr(mapFnError(e));
  }
}

async function finishVerified() {
  await auth.currentUser.reload();
  await auth.currentUser.getIdToken(true);
  S.blocking = false;
  const blocked = await runGate(auth.currentUser);
  if (!blocked) { close(); toast("✅ Email verified. Welcome to ZiBuy!"); redirectAfterLogin(); }
}

async function doVerify(btn) {
  const code = val("zb-code");
  if (!/^\d{6}$/.test(code)) return showErr("Enter the 6-digit code from your email.");
  const done = setBusy(btn, "Verifying…");
  try {
    await callFn("verifyEmailCode", { code });
    await finishVerified();
  } catch (e) {
    showErr(mapFnError(e));
  } finally { done(); }
}

async function doAccept(btn) {
  if (!el("zb-agree")?.checked) return showErr("Please tick the box to accept.");
  const done = setBusy(btn, "Saving…");
  try {
    const legal = await getLegal();
    await callFn("recordTermsAcceptance", {
      agreed: true, termsVersion: legal.termsVersion, privacyVersion: legal.privacyVersion,
      method: S.opts.method || "login_gate"
    });
    sessionStorage.setItem(`zb_gate_ok:${auth.currentUser.uid}:${legal.termsVersion}:${legal.privacyVersion}`, "1");
    S.blocking = false;
    close();
    toast("✅ Thank you. You're all set.");
    redirectAfterLogin();
  } catch (e) {
    legalCache = null;
    showErr(mapFnError(e));
  } finally { done(); }
}

async function doLogout() {
  try {
    await auth.signOut();
    localStorage.removeItem("zibuy-cart");
  } catch (e) {}
  S.blocking = false;
  close();
  window.location.href = "index.html";
}

async function doReset(btn) {
  const email = val("zb-email");
  if (!/^\S+@\S+\.\S+$/.test(email)) return showErr("Enter the email address of your account.");
  const done = setBusy(btn, "Sending…");
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (e) {
    if (e.code === "auth/too-many-requests" || e.code === "auth/network-request-failed") { showErr(mapAuthError(e)); done(); return; }
    /* otherwise stay quiet about whether the account exists */
  }
  showOk("If an account with a password exists for that email, a reset link is on its way. Check your inbox and spam folder.");
  done();
}

async function doSavePassword(btn) {
  const u = auth.currentUser;
  if (!u) return;
  const hasPw = u.providerData.some(p => p.providerId === "password");
  const cur = raw("zb-cur"), p1 = raw("zb-pass"), p2 = raw("zb-pass2");

  const problem = passwordProblem(p1);
  if (problem) return showErr(problem);
  if (p1 !== p2) return showErr("The two passwords don't match.");

  const done = setBusy(btn, "Saving…");
  try {
    if (hasPw) {
      if (!cur) throw { zb: "Enter your current password." };
      await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, cur));
      await updatePassword(u, p1);
    } else {
      try {
        await linkWithCredential(u, EmailAuthProvider.credential(u.email, p1));
      } catch (e) {
        if (e.code !== "auth/requires-recent-login") throw e;
        await reauthenticateWithPopup(u, new GoogleAuthProvider());
        await linkWithCredential(u, EmailAuthProvider.credential(u.email, p1));
      }
    }
    close();
    toast("✅ Password saved. You can now log in with your email and password.");
  } catch (e) {
    showErr(mapAuthError(e));
  } finally { done(); }
}

// ───────── the gate: verified email + accepted terms ─────────
let gatePromise = null;

function runGate(user) {
  if (gatePromise) return gatePromise;
  gatePromise = (async () => {
    try { return await gateCheck(user); }
    catch (e) { console.warn("[auth gate]", e); return false; }
    finally { gatePromise = null; }
  })();
  return gatePromise;
}

async function createProfile(user) {
  await setDoc(doc(db, "users", user.uid), {
    email: user.email || "", uid: user.uid,
    displayName: user.displayName || "", photoURL: user.photoURL || "", phone: "",
    plan: "free", accountType: "normal", isSellerVerified: false, banned: false,
    createdAt: new Date()
  });
  try {
    const r = await import("./referral.js");
    await r.attachReferral(user.uid);
    await r.ensureReferralCode(user.uid);
  } catch (e) {}
}

async function gateCheck(user) {
  if (!user || window.__zbSigningUp) return false;
  if (sessionStorage.getItem("zb_impersonating")) return false;     // admin viewing as a user

  const legal = await getLegal();
  if (legal.gateEnabled === false) return false;                     // emergency switch

  const key = `zb_gate_ok:${user.uid}:${legal.termsVersion}:${legal.privacyVersion}`;
  if (sessionStorage.getItem(key) === "1") return false;

  try { await user.reload(); } catch (e) {}

  const hasPassword = user.providerData.some(p => p.providerId === "password");
  if (user.email && hasPassword && !user.emailVerified) {
    open("verify", { blocking: true, autoSend: true });
    return true;
  }

  const ref = doc(db, "users", user.uid);
  let snap = await getDoc(ref);
  let isNew = false;
  if (!snap.exists()) {
    await createProfile(user);
    snap = await getDoc(ref);
    isNew = true;
  }

  const ta = snap.data()?.termsAccepted;
  if (!ta || String(ta.termsVersion) !== legal.termsVersion || String(ta.privacyVersion) !== legal.privacyVersion) {
    open("terms", { blocking: true, method: !ta ? (isNew ? "google_signup" : "login_gate") : "reaccept" });
    return true;
  }

  sessionStorage.setItem(key, "1");
  return false;
}

// ───────── hook into the rest of the site ─────────
function openPasswordSettings() {
  if (!auth.currentUser) { open("login"); return; }
  open("password");
}

function install() {
  window.openAuthModal    = (view) => open(typeof view === "string" ? view : "login");
  window.closeAuthModal   = () => { if (!S.blocking) close(); };
  window.toggleRegister   = (toSignup) => open(toSignup === false ? "login" : "signup");
  window.customerLogin    = () => open("login");
  window.customerRegister = () => open("signup");
  window.signInWithGoogle = () => open("login");
  window.zbOpenPasswordSettings = openPasswordSettings;
  window.changePassword   = openPasswordSettings;
}
install();
setTimeout(install, 0);                       // wins over the older code that loads after this file
window.addEventListener("load", install);

const style = document.createElement("style");
style.textContent = CSS;
document.head.appendChild(style);

onAuthStateChanged(auth, (user) => {
  if (user && !window.__zbSigningUp) runGate(user);
});