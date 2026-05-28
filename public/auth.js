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
import {
  db,
  collection,
  addDoc
} from "./firebase.js";
import {
  doc,
  setDoc,
  serverTimestamp
} from "./firebase.js";

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
    accountBtn.textContent = "👤 Account";
  }
}

// ============ Modal Functions (with null checks) ============

export function openAuthModal() {
  const modal = document.getElementById("auth-modal");
  if (!modal) {
    console.error("❌ Auth modal element not found");
    return;
  }
  modal.classList.add("open");
}

export function closeAuthModal() {
  const modal = document.getElementById("auth-modal");
  if (modal) {
    modal.classList.remove("open");
  }
}


// ============ Customer Registration ============
window.customerRegister = async function() {
  const email = document.getElementById("auth-email")?.value.trim();
  const password = document.getElementById("auth-password")?.value.trim();

  if (!email || !password) {
    alert("❌ Please fill all fields");
    return;
  }

  try {
    const response = await createUserWithEmailAndPassword(auth, email, password);
    
    // Create user profile in Firestore
    await setDoc(doc(db, "users", response.user.uid), {
      uid: response.user.uid,
      email: response.user.email,
      accountType: "normal",
      isSellerVerified: false,
      adsLimit: 10,
      subscription: {
        active: false,
        plan: null,
        expiresAt: null
      },
      businessProfile: {
        businessName: "",
        description: "",
        logo: "",
        location: ""
      },
      createdAt: serverTimestamp()
    });

    // Show auth-gated buttons
    const buttons = ["post-ad-btn", "dashboard-btn", "notifications-btn", "messages-btn"];
    buttons.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.style.display = "block";
    });

    alert("✅ Account created! You're now logged in");
    closeAuthModal();
    location.reload();
    
  } catch (err) {
    alert("❌ Registration failed: " + err.message);
  }
};

// ============ Customer Login ============

window.customerLogin = async function() {
  const email = document.getElementById("auth-email")?.value.trim();
  const password = document.getElementById("auth-password")?.value.trim();

  if (!email || !password) {
    alert("❌ Please fill all fields");
    return;
  }

  try {
    const response = await signInWithEmailAndPassword(auth, email, password);
    
    // Show auth-gated buttons
    const buttons = ["post-ad-btn", "dashboard-btn", "notifications-btn", "messages-btn"];
    buttons.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.style.display = "block";
    });

    // Update account button
    const accountBtn = document.getElementById("account-btn");
    if (accountBtn) {
      const name = email.split("@")[0];
      accountBtn.textContent = "👤 " + name;
    }

    alert("✅ Login successful!");
    closeAuthModal();
    location.reload();
    
  } catch (err) {
    alert("❌ Login failed: " + err.message);
  }
};

export async function customerLogout() {
  try {
    await signOut(auth);
    showToast("✅ Logged out successfully");
    location.reload();
  } catch (err) {
    console.error("Logout error:", err);
  }
}


// ============================================
// ADMIN LOGIN MODAL
// ============================================

export function openAdminLoginModal() {
  const modal = document.getElementById("admin-login-modal");

  if (modal) {
    modal.classList.add("open");
  }
}

export function closeAdminLoginModal() {
  const modal = document.getElementById("admin-login-modal");

  if (modal) {
    modal.classList.remove("open");
  }
}

// ============================================
// ADMIN LOGIN
// ============================================

export async function adminLogin() {
  const email = document.getElementById("admin-email")?.value.trim();
  const password = document.getElementById("admin-password")?.value.trim();

  if (!email || !password) {
    alert("❌ Please fill admin credentials");
    return;
  }

  try {
    const result = await signInWithEmailAndPassword(auth, email, password);

    if (result.user.email !== ADMIN_EMAIL) {
      await signOut(auth);
      alert("❌ Not authorized as admin");
      return;
    }

    isAdmin = true;

    closeAdminLoginModal();

    setTimeout(() => {
      openAdminPanel();
    }, 500);

    showToast("✅ Welcome Admin! 🔑");

  } catch (err) {
    alert("❌ Admin login failed: " + err.message);
  }
}

// ============================================
// ADMIN PANEL
// ============================================

export async function openAdminPanel() {
  try {
    const modal = document.getElementById("admin-modal");
    const content = document.getElementById("admin-panel-content");

    if (!modal || !content) {
      console.error("Admin modal elements not found");
      return;
    }

    modal.classList.add("open");
    content.style.display = "block";

    try {
  await import("/admin.js");
} catch (err) {
  console.warn("admin.js optional:", err);
}

    if (window.loadOrders) {
      window.loadOrders();
    }

  } catch (err) {
    console.error(err);
  }
}

export function closeAdminPanel() {
  const modal = document.getElementById("admin-modal");

  if (modal) {
    modal.classList.remove("open");
  }
}

// ============================================
// GLOBAL FUNCTIONS
// ============================================
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.customerRegister = customerRegister;
window.customerLogin = customerLogin;
window.customerLogout = customerLogout;
window.openAdminLoginModal = openAdminLoginModal;
window.closeAdminLoginModal = closeAdminLoginModal;
window.adminLogin = adminLogin;
window.openAdminPanel = openAdminPanel;
window.closeAdminPanel = closeAdminPanel;