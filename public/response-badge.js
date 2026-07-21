import { db, doc, getDoc } from "./firebase.js";

export async function renderResponseBadge(userId, targetElId) {
  const el = document.getElementById(targetElId);
  if (!el || !userId) return;

  try {
    const snap = await getDoc(doc(db, "response_stats", userId));
    if (!snap.exists()) return;

    const d = snap.data();
    if (!d.totalConvos || d.totalConvos < 3) return; // not enough data to be meaningful yet

    const rate = Math.round((d.totalResponses / d.totalConvos) * 100);
    const avgMs = d.totalResponses > 0 ? d.totalMs / d.totalResponses : null;

    let speedLabel = "";
    if (avgMs != null) {
      const mins = avgMs / 60000;
      if (mins < 60) speedLabel = `usually replies within ${Math.max(1, Math.round(mins))} min`;
      else if (mins < 1440) speedLabel = `usually replies within ${Math.round(mins/60)}h`;
      else speedLabel = `usually replies within a day`;
    }

    const color = rate >= 80 ? "#10b981" : rate >= 50 ? "#f59e0b" : "#6b7280";

    el.innerHTML = `<span style="display:inline-flex;align-items:center;gap:4px;
      background:${color}1a;color:${color};padding:3px 10px;border-radius:20px;
      font-size:11px;font-weight:800;white-space:nowrap">
      💬 ${rate}% response rate${speedLabel ? " · " + speedLabel : ""}
    </span>`;
  } catch (e) { console.warn("renderResponseBadge:", e.message); }
}