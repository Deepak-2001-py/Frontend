/**
 * admin_audit_logs.html — read-only trail of admin actions. The wireframe
 * only names this as a sidebar destination + a "View audit logs" row in
 * the permission matrix (admin-only), with no detailed screen — this is
 * a reasonable, minimal-but-complete implementation of that gap.
 */

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text === undefined || text === null ? "" : String(text);
  return div.innerHTML;
}

function formatTimestamp(isoOrEpoch) {
  const date = typeof isoOrEpoch === "number" ? new Date(isoOrEpoch * 1000) : new Date(isoOrEpoch);
  return date.toLocaleString();
}

function renderAuditLogs(entries) {
  const body = document.getElementById("auditLogsBody");
  if (!entries.length) {
    body.innerHTML = `<tr><td colspan="4">No matching audit log entries.</td></tr>`;
    return;
  }
  body.innerHTML = entries.map((e) => `
    <tr>
      <td class="admin-cell-sub" style="font-family: var(--font-mono);">${escapeHtml(formatTimestamp(e.timestamp))}</td>
      <td>${escapeHtml(e.actor)}</td>
      <td>${escapeHtml(e.action)}</td>
      <td>${escapeHtml(e.target)}</td>
    </tr>
  `).join("");
}

function debounce(fn, ms) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

async function loadAuditLogs(forceRefresh) {
  const search = document.getElementById("auditSearch").value.trim();
  const category = document.getElementById("auditActionFilter").value;
  try {
    const result = await adminApiRequest("listAuditLogs", { search, category }, { forceRefresh });
    renderAuditLogs(result.entries || []);
  } catch (error) {
    document.getElementById("auditLogsBody").innerHTML = `<tr><td colspan="4">Couldn't load audit logs: ${escapeHtml(error.message)}</td></tr>`;
  }
}

document.addEventListener("DOMContentLoaded", function () {
  loadAuditLogs();
  document.getElementById("auditSearch").addEventListener("input", debounce(() => loadAuditLogs(), 300));
  document.getElementById("auditActionFilter").addEventListener("change", () => loadAuditLogs());
});
