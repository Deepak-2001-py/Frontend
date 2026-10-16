const CONFIG = {
  API: {
    GRADES_ENDPOINT: "https://rus9nultj9.execute-api.eu-north-1.amazonaws.com/dev/getgrades",
    UPDATE_ENDPOINT: "https://rus9nultj9.execute-api.eu-north-1.amazonaws.com/dev/updatedb"
  }
};

function showLoading(id) {
  const element = document.getElementById(id);
  if (element) {
    element.style.display = "block";
  }
}

function hideLoading(id) {
  const element = document.getElementById(id);
  if (element) {
    element.style.display = "none";
  }
}

// `data` (operation + student_id/assignment_id/qp_id) is a read query, so
// it's cached for the tab session — pass forceRefresh=true to bypass the
// cache (used after a mark update, so the refreshed view is never stale).
async function makeAPIRequest(data, forceRefresh) {
  const cacheKey = `grades:${JSON.stringify(data)}`;
  if (!forceRefresh) {
    const cached = apiCache.get(cacheKey);
    if (cached !== undefined) return cached;
  }
  try {
    const authToken = sessionStorage.getItem("authToken") || localStorage.getItem("authToken");
    const response = await fetch(CONFIG.API.GRADES_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error || errBody.message || `HTTP error! Status: ${response.status}`);
    }

    const result = await response.json();
    apiCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error("API request failed:", error);
    throw error;
  }
}

function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    student_id: params.get("student_id"),
    assignment_id: params.get("assignment_id"),
    qp_id: params.get("qp_id"),
    operation: "getSingleStudentGrade"
  };
}

// Separate from getQueryParams() (which is sent verbatim as the API
// payload) — these params only drive UI: deep-linking in from the
// correction worklist (teacher_correction.html) to a specific flagged
// question, and showing a "back to worklist" link.
function getCorrectionUIParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    fromCorrection: params.get("from") === "correction",
    focusQuestion: params.get("focus_q"),
    focusSubpart: params.get("focus_sub") || "",
    qpId: params.get("qp_id"),
    assignmentId: params.get("assignment_id")
  };
}

// Shows a small "back to worklist" banner above the summary card when
// this page was opened from teacher_correction.html's worklist, so the
// teacher can return to it without re-typing qp_id/assignment_id.
function renderBackToWorklistLink() {
  const { fromCorrection, qpId, assignmentId } = getCorrectionUIParams();
  if (!qpId || !assignmentId) return;
  const container = document.getElementById("student-view");
  if (!container || document.getElementById("back-to-worklist-link")) return;

  const link = document.createElement("a");
  link.id = "back-to-worklist-link";
  link.className = "back-to-worklist-link";
  link.href = `teacher_correction.html?qp_id=${encodeURIComponent(qpId)}&assignment_id=${encodeURIComponent(assignmentId)}`;
  link.innerHTML = fromCorrection
    ? '<i class="fas fa-arrow-left"></i> Back to correction worklist'
    : '<i class="fas fa-list-check"></i> Open correction worklist for this assignment';
  container.insertBefore(link, container.firstChild);
}

// Store original data for updates
let currentStudentData = null;
// Store question mapping for consistent indexing - THIS IS THE KEY FIX
let questionIndexMap = new Map();
// Per-question correction-workspace state: AI baseline mark (for the
// "AI: X -> Override: Y" diff), ad-hoc rubric criteria, and answer
// annotations. Keyed by the same questionId as questionIndexMap.
// TODO(backend): none of this (rubric rows, annotations, the AI-vs-override
// distinction) is persisted server-side yet — updateMarksAPI's payload is
// extended with `rubric`/`annotations`/`ai_marks` per question (see
// handleUpdateMarks below) but the "updateMarks" operation ignores unknown
// fields today. Backend needs to accept and store them.
let questionExtras = new Map();

// Shows a .result-container and (re)plays its CSS reveal animation
// (asthetic_style.css's resultReveal keyframes) — removing the class
// before re-adding it, via a forced reflow, is what lets the animation
// replay on a refresh rather than only firing once ever.
function revealResultContainer(el) {
  if (!el) return;
  el.style.display = "block";
  el.classList.remove("is-revealed");
  void el.offsetWidth;
  el.classList.add("is-revealed");
}

// Utility function to escape HTML
function escapeHtml(text) {
  if (typeof text !== 'string') return text;
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Enhanced alert function with better styling
function showAlert(message, type = 'info') {
  // Remove existing alerts
  const existingAlert = document.querySelector('.custom-alert');
  if (existingAlert) {
    existingAlert.remove();
  }

  const alert = document.createElement('div');
  alert.className = `custom-alert alert-${type}`;
  alert.innerHTML = `
    <span>${escapeHtml(message)}</span>
    <button class="alert-close" onclick="this.parentElement.remove()">×</button>
  `;
  
  // Add basic styling
  alert.style.cssText = `
    padding: 12px 20px;
    margin: 10px 0;
    border-radius: 6px;
    position: relative;
    font-size: 14px;
    background-color: ${type === 'danger' ? '#f8d7da' : type === 'warning' ? '#fff3cd' : type === 'success' ? '#d4edda' : '#d1ecf1'};
    color: ${type === 'danger' ? '#721c24' : type === 'warning' ? '#856404' : type === 'success' ? '#155724' : '#0c5460'};
    border: 1px solid ${type === 'danger' ? '#f5c6cb' : type === 'warning' ? '#ffeaa7' : type === 'success' ? '#c3e6cb' : '#bee5eb'};
    z-index: 1000;
  `;
  
  // Style the close button
  const closeBtn = alert.querySelector('.alert-close');
  if (closeBtn) {
    closeBtn.style.cssText = `
      position: absolute;
      top: 8px;
      right: 12px;
      background: none;
      border: none;
      font-size: 18px;
      font-weight: bold;
      color: inherit;
      cursor: pointer;
      padding: 0;
      line-height: 1;
    `;
  }
  
  // Insert at the top of the student result container or body
  const container = document.getElementById('student-result') || document.body;
  if (container) {
    container.insertBefore(alert, container.firstChild);
  }

  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (alert.parentElement) {
      alert.remove();
    }
  }, 5000);
}

// FIXED: Create unique question identifier
function createQuestionId(question) {
  return `q${question.question_number}${question.subpart ? '_' + question.subpart : '_main'}`;
}

function displayStudentSummary(data) {
  const summaryBody = document.getElementById("summary-body");
  const studentResultContainer = document.getElementById("student-result");

  if (!summaryBody || !studentResultContainer) {
    console.error("Required DOM elements not found");
    return;
  }

  summaryBody.innerHTML = "";

  let result;
  if (data && data.body) {
    try {
      result = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
    } catch (error) {
      console.error("Parse error:", error);
      showAlert("Failed to parse grade data", "danger");
      return;
    }
  } else {
    result = data;
  }

  if (!result || !result.summary || !Array.isArray(result.summary)) {
    showAlert("No summary data available", "warning");
    return;
  }

  // Store the current data for updates
  currentStudentData = result;

  result.summary.forEach((grade, index) => {
    const row = document.createElement("tr");
    const dateStr = grade.timestamp
      ? new Date(grade.timestamp * 1000).toLocaleString()
      : "N/A";
    
    row.innerHTML = `
      <td>${escapeHtml(grade.student_id || "N/A")}</td>
      <td>${escapeHtml(grade.assignment_id || "N/A")}</td>
      <td>
        <span class="marks-display" id="summary-marks-${index}">${grade.total_marks !== undefined && grade.total_marks !== null ? grade.total_marks : "N/A"}</span>
        <input type="number" class="marks-input" id="summary-input-${index}" value="${grade.total_marks || 0}" style="display: none;" min="0" max="100">
      </td>
      <td>${escapeHtml(grade.evaluation_id || "N/A")}</td>
      <td>${escapeHtml(grade.qp_id || "N/A")}</td>
      <td>${escapeHtml(dateStr)}</td>
      <td class="actions-col">
        <button class="edit-marks-btn" onclick="toggleSummaryEditMode(${index})" data-index="${index}">Edit</button>
      </td>
    `;
    summaryBody.appendChild(row);
  });

  refreshScoreHero();
  revealResultContainer(studentResultContainer);
}

// Renders/updates the score-hero grade badge from whatever's currently in
// currentStudentData — called on initial load and again after any mark
// edit (updateSummaryTotalMarks) so the badge/percentage/grade letter
// stay in sync with the teacher's overrides instead of freezing at the
// AI's original score.
function refreshScoreHero() {
  const scoreHero = document.getElementById("score-hero");
  if (!scoreHero || typeof renderScoreHero !== "function") return;
  if (!currentStudentData || !currentStudentData.summary || !currentStudentData.summary[0]) return;

  const maxMarks = Array.isArray(currentStudentData.details)
    ? currentStudentData.details.reduce((sum, q) => sum + (parseFloat(q.max_marks) || 0), 0)
    : 0;
  renderScoreHero(scoreHero, {
    totalMarks: currentStudentData.summary[0].total_marks,
    maxMarks,
    details: currentStudentData.details,
  });
}

function toggleSummaryEditMode(index) {
  const marksDisplay = document.getElementById(`summary-marks-${index}`);
  const marksInput = document.getElementById(`summary-input-${index}`);
  const editBtn = document.querySelector(`[data-index="${index}"]`);
  
  if (!marksDisplay || !marksInput || !editBtn) {
    console.error("Summary edit elements not found");
    return;
  }
  
  if (marksDisplay.style.display !== "none") {
    // Switch to edit mode
    marksDisplay.style.display = "none";
    marksInput.style.display = "inline-block";
    marksInput.focus();
    editBtn.textContent = "Save";
    editBtn.classList.add("save-mode");
  } else {
    // Switch back to display mode and update the data
    const newValue = parseFloat(marksInput.value) || 0;
    marksDisplay.textContent = newValue;
    marksDisplay.style.display = "inline";
    marksInput.style.display = "none";
    editBtn.textContent = "Edit";
    editBtn.classList.remove("save-mode");
    
    // Update the stored data
    if (currentStudentData && currentStudentData.summary && currentStudentData.summary[index]) {
      currentStudentData.summary[index].total_marks = newValue;
    }
  }
}

// Function to calculate total marks from individual question marks
function calculateTotalMarks() {
  if (!currentStudentData || !currentStudentData.details) {
    return 0;
  }
  
  let totalMarks = 0;
  currentStudentData.details.forEach(question => {
    totalMarks += parseFloat(question.marks || 0);
  });
  
  return totalMarks;
}

// Function to update summary total marks when individual question marks change
function updateSummaryTotalMarks() {
  const newTotalMarks = calculateTotalMarks();
  
  // Update in current data
  if (currentStudentData && currentStudentData.summary && currentStudentData.summary[0]) {
    currentStudentData.summary[0].total_marks = newTotalMarks;
  }
  
  // Update in UI
  const summaryMarksDisplay = document.getElementById('summary-marks-0');
  const summaryMarksInput = document.getElementById('summary-input-0');
  
  if (summaryMarksDisplay) {
    summaryMarksDisplay.textContent = newTotalMarks;
  }
  if (summaryMarksInput) {
    summaryMarksInput.value = newTotalMarks;
  }
  
  refreshScoreHero();

  // Show notification about auto-update
  showAlert(`Total marks automatically updated to ${newTotalMarks}`, "success");
}
// FIXED: Function to toggle edit mode for individual question marks using unique IDs
function toggleQuestionEditMode(questionId) {
  console.log('Toggling edit mode for question ID:', questionId);
  
  const marksDisplay = document.getElementById(`question-marks-${questionId}`);
  const marksInput = document.getElementById(`question-input-${questionId}`);
  const editBtn = document.querySelector(`[data-question-id="${questionId}"]`);
  
  if (!marksDisplay || !marksInput || !editBtn) {
    console.error("Question edit elements not found for ID:", questionId);
    return;
  }
  
  if (marksDisplay.style.display !== "none") {
    // Switch to edit mode
    marksDisplay.style.display = "none";
    marksInput.style.display = "inline-block";
    marksInput.focus();
    editBtn.textContent = "Save";
    editBtn.classList.add("save-mode");
  } else {
    // Switch back to display mode and update the data
    const newValue = parseFloat(marksInput.value) || 0;
    const maxMarks = parseFloat(marksInput.getAttribute('data-max-marks')) || 100;
    
    // Validate marks don't exceed maximum
    if (newValue > maxMarks) {
      showAlert(`Marks cannot exceed maximum of ${maxMarks}`, "warning");
      marksInput.value = maxMarks;
      return;
    }
    
    if (newValue < 0) {
      showAlert("Marks cannot be negative", "warning");
      marksInput.value = 0;
      return;
    }
    
    marksDisplay.textContent = newValue;
    marksDisplay.style.display = "inline";
    marksInput.style.display = "none";
    editBtn.textContent = "Edit";
    editBtn.classList.remove("save-mode");

    commitQuestionMarks(questionId, newValue, maxMarks);
  }
}

// Shared "save this question's marks" logic — used by the inline Edit/Save
// button above and by the rubric panel's "Apply to score" button
// (applyRubricScore) so both paths refresh status/pills/diff consistently.
function commitQuestionMarks(questionId, newValue, maxMarks) {
  // Refresh the correct/partial/incorrect status now that marks changed,
  // so a teacher correcting a wrong mark sees the card reflect the fix.
  const newStatus = getMarksStatus(newValue, maxMarks);
  const statusBadge = document.getElementById(`question-status-${questionId}`);
  const marksDisplay = document.getElementById(`question-marks-${questionId}`);
  const questionCard = marksDisplay ? marksDisplay.closest('.question-item') : null;
  const reasoningSection = document.getElementById(`question-reasoning-${questionId}`);
  if (questionCard) {
    questionCard.className = `question-item status-${newStatus}`;
  }
  if (statusBadge) {
    const badge = getStatusBadge(newStatus);
    statusBadge.className = `status-badge status-badge-${newStatus}`;
    statusBadge.textContent = badge.text;
  }
  if (reasoningSection) {
    const toggleLabel = reasoningSection.querySelector('.feedback-toggle-btn span:first-child');
    if (toggleLabel) {
      toggleLabel.textContent = newStatus === 'correct' ? 'Feedback' : 'Correction';
    }
  }
  updateQuestionPathPillStatus(questionId, newStatus);
  updateOverrideDiff(questionId, newValue);

  // FIXED: Parse questionId to get question number and subpart
  const questionMatch = questionId.match(/^q(\d+)(?:_(.+))?$/);
  if (!questionMatch) {
    console.error('Invalid question ID format:', questionId);
    return;
  }

  const questionNumber = parseInt(questionMatch[1]);
  const subpart = questionMatch[2] === 'main' ? null : questionMatch[2];

  console.log(`Parsed question ID ${questionId}: number=${questionNumber}, subpart=${subpart}`);

  // Find the correct question in the data array by matching question_number and subpart
  if (currentStudentData && currentStudentData.details) {
    const targetIndex = currentStudentData.details.findIndex(q => {
      const qNum = parseInt(q.question_number);
      const qSubpart = q.subpart || null;
      return qNum === questionNumber && qSubpart === subpart;
    });

    if (targetIndex !== -1) {
      console.log(`Found correct question at index ${targetIndex}. Updating marks from ${currentStudentData.details[targetIndex].marks} to ${newValue}`);
      currentStudentData.details[targetIndex].marks = newValue;

      // Update the mapping for consistency
      questionIndexMap.set(questionId, targetIndex);

      // Automatically update total marks in summary
      updateSummaryTotalMarks();
    } else {
      console.error(`Could not find question ${questionNumber} with subpart '${subpart}' in data array`);
      console.log('Available questions:', currentStudentData.details.map((q, i) => `[${i}] q${q.question_number}_${q.subpart || 'main'}`));
    }
  } else {
    console.error('No current student data available');
  }
}

async function handleUpdateMarks() {
  console.log('Update marks function called');

  if (!currentStudentData || !currentStudentData.summary) {
    showAlert("No data available to update", "warning");
    return;
  }

  const updateBtn = document.querySelector('.update-marks-button');

  if (!updateBtn) {
    console.error("Update button not found");
    showAlert("Update button not found", "warning");
    return;
  }

  const originalText = updateBtn.textContent;
  
  try {
    // Show loading state
    updateBtn.textContent = "Updating...";
    updateBtn.disabled = true;
    updateBtn.style.cursor = "not-allowed";

    console.log('Preparing data for update...');
    
    // Prepare the details array with proper serialization and sorting.
    // Send back the FULL original detail object exactly as it came from the
    // GET response (question, student_answer, feedback, etc. included) —
    // only `marks` differs, already updated in place by
    // toggleQuestionEditMode — so nothing the teacher didn't touch gets
    // silently dropped from the stored record.
    let serializedDetails = [];
    if (currentStudentData.details && Array.isArray(currentStudentData.details)) {
      // Sort details by question_number first, then by subpart (nulls last, then alphabetically)
      serializedDetails = currentStudentData.details
        .map(question => {
          // TODO(backend): ai_marks/rubric/annotations are new fields the
          // "updateMarks" operation doesn't persist yet — see the
          // questionExtras comment near the top of this file. Sent anyway
          // so the backend team can see the intended shape; harmless no-op
          // until the operation is extended to store them.
          const extras = questionExtras.get(createQuestionId(question));
          return {
            ...question,
            subpart: question.subpart || null,
            ai_marks: extras ? extras.aiMarks : question.marks,
            rubric: extras ? extras.rubric : [],
            annotations: extras ? extras.annotations : []
          };
        })
        .sort((a, b) => {
          // First sort by question_number
          if (a.question_number !== b.question_number) {
            return a.question_number - b.question_number;
          }
          
          // Handle multiple subparts for the same question
          if (a.subpart === null && b.subpart === null) return 0;
          if (a.subpart === null) return -1;
          if (b.subpart === null) return 1;
          
          return a.subpart.localeCompare(b.subpart);
        });
    }
    
    // Prepare the data for API call with proper structure. Same principle
    // as details above: keep the full original summary record from the GET
    // response, only total_marks was changed (by updateSummaryTotalMarks /
    // toggleSummaryEditMode), everything else round-trips unchanged.
    const updatedData = {
      operation: "updateMarks",
      summary: currentStudentData.summary.map(grade => ({ ...grade })),
      details: serializedDetails
    };

    console.log('Data prepared and serialized:', JSON.stringify(updatedData, null, 2));

    // Validate data structure before sending
    if (!validateUpdateData(updatedData)) {
      throw new Error("Data validation failed - marks and max_marks mismatch detected");
    }

    // Make API call to update marks
    const response = await updateMarksAPI(updatedData);
    
    console.log('updateMarksAPI response:', response);
    
    if (response && (response.success || response.statusCode === 200)) {
      showAlert("All marks updated successfully!", "success");
      // Optionally refresh the data
      await refreshStudentData();
      console.log('Marks updated successfully, data refreshed');
    } else {
      throw new Error(response?.message || response?.error || "Update failed");
    }

  } catch (error) {
    console.error("Update error:", error);
    showAlert(`Failed to update marks: ${error.message}`, "danger");
  } finally {
    // Restore button state
    updateBtn.textContent = originalText;
    updateBtn.disabled = false;
    updateBtn.style.cursor = "pointer";
  }
}

// Validation function to ensure data integrity
function validateUpdateData(data) {
  console.log('Validating update data...');
  
  if (data.details && Array.isArray(data.details)) {
    const questionMap = new Map();
    
    for (const detail of data.details) {
      // Ensure marks don't exceed max_marks
      if (detail.marks > detail.max_marks) {
        console.error(`Validation failed: marks (${detail.marks}) exceed max_marks (${detail.max_marks}) for question ${detail.question_number}${detail.subpart ? detail.subpart : ''}`);
        return false;
      }
      
      // Ensure required fields are present
      if (typeof detail.question_number !== 'number' || 
          typeof detail.marks !== 'number' || 
          typeof detail.max_marks !== 'number' ||
          !detail.evaluation_id ||
          typeof detail.timestamp !== 'number') {
        console.error('Validation failed: missing required fields in detail:', detail);
        return false;
      }
      
      // Track questions and subparts to detect duplicates
      const questionKey = `${detail.question_number}-${detail.subpart || 'main'}`;
      if (questionMap.has(questionKey)) {
        console.error(`Validation failed: duplicate entry found for question ${detail.question_number}${detail.subpart ? detail.subpart : ''}`);
        return false;
      }
      questionMap.set(questionKey, detail);
    }
  }
  
  console.log('Data validation passed');
  return true;
}

// API call function for updating marks
async function updateMarksAPI(data) {
  console.log('Making API call to update marks...');
  console.log('API Endpoint:', CONFIG.API.UPDATE_ENDPOINT);
  
  try {
    const authToken = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
    const response = await fetch(CONFIG.API.UPDATE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(data)
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Response error text:', errorText);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('updateMarksAPI Response:', result);
    // Marks changed server-side — any cached grades read is now stale.
    apiCache.clearPrefix('grades:');
    return result;

  } catch (error) {
    console.error('API call failed:', error);
    
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Network error: Please check your internet connection and try again.');
    }
    
    throw error;
  }
}

// Function to refresh data after update
async function refreshStudentData() {
  try {
    const queryParams = getQueryParams();
    const data = await makeAPIRequest(queryParams, /* forceRefresh */ true);
    console.log('Data refreshed:', data);
    if (!data || !data.body) {
      showAlert("No data returned from server", "warning");
      return;
    }
    displayStudentSummary(data);
    displayDetails(data);
  } catch (error) {
    console.error('Failed to refresh data:', error);
    showAlert('Failed to refresh data after update', 'warning');
  }
}

// Classify a question as correct/partial/incorrect from the marks the
// grading API already returns (question.marks vs question.max_marks) —
// no new data, just a comparison of two existing fields.
function getMarksStatus(marks, maxMarks) {
  const obtained = parseFloat(marks) || 0;
  const max = parseFloat(maxMarks) || 0;
  if (max <= 0) return 'unscored';
  if (obtained >= max) return 'correct';
  if (obtained <= 0) return 'incorrect';
  return 'partial';
}

function getStatusBadge(status) {
  const badges = {
    correct: { text: '✓ Correct' },
    partial: { text: '~ Partially correct' },
    incorrect: { text: '✕ Needs correction' },
    unscored: { text: '' }
  };
  return badges[status] || badges.unscored;
}

// Function to render content with proper formatting
function renderContent(text) {
  if (!text) return '';
  
  // Handle LaTeX format with sections
  if (text.includes('\\textbf{') && text.includes('}:} \\quad \\text{')) {
    const sections = text.match(/\[ \\textbf\{([^}]+)\}\:} \\quad \\text\{([^}]+)\} \]/g) || [];
    
    if (sections.length > 0) {
      const parsedHtml = sections.map(section => {
        const headingMatch = section.match(/\\textbf\{([^}]+)\}/);
        const contentMatch = section.match(/\\quad \\text\{([^}]+)\}/);
        
        const heading = headingMatch ? escapeHtml(headingMatch[1]) : '';
        let content = contentMatch ? contentMatch[1] : '';
        
        content = content.replace(/\\begin\{itemize\}(.*?)\\end\{itemize\}/gs, (match, items) => {
          const listItems = items.split('\\item').filter(item => item.trim());
          return `<ul>${listItems.map(item => `<li>${escapeHtml(item.trim())}</li>`).join('')}</ul>`;
        });
        
        content = content.replace(/\\([a-zA-Z]+)/g, '\\$1');
        content = content.replace(/\\\(([^)]+)\\\)/g, '$$1$');
        
        return `
          <div class="feedback-section">
            <h4>${heading}:</h4>
            <div class="feedback-content">${content}</div>
          </div>
        `;
      }).join('');
      
      return parsedHtml;
    }
  }
  
  // Process Markdown formatting
  let processedText = escapeHtml(text);
  
  processedText = processedText.replace(/^(\d+)\.\s*\*\*(.*?)\*\*/gm, '<br>$1. <strong>$2</strong>');
  processedText = processedText.replace(/^-\s*\*\*(.*?)\*\*/gm, '<br>- <strong>$1</strong>');
  processedText = processedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  processedText = processedText.replace(/^## (.*?)$/gm, '<br><h2>$1</h2>');
  processedText = processedText.replace(/^### (.*?)$/gm, '<br><h3>$1</h3>');
  
  return processedText;
}

// FIXED: Function to display question details with proper ID mapping
function displayDetails(data) {
  const questionsContainer = document.getElementById("questions-container");

  if (!questionsContainer) {
    console.error("Questions container not found");
    return;
  }

  questionsContainer.innerHTML = "";
  
  // Clear the question index map
  questionIndexMap.clear();

  let result;
  if (data && data.body) {
    try {
      result = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
    } catch (error) {
      console.error("Parse error:", error);
      showAlert("Failed to parse details data", "danger");
      return;
    }
  } else {
    result = data;
  }

  if (!result || !result.details || !Array.isArray(result.details)) {
    console.log("No details available");
    return;
  }

  // FIXED: Create the question ID mapping BEFORE sorting to preserve original indices
  result.details.forEach((question, originalIndex) => {
    const questionId = createQuestionId(question);
    questionIndexMap.set(questionId, originalIndex);
    console.log(`Pre-sort mapping: question ID ${questionId} to original data index ${originalIndex}`);
  });

  // Sort questions by question_number and subpart for display purposes only
  const sortedDetails = [...result.details].sort((a, b) => {
    const numA = parseInt(a.question_number) || 0;
    const numB = parseInt(b.question_number) || 0;
    
    if (numA !== numB) return numA - numB;
    
    if (a.subpart && b.subpart) {
      return a.subpart.localeCompare(b.subpart);
    } else if (a.subpart) {
      return 1;
    } else if (b.subpart) {
      return -1;
    }
    
    return 0;
  });

  // Display the sorted questions
  sortedDetails.forEach((question, displayIndex) => {
    const questionId = createQuestionId(question);
    ensureExtras(questionId, question.marks);

    const questionCard = document.createElement('div');
    const status = getMarksStatus(question.marks, question.max_marks);
    const badge = getStatusBadge(status);
    questionCard.className = `question-item status-${status}`;
    questionCard.id = `q-card-${displayIndex}`;
    questionCard.dataset.qIndex = String(displayIndex);

    let timestamp = '';
    if (question.timestamp) {
      try {
        timestamp = new Date(question.timestamp * 1000).toLocaleString();
      } catch (e) {
        console.error("Invalid timestamp format", e);
        timestamp = '';
      }
    }
    
    questionCard.innerHTML = `
      <div class="question-header">
        <h3>Question ${escapeHtml(question.question_number || '')} ${question.subpart ? `(${escapeHtml(question.subpart)})` : ''}</h3>
        <span class="status-badge status-badge-${status}" id="question-status-${questionId}">${badge.text}</span>
      </div>

      <div class="question-meta">
        <span class="marks">
          Marks:
          <span class="obtained-marks-container">
            <span class="marks-display" id="question-marks-${questionId}">${question.marks || 0}</span>
            <input type="number"
                   class="marks-input"
                   id="question-input-${questionId}"
                   value="${question.marks || 0}"
                   data-max-marks="${question.max_marks || 100}"
                   style="display: none;"
                   min="0"
                   max="${question.max_marks || 100}">
          </span>
          / <span class="max">${question.max_marks || 0}</span>
          <button class="edit-question-marks-btn"
                  onclick="toggleQuestionEditMode('${questionId}')"
                  data-question-id="${questionId}"
                  style="margin-left: 10px; padding: 2px 8px; font-size: 12px;">Edit</button>
        </span>
        <span class="override-diff" id="override-diff-${questionId}" hidden></span>
        ${timestamp ? `<span class="timestamp">Answered on: ${escapeHtml(timestamp)}</span>` : ''}
      </div>

      <p class="question-text">${renderContent(question.question || 'Question not available')}</p>

      <div class="answer-section">
        <div class="answer-section-header">
          <h4>Your Answer:</h4>
          <div class="annotate-toolbar" data-question-id="${questionId}">
            <span class="annotate-toolbar-label">Annotate selection:</span>
            <button type="button" class="annotate-btn" onclick="applyAnnotation('${questionId}','highlight')" title="Highlight selected text"><i class="fas fa-highlighter"></i></button>
            <button type="button" class="annotate-btn" onclick="applyAnnotation('${questionId}','strike')" title="Strike through selected text"><i class="fas fa-strikethrough"></i></button>
            <button type="button" class="annotate-btn" onclick="applyAnnotation('${questionId}','comment')" title="Add a comment on selected text"><i class="fas fa-comment-dots"></i></button>
            <button type="button" class="annotate-btn annotate-btn-clear" onclick="clearAnnotations('${questionId}')" title="Clear all annotations"><i class="fas fa-eraser"></i></button>
          </div>
        </div>
        <pre id="answer-pre-${questionId}">${renderContent(question.student_answer || 'No answer provided')}</pre>
      </div>

      <div class="reasoning-section rubric" id="question-reasoning-${questionId}">
        <button type="button" class="feedback-toggle-btn" aria-expanded="false">
          <span>${status === 'correct' ? 'Feedback' : 'Correction'}</span>
          <span class="feedback-toggle-icon">▾</span>
        </button>
        <div class="feedback-container" hidden>${renderContent(question.feedback || 'No additional reasoning provided')}</div>
      </div>

      <div class="rubric-panel" id="rubric-panel-${questionId}">
        <button type="button" class="rubric-toggle-btn" onclick="toggleRubricPanel('${questionId}')" aria-expanded="false">
          <span>Rubric score</span>
          <span class="feedback-toggle-icon">▾</span>
        </button>
        <div class="rubric-body" id="rubric-body-${questionId}" hidden>
          <div class="rubric-rows" id="rubric-rows-${questionId}"></div>
          <button type="button" class="rubric-add-btn" onclick="addRubricRow('${questionId}')"><i class="fas fa-plus"></i> Add criterion</button>
          <div class="rubric-sum-row">
            <span>Rubric total: <strong id="rubric-sum-${questionId}">0</strong> / ${question.max_marks || 0}</span>
            <button type="button" class="btn btn-secondary rubric-apply-btn" onclick="applyRubricScore('${questionId}')">Apply to score</button>
          </div>
        </div>
      </div>
    `;

    questionsContainer.appendChild(questionCard);
  });

  console.log('Final question index mapping:', questionIndexMap);

  // Horizontal one-question-at-a-time viewer (same pattern as
  // student_grade.js / view_grades.js) — a scroll-snapped row + pill-based
  // question path nav, mirroring the wireframe's "‹ Q3 / Q5 ›" pager.
  setupQuestionPathNav(sortedDetails);

  // Load MathJax if needed
  loadMathJax(questionsContainer);

  // Deep link from the correction worklist (teacher_correction.html) to a
  // specific flagged question: jump to it and expand its Correction +
  // Rubric panels so the teacher lands straight on the item they opened.
  focusRequestedQuestion(sortedDetails);
}

// Jumps to and expands the question named by ?focus_q=&focus_sub= (set by
// teacher_correction.html's worklist "Open ->" links). No-op if those
// params are absent or don't match any rendered question.
function focusRequestedQuestion(sortedDetails) {
  const { focusQuestion, focusSubpart } = getCorrectionUIParams();
  if (!focusQuestion) return;

  const index = sortedDetails.findIndex((q) => {
    const qNum = String(q.question_number);
    const qSub = q.subpart || '';
    return qNum === String(focusQuestion) && qSub === (focusSubpart || '');
  });
  if (index === -1) return;

  goToQuestion(index);

  const question = sortedDetails[index];
  const questionId = createQuestionId(question);
  const reasoningToggle = document.querySelector(`#question-reasoning-${CSS.escape(questionId)} .feedback-toggle-btn`);
  const reasoningPanel = document.getElementById(`question-reasoning-${questionId}`);
  if (reasoningToggle && reasoningPanel) {
    const panel = reasoningPanel.querySelector('.feedback-container');
    if (panel) {
      panel.hidden = false;
      reasoningToggle.setAttribute('aria-expanded', 'true');
    }
  }
}

// ---- Horizontal question-path navigation ----
// currentQuestionIndex starts at -1 ("nothing selected yet") — the
// question-card row stays collapsed until the user clicks a pill, per
// the requested first-view: pill nav only, cards revealed on click.
let currentQuestionIndex = -1;
let totalQuestionsCount = 0;

function setupQuestionPathNav(details) {
  const nav = document.getElementById('q-path-nav');
  const container = document.getElementById('questions-container');
  totalQuestionsCount = details.length;
  currentQuestionIndex = -1;
  if (container) container.classList.add('is-collapsed');
  if (!nav) return;

  const pills = details.map((q, i) => {
    const status = getMarksStatus(q.marks, q.max_marks);
    const label = `Q${escapeHtml(String(q.question_number || i + 1))}${q.subpart ? escapeHtml(q.subpart) : ''}`;
    return `<button type="button" class="q-path-pill status-${status}" data-index="${i}">${label}</button>`;
  }).join('');

  nav.innerHTML = `
    <button type="button" class="q-path-btn q-path-prev" aria-label="Previous question">‹</button>
    <div class="q-path-track">${pills}</div>
    <button type="button" class="q-path-btn q-path-next" aria-label="Next question">›</button>
  `;

  nav.querySelectorAll('.q-path-pill').forEach((pill) => {
    pill.addEventListener('click', () => goToQuestion(parseInt(pill.dataset.index, 10)));
  });
  nav.querySelector('.q-path-prev').addEventListener('click', () => goToQuestion(currentQuestionIndex - 1));
  nav.querySelector('.q-path-next').addEventListener('click', () => goToQuestion(currentQuestionIndex + 1));

  setupQuestionScrollSync(details.length);
  setupFeedbackToggleDelegation();
  updateQuestionPathState();
}

function goToQuestion(index) {
  if (totalQuestionsCount === 0) return;
  const clamped = Math.max(0, Math.min(index, totalQuestionsCount - 1));
  currentQuestionIndex = clamped;
  const container = document.getElementById('questions-container');
  if (container) container.classList.remove('is-collapsed');
  try {
    const target = document.getElementById(`q-card-${clamped}`);
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    }
  } catch (e) {
    console.warn('scrollIntoView failed:', e);
  }
  updateQuestionPathState();
}

// #questions-container is a horizontal flex row of cards laid out side by
// side — even with align-items:flex-start (so a short card no longer
// stretches to the tallest one), the ROW itself is still as tall as its
// tallest child, leaving dead space below whichever (shorter) card is
// actually in view. Pinning the container's height to just the active
// card's own height removes that gap; called whenever the active card
// changes (goToQuestion, swipe scroll-sync) or its content resizes in
// place (feedback toggle, rubric panel, annotations).
function syncQuestionsContainerHeight() {
  const container = document.getElementById('questions-container');
  if (!container || currentQuestionIndex < 0) return;
  const activeCard = document.getElementById(`q-card-${currentQuestionIndex}`);
  if (!activeCard) return;
  container.style.height = `${activeCard.scrollHeight}px`;
}

function updateQuestionPathState() {
  const nav = document.getElementById('q-path-nav');
  const hint = document.getElementById('q-path-hint');
  const nothingSelected = currentQuestionIndex < 0;
  if (nav) {
    nav.querySelectorAll('.q-path-pill').forEach((pill, i) => {
      pill.classList.toggle('active', i === currentQuestionIndex);
    });
    const prevBtn = nav.querySelector('.q-path-prev');
    const nextBtn = nav.querySelector('.q-path-next');
    if (prevBtn) prevBtn.disabled = nothingSelected || currentQuestionIndex <= 0;
    if (nextBtn) nextBtn.disabled = nothingSelected || currentQuestionIndex >= totalQuestionsCount - 1;
  }
  if (hint) hint.style.display = nothingSelected ? '' : 'none';
  const countEl = document.getElementById('q-count');
  if (countEl) {
    countEl.textContent = (totalQuestionsCount && !nothingSelected)
      ? `Question ${currentQuestionIndex + 1} of ${totalQuestionsCount}`
      : '';
  }
  syncQuestionsContainerHeight();
}

function setupFeedbackToggleDelegation() {
  const container = document.getElementById('questions-container');
  if (!container || container.dataset.feedbackToggleBound === 'true') return;
  container.dataset.feedbackToggleBound = 'true';
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.feedback-toggle-btn');
    if (!btn) return;
    const panel = btn.nextElementSibling;
    if (!panel || !panel.classList.contains('feedback-container')) return;
    const isOpen = !panel.hidden;
    panel.hidden = isOpen;
    btn.setAttribute('aria-expanded', String(!isOpen));
    syncQuestionsContainerHeight();
  });
}

function setupQuestionScrollSync(count) {
  const container = document.getElementById('questions-container');
  if (!container || !window.IntersectionObserver) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
        const idx = parseInt(entry.target.dataset.qIndex, 10);
        if (!isNaN(idx)) {
          currentQuestionIndex = idx;
          updateQuestionPathState();
        }
      }
    });
  }, { root: container, threshold: 0.6 });
  for (let i = 0; i < count; i++) {
    const el = document.getElementById(`q-card-${i}`);
    if (el) observer.observe(el);
  }
}

// Updates the pill's status color to match a corrected mark, keyed off the
// question card's data-question-id (set when the card was built above).
function updateQuestionPathPillStatus(questionId, newStatus) {
  // Looked up via the status-badge's id (unique per question) rather than
  // a data-question-id on the card, since .edit-question-marks-btn already
  // owns that attribute for toggleQuestionEditMode's own lookup — reusing
  // it on the card would make querySelector('[data-question-id=...]')
  // ambiguous between the card and the button.
  const statusBadge = document.getElementById(`question-status-${questionId}`);
  const card = statusBadge ? statusBadge.closest('.question-item') : null;
  const nav = document.getElementById('q-path-nav');
  if (!card || !nav) return;
  const pill = nav.querySelector(`.q-path-pill[data-index="${card.dataset.qIndex}"]`);
  if (pill) {
    pill.classList.remove('status-correct', 'status-partial', 'status-incorrect');
    pill.classList.add(`status-${newStatus}`);
  }
}

function loadMathJax(container) {
  if (!window.MathJax) {
    window.MathJax = {
      tex: {
        inlineMath: [['$', '$'], ['\\(', '\\)']],
        processEscapes: true
      },
      options: {
        enableMenu: false,
        processHtmlClass: 'math'
      }
    };
    
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.0/es5/tex-mml-chtml.js';
    script.async = true;
    document.head.appendChild(script);
    
    script.onload = function() {
      if (window.MathJax && window.MathJax.typeset) {
        window.MathJax.typeset([container]);
      }
    };
  } else {
    if (window.MathJax && window.MathJax.typeset) {
      window.MathJax.typeset([container]);
    }
  }
}

function setupNavLinkHighlighting() {
  console.log('Navigation highlighting setup');
}

// Toggles a read-only "what the student sees" preview: the question/answer/
// marks/correction markup is identical to the teacher's editing view (same
// data, same status-* classes) — this just hides the teacher-only edit
// controls (Edit buttons, Actions column, Update Marks button) via CSS.
function toggleStudentPreview() {
  const toggleBtn = document.getElementById('preview-toggle-btn');
  const banner = document.getElementById('preview-banner');
  if (!toggleBtn) return;

  const isPreview = document.body.classList.toggle('student-preview-mode');
  toggleBtn.innerHTML = isPreview
    ? '<i class="fas fa-pen"></i> Back to Editing'
    : '<i class="fas fa-eye"></i> Preview as Student';
  if (banner) {
    banner.style.display = isPreview ? 'flex' : 'none';
  }
}

// ---- Correction workspace: AI-vs-override diff, rubric scoring, annotation ----
// (wireframe §16 "Teacher — Manual Grading & Correction" steps 2-4, folded
// into this existing per-student page rather than a separate PDF-style
// annotator, since the underlying data model here is question/answer text,
// not scanned pages.)

// Creates (once) the per-question extras record used by the diff/rubric/
// annotation features below. `initialMarks` becomes the "AI mark" baseline
// the first time a question is rendered; re-renders (e.g. after
// refreshStudentData()) don't reset an already-known baseline.
function ensureExtras(questionId, initialMarks) {
  if (!questionExtras.has(questionId)) {
    questionExtras.set(questionId, {
      aiMarks: parseFloat(initialMarks) || 0,
      rubric: [],
      annotations: [],
      originalAnswerHtml: null // captured lazily on first annotation, see applyAnnotation
    });
  }
  return questionExtras.get(questionId);
}

// Shows/hides the "AI: X -> Override: Y" chip next to a question's marks
// whenever the teacher's saved value differs from the AI baseline captured
// in ensureExtras(). Mirrors the wireframe's M-Rubric "AI mark -> Your
// override" pair.
function updateOverrideDiff(questionId, newValue) {
  const chip = document.getElementById(`override-diff-${questionId}`);
  const extras = questionExtras.get(questionId);
  if (!chip || !extras) return;
  if (newValue === extras.aiMarks) {
    chip.hidden = true;
    chip.textContent = '';
    return;
  }
  chip.hidden = false;
  chip.textContent = `AI: ${extras.aiMarks} → Override: ${newValue}`;
}

// ---- Rubric scoring (wireframe M-Rubric) ----
// Ad-hoc, teacher-defined criteria (no rubric data model exists on the
// backend yet — see the TODO near questionExtras above) that sum to an
// override total, applied to the question via the same commitQuestionMarks
// path the inline Edit/Save button uses.

function toggleRubricPanel(questionId) {
  const body = document.getElementById(`rubric-body-${questionId}`);
  const btn = document.querySelector(`#rubric-panel-${CSS.escape(questionId)} .rubric-toggle-btn`);
  if (!body || !btn) return;
  const isOpen = !body.hidden;
  body.hidden = isOpen;
  btn.setAttribute('aria-expanded', String(!isOpen));
  if (!isOpen && questionExtras.get(questionId)?.rubric.length === 0) {
    addRubricRow(questionId);
  }
  syncQuestionsContainerHeight();
}

function addRubricRow(questionId) {
  const extras = questionExtras.get(questionId);
  if (!extras) return;
  extras.rubric.push({ name: '', points: 0 });
  renderRubricRows(questionId);
}

function removeRubricRow(questionId, rowIndex) {
  const extras = questionExtras.get(questionId);
  if (!extras) return;
  extras.rubric.splice(rowIndex, 1);
  renderRubricRows(questionId);
}

function updateRubricRow(questionId, rowIndex, field, value) {
  const extras = questionExtras.get(questionId);
  if (!extras || !extras.rubric[rowIndex]) return;
  extras.rubric[rowIndex][field] = field === 'points' ? (parseFloat(value) || 0) : value;
  renderRubricRows(questionId, /* rebuildInputs */ false);
}

function renderRubricRows(questionId, rebuildInputs = true) {
  const extras = questionExtras.get(questionId);
  const rowsEl = document.getElementById(`rubric-rows-${questionId}`);
  const sumEl = document.getElementById(`rubric-sum-${questionId}`);
  if (!extras || !rowsEl) return;

  if (rebuildInputs) {
    rowsEl.innerHTML = extras.rubric.map((row, i) => `
      <div class="rubric-row">
        <input type="text" class="rubric-row-name" placeholder="Criterion (e.g. Correct method)"
               value="${escapeHtml(row.name)}"
               oninput="updateRubricRow('${questionId}', ${i}, 'name', this.value)">
        <input type="number" class="rubric-row-points" min="0" step="0.5" placeholder="pts"
               value="${row.points}"
               oninput="updateRubricRow('${questionId}', ${i}, 'points', this.value)">
        <button type="button" class="rubric-row-remove" onclick="removeRubricRow('${questionId}', ${i})" aria-label="Remove criterion">&times;</button>
      </div>
    `).join('') || '<p class="rubric-empty">No criteria yet — add one below.</p>';
  }

  const sum = extras.rubric.reduce((total, row) => total + (parseFloat(row.points) || 0), 0);
  if (sumEl) sumEl.textContent = sum;

  if (rebuildInputs) syncQuestionsContainerHeight();
}

function applyRubricScore(questionId) {
  const extras = questionExtras.get(questionId);
  const marksInput = document.getElementById(`question-input-${questionId}`);
  if (!extras || !marksInput) return;

  const maxMarks = parseFloat(marksInput.getAttribute('data-max-marks')) || 100;
  const sum = extras.rubric.reduce((total, row) => total + (parseFloat(row.points) || 0), 0);
  const clamped = Math.max(0, Math.min(sum, maxMarks));

  if (sum > maxMarks) {
    showAlert(`Rubric total (${sum}) exceeds this question's max marks (${maxMarks}) — applied as ${clamped}.`, 'warning');
  }

  const marksDisplay = document.getElementById(`question-marks-${questionId}`);
  if (marksDisplay) marksDisplay.textContent = clamped;
  marksInput.value = clamped;
  commitQuestionMarks(questionId, clamped, maxMarks);
  showAlert('Rubric score applied to this question.', 'success');
}

// ---- Answer annotation (wireframe M-Annotate) ----
// Operates on the current text selection inside this question's answer
// <pre>. Uses Range.surroundContents, which requires the selection to sit
// inside a single element — fine for the plain-text answers this data
// model returns; a selection spanning multiple existing annotation spans
// will fail gracefully with a warning rather than corrupt the DOM.

function getSelectionWithinAnswer(questionId) {
  const pre = document.getElementById(`answer-pre-${questionId}`);
  const selection = window.getSelection();
  if (!pre || !selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!pre.contains(range.commonAncestorContainer)) return null;
  return { pre, selection, range };
}

function applyAnnotation(questionId, type) {
  const target = getSelectionWithinAnswer(questionId);
  if (!target) {
    showAlert('Select some text inside the answer first, then choose an annotation.', 'warning');
    return;
  }
  const extras = ensureExtras(questionId, 0);
  // Capture the pristine answer HTML once, before the first annotation, so
  // clearAnnotations() can restore it exactly.
  if (extras.originalAnswerHtml === null) {
    extras.originalAnswerHtml = target.pre.innerHTML;
  }

  const { range, selection } = target;
  const text = range.toString();
  let comment = '';
  if (type === 'comment') {
    comment = window.prompt('Comment on the selected text:', '') || '';
    if (!comment.trim()) return;
  }

  const wrapper = document.createElement(type === 'strike' ? 'del' : type === 'comment' ? 'span' : 'mark');
  wrapper.className = type === 'highlight' ? 'annotation-highlight'
    : type === 'strike' ? 'annotation-strike'
    : 'annotation-comment';
  if (comment) wrapper.title = comment;

  try {
    range.surroundContents(wrapper);
  } catch (e) {
    console.warn('Annotation failed — selection spans multiple elements:', e);
    showAlert('Could not annotate that selection — try selecting text within a single line.', 'warning');
    return;
  }
  selection.removeAllRanges();

  extras.annotations.push({ type, text, comment: comment || undefined });
}

function clearAnnotations(questionId) {
  const extras = questionExtras.get(questionId);
  const pre = document.getElementById(`answer-pre-${questionId}`);
  if (!extras || !pre) return;
  if (extras.originalAnswerHtml !== null) {
    pre.innerHTML = extras.originalAnswerHtml;
  }
  extras.annotations = [];
}

async function loadAndDisplayData() {
  const queryParams = getQueryParams();

  if (!queryParams.student_id || !queryParams.assignment_id) {
    showAlert("Missing required parameters: student_id or assignment_id", "danger");
    return;
  }

  showLoading("student-loader-container");
  renderBackToWorklistLink();

  try {
    const data = await makeAPIRequest(queryParams);
    console.log('Data loaded:', data);
    if (!data || !data.body) {
      showAlert("No data returned from server", "warning");
      return;
    }
    displayStudentSummary(data);
    displayDetails(data);
  } catch (error) {
    console.error("Error loading data:", error);
    showAlert(`Failed to load data: ${error.message}`, "danger");
  } finally {
    hideLoading("student-loader-container");
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log('DOM Content Loaded - Initializing application...');
  setupNavLinkHighlighting();
  loadAndDisplayData();
});

// Also add a fallback initialization in case DOMContentLoaded has already fired
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

function initializeApp() {
  console.log('Initializing application...');
  setupNavLinkHighlighting();
  loadAndDisplayData();
}