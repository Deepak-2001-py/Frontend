/**
 * Student Grade Management System
 * Handles display and editing of student grades with real-time updates
 */

// Configuration
const CONFIG = {
  API: {
    GRADES_ENDPOINT: "https://rus9nultj9.execute-api.eu-north-1.amazonaws.com/dev/getgrades",
    UPDATE_ENDPOINT: "https://rus9nultj9.execute-api.eu-north-1.amazonaws.com/dev/updatedb"
  }
};

// Global state
let currentStudentData = null;

/**
 * UTILITY FUNCTIONS
 */

// Show/hide loading indicators
function showLoading(id) {
  const element = document.getElementById(id);
  if (element) element.style.display = "block";
}

function hideLoading(id) {
  const element = document.getElementById(id);
  if (element) element.style.display = "none";
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (typeof text !== 'string') return text;
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Get URL parameters
function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    student_id: params.get("student_id"),
    assignment_id: params.get("assignment_id"),
    qp_id: params.get("qp_id"),
    operation: "getSingleStudentGrade"
  };
}

/**
 * ALERT SYSTEM
 */

function showAlert(message, type = 'info') {
  // Remove existing alert
  const existingAlert = document.querySelector('.custom-alert');
  if (existingAlert) existingAlert.remove();

  const alert = document.createElement('div');
  alert.className = `custom-alert alert-${type}`;
  
  // Alert colors
  const colors = {
    danger: { bg: '#f8d7da', text: '#721c24', border: '#f5c6cb' },
    warning: { bg: '#fff3cd', text: '#856404', border: '#ffeaa7' },
    success: { bg: '#d4edda', text: '#155724', border: '#c3e6cb' },
    info: { bg: '#d1ecf1', text: '#0c5460', border: '#bee5eb' }
  };
  
  const color = colors[type] || colors.info;
  
  alert.innerHTML = `
    <span>${escapeHtml(message)}</span>
    <button class="alert-close" onclick="this.parentElement.remove()">×</button>
  `;
  
  // Apply styling
  alert.style.cssText = `
    padding: 12px 20px;
    margin: 10px 0;
    border-radius: 6px;
    position: relative;
    font-size: 14px;
    background-color: ${color.bg};
    color: ${color.text};
    border: 1px solid ${color.border};
    z-index: 1000;
  `;
  
  // Style close button
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
  
  // Insert into DOM
  const container = document.getElementById('student-result') || document.body;
  container.insertBefore(alert, container.firstChild);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (alert.parentElement) alert.remove();
  }, 5000);
}

/**
 * API FUNCTIONS
 */

async function makeAPIRequest(data) {
  try {
    const response = await fetch(CONFIG.API.GRADES_ENDPOINT, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("API request failed:", error);
    throw error;
  }
}

async function updateMarksAPI(data) {
  console.log('Making API call to update marks...', data);
  
  try {
    const response = await fetch(CONFIG.API.UPDATE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Network error: Please check your internet connection and try again.');
    }
    
    throw error;
  }
}

/**
 * DATA PROCESSING FUNCTIONS
 */

function parseResponseData(data) {
  if (!data) return null;
  
  if (data.body) {
    try {
      return typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
    } catch (error) {
      console.error("Parse error:", error);
      throw new Error("Failed to parse response data");
    }
  }
  
  return data;
}

function calculateTotalMarks() {
  if (!currentStudentData?.details) return 0;
  
  return currentStudentData.details.reduce((total, question) => {
    return total + (parseFloat(question.marks) || 0);
  }, 0);
}

function updateSummaryTotalMarks() {
  const newTotalMarks = calculateTotalMarks();
  
  // Update stored data
  if (currentStudentData?.summary?.[0]) {
    currentStudentData.summary[0].total_marks = newTotalMarks;
  }
  
  // Update UI elements
  const summaryMarksDisplay = document.getElementById('summary-marks-0');
  const summaryMarksInput = document.getElementById('summary-input-0');
  
  if (summaryMarksDisplay) summaryMarksDisplay.textContent = newTotalMarks;
  if (summaryMarksInput) summaryMarksInput.value = newTotalMarks;
  
  showAlert(`Total marks automatically updated to ${newTotalMarks}`, "success");
}

/**
 * UI RENDERING FUNCTIONS
 */

function displayStudentSummary(data) {
  const summaryBody = document.getElementById("summary-body");
  const studentResultContainer = document.getElementById("student-result");

  if (!summaryBody || !studentResultContainer) {
    console.error("Required DOM elements not found");
    return;
  }

  summaryBody.innerHTML = "";

  const result = parseResponseData(data);
  if (!result?.summary || !Array.isArray(result.summary)) {
    showAlert("No summary data available", "warning");
    return;
  }

  // Store current data
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
        <span class="marks-display" id="summary-marks-${index}">
          ${grade.total_marks !== undefined && grade.total_marks !== null ? grade.total_marks : "N/A"}
        </span>
        <input type="number" 
               class="marks-input" 
               id="summary-input-${index}" 
               value="${grade.total_marks || 0}" 
               style="display: none;" 
               min="0" 
               max="100">
      </td>
      <td>${escapeHtml(grade.evaluation_id || "N/A")}</td>
      <td>${escapeHtml(grade.qp_id || "N/A")}</td>
      <td>${escapeHtml(dateStr)}</td>
      <td>
        <button class="edit-marks-btn" 
                onclick="toggleSummaryEditMode(${index})" 
                data-index="${index}">Edit</button>
      </td>
    `;
    summaryBody.appendChild(row);
  });
  
  studentResultContainer.style.display = "block";
}

function displayDetails(data) {
  const questionsContainer = document.getElementById("questions-container");
  if (!questionsContainer) {
    console.error("Questions container not found");
    return;
  }

  questionsContainer.innerHTML = "";

  const result = parseResponseData(data);
  if (!result?.details || !Array.isArray(result.details)) {
    console.log("No details available");
    return;
  }

  // Sort questions by question number and subpart
  const sortedQuestions = result.details.sort((a, b) => {
    const numA = parseInt(a.question_number) || 0;
    const numB = parseInt(b.question_number) || 0;
    
    if (numA !== numB) return numA - numB;
    
    if (a.subpart && b.subpart) return a.subpart.localeCompare(b.subpart);
    if (a.subpart) return 1;
    if (b.subpart) return -1;
    return 0;
  });

  sortedQuestions.forEach((question, questionIndex) => {
    const questionCard = createQuestionCard(question, questionIndex);
    questionsContainer.appendChild(questionCard);
  });

  loadMathJax(questionsContainer);
}

function createQuestionCard(question, questionIndex) {
  const questionCard = document.createElement('div');
  questionCard.className = 'question-item';
  
  const timestamp = question.timestamp 
    ? new Date(question.timestamp * 1000).toLocaleString()
    : '';
  
  questionCard.innerHTML = `
    <div class="question-header">
      <h3>Question ${escapeHtml(question.question_number || '')} 
          ${question.subpart ? `(${escapeHtml(question.subpart)})` : ''}</h3>
    </div>
    
    <div class="question-meta">
      <span class="marks">
        Marks: 
        <span class="obtained-marks-container">
          <span class="marks-display" id="question-marks-${questionIndex}">
            ${question.marks || 0}
          </span>
          <input type="number" 
                 class="marks-input" 
                 id="question-input-${questionIndex}" 
                 value="${question.marks || 0}" 
                 data-max-marks="${question.max_marks || 100}"
                 style="display: none;" 
                 min="0" 
                 max="${question.max_marks || 100}">
        </span>
        / <span class="max">${question.max_marks || 0}</span>
        <button class="edit-question-marks-btn" 
                onclick="toggleQuestionEditMode(${questionIndex})" 
                data-question-index="${questionIndex}"
                style="margin-left: 10px; padding: 2px 8px; font-size: 12px;">Edit</button>
      </span>
      ${timestamp ? `<span class="timestamp">Answered on: ${escapeHtml(timestamp)}</span>` : ''}
    </div>

    <p class="question-text">${renderContent(question.question || 'Question not available')}</p>

    <div class="answer-section">
      <h4>Your Answer:</h4>
      <pre>${renderContent(question.student_answer || 'No answer provided')}</pre>
    </div>

    <div class="reasoning-section rubric">
      <h4>Feedback:</h4>
      <div class="feedback-container">${renderContent(question.feedback || 'No feedback provided')}</div>
    </div>
  `;

  return questionCard;
}

/**
 * CONTENT RENDERING
 */

function renderContent(text) {
  if (!text) return '';
  
  // Handle LaTeX format with sections
  if (text.includes('\\textbf{') && text.includes('}:} \\quad \\text{')) {
    return renderLatexContent(text);
  }
  
  // Process Markdown formatting
  return renderMarkdownContent(text);
}

function renderLatexContent(text) {
  const sections = text.match(/\[ \\textbf\{([^}]+)\}\:} \\quad \\text\{([^}]+)\} \]/g) || [];
  
  if (sections.length === 0) return escapeHtml(text);
  
  return sections.map(section => {
    const headingMatch = section.match(/\\textbf\{([^}]+)\}/);
    const contentMatch = section.match(/\\quad \\text\{([^}]+)\}/);
    
    const heading = headingMatch ? escapeHtml(headingMatch[1]) : '';
    let content = contentMatch ? contentMatch[1] : '';
    
    // Process itemized lists
    content = content.replace(/\\begin\{itemize\}(.*?)\\end\{itemize\}/gs, (match, items) => {
      const listItems = items.split('\\item').filter(item => item.trim());
      return `<ul>${listItems.map(item => `<li>${escapeHtml(item.trim())}</li>`).join('')}</ul>`;
    });
    
    // Process LaTeX commands
    content = content.replace(/\\([a-zA-Z]+)/g, '\\$1');
    content = content.replace(/\\\(([^)]+)\\\)/g, '$$1$');
    
    return `
      <div class="feedback-section">
        <h4>${heading}:</h4>
        <div class="feedback-content">${content}</div>
      </div>
    `;
  }).join('');
}

function renderMarkdownContent(text) {
  let processedText = escapeHtml(text);
  
  // Process various markdown elements
  processedText = processedText.replace(/^(\d+)\.\s*\*\*(.*?)\*\*/gm, '<br>$1. <strong>$2</strong>');
  processedText = processedText.replace(/^-\s*\*\*(.*?)\*\*/gm, '<br>- <strong>$1</strong>');
  processedText = processedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  processedText = processedText.replace(/^## (.*?)$/gm, '<br><h2>$1</h2>');
  processedText = processedText.replace(/^### (.*?)$/gm, '<br><h3>$1</h3>');
  
  return processedText;
}

/**
 * EDIT MODE FUNCTIONS
 */

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
    // Save and switch back to display mode
    const newValue = parseFloat(marksInput.value) || 0;
    marksDisplay.textContent = newValue;
    marksDisplay.style.display = "inline";
    marksInput.style.display = "none";
    editBtn.textContent = "Edit";
    editBtn.classList.remove("save-mode");
    
    // Update stored data
    if (currentStudentData?.summary?.[index]) {
      currentStudentData.summary[index].total_marks = newValue;
    }
  }
}

function toggleQuestionEditMode(questionIndex) {
  const marksDisplay = document.getElementById(`question-marks-${questionIndex}`);
  const marksInput = document.getElementById(`question-input-${questionIndex}`);
  const editBtn = document.querySelector(`[data-question-index="${questionIndex}"]`);
  
  if (!marksDisplay || !marksInput || !editBtn) {
    console.error("Question edit elements not found");
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
    // Validate and save
    const newValue = parseFloat(marksInput.value) || 0;
    const maxMarks = parseFloat(marksInput.getAttribute('data-max-marks')) || 100;
    
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
    
    // Update UI
    marksDisplay.textContent = newValue;
    marksDisplay.style.display = "inline";
    marksInput.style.display = "none";
    editBtn.textContent = "Edit";
    editBtn.classList.remove("save-mode");
    
    // Update stored data and recalculate total
    if (currentStudentData?.details?.[questionIndex]) {
      currentStudentData.details[questionIndex].marks = newValue;
      updateSummaryTotalMarks();
    }
  }
}

/**
 * UPDATE FUNCTIONS
 */

async function handleUpdateMarks() {
  console.log('Update marks function called');

  if (!currentStudentData?.summary) {
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

    // Prepare update data
    const updatedData = {
      operation: "updateMarks",
      summary: currentStudentData.summary.map(grade => ({
        student_id: grade.student_id,
        assignment_id: grade.assignment_id,
        evaluation_id: grade.evaluation_id,
        qp_id: grade.qp_id,
        total_marks: grade.total_marks,
        timestamp: grade.timestamp
      })),
      details: currentStudentData.details ? currentStudentData.details.map(question => ({
        question_number: question.question_number,
        subpart: question.subpart,
        marks: question.marks,
        max_marks: question.max_marks,
        timestamp: question.timestamp,
        evaluation_id: question.evaluation_id
      })) : []
    };

    const response = await updateMarksAPI(updatedData);
    
    if (response && (response.success || response.statusCode === 200)) {
      showAlert("All marks updated successfully!", "success");
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

async function refreshStudentData() {
  try {
    const queryParams = getQueryParams();
    const data = await makeAPIRequest(queryParams);
    displayStudentSummary(data);
    displayDetails(data);
  } catch (error) {
    console.error('Failed to refresh data:', error);
    showAlert('Failed to refresh data after update', 'warning');
  }
}

/**
 * MATHJAX LOADING
 */

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
    
    script.onload = () => {
      if (window.MathJax?.typeset) {
        window.MathJax.typeset([container]);
      }
    };
  } else {
    if (window.MathJax?.typeset) {
      window.MathJax.typeset([container]);
    }
  }
}

/**
 * INITIALIZATION
 */

async function loadAndDisplayData() {
  const queryParams = getQueryParams();
  
  if (!queryParams.student_id || !queryParams.assignment_id) {
    showAlert("Missing required parameters: student_id or assignment_id", "danger");
    return;
  }

  showLoading("student-loader-container");

  try {
    const data = await makeAPIRequest(queryParams);
    displayStudentSummary(data);
    displayDetails(data);
  } catch (error) {
    console.error("Error loading data:", error);
    showAlert(`Failed to load data: ${error.message}`, "danger");
  } finally {
    hideLoading("student-loader-container");
  }
}

function initializeApp() {
  console.log('Initializing Student Grade Management System...');
  loadAndDisplayData();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}