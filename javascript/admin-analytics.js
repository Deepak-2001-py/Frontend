/**
 * admin_analytics.html — full platform analytics (stat tiles the Overview
 * page also shows a summary of, plus the weekly bar chart and top-schools
 * ranked list from Website Wireframes.html §05 "Admin Analytics").
 */

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text === undefined || text === null ? "" : String(text);
  return div.innerHTML;
}

function renderStat(key, stat) {
  if (!stat) return;
  const valueEl = document.querySelector(`[data-stat="${key}"]`);
  const trendEl = document.querySelector(`[data-trend="${key}"]`);
  if (valueEl) valueEl.textContent = stat.value;
  if (trendEl && stat.trend) {
    const arrow = stat.direction === "flat" ? "→" : stat.direction === "down" ? "↓" : "↑";
    trendEl.innerHTML = `<span>${arrow}</span><span>${escapeHtml(stat.trend)}</span>`;
  }
}

function renderBarChart(weeklyPapers) {
  const host = document.getElementById("papersChart");
  const max = Math.max(...weeklyPapers.map((w) => w.value), 1);
  host.innerHTML = weeklyPapers.map((w) => {
    const pct = Math.round((w.value / max) * 100);
    return `<div class="bar" style="height:${pct}%;" title="${escapeHtml(w.label)}: ${w.value}"></div>`;
  }).join("");
}

function renderTopSchools(schools) {
  const host = document.getElementById("topSchoolsList");
  const max = Math.max(...schools.map((s) => s.value), 1);
  host.innerHTML = schools.map((s) => {
    const pct = Math.round((s.value / max) * 100);
    return `
      <div>
        <div class="admin-ranked-row-labels"><span>${escapeHtml(s.name)}</span><span class="value">${escapeHtml(s.label)}</span></div>
        <div class="admin-progress-track"><div class="admin-progress-fill" style="width:${pct}%;"></div></div>
      </div>
    `;
  }).join("");
}

async function loadAnalytics(forceRefresh) {
  const range = document.getElementById("rangeSelect").value;
  try {
    const analytics = await adminApiRequest("getAnalytics", { range }, { forceRefresh });
    renderStat("activeUsers", analytics.activeUsers);
    renderStat("papersGraded", analytics.papersGraded);
    renderStat("schools", analytics.schools);
    renderStat("uptime", analytics.uptime);
    renderBarChart(analytics.weeklyPapers || []);
    renderTopSchools(analytics.topSchools || []);
  } catch (error) {
    showAdminAlert("Couldn't load analytics: " + error.message, "danger");
  }
}

document.addEventListener("DOMContentLoaded", function () {
  loadAnalytics();
  document.getElementById("rangeSelect").addEventListener("change", () => loadAnalytics());
});
