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

async function makeAPIRequest(data) {
  try {
    const response = await fetch(CONFIG.API.GRADES_ENDPOINT, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(data),
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

function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    student_id: params.get("student_id"),
    assignment_id: params.get("assignment_id"),
    qp_id: params.get("qp_id"),
    operation: "getSingleStudentGrade"
  };
}

// Store original data for updates
let currentStudentData = null;
// Store question mapping for consistent indexing - THIS IS THE KEY FIX
let questionIndexMap = new Map();

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
      <td>
        <button class="edit-marks-btn" onclick="toggleSummaryEditMode(${index})" data-index="${index}">Edit</button>
      </td>
    `;
    summaryBody.appendChild(row);
  });
  
  studentResultContainer.style.display = "block";
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
        const match = qNum === questionNumber && qSubpart === subpart;
        console.log(`Comparing: data[${currentStudentData.details.indexOf(q)}] q${qNum}_${qSubpart || 'main'} vs target q${questionNumber}_${subpart || 'main'} = ${match}`);
        return match;
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
    
    // Prepare the details array with proper serialization and sorting
    let serializedDetails = [];
    if (currentStudentData.details && Array.isArray(currentStudentData.details)) {
      // Sort details by question_number first, then by subpart (nulls last, then alphabetically)
      serializedDetails = currentStudentData.details
        .map(question => ({
          question_number: question.question_number,
          subpart: question.subpart || null,
          marks: question.marks,
          max_marks: question.max_marks,
          timestamp: question.timestamp,
          evaluation_id: question.evaluation_id
        }))
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
    
    // Prepare the data for API call with proper structure
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
    const response = await fetch(CONFIG.API.UPDATE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
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
    const data = await makeAPIRequest(queryParams);
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
  sortedDetails.forEach((question) => {
    const questionId = createQuestionId(question);
    
    const questionCard = document.createElement('div');
    questionCard.className = 'question-item';
    
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
        ${timestamp ? `<span class="timestamp">Answered on: ${escapeHtml(timestamp)}</span>` : ''}
      </div>

      <p class="question-text">${renderContent(question.question || 'Question not available')}</p>

      <div class="answer-section">
        <h4>Your Answer:</h4>
        <pre>${renderContent(question.student_answer || 'No answer provided')}</pre>
      </div>

      <div class="reasoning-section rubric">
        <h4>Feedback:</h4>
        <div class="feedback-container">${renderContent(question.feedback || 'No additional reasoning provided')}</div>
      </div>
    `;

    questionsContainer.appendChild(questionCard);
  });

  console.log('Final question index mapping:', questionIndexMap);

  // Load MathJax if needed
  loadMathJax(questionsContainer);
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

async function loadAndDisplayData() {
  const queryParams = getQueryParams();
  
  if (!queryParams.student_id || !queryParams.assignment_id) {
    showAlert("Missing required parameters: student_id or assignment_id", "danger");
    return;
  }

  showLoading("student-loader-container");

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