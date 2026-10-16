/**
 * Teacher — Manual Grading & Correction · Worklist (wireframe §16, step 1)
 *
 * Reuses the same GRADES_ENDPOINT + operations already used across the
 * codebase (view_grades.js / student-details.js / student_grade.js):
 *   - "getAllStudentGrades" {qp_id, assignment_id} -> {grades:[...]}
 *   - "getSingleStudentGrade" {student_id, assignment_id} -> {summary, details}
 *
 * There is no backend endpoint yet that returns a pre-aggregated list of
 * flagged answers, so this page builds the worklist client-side: it pulls
 * the roster via getAllStudentGrades, then walks each student's details
 * via getSingleStudentGrade and classifies every question locally with the
 * same getMarksStatus() logic used elsewhere in the app. That's an N+1
 * request pattern — fine for a classroom-sized roster, but:
 *
 * TODO(backend): add an operation e.g. "getGradingWorklist"
 *   request:  { operation: "getGradingWorklist", qp_id, assignment_id }
 *   response: { body: { items: [ { student_id, question_number, subpart,
 *              marks, max_marks, ai_confidence?, recheck_requested? } ] } }
 * so the worklist can be fetched in one call instead of scanning every
 * student's full detail record, and so "AI low confidence" / "student
 * re-check requested" can be real filters instead of just
 * correct/partial/incorrect derived from marks.
 *
 * TODO(backend): add an operation e.g. "finalizeCorrection"
 *   request: { operation: "finalizeCorrection", qp_id, assignment_id,
 *              reviewed_count, total_count }
 * to close out the correction pass and hand the assignment to publishing
 * (§12 in the wireframe). Until it exists, finalize() below best-effort
 * posts it (swallowing failure) and moves on to the grades view.
 */
document.addEventListener("DOMContentLoaded", function () {
  const CONFIG = {
    API: {
      GRADES_ENDPOINT: "https://rus9nultj9.execute-api.eu-north-1.amazonaws.com/dev/getgrades",
      UPDATE_ENDPOINT: "https://rus9nultj9.execute-api.eu-north-1.amazonaws.com/dev/updatedb",
    },
  };

  const form = document.getElementById("worklist-scan-form");
  const qpInput = document.getElementById("qp-id");
  const assignmentInput = document.getElementById("assignment-id");
  const scanBtn = document.getElementById("scan-btn");
  const rescanBtn = document.getElementById("rescan-btn");
  const finalizeBtn = document.getElementById("finalize-btn");
  const loaderContainer = document.getElementById("worklist-loader-container");
  const scanProgress = document.getElementById("scan-progress");
  const resultContainer = document.getElementById("worklist-result");
  const itemsContainer = document.getElementById("worklist-items");
  const emptyState = document.getElementById("worklist-empty");
  const finalizeCountEl = document.getElementById("finalize-count");
  const filtersContainer = document.getElementById("worklist-filters");

  let currentItems = [];
  let currentFilter = "all";
  let currentQpId = "";
  let currentAssignmentId = "";
  // Which student groups are expanded — the worklist renders one card per
  // student first; clicking a student name expands *only that student's*
  // flagged questions below it. Keyed by student_id so each group's items
  // are looked up by an exact match, never by list position, which is what
  // guarantees clicking one student can never reveal another student's
  // questions.
  let expandedStudents = new Set();

  // Pre-fill from ?qp_id=&assignment_id= if a caller (e.g. the "Open
  // Correction Workspace" link on teacher_view_grade.html) linked in with
  // known values, and auto-run the scan.
  const initialParams = new URLSearchParams(window.location.search);
  const initialQp = initialParams.get("qp_id");
  const initialAssignment = initialParams.get("assignment_id");
  if (initialQp) qpInput.value = initialQp;
  if (initialAssignment) assignmentInput.value = initialAssignment;
  if (initialQp && initialAssignment) {
    runScan(initialQp.trim(), initialAssignment.trim());
  } else {
    // No link-in params — restore the last scan run on this tab so
    // navigating back to this page shows the same worklist again instead
    // of an empty form. Resolves straight from apiCache (cache hit).
    const lastScan = apiCache.get("lastQuery:correction");
    if (lastScan && lastScan.qpId && lastScan.assignmentId) {
      qpInput.value = lastScan.qpId;
      assignmentInput.value = lastScan.assignmentId;
      runScan(lastScan.qpId, lastScan.assignmentId);
    }
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const qpId = qpInput.value.trim();
    const assignmentId = assignmentInput.value.trim();
    if (!qpId || !assignmentId) {
      alert("Please fill in both Question Paper ID and Assignment ID.");
      return;
    }
    runScan(qpId, assignmentId);
  });

  rescanBtn.addEventListener("click", function () {
    if (currentQpId && currentAssignmentId) runScan(currentQpId, currentAssignmentId, /* forceRefresh */ true);
  });

  filtersContainer.addEventListener("click", function (event) {
    const pill = event.target.closest(".filter-pill");
    if (!pill) return;
    filtersContainer.querySelectorAll(".filter-pill").forEach((p) => p.classList.remove("active"));
    pill.classList.add("active");
    currentFilter = pill.dataset.filter;
    renderItems();
  });

  finalizeBtn.addEventListener("click", finalize);

  // Reads (GRADES_ENDPOINT) are cached per exact query for the tab session;
  // mutations (UPDATE_ENDPOINT) are never cached and always hit the network.
  async function makeAPIRequest(endpoint, data, forceRefresh) {
    const isRead = endpoint === CONFIG.API.GRADES_ENDPOINT;
    const cacheKey = `grades:${JSON.stringify(data)}`;
    if (isRead && !forceRefresh) {
      const cached = apiCache.get(cacheKey);
      if (cached !== undefined) return cached;
    }
    const authToken = sessionStorage.getItem("authToken") || localStorage.getItem("authToken");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${authToken}` },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error || errBody.message || `HTTP error! Status: ${response.status}`);
    }
    const result = await response.json();
    if (isRead) {
      apiCache.set(cacheKey, result);
    } else {
      // A mutation just happened — any previously cached roster/detail
      // reads for this worklist are now stale.
      apiCache.clearPrefix('grades:');
    }
    return result;
  }

  function parseBody(response) {
    if (!response) return null;
    if (response.body) {
      return typeof response.body === "string" ? JSON.parse(response.body) : response.body;
    }
    return response;
  }

  // Same classification used across view_grades.js / student-details.js /
  // student_grade.js — kept in sync intentionally rather than imported,
  // since none of those files currently export it as a shared module.
  function getMarksStatus(marks, maxMarks) {
    const obtained = parseFloat(marks) || 0;
    const max = parseFloat(maxMarks) || 0;
    if (max <= 0) return "unscored";
    if (obtained >= max) return "correct";
    if (obtained <= 0) return "incorrect";
    return "partial";
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text === undefined || text === null ? "" : String(text);
    return div.innerHTML;
  }

  function reviewedStorageKey(qpId, assignmentId) {
    return `correction_reviewed_${qpId}_${assignmentId}`;
  }

  function getReviewedSet(qpId, assignmentId) {
    try {
      const raw = localStorage.getItem(reviewedStorageKey(qpId, assignmentId));
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch (e) {
      return new Set();
    }
  }

  function markReviewed(qpId, assignmentId, itemKey) {
    const set = getReviewedSet(qpId, assignmentId);
    set.add(itemKey);
    localStorage.setItem(reviewedStorageKey(qpId, assignmentId), JSON.stringify([...set]));
  }

  async function runScan(qpId, assignmentId, forceRefresh) {
    currentQpId = qpId;
    currentAssignmentId = assignmentId;
    expandedStudents = new Set();
    scanBtn.disabled = true;
    loaderContainer.style.display = "block";
    resultContainer.style.display = "none";
    scanProgress.textContent = "Loading class roster…";

    try {
      const rosterResponse = await makeAPIRequest(CONFIG.API.GRADES_ENDPOINT, {
        operation: "getAllStudentGrades",
        qp_id: qpId,
        assignment_id: assignmentId,
      }, forceRefresh);
      apiCache.set("lastQuery:correction", { qpId, assignmentId });
      const roster = parseBody(rosterResponse);
      const grades = roster && Array.isArray(roster.grades) ? roster.grades : [];

      if (grades.length === 0) {
        currentItems = [];
        renderItems();
        resultContainer.style.display = "block";
        return;
      }

      const items = [];
      for (let i = 0; i < grades.length; i++) {
        const studentId = grades[i].student_id;
        scanProgress.textContent = `Scanning ${i + 1} of ${grades.length} — ${studentId || "student"}…`;
        try {
          const detailResponse = await makeAPIRequest(CONFIG.API.GRADES_ENDPOINT, {
            operation: "getSingleStudentGrade",
            student_id: studentId,
            assignment_id: assignmentId,
          }, forceRefresh);
          const detail = parseBody(detailResponse);
          const details = detail && Array.isArray(detail.details) ? detail.details : [];
          details.forEach((q) => {
            const status = getMarksStatus(q.marks, q.max_marks);
            if (status === "incorrect" || status === "partial") {
              items.push({
                student_id: studentId,
                question_number: q.question_number,
                subpart: q.subpart || "",
                marks: q.marks,
                max_marks: q.max_marks,
                status,
                question_text: q.question || "",
              });
            }
          });
        } catch (perStudentError) {
          console.warn(`Could not load details for ${studentId}:`, perStudentError);
        }
      }

      // Flagged first: needs-correction before partial-credit, otherwise
      // stable by student id.
      items.sort((a, b) => {
        if (a.status !== b.status) return a.status === "incorrect" ? -1 : 1;
        return String(a.student_id).localeCompare(String(b.student_id));
      });

      currentItems = items;
      renderItems();
      resultContainer.style.display = "block";
    } catch (error) {
      console.error("Worklist scan failed:", error);
      alert(`Failed to scan for flagged answers: ${error.message}`);
    } finally {
      scanBtn.disabled = false;
      loaderContainer.style.display = "none";
    }
  }

  function itemKey(item) {
    return `${item.student_id}_${item.question_number}_${item.subpart || "main"}`;
  }

  // Groups the flat flagged-item list by student_id, preserving the order
  // students first appeared in (already stable-sorted alphabetically by
  // runScan). Each group's `items` array contains ONLY that student's
  // flagged questions — nothing is shared or indexed across groups.
  function groupByStudent(items) {
    const order = [];
    const groups = new Map();
    items.forEach((item) => {
      const sid = item.student_id;
      if (!groups.has(sid)) {
        groups.set(sid, []);
        order.push(sid);
      }
      groups.get(sid).push(item);
    });
    return order.map((sid) => ({ studentId: sid, items: groups.get(sid) }));
  }

  function renderItems() {
    const reviewed = getReviewedSet(currentQpId, currentAssignmentId);

    const counts = { all: currentItems.length, incorrect: 0, partial: 0 };
    currentItems.forEach((item) => {
      counts[item.status] = (counts[item.status] || 0) + 1;
    });
    document.getElementById("count-all").textContent = counts.all;
    document.getElementById("count-incorrect").textContent = counts.incorrect;
    document.getElementById("count-partial").textContent = counts.partial;

    itemsContainer.innerHTML = "";
    emptyState.style.display = currentItems.length === 0 ? "block" : "none";

    // Step 1: student names list. Each group only shows questions that
    // match currentFilter, and a group with nothing left to show under the
    // active filter is skipped entirely.
    const groups = groupByStudent(currentItems)
      .map((group) => ({
        studentId: group.studentId,
        items: group.items.filter((item) => currentFilter === "all" || item.status === currentFilter),
      }))
      .filter((group) => group.items.length > 0);

    groups.forEach((group) => {
      const studentId = group.studentId;
      const isExpanded = expandedStudents.has(studentId);
      const initials = String(studentId || "?").slice(0, 2).toUpperCase();
      const reviewedInGroup = group.items.filter((item) => reviewed.has(itemKey(item))).length;

      const groupCard = document.createElement("div");
      groupCard.className = "worklist-student-group";

      const header = document.createElement("button");
      header.type = "button";
      header.className = "worklist-student-header";
      header.setAttribute("aria-expanded", String(isExpanded));
      header.innerHTML = `
        <span class="worklist-item-avatar">${escapeHtml(initials)}</span>
        <div class="worklist-item-body">
          <div class="worklist-item-title">${escapeHtml(studentId)}</div>
          <div class="worklist-item-meta">${group.items.length} flagged answer${group.items.length === 1 ? "" : "s"} &middot; ${reviewedInGroup}/${group.items.length} reviewed</div>
        </div>
        <span class="worklist-student-chevron">${isExpanded ? "&#9660;" : "&#9654;"}</span>
      `;
      // Toggling by student_id (not list position) is what guarantees this
      // only ever expands *this* student's questions.
      header.addEventListener("click", () => {
        if (expandedStudents.has(studentId)) {
          expandedStudents.delete(studentId);
        } else {
          expandedStudents.add(studentId);
        }
        renderItems();
      });
      groupCard.appendChild(header);

      if (isExpanded) {
        const body = document.createElement("div");
        body.className = "worklist-student-body";

        // Step 2: this student's question list — sourced only from
        // group.items, which was filtered to this exact studentId above.
        group.items.forEach((item) => {
          const key = itemKey(item);
          const isReviewed = reviewed.has(key);
          const qLabel = `Q${escapeHtml(item.question_number)}${item.subpart ? escapeHtml(item.subpart) : ""}`;
          const statusLabel = item.status === "incorrect" ? "AI flagged: needs correction" : "AI flagged: partial credit";

          const row = document.createElement("div");
          row.className = `worklist-item status-${item.status}${isReviewed ? " is-reviewed" : ""}`;
          row.innerHTML = `
            <div class="worklist-item-body">
              <div class="worklist-item-title">${qLabel}${isReviewed ? '<span class="worklist-item-reviewed-tag">&#10003; reviewed</span>' : ""}</div>
              <div class="worklist-item-meta">${escapeHtml(statusLabel)} &middot; ${escapeHtml(item.marks)}/${escapeHtml(item.max_marks)} marks</div>
            </div>
            <a class="btn btn-secondary" href="student-details.html?student_id=${encodeURIComponent(item.student_id)}&assignment_id=${encodeURIComponent(currentAssignmentId)}&qp_id=${encodeURIComponent(currentQpId)}&focus_q=${encodeURIComponent(item.question_number)}&focus_sub=${encodeURIComponent(item.subpart || "")}&from=correction">Open &rarr;</a>
          `;
          row.querySelector("a").addEventListener("click", (event) => {
            event.stopPropagation();
            markReviewed(currentQpId, currentAssignmentId, key);
          });
          body.appendChild(row);
        });

        groupCard.appendChild(body);
      }

      itemsContainer.appendChild(groupCard);
    });

    const reviewedCount = currentItems.filter((item) => reviewed.has(itemKey(item))).length;
    const total = currentItems.length;
    finalizeCountEl.textContent = `${reviewedCount} / ${total} opened`;
    finalizeCountEl.classList.toggle("all-done", total > 0 && reviewedCount === total);
  }

  async function finalize() {
    if (!currentQpId || !currentAssignmentId) return;
    const reviewed = getReviewedSet(currentQpId, currentAssignmentId);
    finalizeBtn.disabled = true;
    finalizeBtn.textContent = "Finalizing…";
    try {
      // TODO(backend): "finalizeCorrection" operation doesn't exist yet —
      // this call is best-effort and its failure doesn't block the
      // teacher from moving on to Publish/View Grades.
      await makeAPIRequest(CONFIG.API.UPDATE_ENDPOINT, {
        operation: "finalizeCorrection",
        qp_id: currentQpId,
        assignment_id: currentAssignmentId,
        reviewed_count: reviewed.size,
        total_count: currentItems.length,
      });
    } catch (error) {
      console.warn("finalizeCorrection is not implemented on the backend yet:", error);
    } finally {
      window.location.href = `teacher_view_grade.html?qp_id=${encodeURIComponent(currentQpId)}&assignment_id=${encodeURIComponent(currentAssignmentId)}`;
    }
  }
});
