/**
 * admin_tickets.html — support ticket queue.
 */

let currentTicketFilter = "open";

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text === undefined || text === null ? "" : String(text);
  return div.innerHTML;
}

function priorityPillClass(priority) {
  if (priority === "high") return "priority-high";
  if (priority === "low") return "priority-low";
  return "priority-med";
}

function renderTickets(tickets) {
  const body = document.getElementById("ticketsBody");
  if (!tickets.length) {
    body.innerHTML = `<tr><td colspan="4">No tickets in this view.</td></tr>`;
    return;
  }
  body.innerHTML = tickets.map((t) => `
    <tr>
      <td><span class="status-pill ${priorityPillClass(t.priority)}">${escapeHtml(capitalize(t.priority))}</span></td>
      <td>
        <div class="admin-cell-name">${escapeHtml(t.subject)}</div>
        <div class="admin-cell-sub" style="font-family: var(--font-mono);">#${escapeHtml(t.id)} · ${escapeHtml(t.ageLabel)}</div>
      </td>
      <td>${escapeHtml(t.requester)}</td>
      <td>
        ${t.assignee
          ? `<span>${escapeHtml(t.assignee)}</span>`
          : `<button type="button" class="btn btn-secondary claim-btn" data-id="${t.id}" style="padding:5px 10px; font-size:12px;">Assign to me</button>`
        }
        ${currentTicketFilter !== "resolved" ? `<button type="button" class="btn btn-secondary resolve-btn" data-id="${t.id}" style="padding:5px 10px; font-size:12px; margin-left:6px;">Resolve</button>` : ""}
      </td>
    </tr>
  `).join("");

  body.querySelectorAll(".claim-btn").forEach((b) => b.addEventListener("click", () => claimTicket(b.dataset.id)));
  body.querySelectorAll(".resolve-btn").forEach((b) => b.addEventListener("click", () => resolveTicket(b.dataset.id)));
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

async function loadTickets(forceRefresh) {
  try {
    const result = await adminApiRequest("listTickets", { filter: currentTicketFilter }, { forceRefresh });
    renderTickets(result.tickets || []);
    document.getElementById("ticketCount").textContent = typeof result.openCount === "number" ? `· ${result.openCount} open` : "";
  } catch (error) {
    document.getElementById("ticketsBody").innerHTML = `<tr><td colspan="4">Couldn't load tickets: ${escapeHtml(error.message)}</td></tr>`;
  }
}

async function claimTicket(ticketId) {
  try {
    await adminApiRequest("assignTicket", { ticketId });
    loadTickets(true);
  } catch (error) {
    showAdminAlert("Couldn't assign ticket: " + error.message, "danger");
  }
}

async function resolveTicket(ticketId) {
  try {
    await adminApiRequest("resolveTicket", { ticketId });
    showAdminAlert("Ticket resolved.", "success");
    loadTickets(true);
  } catch (error) {
    showAdminAlert("Couldn't resolve ticket: " + error.message, "danger");
  }
}

document.addEventListener("DOMContentLoaded", function () {
  loadTickets();
  document.querySelectorAll("#ticketFilterPills .admin-filter-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      document.querySelectorAll("#ticketFilterPills .admin-filter-pill").forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      currentTicketFilter = pill.dataset.filter;
      loadTickets();
    });
  });
});
