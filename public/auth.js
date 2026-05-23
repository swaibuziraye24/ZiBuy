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

window.customerRegister = async function() {
  // ... registration code ...
  
  // After successful registration, add same buttons:
  document.getElementById("post-ad-btn").style.display = "block";
  document.getElementById("dashboard-btn").style.display = "block";
  document.getElementById("notifications-btn").style.display = "block";
  document.getElementById("messages-btn").style.display = "block";
  
  alert("✅ Account created! You're now logged in");
  closeAuthModal();
  location.reload();
}

window.customerLogin = async function() {
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value.trim();

  if (!email || !password) {
    alert("Please fill all fields");
    return;
  }

  try {
    const response = await signInWithEmailAndPassword(auth, email, password);
    
    // ✅ ADD THIS PART:
    // Show the buttons for logged-in users
    document.getElementById("post-ad-btn").style.display = "block";
    document.getElementById("dashboard-btn").style.display = "block";
    document.getElementById("notifications-btn").style.display = "block";
    document.getElementById("messages-btn").style.display = "block";
    document.getElementById("account-btn").textContent = "🚪 Logout";
    
    // Hide login button
    document.getElementById("account-btn").onclick = function() {
      auth.signOut();
      location.reload();
    };
    
    alert("✅ Login successful!");
    closeAuthModal();
    location.reload(); // Refresh to show buttons
    
  } catch (err) {
    alert("❌ Login failed: " + err.message);
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

export async function openAdminPanel() {

  // Load admin module only when needed
  await import("./admin.js");

  const modal = document.getElementById("admin-modal");
  const content = document.getElementById("admin-panel-content");

  if (modal) {
    modal.classList.add("open");
  }

  if (content) {
    content.style.display = "block";
  }

  // Load orders
  if (window.loadOrders) {
    window.loadOrders();
  }

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


