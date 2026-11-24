/**
 * admin_profile.html — full self-edit including username, and a direct
 * self-service password change (admins skip the reset-request workflow
 * that teachers/students are required to use — see admin_reset_requests.html).
 */

async function loadProfile() {
  try {
    const profile = await adminApiRequest("getProfile", {});
    document.getElementById("fullName").value = profile.fullName || "";
    document.getElementById("username").value = profile.username || "";
    document.getElementById("email").value = profile.email || "";
    document.getElementById("phone").value = profile.phone || "";
    document.getElementById("profileDisplayName").textContent = profile.fullName || "Admin";
    document.getElementById("profileUsernameTag").textContent = `${profile.username || ""} · ${profile.adminLevel || "admin"}`;
  } catch (error) {
    showAdminAlert("Couldn't load profile: " + error.message, "danger");
  }
}

async function saveProfile() {
  const btn = document.getElementById("saveProfileBtn");
  btn.disabled = true;
  try {
    await adminApiRequest("updateProfile", {
      fullName: document.getElementById("fullName").value.trim(),
      username: document.getElementById("username").value.trim(),
      email: document.getElementById("email").value.trim(),
      phone: document.getElementById("phone").value.trim(),
    });
    showAdminAlert("Profile updated.", "success");
    loadProfile();
  } catch (error) {
    showAdminAlert("Couldn't save profile: " + error.message, "danger");
  } finally {
    btn.disabled = false;
  }
}

async function submitChangePassword() {
  const current = document.getElementById("currentPassword").value;
  const next = document.getElementById("newPassword").value;
  const confirmNext = document.getElementById("confirmNewPassword").value;

  if (!current || !next) {
    showAdminAlert("Enter your current and new password.", "warning");
    return;
  }
  if (next !== confirmNext) {
    showAdminAlert("New password and confirmation don't match.", "warning");
    return;
  }

  const btn = document.getElementById("submitChangePasswordBtn");
  btn.disabled = true;
  try {
    await adminApiRequest("changeOwnPassword", { currentPassword: current, newPassword: next });
    showAdminAlert("Password updated.", "success");
    closeChangePasswordModal();
  } catch (error) {
    showAdminAlert("Couldn't change password: " + error.message, "danger");
  } finally {
    btn.disabled = false;
  }
}

function closeChangePasswordModal() {
  document.getElementById("changePasswordOverlay").classList.remove("show");
  document.getElementById("currentPassword").value = "";
  document.getElementById("newPassword").value = "";
  document.getElementById("confirmNewPassword").value = "";
}

document.addEventListener("DOMContentLoaded", function () {
  loadProfile();
  document.getElementById("saveProfileBtn").addEventListener("click", saveProfile);

  document.getElementById("changePasswordBtn").addEventListener("click", () => {
    document.getElementById("changePasswordOverlay").classList.add("show");
  });
  document.getElementById("changePasswordCloseBtn").addEventListener("click", closeChangePasswordModal);
  document.getElementById("cancelChangePasswordBtn").addEventListener("click", closeChangePasswordModal);
  document.getElementById("submitChangePasswordBtn").addEventListener("click", submitChangePassword);
});
