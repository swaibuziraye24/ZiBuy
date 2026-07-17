import { app, auth } from "./firebase.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

const functions        = getFunctions(app);
const sendPhoneOTPFn    = httpsCallable(functions, "sendPhoneOTP");
const verifyPhoneOTPFn  = httpsCallable(functions, "verifyPhoneOTP");

let _otpCooldownInterval = null;

window.openPhoneVerifyModal = function(currentPhone = "") {
  const existing = document.getElementById("phone-verify-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "phone-verify-modal";
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px`;

  modal.innerHTML = `
    <div style="background:white;border-radius:20px;padding:28px;max-width:400px;width:100%">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <h2 style="margin:0;font-size:18px;font-weight:800;color:#111827">📱 Verify Your Phone</h2>
        <button onclick="document.getElementById('phone-verify-modal').remove()"
          style="background:#f3f4f6;border:none;width:32px;height:32px;border-radius:50%;font-size:18px;cursor:pointer">×</button>
      </div>
      <p style="font-size:13px;color:#6b7280;margin-bottom:18px">Verified sellers get a trust badge and rank higher in search results.</p>

      <div id="phone-step-1">
        <label style="display:block;font-size:12px;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Phone Number</label>
        <input type="tel" id="pv-phone-input" placeholder="256701234567" value="${currentPhone}"
          style="width:100%;padding:13px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:15px;font-family:inherit;outline:none;box-sizing:border-box;margin-bottom:14px">
        <button id="pv-send-btn" onclick="sendPhoneVerificationCode()"
          style="width:100%;background:#ff6600;color:white;border:none;padding:14px;border-radius:12px;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit">
          Send Verification Code
        </button>
      </div>

      <div id="phone-step-2" style="display:none">
        <p style="font-size:13px;color:#374151;margin-bottom:14px">
          Enter the 6-digit code sent to <strong id="pv-sent-to"></strong>
        </p>
        <input type="text" id="pv-code-input" maxlength="6" placeholder="000000" inputmode="numeric"
          style="width:100%;padding:16px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:24px;font-weight:800;letter-spacing:8px;text-align:center;font-family:inherit;outline:none;box-sizing:border-box;margin-bottom:14px">
        <button id="pv-verify-btn" onclick="confirmPhoneVerificationCode()"
          style="width:100%;background:#ff6600;color:white;border:none;padding:14px;border-radius:12px;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit;margin-bottom:10px">
          Verify Code
        </button>
        <p style="text-align:center;font-size:13px;color:#6b7280">
          <span id="pv-resend-timer"></span>
          <button id="pv-resend-btn" onclick="sendPhoneVerificationCode()" style="display:none;background:none;border:none;color:#ff6600;font-weight:700;cursor:pointer;font-family:inherit">Resend Code</button>
        </p>
      </div>

      <p id="pv-error" style="color:#ef4444;font-size:13px;margin-top:10px;display:none"></p>
    </div>
  `;

  document.body.appendChild(modal);
};

window.sendPhoneVerificationCode = async function() {
  const phoneInput = document.getElementById("pv-phone-input");
  const phone      = phoneInput ? phoneInput.value.trim() : window._pvPhone;
  const errorEl    = document.getElementById("pv-error");
  const sendBtn    = document.getElementById("pv-send-btn") || document.getElementById("pv-resend-btn");

  if (!auth.currentUser) { alert("Please login first"); return; }

  if (!phone || phone.replace(/\D/g, "").length < 9) {
    if (errorEl) { errorEl.textContent = "Enter a valid phone number"; errorEl.style.display = "block"; }
    return;
  }

  window._pvPhone = phone;
  if (errorEl) errorEl.style.display = "none";
  if (sendBtn) { sendBtn.textContent = "Sending..."; sendBtn.disabled = true; }

  try {
    await sendPhoneOTPFn({ phone });

    document.getElementById("phone-step-1").style.display = "none";
    document.getElementById("phone-step-2").style.display = "block";
    document.getElementById("pv-sent-to").textContent = phone;
    document.getElementById("pv-code-input")?.focus();

    startResendCooldown();

  } catch (err) {
    console.error(err);
    if (errorEl) { errorEl.textContent = err.message || "Failed to send code"; errorEl.style.display = "block"; }
  } finally {
    if (sendBtn) {
      sendBtn.textContent = sendBtn.id === "pv-resend-btn" ? "Resend Code" : "Send Verification Code";
      sendBtn.disabled = false;
    }
  }
};

function startResendCooldown() {
  let seconds = 60;
  const timerEl   = document.getElementById("pv-resend-timer");
  const resendBtn = document.getElementById("pv-resend-btn");
  if (resendBtn) resendBtn.style.display = "none";
  if (_otpCooldownInterval) clearInterval(_otpCooldownInterval);

  _otpCooldownInterval = setInterval(() => {
    seconds--;
    if (timerEl) timerEl.textContent = `Resend available in ${seconds}s`;
    if (seconds <= 0) {
      clearInterval(_otpCooldownInterval);
      if (timerEl) timerEl.textContent = "";
      if (resendBtn) resendBtn.style.display = "inline";
    }
  }, 1000);

  if (timerEl) timerEl.textContent = `Resend available in ${seconds}s`;
}

window.confirmPhoneVerificationCode = async function() {
  const codeInput = document.getElementById("pv-code-input");
  const code      = codeInput ? codeInput.value.trim() : "";
  const errorEl   = document.getElementById("pv-error");
  const btn       = document.getElementById("pv-verify-btn");

  if (!code || code.length !== 6) {
    if (errorEl) { errorEl.textContent = "Enter the 6-digit code"; errorEl.style.display = "block"; }
    return;
  }

  if (errorEl) errorEl.style.display = "none";
  if (btn) { btn.textContent = "Verifying..."; btn.disabled = true; }

  try {
    await verifyPhoneOTPFn({ code });

    document.getElementById("phone-verify-modal")?.remove();
    if (_otpCooldownInterval) clearInterval(_otpCooldownInterval);

    document.querySelectorAll(".phone-verified-badge").forEach(el => el.style.display = "inline-flex");

    const toast = document.createElement("div");
    toast.style.cssText = `position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:#10b981;color:white;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,0.15)`;
    toast.textContent = "✅ Phone number verified!";
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);

  } catch (err) {
    console.error(err);
    if (errorEl) { errorEl.textContent = err.message || "Verification failed"; errorEl.style.display = "block"; }
  } finally {
    if (btn) { btn.textContent = "Verify Code"; btn.disabled = false; }
  }
};