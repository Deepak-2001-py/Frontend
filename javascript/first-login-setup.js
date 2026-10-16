/**
 * admin/first_login_setup.html — Step 3 of the Onboarding Flow
 * (Website Wireframes.html §17). Reached from an *unauthenticated* invite
 * link (?token=...), so this deliberately does NOT load admin-common.js
 * (which would bounce an unauthenticated visitor to session-expired).
 */

const FIRST_LOGIN_API_ENDPOINT = "https://rus9nultj9.execute-api.eu-north-1.amazonaws.com/dev/admin";

function showFirstLoginAlert(message, type) {
  const host = document.getElementById("firstLoginAlert");
  host.textContent = message;
  host.className = `status-pill ${type === "danger" ? "danger" : "warning"}`;
  host.style.display = "inline-flex";
}

function getInviteToken() {
  return new URLSearchParams(window.location.search).get("token") || "";
}

function dashboardUrlForRole(role) {
  if (role === "teacher") return "../dashboards/teacher_dashboard.html";
  if (role === "admin") return "../admin/admin_dashboard.html";
  return "../dashboards/student_dashboard_.html";
}

async function loadInviteDetails() {
  const token = getInviteToken();
  if (!token) {
    showFirstLoginAlert("This invite link is missing its token — ask your admin to resend the invite.", "danger");
    document.getElementById("finishBtn").disabled = true;
    return;
  }
  try {
    const response = await fetch(FIRST_LOGIN_API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "getInviteDetails", token }),
    });
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    const invite = await response.json();

    document.getElementById("inviteRoleLabel").textContent = capitalize(invite.role);
    document.getElementById("inviteClassLabel").textContent = invite.className || "GradeAnt";
    document.getElementById("sideName").textContent = invite.fullName;
    document.getElementById("sideRole").textContent = capitalize(invite.role);
    document.getElementById("sideClass").textContent = invite.className || "—";
    document.getElementById("sideDashboardLabel").textContent = `${capitalize(invite.role)} Dashboard`;
  } catch (error) {
    showFirstLoginAlert("Couldn't load this invite: " + error.message, "danger");
    document.getElementById("finishBtn").disabled = true;
  }
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

async function completeFirstLogin() {
  const token = getInviteToken();
  const password = document.getElementById("createPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const agreed = document.getElementById("agreePolicy").checked;

  if (!password || password.length < 8) {
    showFirstLoginAlert("Choose a password with at least 8 characters.", "warning");
    return;
  }
  if (password !== confirmPassword) {
    showFirstLoginAlert("Passwords don't match.", "warning");
    return;
  }
  if (!agreed) {
    showFirstLoginAlert("You need to accept the acceptable-use & privacy policy to continue.", "warning");
    return;
  }

  const btn = document.getElementById("finishBtn");
  btn.disabled = true;
  btn.textContent = "Setting up…";

  try {
    const response = await fetch(FIRST_LOGIN_API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "completeFirstLogin", token, password }),
    });
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    const result = await response.json();

    apiCache.clearAll();
    sessionStorage.setItem("authToken", result.token);
    sessionStorage.setItem("userId", result.userId);
    sessionStorage.setItem("userType", result.role);
    sessionStorage.setItem("userName", result.fullName);
    sessionStorage.setItem("loginTime", new Date().toISOString());

    window.location.href = dashboardUrlForRole(result.role);
  } catch (error) {
    showFirstLoginAlert("Couldn't finish setup: " + error.message, "danger");
    btn.disabled = false;
    btn.textContent = "Finish & go to dashboard →";
  }
}

document.addEventListener("DOMContentLoaded", function () {
  loadInviteDetails();
  document.getElementById("finishBtn").addEventListener("click", completeFirstLogin);
});
