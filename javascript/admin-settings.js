/**
 * admin_settings.html — platform-wide settings. Like Audit Logs, the
 * wireframe only names "System Settings" as a sidebar destination without
 * detailed screen content; these are the settings implied elsewhere in
 * the wireframe (session timeout ties to §09 Session Expired's "30
 * minutes of inactivity" copy, self-signup ties to §17's invite-only flow).
 */

async function loadSettings() {
  try {
    const settings = await adminApiRequest("getSettings", {});
    document.getElementById("platformName").value = settings.platformName || "";
    document.getElementById("supportEmail").value = settings.supportEmail || "";
    document.getElementById("sessionTimeout").value = settings.sessionTimeoutMinutes || 30;
    document.getElementById("maintenanceMode").checked = !!settings.maintenanceMode;
    document.getElementById("allowSelfSignup").checked = !!settings.allowSelfSignup;
  } catch (error) {
    showAdminAlert("Couldn't load settings: " + error.message, "danger");
  }
}

async function saveSettings() {
  const btn = document.getElementById("saveSettingsBtn");
  btn.disabled = true;
  try {
    await adminApiRequest("updateSettings", {
      platformName: document.getElementById("platformName").value.trim(),
      supportEmail: document.getElementById("supportEmail").value.trim(),
      sessionTimeoutMinutes: Number(document.getElementById("sessionTimeout").value) || 30,
      maintenanceMode: document.getElementById("maintenanceMode").checked,
      allowSelfSignup: document.getElementById("allowSelfSignup").checked,
    });
    showAdminAlert("Settings saved.", "success");
  } catch (error) {
    showAdminAlert("Couldn't save settings: " + error.message, "danger");
  } finally {
    btn.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", function () {
  loadSettings();
  document.getElementById("saveSettingsBtn").addEventListener("click", saveSettings);
});
