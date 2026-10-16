/**
 * GradeAnt — Admin Console shared JS
 *
 * Loaded on every admin/*.html page (except first_login_setup.html, which
 * is reached from an unauthenticated invite link and has no sidebar).
 * Handles: the admin-only auth guard, sidebar active-link + user-menu
 * wiring, logout, and the shared API helper that talks to the admin
 * Lambda (admin/lambda_admin.py) behind API Gateway.
 *
 * Depends on javascript/api-cache.js being loaded first.
 */

// Same API Gateway host the rest of the app already points at — the admin
// Lambda hangs off a single "/admin" resource and dispatches by
// `operation` in the request body (see lambda_admin.py), matching the
// existing getgrades/updatedb convention instead of one route per action.
const ADMIN_API_ENDPOINT = "https://rus9nultj9.execute-api.eu-north-1.amazonaws.com/dev/admin";

/**
 * Redirects away if there's no session, or if the session isn't an admin.
 * Call this at the top of every admin page before rendering anything else.
 */
function requireAdminAuth() {
  const token = sessionStorage.getItem("authToken") || localStorage.getItem("authToken");
  const userType = sessionStorage.getItem("userType") || localStorage.getItem("userType");

  if (!token) {
    window.location.href = "../session/session-expired.html?returnTo=" + encodeURIComponent(window.location.pathname);
    return null;
  }
  if (userType !== "admin") {
    window.location.href = "../session/unauthorized.html";
    return null;
  }
  return { token, userType };
}

/**
 * POSTs { operation, ...payload } to the admin Lambda. Read-style
 * operations (the ones listed in READ_OPERATIONS) are cached per exact
 * query via apiCache, same pattern as the grading pages; everything else
 * always hits the network and invalidates the "admin:" cache prefix on
 * success, since almost every admin write affects some list view.
 */
const ADMIN_READ_OPERATIONS = new Set([
  "listUsers",
  "listResetRequests",
  "getPermissionMatrix",
  "listContent",
  "getAnalytics",
  "listTickets",
  "listAuditLogs",
  "getSettings",
]);

async function adminApiRequest(operation, payload, opts) {
  opts = opts || {};
  const auth = { token: sessionStorage.getItem("authToken") || localStorage.getItem("authToken") };
  const body = Object.assign({ operation }, payload || {});
  const isRead = ADMIN_READ_OPERATIONS.has(operation);
  const cacheKey = `admin:${operation}:${JSON.stringify(payload || {})}`;

  if (isRead && !opts.forceRefresh) {
    const cached = apiCache.get(cacheKey);
    if (cached !== undefined) return cached;
  }

  const response = await fetch(ADMIN_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${auth.token}`,
      "Origin": window.location.origin,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const errBody = await response.json();
      message = errBody.message || message;
    } catch (e) { /* body wasn't JSON — keep the generic message */ }
    throw new Error(message);
  }

  const data = await response.json();

  if (isRead) {
    apiCache.set(cacheKey, data);
  } else {
    apiCache.clearPrefix("admin:");
  }

  return data;
}

/** Small alert/toast — every admin page includes an #adminAlert host. */
function showAdminAlert(message, type) {
  const host = document.getElementById("adminAlert");
  if (!host) {
    console.warn("showAdminAlert: #adminAlert not found, message was:", message);
    return;
  }
  host.textContent = message;
  host.className = `status-pill ${type === "danger" ? "danger" : type === "warning" ? "warning" : "success"}`;
  host.style.display = "inline-flex";
  host.style.marginBottom = "16px";
  clearTimeout(host._hideTimer);
  host._hideTimer = setTimeout(() => { host.style.display = "none"; }, 5000);
}

function setupAdminSidebar() {
  const currentFile = window.location.pathname.split("/").pop();
  document.querySelectorAll(".admin-nav-link").forEach((link) => {
    const href = link.getAttribute("href");
    if (href && href.split("/").pop() === currentFile) {
      link.classList.add("active");
    }
  });

  const toggle = document.getElementById("adminUserCard");
  const menu = document.getElementById("adminUserMenu");
  if (toggle && menu) {
    toggle.addEventListener("click", function (e) {
      e.stopPropagation();
      menu.classList.toggle("show");
    });
    document.addEventListener("click", () => menu.classList.remove("show"));
  }

  const nameEl = document.getElementById("adminUserName");
  if (nameEl) {
    nameEl.textContent = sessionStorage.getItem("userName") || localStorage.getItem("userName") || "Admin";
  }

  const logoutLink = document.getElementById("adminLogoutBtn");
  if (logoutLink) {
    logoutLink.addEventListener("click", function (e) {
      e.preventDefault();
      window.location.href = "../session/logout.html";
    });
  }
}

document.addEventListener("DOMContentLoaded", function () {
  if (!requireAdminAuth()) return;
  setupAdminSidebar();
});
