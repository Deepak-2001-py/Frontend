/**
 * admin_content.html — blog/content moderation queue.
 */

let currentContentFilter = "all";

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text === undefined || text === null ? "" : String(text);
  return div.innerHTML;
}

function statusPillForContent(status) {
  if (status === "published") return "success";
  if (status === "pending") return "warning";
  return "info"; // draft
}

function renderContent(posts) {
  const host = document.getElementById("contentList");
  if (!posts.length) {
    host.innerHTML = `<div class="admin-panel">No posts in this view.</div>`;
    return;
  }
  host.innerHTML = posts.map((post) => {
    const actions = [];
    if (post.status === "pending") {
      actions.push(`<button type="button" class="btn btn-secondary approve-post-btn" data-id="${post.id}" style="color: var(--accent); border-color: var(--teal-200); padding:6px 11px; font-size:12px;">Approve</button>`);
    }
    if (post.status === "published") {
      actions.push(`<button type="button" class="btn btn-secondary unpublish-post-btn" data-id="${post.id}" style="color: var(--color-danger); border-color: var(--color-danger-soft); padding:6px 11px; font-size:12px;">Unpublish</button>`);
    } else {
      actions.push(`<button type="button" class="btn btn-secondary publish-post-btn" data-id="${post.id}" style="padding:6px 11px; font-size:12px;">Publish</button>`);
    }
    actions.push(`<button type="button" class="btn btn-secondary edit-post-btn" data-id="${post.id}" style="padding:6px 11px; font-size:12px;">Edit</button>`);

    return `
      <div class="admin-panel" style="display:flex; gap:14px; align-items:center;">
        <div style="width:64px; height:48px; border-radius:8px; background: var(--gradient-grow); flex-shrink:0;"></div>
        <div style="flex:1; min-width:0;">
          <div style="font-size:14px; font-weight:700; color:var(--ink-900);">${escapeHtml(post.title)}</div>
          <div style="font-size:11px; color:var(--text-subtle); margin-top:3px;">by ${escapeHtml(post.author)} · ${escapeHtml(post.dateLabel)}</div>
        </div>
        <span class="status-pill ${statusPillForContent(post.status)}">${escapeHtml(capitalize(post.status))}</span>
        <div class="admin-inline-actions">${actions.join("")}</div>
      </div>
    `;
  }).join("");

  host.querySelectorAll(".approve-post-btn").forEach((b) => b.addEventListener("click", () => updatePostStatus(b.dataset.id, "published")));
  host.querySelectorAll(".unpublish-post-btn").forEach((b) => b.addEventListener("click", () => updatePostStatus(b.dataset.id, "draft")));
  host.querySelectorAll(".publish-post-btn").forEach((b) => b.addEventListener("click", () => updatePostStatus(b.dataset.id, "published")));
  host.querySelectorAll(".edit-post-btn").forEach((b) => b.addEventListener("click", () => {
    showAdminAlert("Post editor isn't wired up yet — this button is ready for it.", "warning");
  }));
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

async function loadContent(forceRefresh) {
  try {
    const result = await adminApiRequest("listContent", { filter: currentContentFilter }, { forceRefresh });
    renderContent(result.posts || []);
  } catch (error) {
    document.getElementById("contentList").innerHTML = `<div class="admin-panel">Couldn't load content: ${escapeHtml(error.message)}</div>`;
  }
}

async function updatePostStatus(postId, status) {
  try {
    await adminApiRequest("updatePostStatus", { postId, status });
    showAdminAlert(`Post ${status === "published" ? "published" : "updated"}.`, "success");
    loadContent(true);
  } catch (error) {
    showAdminAlert("Couldn't update post: " + error.message, "danger");
  }
}

document.addEventListener("DOMContentLoaded", function () {
  loadContent();

  document.querySelectorAll("#contentFilterPills .admin-filter-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      document.querySelectorAll("#contentFilterPills .admin-filter-pill").forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      currentContentFilter = pill.dataset.filter;
      loadContent();
    });
  });

  document.getElementById("newPostBtn").addEventListener("click", () => {
    showAdminAlert("Post composer isn't wired up yet — this button is ready for it.", "warning");
  });
});
