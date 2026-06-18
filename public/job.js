// ============================================
//   ZiBuy — Job Detail Page
// ============================================

import { db, doc, getDoc } from "./firebase.js";
import { updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const params = new URLSearchParams(window.location.search);
const jobId  = params.get("id");

loadJob();

async function loadJob() {
  const wrap = document.getElementById("job-wrap");

  if (!jobId) {
    wrap.innerHTML = `
      <div class="job-error">
        <p style="font-size:48px;margin-bottom:12px">😕</p>
        <p style="font-size:16px;font-weight:700;color:#111827">Job not found</p>
        <a href="index.html" style="color:#ff6600;font-weight:700;display:inline-block;margin-top:12px">← Back to ZiBuy</a>
      </div>`;
    return;
  }

  try {
    const snap = await getDoc(doc(db, "job_ads", jobId));

    if (!snap.exists()) {
      wrap.innerHTML = `
        <div class="job-error">
          <p style="font-size:48px;margin-bottom:12px">😕</p>
          <p style="font-size:16px;font-weight:700;color:#111827">This job listing was not found</p>
          <p style="font-size:13px;margin-top:6px">It may have expired or been removed</p>
          <a href="index.html" style="color:#ff6600;font-weight:700;display:inline-block;margin-top:12px">← Back to ZiBuy</a>
        </div>`;
      return;
    }

    const job = snap.data();
    document.title = `${job.title} — ZiBuy Jobs`;

    // Track view count (non-blocking)
    updateDoc(doc(db, "job_ads", jobId), { views: increment(1) }).catch(() => {});

    const deadlineText = job.deadline
      ? new Date(job.deadline).toLocaleDateString("en-UG", { day: "numeric", month: "long", year: "numeric" })
      : "Open until filled";

    const phoneClean = (job.phone || "").replace(/\D/g, "");
    const waMsg = encodeURIComponent(
      `Hello, I saw the job posting for *${job.title}* at *${job.company}* on ZiBuy. I would like to apply.`
    );

    wrap.innerHTML = `
      <a href="index.html" class="job-back">← Back to ZiBuy</a>

      <div class="job-card">

        <div class="job-badges">
          ${job.isTop ? `<span class="job-badge top">⭐ TOP AD</span>` : ""}
          <span class="job-badge hiring">💼 WE ARE HIRING</span>
          <span class="job-badge type">${job.type || "Full Time"}</span>
        </div>

        <h1 class="job-title">${job.title}</h1>
        <p class="job-company">🏢 ${job.company}</p>

        <div class="job-meta-grid">
          <div class="job-meta-item">
            <p>Location</p>
            <p>📍 ${job.location || "—"}</p>
          </div>
          <div class="job-meta-item">
            <p>Salary</p>
            <p>💰 ${job.salary || "Negotiable"}</p>
          </div>
          <div class="job-meta-item">
            <p>Category</p>
            <p>🗂️ ${job.category || "—"}</p>
          </div>
          <div class="job-meta-item">
            <p>Experience</p>
            <p>📈 ${job.experience || "Any level"}</p>
          </div>
          <div class="job-meta-item">
            <p>Education</p>
            <p>🎓 ${job.education || "Any level"}</p>
          </div>
          <div class="job-meta-item">
            <p>Gender Preference</p>
            <p>👤 ${job.gender || "Any"}</p>
          </div>
        </div>

        <div class="job-section">
          <h3>📋 Job Description</h3>
          <p>${job.desc || "No description provided."}</p>
        </div>

        ${job.apply ? `
          <div class="job-section">
            <h3>📝 How to Apply</h3>
            <p>${job.apply}</p>
          </div>
        ` : ""}

        <span class="job-deadline-tag">⏰ Application Deadline: ${deadlineText}</span>

        <div class="job-apply-box">
          <h3>📞 Contact This Employer</h3>
          <p style="font-size:13px;color:#374151;margin:0">
            Reach out directly using the contact details below to apply for this position.
          </p>
          <div class="job-apply-btns">
            ${phoneClean ? `
              <a href="tel:+${phoneClean}" class="job-apply-btn job-apply-call">
                📞 Call Now
              </a>
              <a href="https://wa.me/${phoneClean}?text=${waMsg}" target="_blank" class="job-apply-btn job-apply-wa">
                💬 WhatsApp
              </a>
            ` : `<p style="color:#6b7280;font-size:13px">No contact information provided</p>`}
          </div>
        </div>

      </div>
    `;

  } catch (err) {
    console.error("loadJob error:", err);
    wrap.innerHTML = `
      <div class="job-error">
        <p style="font-size:16px;font-weight:700;color:red">Failed to load job details</p>
        <p style="font-size:13px">${err.message}</p>
      </div>`;
  }
}