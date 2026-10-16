/**
 * admin_dashboard.html (Overview) — pulls the same summary numbers the
 * Analytics page shows in full, via the admin Lambda's "getAnalytics" op.
 */
document.addEventListener("DOMContentLoaded", async function () {
  try {
    const analytics = await adminApiRequest("getAnalytics", { range: "30d" });
    renderStat("activeUsers", analytics.activeUsers);
    renderStat("papersGraded", analytics.papersGraded);
    renderStat("schools", analytics.schools);
    renderStat("uptime", analytics.uptime, true);
  } catch (error) {
    console.error("Failed to load overview stats:", error);
    showAdminAlert("Couldn't load platform stats: " + error.message, "danger");
  }
});

function renderStat(key, stat, isFlat) {
  if (!stat) return;
  const valueEl = document.querySelector(`[data-stat="${key}"]`);
  const trendEl = document.querySelector(`[data-trend="${key}"]`);
  if (valueEl) valueEl.textContent = stat.value;
  if (trendEl && stat.trend) {
    const arrow = isFlat || stat.direction === "flat" ? "→" : stat.direction === "down" ? "↓" : "↑";
    trendEl.innerHTML = `<span>${arrow}</span><span>${stat.trend}</span>`;
  }
}
