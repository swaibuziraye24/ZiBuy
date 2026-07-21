import { db, auth, collection, addDoc } from "./firebase.js";

let _errorBuffer = [];
let _flushTimer  = null;

function queueError(errorData) {
  _errorBuffer.push(errorData);
  if (_flushTimer) return;
  // Batch briefly so a burst of related errors doesn't spam Firestore writes
  _flushTimer = setTimeout(flushErrors, 2000);
}

async function flushErrors() {
  const batch = _errorBuffer.splice(0, _errorBuffer.length);
  _flushTimer = null;
  if (batch.length === 0) return;

  for (const err of batch) {
    try {
      await addDoc(collection(db, "client_errors"), err);
    } catch (e) {
      // If logging itself fails, don't loop — just drop it silently
    }
  }
}

function buildErrorPayload(message, source, stack) {
  return {
    message:    String(message || "").slice(0, 500),
    source:     source || "unknown",
    stack:      String(stack || "").slice(0, 1000),
    page:       window.location.pathname,
    userAgent:  navigator.userAgent,
    userEmail:  auth.currentUser?.email || "guest",
    online:     navigator.onLine,
    createdAt:  new Date()
  };
}

// Catches genuine uncaught JS errors anywhere on the page
window.addEventListener("error", (event) => {
  queueError(buildErrorPayload(event.message, event.filename, event.error?.stack));
});

// Catches unhandled promise rejections — the most common source of
// silent failures in async code (failed Firestore calls, etc.)
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  queueError(buildErrorPayload(
    reason?.message || String(reason),
    "promise",
    reason?.stack
  ));
});

// Optional manual logging for caught errors you still want visibility on
export function logHandledError(message, context) {
  queueError(buildErrorPayload(message, context || "handled", new Error().stack));
}