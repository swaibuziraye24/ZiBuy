import { auth } from "./firebase.js";
import {
  onAuthStateChanged, EmailAuthProvider, GoogleAuthProvider,
  reauthenticateWithCredential, reauthenticateWithPopup, signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import "./auth-ui.js";

const FUNCTIONS_URL = "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";
const el = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

async function callFn(name, data) {
  const { getFunctions, httpsCallable } = await import(FUNCTIONS_URL);
  return (await httpsCallable(getFunctions(), name)(data || {})).data;
}

function showErr(id, msg) {
  const e = el(id);
  e.textContent = msg;
  e.style.display = "block";
}

// ───────── Option 1: delete it yourself ─────────
let deleted = false;
onAuthStateChanged(auth, (user) => { if (!deleted) renderSelf(user); });

function renderSelf(user) {
  const box = el("del-self");

  if (!user) {
    box.innerHTML = `
      <p>Log in to delete your account right now.</p>
      <button class="del-btn primary" id="del-login">Log in</button>`;
    el("del-login").onclick = () => {
      if (window.openAuthModal) window.openAuthModal("login");
      else window.location.href = "index.html?auth=1";
    };
    return;
  }

  const hasPw = user.providerData.some(p => p.providerId === "password");
  box.innerHTML = `
    <div class="del-box">Logged in as <strong>${esc(user.email || "")}</strong></div>
    <label class="del-lab" for="del-type">Type DELETE to confirm</label>
    <input class="del-in" id="del-type" type="text" autocomplete="off" placeholder="DELETE">
    ${hasPw
      ? `<label class="del-lab" for="del-pass">Your password</label>
         <input class="del-in" id="del-pass" type="password" autocomplete="current-password" placeholder="Enter your account password">`
      : `<p style="font-size:12.5px;color:#6b7280">You will be asked to confirm with your Google account.</p>`}
    <div class="del-err" id="del-err"></div>
    <button class="del-btn danger" id="del-go">Permanently delete my account</button>
    <p style="font-size:12.5px;color:#6b7280;margin-top:10px">This cannot be undone.</p>`;
  el("del-go").onclick = () => doDelete(user, hasPw);
}

async function doDelete(user, hasPw) {
  el("del-err").style.display = "none";
  if (el("del-type").value.trim() !== "DELETE") return showErr("del-err", "Please type DELETE to confirm.");

  const btn = el("del-go");
  btn.disabled = true;
  btn.textContent = "Deleting…";

  try {
    if (hasPw) {
      const pw = el("del-pass").value;
      if (!pw) throw { message: "Please enter your password." };
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, pw));
    } else {
      await reauthenticateWithPopup(user, new GoogleAuthProvider());
    }

    await callFn("deleteMyAccount", {});

    deleted = true;
    try { await signOut(auth); } catch (e) {}
    try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}
    el("del-self").innerHTML = `<div class="del-ok">✅ Your account has been deleted. Thank you for using ZiBuy.</div>`;
  } catch (e) {
    const code = e.code || "";
    showErr("del-err",
      code === "auth/wrong-password" || code === "auth/invalid-credential" ? "Wrong password. Please try again."
      : code === "auth/popup-closed-by-user" ? "Sign-in was cancelled."
      : (e.message || "Couldn't delete your account. Please try again."));
    btn.disabled = false;
    btn.textContent = "Permanently delete my account";
  }
}

// ───────── Option 2: request deletion by email ─────────
let reqEmail = "";

function renderRequestStep1() {
  el("del-request").innerHTML = `
    <label class="del-lab" for="rq-email">Email address of your account</label>
    <input class="del-in" id="rq-email" type="email" autocomplete="email" placeholder="you@example.com" value="${esc(reqEmail)}">
    <div class="del-err" id="rq-err"></div>
    <button class="del-btn primary" id="rq-send">Send me a code</button>`;

  el("rq-send").onclick = async () => {
    const email = el("rq-email").value.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return showErr("rq-err", "Enter a valid email address.");
    const btn = el("rq-send");
    btn.disabled = true; btn.textContent = "Sending…";
    try {
      await callFn("startDeletionRequest", { email });
      reqEmail = email;
      renderRequestStep2();
    } catch (e) {
      showErr("rq-err", e.message || "Something went wrong. Please try again.");
      btn.disabled = false; btn.textContent = "Send me a code";
    }
  };
}

function renderRequestStep2() {
  el("del-request").innerHTML = `
    <div class="del-box">If an account exists for <strong>${esc(reqEmail)}</strong>, we sent a 6-digit code to it. Check your inbox and spam folder.</div>
    <label class="del-lab" for="rq-code">6-digit code</label>
    <input class="del-in" id="rq-code" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="••••••">
    <label class="del-lab" for="rq-note">Anything we should know? (optional)</label>
    <input class="del-in" id="rq-note" type="text" maxlength="300" placeholder="Optional note">
    <div class="del-err" id="rq-err"></div>
    <button class="del-btn danger" id="rq-submit">Submit my deletion request</button>
    <p style="margin-top:10px"><button id="rq-back" style="background:none;border:none;color:#ff6600;font-weight:700;cursor:pointer;font-family:inherit">← Use a different email</button></p>`;

  el("rq-code").oninput = (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6); };
  el("rq-back").onclick = renderRequestStep1;
  el("rq-submit").onclick = async () => {
    const code = el("rq-code").value.trim();
    if (!/^\d{6}$/.test(code)) return showErr("rq-err", "Enter the 6-digit code from your email.");
    const btn = el("rq-submit");
    btn.disabled = true; btn.textContent = "Submitting…";
    try {
      await callFn("confirmDeletionRequest", { email: reqEmail, code, note: el("rq-note").value.trim() });
      el("del-request").innerHTML = `<div class="del-ok">✅ Request received. We will delete your account and data within 30 days and email you at ${esc(reqEmail)} when it's done.</div>`;
    } catch (e) {
      showErr("rq-err", e.message || "Something went wrong. Please try again.");
      btn.disabled = false; btn.textContent = "Submit my deletion request";
    }
  };
}

renderRequestStep1();