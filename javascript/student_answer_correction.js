/**
 * Student — Review & Correct Your Answers (post-upload OCR correction)
 *
 * Talks to lambda_python_files/correct_questions_answer.py:
 *   - "getAnswersForCorrection" {student_id, assignment_id, qp_id?}
 *     -> {answers: [{evaluation_id, question_number, subpart, question,
 *                    student_answer, is_latex, max_marks, status}]}
 *   - "submitAnswerCorrections" {corrections:[{evaluation_id,
 *       question_number, corrected_answer, is_latex}]}
 *
 * Reached either by loading the page directly (student re-checks later)
 * or via a redirect from javascript/upload_pdf.js right after a student
 * assignment upload finishes, which appends ?assignment_id=&qp_id=.
 *
 * If GradeAnt's OCR hasn't produced any rows yet for this assignment
 * (nothing to correct), the "still processing" state is shown instead of
 * an empty list, since that's the expected state right after upload.
 */
document.addEventListener("DOMContentLoaded", function () {
  const CONFIG = {
    API: {
      CORRECTION_ENDPOINT: "https://rus9nultj9.execute-api.eu-north-1.amazonaws.com/dev/correctanswer",
    },
  };

  const lookupForm = document.getElementById("lookup-form");
  const assignmentInput = document.getElementById("assignment-id");
  const qpInput = document.getElementById("qp-id");
  const loadBtn = document.getElementById("load-btn");
  const loaderContainer = document.getElementById("loader-container");
  const loaderText = document.getElementById("loader-text");
  const processingState = document.getElementById("processing-state");
  const retryBtn = document.getElementById("retry-btn");
  const resultContainer = document.getElementById("answers-result");
  const answersList = document.getElementById("answers-list");
  const correctionCount = document.getElementById("correction-count");
  const savedCountEl = document.getElementById("saved-count");
  const reloadBtn = document.getElementById("reload-btn");
  const saveAllBtn = document.getElementById("save-all-btn");
  const alertsContainer = document.getElementById("alerts-container");

  let currentAnswers = [];
  let currentAssignmentId = "";
  let currentQpId = "";

  function showAlert(message, type = "info") {
    if (!alertsContainer) return;
    const alert = document.createElement("div");
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    const closeBtn = document.createElement("button");
    closeBtn.className = "close-btn";
    closeBtn.innerHTML = "&times;";
    closeBtn.addEventListener("click", () => alert.remove());
    alert.appendChild(closeBtn);
    alertsContainer.appendChild(alert);
    setTimeout(() => alert.remove(), 6000);
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text === undefined || text === null ? "" : String(text);
    return div.innerHTML;
  }

  function getStudentId() {
    return sessionStorage.getItem("userId") || localStorage.getItem("userId") || "";
  }

  // Pre-fill from ?assignment_id=&qp_id= (set by upload_pdf.js right after
  // a successful student upload) and auto-run the load.
  const initialParams = new URLSearchParams(window.location.search);
  const initialAssignment = initialParams.get("assignment_id");
  const initialQp = initialParams.get("qp_id");
  if (initialAssignment) assignmentInput.value = initialAssignment;
  if (initialQp) qpInput.value = initialQp;
  if (initialAssignment) {
    runLoad(initialAssignment.trim(), (initialQp || "").trim());
  } else {
    const last = apiCache.get("lastQuery:answerCorrection");
    if (last && last.assignmentId) {
      assignmentInput.value = last.assignmentId;
      qpInput.value = last.qpId || "";
      runLoad(last.assignmentId, last.qpId || "");
    }
  }

  lookupForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const assignmentId = assignmentInput.value.trim();
    const qpId = qpInput.value.trim();
    if (!assignmentId) {
      showAlert("Please enter an Assignment ID.", "danger");
      return;
    }
    runLoad(assignmentId, qpId);
  });

  retryBtn.addEventListener("click", function () {
    if (currentAssignmentId) runLoad(currentAssignmentId, currentQpId, /* forceRefresh */ true);
  });
  reloadBtn.addEventListener("click", function () {
    if (currentAssignmentId) runLoad(currentAssignmentId, currentQpId, /* forceRefresh */ true);
  });
  saveAllBtn.addEventListener("click", saveAllCorrections);

  async function makeAPIRequest(data) {
    const authToken = sessionStorage.getItem("authToken") || localStorage.getItem("authToken");
    const response = await fetch(CONFIG.API.CORRECTION_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${authToken}` },
      body: JSON.stringify(data),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || result.message || `HTTP error! Status: ${response.status}`);
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

  async function runLoad(assignmentId, qpId, forceRefresh) {
    currentAssignmentId = assignmentId;
    currentQpId = qpId;
    loadBtn.disabled = true;
    loaderContainer.style.display = "block";
    loaderText.textContent = "Loading your answers…";
    processingState.style.display = "none";
    resultContainer.style.display = "none";

    try {
      const studentId = getStudentId();
      if (!studentId) {
        showAlert("Could not find your student ID — please log in again.", "danger");
        return;
      }

      const cacheKey = `answerCorrection:${studentId}:${assignmentId}:${qpId}`;
      let response;
      if (!forceRefresh && apiCache.has(cacheKey)) {
        response = apiCache.get(cacheKey);
      } else {
        response = await makeAPIRequest({
          operation: "getAnswersForCorrection",
          student_id: studentId,
          assignment_id: assignmentId,
          qp_id: qpId || undefined,
        });
        apiCache.set(cacheKey, response);
      }
      apiCache.set("lastQuery:answerCorrection", { assignmentId, qpId });

      const data = parseBody(response);
      const answers = data && Array.isArray(data.answers) ? data.answers : [];

      if (answers.length === 0) {
        processingState.style.display = "block";
        return;
      }

      currentAnswers = answers;
      renderAnswers();
      resultContainer.style.display = "block";
    } catch (error) {
      console.error("Failed to load answers for correction:", error);
      showAlert(`Failed to load your answers: ${error.message}`, "danger");
    } finally {
      loadBtn.disabled = false;
      loaderContainer.style.display = "none";
    }
  }

  function updateSavedCount() {
    const saved = currentAnswers.filter((a) => a.status === "corrected").length;
    savedCountEl.textContent = `${saved} / ${currentAnswers.length} saved`;
    savedCountEl.classList.toggle("all-done", currentAnswers.length > 0 && saved === currentAnswers.length);
  }

  function renderAnswers() {
    correctionCount.textContent = `${currentAnswers.length} question${currentAnswers.length === 1 ? "" : "s"}`;
    answersList.innerHTML = "";

    currentAnswers.forEach((answer, index) => {
      const card = buildAnswerCard(answer, index);
      answersList.appendChild(card);
    });

    updateSavedCount();
    loadMathJax(answersList);
  }

  function buildAnswerCard(answer, index) {
    const qLabel = `Q${escapeHtml(answer.question_number)}${answer.subpart ? escapeHtml(answer.subpart) : ""}`;
    const isCorrected = answer.status === "corrected";

    const card = document.createElement("div");
    card.className = "question-item answer-editor-card";
    card.dataset.index = String(index);

    card.innerHTML = `
      <div class="question-header">
        <h3>${qLabel}</h3>
        <span class="answer-status-tag ${isCorrected ? "status-corrected" : "status-pending"}">
          ${isCorrected ? "&#10003; Corrected" : "Needs your review"}
        </span>
      </div>
      <div class="question-meta">
        <span class="marks">Max marks: <span class="marks-display">${escapeHtml(answer.max_marks || 0)}</span></span>
      </div>
      <p class="question-text">${escapeHtml(answer.question || "Question text not available yet")}</p>

      <div class="answer-mode-toggle" role="tablist">
        <button type="button" class="answer-mode-btn ${answer.is_latex ? "" : "active"}" data-mode="plain">Plain text</button>
        <button type="button" class="answer-mode-btn ${answer.is_latex ? "active" : ""}" data-mode="latex">LaTeX</button>
      </div>

      <div class="answer-editor-grid">
        <div class="answer-editor-col">
          <h5>Your answer</h5>
          <textarea class="answer-textarea" spellcheck="false">${escapeHtml(answer.student_answer || "")}</textarea>
        </div>
        <div class="answer-preview-col">
          <h5>Preview</h5>
          <div class="answer-preview-pane"></div>
        </div>
      </div>

      <div class="answer-editor-actions">
        <span class="answer-save-status"></span>
        <button type="button" class="btn btn-secondary save-one-btn"><i class="fas fa-floppy-disk"></i> Save this answer</button>
      </div>
    `;

    const textarea = card.querySelector(".answer-textarea");
    const previewPane = card.querySelector(".answer-preview-pane");
    const modeButtons = card.querySelectorAll(".answer-mode-btn");
    const saveStatus = card.querySelector(".answer-save-status");
    const saveBtn = card.querySelector(".save-one-btn");

    let mode = answer.is_latex ? "latex" : "plain";

    function updatePreview() {
      const text = textarea.value;
      if (mode === "latex") {
        // Wrap as a display block so MathJax typesets the whole answer;
        // plain-text lines with no math still render fine as literal text.
        previewPane.innerHTML = escapeHtml(text).replace(/\n/g, "<br>");
        previewPane.dataset.latex = "true";
        if (window.MathJax && window.MathJax.typeset) {
          previewPane.textContent = text;
          try { window.MathJax.typeset([previewPane]); } catch (e) { /* best-effort */ }
        }
      } else {
        previewPane.textContent = text;
        delete previewPane.dataset.latex;
      }
    }

    modeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        mode = btn.dataset.mode;
        modeButtons.forEach((b) => b.classList.toggle("active", b === btn));
        updatePreview();
      });
    });

    textarea.addEventListener("input", updatePreview);
    updatePreview();

    saveBtn.addEventListener("click", async () => {
      await saveCorrection(answer, textarea.value, mode === "latex", saveStatus, saveBtn);
    });

    return card;
  }

  async function saveCorrection(answer, text, isLatex, statusEl, btn) {
    if (!text || !text.trim()) {
      statusEl.textContent = "Answer can't be empty.";
      statusEl.className = "answer-save-status error";
      return false;
    }
    btn.disabled = true;
    statusEl.textContent = "Saving…";
    statusEl.className = "answer-save-status";
    try {
      await makeAPIRequest({
        operation: "submitAnswerCorrections",
        corrections: [{
          evaluation_id: answer.evaluation_id,
          question_number: answer.question_number,
          corrected_answer: text,
          is_latex: isLatex,
        }],
      });
      answer.student_answer = text;
      answer.is_latex = isLatex;
      answer.status = "corrected";
      apiCache.clearPrefix("answerCorrection:");
      statusEl.textContent = "Saved.";
      statusEl.className = "answer-save-status saved";
      updateSavedCount();
      return true;
    } catch (error) {
      statusEl.textContent = `Failed to save: ${error.message}`;
      statusEl.className = "answer-save-status error";
      return false;
    } finally {
      btn.disabled = false;
    }
  }

  async function saveAllCorrections() {
    saveAllBtn.disabled = true;
    saveAllBtn.textContent = "Saving all…";
    try {
      const cards = Array.from(answersList.querySelectorAll(".answer-editor-card"));
      let successCount = 0;
      for (const card of cards) {
        const index = parseInt(card.dataset.index, 10);
        const answer = currentAnswers[index];
        const textarea = card.querySelector(".answer-textarea");
        const isLatex = card.querySelector('.answer-mode-btn[data-mode="latex"]').classList.contains("active");
        const statusEl = card.querySelector(".answer-save-status");
        const saveBtn = card.querySelector(".save-one-btn");
        const ok = await saveCorrection(answer, textarea.value, isLatex, statusEl, saveBtn);
        if (ok) successCount++;
      }
      showAlert(`Saved ${successCount} of ${cards.length} answer(s).`, successCount === cards.length ? "success" : "warning");
    } finally {
      saveAllBtn.disabled = false;
      saveAllBtn.innerHTML = '<i class="fas fa-check-double"></i> Save all corrections';
    }
  }

  // Same dynamic MathJax loader used by view_grades.js / student_grade.js /
  // student-details.js — kept in sync intentionally rather than imported.
  function loadMathJax(container) {
    if (!window.MathJax) {
      window.MathJax = {
        tex: { inlineMath: [["$", "$"], ["\\(", "\\)"]], displayMath: [["$$", "$$"], ["\\[", "\\]"]] },
        svg: { fontCache: "global" },
      };
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.0/es5/tex-mml-chtml.js";
      script.async = true;
      script.onload = function () {
        if (window.MathJax && window.MathJax.typeset) {
          try { window.MathJax.typeset([container]); } catch (e) { console.error("MathJax typeset error:", e); }
        }
      };
      document.head.appendChild(script);
    } else if (window.MathJax.typeset) {
      try { window.MathJax.typeset([container]); } catch (e) { console.error("MathJax typeset error:", e); }
    }
  }
});
