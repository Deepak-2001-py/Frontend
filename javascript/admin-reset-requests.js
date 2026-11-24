/**
 * admin_reset_requests.html — password reset request queue + the
 * read-only permission matrix reference (Website Wireframes.html §07).
 */

let currentRequestFilter = "pending";

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text === undefined || text === null ? "" : String(text);
  return div.innerHTML;
}

function timeAgo(isoOrEpoch) {
  const then = typeof isoOrEpoch === "number" ? isoOrEpoch * 1000 : new Date(isoOrEpoch).getTime();
  const minutes = Math.max(1, Math.round((Date.now() - then) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function roleClass(role) {
  if (role === "teacher") return "info";
  if (role === "student") return "info";
  return "warning";
}

function renderRequests(requests) {
  const body = document.getElementById("resetRequestsBody");
  if (!requests.length) {
    body.innerHTML = `<tr><td colspan="4">No ${escapeHtml(currentRequestFilter)} requests.</td></tr>`;
    return;
  }
  body.innerHTML = requests.map((r) => {
    let actions;
    if (r.status === "pending") {
      actions = `
        <button type="button" class="btn btn-primary approve-btn" data-id="${r.id}" style="background: var(--accent); padding:6px 11px; font-size:12px;">Approve</button>
        <button type="button" class="btn btn-secondary reject-btn" data-id="${r.id}" style="padding:6px 11px; font-size:12px;">Reject</button>
      `;
    } else if (r.status === "approved") {
      actions = `<button type="button" class="btn btn-primary gen-temp-btn" data-id="${r.id}" style="padding:6px 11px; font-size:12px;">Generate Temp Password</button>`;
    } else {
      actions = `<span class="form-text">${escapeHtml(capitalize(r.status))}</span>`;
    }
    return `
      <tr>
        <td>
          <div class="admin-cell-name">${escapeHtml(r.userName)}</div>
          <div class="admin-cell-sub" style="font-family: var(--font-mono);">${escapeHtml(r.userEmail)}</div>
        </td>
        <td><span class="status-pill ${roleClass(r.role)}">${escapeHtml(capitalize(r.role))}</span></td>
        <td>${escapeHtml(timeAgo(r.requestedAt))}</td>
        <td class="admin-inline-actions">${actions}</td>
      </tr>
    `;
  }).join("");

  body.querySelectorAll(".approve-btn").forEach((btn) => btn.addEventListener("click", () => approveRequest(btn.dataset.id)));
  body.querySelectorAll(".reject-btn").forEach((btn) => btn.addEventListener("click", () => rejectRequest(btn.dataset.id)));
  body.querySelectorAll(".gen-temp-btn").forEach((btn) => btn.addEventListener("click", () => generateTempPassword(btn.dataset.id)));
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

async function loadRequests(forceRefresh) {
  try {
    const result = await adminApiRequest("listResetRequests", { status: currentRequestFilter }, { forceRefresh });
    renderRequests(result.requests || []);
    const pendingPill = document.querySelector('[data-filter="pending"]');
    if (pendingPill && typeof result.pendingCount === "number") {
      pendingPill.textContent = `Pending ${result.pendingCount}`;
    }
  } catch (error) {
    document.getElementById("resetRequestsBody").innerHTML = `<tr><td colspan="4">Couldn't load requests: ${escapeHtml(error.message)}</td></tr>`;
  }
}

async function approveRequest(id) {
  try {
    await adminApiRequest("approveResetRequest", { requestId: id });
    showAdminAlert("Request approved. Generate a temp password when ready.", "success");
    loadRequests(true);
  } catch (error) {
    showAdminAlert("Couldn't approve request: " + error.message, "danger");
  }
}

async function rejectRequest(id) {
  if (!confirm("Reject this reset request?")) return;
  try {
    await adminApiRequest("rejectResetRequest", { requestId: id });
    showAdminAlert("Request rejected.", "success");
    loadRequests(true);
  } catch (error) {
    showAdminAlert("Couldn't reject request: " + error.message, "danger");
  }
}

async function generateTempPassword(id) {
  try {
    const result = await adminApiRequest("generateTempPassword", { requestId: id });
    document.getElementById("tempPasswordValue").textContent = result.tempPassword;
    document.getElementById("tempPasswordOverlay").classList.add("show");
    loadRequests(true);
  } catch (error) {
    showAdminAlert("Couldn't generate a temp password: " + error.message, "danger");
  }
}

function cellClass(value) {
  if (value === "yes") return "cell yes";
  if (value === "self") return "cell self";
  return "cell no";
}

function cellSymbol(value) {
  if (value === "yes") return "✓";
  if (value === "self") return "Self";
  return "✗";
}

async function loadPermissionMatrix() {
  const host = document.getElementById("permissionMatrix");
  try {
    const result = await adminApiRequest("getPermissionMatrix", {});
    const rows = (result.features || []).map((f) => `
      <div class="feature">${escapeHtml(f.label)}</div>
      <div class="${cellClass(f.admin)}">${cellSymbol(f.admin)}</div>
      <div class="${cellClass(f.teacher)}">${cellSymbol(f.teacher)}</div>
      <div class="${cellClass(f.student)}">${cellSymbol(f.student)}</div>
    `).join("");
    host.insertAdjacentHTML("beforeend", rows);
  } catch (error) {
    host.insertAdjacentHTML("beforeend", `<div class="feature" style="grid-column: 1 / -1;">Couldn't load permission matrix: ${escapeHtml(error.message)}</div>`);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  loadRequests();
  loadPermissionMatrix();

  document.querySelectorAll("#requestFilterPills .admin-filter-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      document.querySelectorAll("#requestFilterPills .admin-filter-pill").forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      currentRequestFilter = pill.dataset.filter;
      loadRequests();
    });
  });

  document.getElementById("tempPasswordCloseBtn").addEventListener("click", () => {
    document.getElementById("tempPasswordOverlay").classList.remove("show");
  });
  document.getElementById("tempPasswordDoneBtn").addEventListener("click", () => {
    document.getElementById("tempPasswordOverlay").classList.remove("show");
  });
});
