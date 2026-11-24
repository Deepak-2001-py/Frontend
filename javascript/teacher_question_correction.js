/**
 * Teacher — Review & Correct Question Text (post-upload OCR correction)
 *
 * Talks to lambda_python_files/correct_questions_answer.py:
 *   - "getQuestionsForCorrection" {qp_id, assignment_id}
 *     -> {questions: [{question_number, subpart, question, is_latex,
 *                      max_marks, question_reviewed}]}
 *   - "submitQuestionCorrections" {qp_id, assignment_id,
 *       corrections:[{question_number, subpart, corrected_question, is_latex}]}
 *     -> fans a correction out to every student's copy of that question.
 *
 * Reached either by loading the page directly or via a redirect from
 * javascript/upload_pdf.js right after a teacher finishes uploading the
 * question paper / solution, which appends ?qp_id=&assignment_id=.
 *
 * Distinct from teacher_correction.html (javascript/teacher_correction.js)
 * — that page is the post-grading "worklist" for overriding AI marks;
 * this page is the pre-grading pass over the OCR'd question text itself.
 */
document.addEventListener("DOMContentLoaded", function () {
  const CONFIG = {
    API: {
      CORRECTION_ENDPOINT: "https://rus9nultj9.execute-api.eu-north-1.amazonaws.com/dev/correctanswer",
    },
  };

  const lookupForm = document.getElementById("lookup-form");
  const qpInput = document.getElementById("qp-id");
  const assignmentInput = document.getElementById("assignment-id");
  const loadBtn = document.getElementById("load-btn");
  const loaderContainer = document.getElementById("loader-container");
  const loaderText = document.getElementById("loader-text");
  const processingState = document.getElementById("processing-state");
  const retryBtn = document.getElementById("retry-btn");
  const resultContainer = document.getElementById("questions-result");
  const questionsList = document.getElementById("questions-list");
  const correctionCount = document.getElementById("correction-count");
  const savedCountEl = document.getElementById("saved-count");
  const reloadBtn = document.getElementById("reload-btn");
  const saveAllBtn = document.getElementById("save-all-btn");
  const alertsContainer = document.getElementById("alerts-container");

  let currentQuestions = [];
  let currentQpId = "";
  let currentAssignmentId = "";

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

  const initialParams = new URLSearchParams(window.location.search);
  const initialQp = initialParams.get("qp_id");
  const initialAssignment = initialParams.get("assignment_id");
  if (initialQp) qpInput.value = initialQp;
  if (initialAssignment) assignmentInput.value = initialAssignment;
  if (initialQp && initialAssignment) {
    runLoad(initialQp.trim(), initialAssignment.trim());
  } else {
    const last = apiCache.get("lastQuery:questionCorrection");
    if (last && last.qpId && last.assignmentId) {
      qpInput.value = last.qpId;
      assignmentInput.value = last.assignmentId;
      runLoad(last.qpId, last.assignmentId);
    }
  }

  lookupForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const qpId = qpInput.value.trim();
    const assignmentId = assignmentInput.value.trim();
    if (!qpId || !assignmentId) {
      showAlert("Please fill in both Question Paper ID and Assignment ID.", "danger");
      return;
    }
    runLoad(qpId, assignmentId);
  });

  retryBtn.addEventListener("click", function () {
    if (currentQpId && currentAssignmentId) runLoad(currentQpId, currentAssignmentId, true);
  });
  reloadBtn.addEventListener("click", function () {
    if (currentQpId && currentAssignmentId) runLoad(currentQpId, currentAssignmentId, true);
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

  async function runLoad(qpId, assignmentId, forceRefresh) {
    currentQpId = qpId;
    currentAssignmentId = assignmentId;
    loadBtn.disabled = true;
    loaderContainer.style.display = "block";
    loaderText.textContent = "Loading questions…";
    processingState.style.display = "none";
    resultContainer.style.display = "none";

    try {
      const cacheKey = `questionCorrection:${qpId}:${assignmentId}`;
      let response;
      if (!forceRefresh && apiCache.has(cacheKey)) {
        response = apiCache.get(cacheKey);
      } else {
        response = await makeAPIRequest({
          operation: "getQuestionsForCorrection",
          qp_id: qpId,
          assignment_id: assignmentId,
        });
        apiCache.set(cacheKey, response);
      }
      apiCache.set("lastQuery:questionCorrection", { qpId, assignmentId });

      const data = parseBody(response);
      const questions = data && Array.isArray(data.questions) ? data.questions : [];

      if (questions.length === 0) {
        processingState.style.display = "block";
        return;
      }

      currentQuestions = questions;
      renderQuestions();
      resultContainer.style.display = "block";
    } catch (error) {
      console.error("Failed to load questions for correction:", error);
      showAlert(`Failed to load questions: ${error.message}`, "danger");
    } finally {
      loadBtn.disabled = false;
      loaderContainer.style.display = "none";
    }
  }

  function updateSavedCount() {
    const reviewed = currentQuestions.filter((q) => q.question_reviewed).length;
    savedCountEl.textContent = `${reviewed} / ${currentQuestions.length} reviewed`;
    savedCountEl.classList.toggle("all-done", currentQuestions.length > 0 && reviewed === currentQuestions.length);
  }

  function renderQuestions() {
    correctionCount.textContent = `${currentQuestions.length} question${currentQuestions.length === 1 ? "" : "s"}`;
    questionsList.innerHTML = "";
    currentQuestions.forEach((question, index) => {
      questionsList.appendChild(buildQuestionCard(question, index));
    });
    updateSavedCount();
    loadMathJax(questionsList);
  }

  function buildQuestionCard(question, index) {
    const qLabel = `Q${escapeHtml(question.question_number)}${question.subpart ? escapeHtml(question.subpart) : ""}`;
    const isReviewed = !!question.question_reviewed;

    const card = document.createElement("div");
    card.className = "question-item answer-editor-card";
    card.dataset.index = String(index);

    card.innerHTML = `
      <div class="question-header">
        <h3>${qLabel}</h3>
        <span class="answer-status-tag ${isReviewed ? "status-corrected" : "status-pending"}">
          ${isReviewed ? "&#10003; Reviewed" : "Needs your review"}
        </span>
      </div>
      <div class="question-meta">
        <span class="marks">Max marks: <span class="marks-display">${escapeHtml(question.max_marks || 0)}</span></span>
      </div>

      <div class="answer-mode-toggle" role="tablist">
        <button type="button" class="answer-mode-btn ${question.is_latex ? "" : "active"}" data-mode="plain">Plain text</button>
        <button type="button" class="answer-mode-btn ${question.is_latex ? "active" : ""}" data-mode="latex">LaTeX</button>
      </div>

      <div class="answer-editor-grid">
        <div class="answer-editor-col">
          <h5>Question text</h5>
          <textarea class="answer-textarea" spellcheck="false">${escapeHtml(question.question || "")}</textarea>
        </div>
        <div class="answer-preview-col">
          <h5>Preview</h5>
          <div class="answer-preview-pane"></div>
        </div>
      </div>

      <div class="answer-editor-actions">
        <span class="answer-save-status"></span>
        <button type="button" class="btn btn-secondary save-one-btn"><i class="fas fa-floppy-disk"></i> Save (applies to whole class)</button>
      </div>
    `;

    const textarea = card.querySelector(".answer-textarea");
    const previewPane = card.querySelector(".answer-preview-pane");
    const modeButtons = card.querySelectorAll(".answer-mode-btn");
    const saveStatus = card.querySelector(".answer-save-status");
    const saveBtn = card.querySelector(".save-one-btn");

    let mode = question.is_latex ? "latex" : "plain";

    function updatePreview() {
      const text = textarea.value;
      previewPane.textContent = text;
      if (mode === "latex" && window.MathJax && window.MathJax.typeset) {
        try { window.MathJax.typeset([previewPane]); } catch (e) { /* best-effort */ }
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
      await saveCorrection(question, textarea.value, mode === "latex", saveStatus, saveBtn);
    });

    return card;
  }

  async function saveCorrection(question, text, isLatex, statusEl, btn) {
    if (!text || !text.trim()) {
      statusEl.textContent = "Question text can't be empty.";
      statusEl.className = "answer-save-status error";
      return false;
    }
    btn.disabled = true;
    statusEl.textContent = "Saving to whole class…";
    statusEl.className = "answer-save-status";
    try {
      const response = await makeAPIRequest({
        operation: "submitQuestionCorrections",
        qp_id: currentQpId,
        assignment_id: currentAssignmentId,
        corrections: [{
          question_number: question.question_number,
          subpart: question.subpart,
          corrected_question: text,
          is_latex: isLatex,
        }],
      });
      const data = parseBody(response);
      const recordsUpdated = data && Array.isArray(data.updated_questions) && data.updated_questions[0]
        ? data.updated_questions[0].records_updated
        : 0;

      question.question = text;
      question.is_latex = isLatex;
      question.question_reviewed = true;
      apiCache.clearPrefix("questionCorrection:");
      statusEl.textContent = `Saved — updated ${recordsUpdated} student record(s).`;
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
      const cards = Array.from(questionsList.querySelectorAll(".answer-editor-card"));
      let successCount = 0;
      for (const card of cards) {
        const index = parseInt(card.dataset.index, 10);
        const question = currentQuestions[index];
        const textarea = card.querySelector(".answer-textarea");
        const isLatex = card.querySelector('.answer-mode-btn[data-mode="latex"]').classList.contains("active");
        const statusEl = card.querySelector(".answer-save-status");
        const saveBtn = card.querySelector(".save-one-btn");
        const ok = await saveCorrection(question, textarea.value, isLatex, statusEl, saveBtn);
        if (ok) successCount++;
      }
      showAlert(`Saved ${successCount} of ${cards.length} question(s).`, successCount === cards.length ? "success" : "warning");
    } finally {
      saveAllBtn.disabled = false;
      saveAllBtn.innerHTML = '<i class="fas fa-check-double"></i> Save all corrections';
    }
  }

  // Same dynamic MathJax loader used across the app (view_grades.js /
  // student_grade.js / student-details.js / student_answer_correction.js).
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
