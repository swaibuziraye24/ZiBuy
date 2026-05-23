// ============================================
//   ZiBuy — Auth Module
// ============================================

import {
  auth
} from "./firebase.js";

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { showToast } from "./app.js";

const ADMIN_EMAIL = "swaibuziraye22@gmail.com";

// ---- Track auth state globally ----
export let isAdmin = false;
export let currentUser = null;

onAuthStateChanged(auth, (user) => {

  currentUser = user;
  isAdmin = !!(user && user.email === ADMIN_EMAIL);

  updateAccountButton(user);

  const adminBtn = document.getElementById("admin-verify-btn");

if (adminBtn) {
  adminBtn.style.display = isAdmin ? "inline-block" : "none";
}


  // Hide admin panel if logged out
  if (!isAdmin) {
    const panel = document.getElementById("admin-modal");
    if (panel) panel.classList.remove("open");
  }
});

function updateAccountButton(user) {
  const accountBtn = document.getElementById("account-btn");
  if (!accountBtn) return;
  if (user) {
    const name = user.email.split("@")[0];
    accountBtn.textContent = "👤 " + name;
  } else {
    accountBtn.textContent = "Account";
  }
}

// ============ Customer Auth ============

export function openAuthModal() {
  document.getElementById("auth-modal").classList.add("open");
}

export function closeAuthModal() {
  document.getElementById("auth-modal").classList.remove("open");
}

export async function customerRegister() {
  const email    = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value.trim();

  if (!email || !password) {
    showToast("Please fill in all fields", "error");
    return;
  }

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    showToast("Account created! Welcome to ZiBuy 🎉", "success");
    closeAuthModal();
  } catch (err) {
    showToast(err.message, "error");
  }
}

export async function customerLogin() {
  const email    = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value.trim();

  if (!email || !password) {
    showToast("Please fill in all fields", "error");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    showToast("Welcome back! 👋", "success");
    closeAuthModal();
  } catch (err) {
    showToast("Invalid email or password", "error");
  }
}

export async function customerLogout() {
  await signOut(auth);
  showToast("Logged out successfully", "info");
}

// ============ Admin Auth ============

export function openAdminLoginModal() {
  document.getElementById("admin-login-modal").classList.add("open");
}

export function closeAdminLoginModal() {
  document.getElementById("admin-login-modal").classList.remove("open");
}

export async function adminLogin() {
  const email    = document.getElementById("admin-email").value.trim();
  const password = document.getElementById("admin-password").value.trim();

  try {
    const result = await signInWithEmailAndPassword(auth, email, password);

    if (result.user.email !== ADMIN_EMAIL) {
      await signOut(auth);
      showToast("Not authorized as admin", "error");
      return;
    }

    isAdmin = true;
    closeAdminLoginModal();
    openAdminPanel();
    showToast("Welcome Admin! 🔑", "success");
  } catch (err) {
    showToast("Admin login failed", "error");
  }
}

export function openAdminPanel() {

  const modal = document.getElementById("admin-modal");
  const content = document.getElementById("admin-panel-content");

  if (modal) {
    modal.classList.add("open");
  }

  if (content) {
    content.style.display = "block";
  }

  // Trigger order load
  window.loadOrders && window.loadOrders();
}

export function closeAdminPanel() {
  document.getElementById("admin-modal").classList.remove("open");
}

// Expose to window for inline HTML onclick
window.openAuthModal        = openAuthModal;
window.closeAuthModal       = closeAuthModal;
window.customerRegister     = customerRegister;
window.customerLogin        = customerLogin;
window.customerLogout       = customerLogout;
window.openAdminLoginModal  = openAdminLoginModal;
window.closeAdminLoginModal = closeAdminLoginModal;
window.adminLogin           = adminLogin;
window.openAdminPanel       = openAdminPanel;
window.closeAdminPanel      = closeAdminPanel;


