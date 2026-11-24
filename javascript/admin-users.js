/**
 * admin_users.html — user list/search/filter + the "Add people" wizard
 * (merges the Onboarding Flow's Invite/Import and Assign Roles steps —
 * see Website Wireframes.html §17 — directly into user management, since
 * inviting *is* how a user gets added here).
 */

let currentUsers = [];
let inviteQueue = []; // [{ email, name, role, className }]

function debounce(fn, ms) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

function statusPillClass(status) {
  if (status === "active") return "success";
  if (status === "invited") return "warning";
  return "info"; // suspended
}

function renderUsers(users) {
  const body = document.getElementById("usersTableBody");
  if (!users.length) {
    body.innerHTML = `<tr><td colspan="5">No users match this search.</td></tr>`;
    return;
  }
  body.innerHTML = users.map((u) => `
    <tr>
      <td>
        <div class="admin-cell-user">
          <span class="admin-cell-avatar"></span>
          <div>
            <div class="admin-cell-name">${escapeHtml(u.name)}</div>
            <div class="admin-cell-sub">${escapeHtml(u.email)}</div>
          </div>
        </div>
      </td>
      <td>${escapeHtml(capitalize(u.role))}</td>
      <td>${escapeHtml(u.school || "—")}</td>
      <td><span class="status-pill ${statusPillClass(u.status)}">${escapeHtml(capitalize(u.status))}</span></td>
      <td class="admin-inline-actions">
        <button type="button" class="btn btn-secondary toggle-status-btn" data-id="${u.id}" data-status="${u.status}">
          ${u.status === "suspended" ? "Activate" : "Suspend"}
        </button>
        <button type="button" class="btn btn-secondary delete-user-btn" data-id="${u.id}" style="color:var(--color-danger);">Delete</button>
      </td>
    </tr>
  `).join("");

  body.querySelectorAll(".toggle-status-btn").forEach((btn) => {
    btn.addEventListener("click", () => toggleUserStatus(btn.dataset.id, btn.dataset.status));
  });
  body.querySelectorAll(".delete-user-btn").forEach((btn) => {
    btn.addEventListener("click", () => deleteUser(btn.dataset.id));
  });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text === undefined || text === null ? "" : String(text);
  return div.innerHTML;
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

async function loadUsers(forceRefresh) {
  const search = document.getElementById("userSearch").value.trim();
  const role = document.getElementById("roleFilter").value;
  const status = document.getElementById("statusFilter").value;
  try {
    const result = await adminApiRequest("listUsers", { search, role, status }, { forceRefresh });
    currentUsers = result.users || [];
    renderUsers(currentUsers);
    document.getElementById("userCount").textContent = `· ${result.total ?? currentUsers.length}`;
  } catch (error) {
    console.error("Failed to load users:", error);
    document.getElementById("usersTableBody").innerHTML = `<tr><td colspan="5">Couldn't load users: ${escapeHtml(error.message)}</td></tr>`;
  }
}

async function toggleUserStatus(userId, currentStatus) {
  const newStatus = currentStatus === "suspended" ? "active" : "suspended";
  try {
    await adminApiRequest("updateUserStatus", { userId, status: newStatus });
    showAdminAlert(`User ${newStatus === "suspended" ? "suspended" : "activated"}.`, "success");
    loadUsers(true);
  } catch (error) {
    showAdminAlert("Couldn't update status: " + error.message, "danger");
  }
}

async function deleteUser(userId) {
  if (!confirm("Delete this user? This can't be undone.")) return;
  try {
    await adminApiRequest("deleteUser", { userId });
    showAdminAlert("User deleted.", "success");
    loadUsers(true);
  } catch (error) {
    showAdminAlert("Couldn't delete user: " + error.message, "danger");
  }
}

/* ---- Add People wizard ---- */

function renderInviteList() {
  const host = document.getElementById("inviteList");
  host.innerHTML = inviteQueue.map((person, i) => `
    <div class="admin-invite-list-item">
      <span>${escapeHtml(person.name)} · ${escapeHtml(person.email)}</span>
      <button type="button" data-idx="${i}" title="Remove">&times;</button>
    </div>
  `).join("");
  host.querySelectorAll("button[data-idx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      inviteQueue.splice(Number(btn.dataset.idx), 1);
      renderInviteList();
    });
  });
  document.getElementById("continueToRolesBtn").disabled = inviteQueue.length === 0;
}

function parseCsv(text) {
  // Minimal "email,name" per line CSV — matches the wireframe's "bulk-add
  // a whole roster at once" use case, not a general-purpose CSV parser.
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [email, name] = line.split(",").map((s) => (s || "").trim());
      return { email, name: name || email };
    })
    .filter((p) => p.email && p.email.includes("@"));
}

function setWizardStep(step) {
  document.querySelectorAll(".admin-wizard-step").forEach((el) => {
    el.classList.toggle("active", el.dataset.wizardStep === String(step));
  });
  document.querySelectorAll("#wizardStepper .step").forEach((el) => {
    const s = Number(el.dataset.step);
    el.classList.remove("done", "current");
    if (s < step) el.classList.add("done");
    else if (s === step) el.classList.add("current");
  });
}

function openWizard() {
  inviteQueue = [];
  renderInviteList();
  setWizardStep(1);
  document.getElementById("wizardOverlay").classList.add("show");
}

function closeWizard() {
  document.getElementById("wizardOverlay").classList.remove("show");
}

function renderRolesStep() {
  const body = document.getElementById("rolesTableBody");
  body.innerHTML = inviteQueue.map((person, i) => `
    <tr>
      <td><div class="admin-cell-user"><span class="admin-cell-avatar"></span><span>${escapeHtml(person.name)}</span></div></td>
      <td>
        <select class="admin-role-select" data-idx="${i}" data-field="role">
          <option value="teacher" ${person.role === "teacher" ? "selected" : ""}>Teacher</option>
          <option value="student" ${person.role === "student" || !person.role ? "selected" : ""}>Student</option>
          <option value="admin" ${person.role === "admin" ? "selected" : ""}>Admin</option>
        </select>
      </td>
      <td><input type="text" class="form-control" data-idx="${i}" data-field="className" placeholder="e.g. PHY-204" value="${escapeHtml(person.className || "")}" style="max-width:140px; padding:6px 10px;"></td>
    </tr>
  `).join("");

  body.querySelectorAll("[data-field]").forEach((input) => {
    input.addEventListener("change", () => {
      const idx = Number(input.dataset.idx);
      inviteQueue[idx][input.dataset.field] = input.value;
    });
  });
}

async function sendInvites() {
  const btn = document.getElementById("sendInvitesBtn");
  btn.disabled = true;
  btn.textContent = "Sending…";
  try {
    await adminApiRequest("inviteUsers", { invitees: inviteQueue });
    showAdminAlert(`Sent ${inviteQueue.length} invite(s).`, "success");
    closeWizard();
    loadUsers(true);
  } catch (error) {
    showAdminAlert("Couldn't send invites: " + error.message, "danger");
  } finally {
    btn.disabled = false;
    btn.textContent = "Send invites →";
  }
}

document.addEventListener("DOMContentLoaded", function () {
  loadUsers();

  document.getElementById("userSearch").addEventListener("input", debounce(() => loadUsers(), 300));
  document.getElementById("roleFilter").addEventListener("change", () => loadUsers());
  document.getElementById("statusFilter").addEventListener("change", () => loadUsers());

  document.getElementById("openInviteBtn").addEventListener("click", openWizard);
  document.getElementById("openImportBtn").addEventListener("click", () => {
    openWizard();
    document.getElementById("choiceImport").click();
  });
  document.getElementById("wizardCloseBtn").addEventListener("click", closeWizard);
  document.getElementById("wizardOverlay").addEventListener("click", (e) => {
    if (e.target.id === "wizardOverlay") closeWizard();
  });

  const choiceInvite = document.getElementById("choiceInvite");
  const choiceImport = document.getElementById("choiceImport");
  const inviteFormPanel = document.getElementById("inviteFormPanel");
  const csvFileInput = document.getElementById("csvFileInput");

  choiceInvite.addEventListener("click", () => {
    choiceInvite.classList.add("active");
    choiceImport.classList.remove("active");
    inviteFormPanel.style.display = "block";
  });

  choiceImport.addEventListener("click", () => {
    choiceImport.classList.add("active");
    choiceInvite.classList.remove("active");
    inviteFormPanel.style.display = "none";
    csvFileInput.click();
  });

  csvFileInput.addEventListener("change", () => {
    const file = csvFileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result));
      if (!parsed.length) {
        showAdminAlert("No valid rows found in that CSV (expected email,name per line).", "warning");
        return;
      }
      inviteQueue = inviteQueue.concat(parsed);
      renderInviteList();
      showAdminAlert(`Added ${parsed.length} people from CSV.`, "success");
    };
    reader.readAsText(file);
    csvFileInput.value = "";
  });

  document.getElementById("addToListBtn").addEventListener("click", () => {
    const email = document.getElementById("inviteEmail").value.trim();
    const name = document.getElementById("inviteName").value.trim();
    if (!email || !email.includes("@")) {
      showAdminAlert("Enter a valid email address.", "warning");
      return;
    }
    inviteQueue.push({ email, name: name || email });
    document.getElementById("inviteEmail").value = "";
    document.getElementById("inviteName").value = "";
    renderInviteList();
  });

  document.getElementById("continueToRolesBtn").addEventListener("click", () => {
    renderRolesStep();
    setWizardStep(2);
  });

  document.getElementById("backToInviteBtn").addEventListener("click", () => setWizardStep(1));
  document.getElementById("sendInvitesBtn").addEventListener("click", sendInvites);
});
