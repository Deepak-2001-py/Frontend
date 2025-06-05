document.addEventListener("DOMContentLoaded", function () {
  // Configuration
  const CONFIG = {
    API: {
      GRADES_ENDPOINT:
        "https://rus9nultj9.execute-api.eu-north-1.amazonaws.com/dev/getgrades",
    },
    UPLOAD: {
      MAX_FILE_SIZE_MB: 10,
      ALLOWED_FILE_TYPES: ["application/pdf"],
      TIMEOUT_MS: 60000,
      MAX_RETRIES: 2,
      RETRY_DELAY_MS: 2000,
    },
    UI: {
      ALERT_TIMEOUT_MS: 5000,
      PROGRESS_HIDE_DELAY_MS: 3000,
    },
  };

  // Utility Functions
  const Utils = {
    generateUUID() {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
        /[xy]/g,
        function (c) {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        }
      );
    },

    formatFileSize(bytes) {
      if (bytes < 1024) return `${bytes} bytes`;
      if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / 1048576).toFixed(1)} MB`;
    },

    sanitizeHTML(str) {
      const temp = document.createElement("div");
      temp.textContent = str;
      return temp.innerHTML;
    },
  };

  // UI Manager for notifications and progress indication
  const UIManager = {
    showAlert(message, type = "info") {
      const alertsContainer = document.getElementById("alerts-container");
      if (!alertsContainer) {
        console.error("Alerts container not found");
        return;
      }

      const alert = document.createElement("div");
      alert.className = `alert alert-${type}`;
      alert.innerHTML = Utils.sanitizeHTML(message);

      const closeBtn = document.createElement("button");
      closeBtn.className = "close-btn";
      closeBtn.innerHTML = "&times;";
      closeBtn.addEventListener("click", () => alert.remove());

      alert.appendChild(closeBtn);
      alertsContainer.appendChild(alert);

      setTimeout(() => {
        alert.classList.add("fade-out");
        setTimeout(() => alert.remove(), 500);
      }, CONFIG.UI.ALERT_TIMEOUT_MS);
    },

    showProgress(message, progress = 0) {
      const progressContainer = document.getElementById("progress-container");
      if (!progressContainer) {
        console.error("Progress container not found");
        return;
      }

      progressContainer.style.display = "block";

      const progressBar = document.getElementById("progress-bar");
      const progressText = document.getElementById("progress-text");

      if (progressBar) progressBar.style.width = `${progress}%`;
      if (progressText) progressText.textContent = message;

      if (progress === 100) {
        setTimeout(() => {
          progressContainer.style.display = "none";
        }, CONFIG.UI.PROGRESS_HIDE_DELAY_MS);
      }
    },

    hideProgress() {
      const progressContainer = document.getElementById("progress-container");
      if (progressContainer) {
        progressContainer.style.display = "none";
      }
    },
  };

  // Unified Tab Management System
  const TabManager = {
    // Initialize all tab systems
    init() {
      // Primary Navigation Tabs
      this.setupTabSystem(".primary-nav .tab-btn", "primary-nav");
    },

    // Generic tab setup method
    setupTabSystem(tabSelector, navType) {
      const tabButtons = document.querySelectorAll(tabSelector);

      tabButtons.forEach((tab) => {
        tab.addEventListener("click", () => {
          this.switchTab(tabButtons, tab, navType);
        });
      });

      // Setup initial state
      this.setupInitialState(tabButtons, navType);
    },

    // Setup initial tab state
    setupInitialState(tabs, navType) {
      const activeTab = Array.from(tabs).find((tab) =>
        tab.classList.contains("active")
      );

      if (activeTab) {
        const targetId = activeTab.getAttribute("data-tab");
        const contentSections = this.getContentSections(navType);

        // Hide all sections
        contentSections.forEach((section) => {
          section.classList.remove("active");
          section.setAttribute("aria-hidden", "true");
          section.style.display = "none";
        });

        // Show initial active section
        const initialSection = document.getElementById(targetId);
        if (initialSection) {
          initialSection.classList.add("active");
          initialSection.setAttribute("aria-hidden", "false");
          initialSection.style.display = "block";
        }
      }
    },

    // Switch between tabs
    switchTab(tabGroup, selectedTab, navType) {
      const targetId = selectedTab.getAttribute("data-tab");

      // Reset all tabs in this group
      tabGroup.forEach((tab) => {
        tab.classList.remove("active");
        tab.setAttribute("aria-selected", "false");
      });

      // Activate selected tab
      selectedTab.classList.add("active");
      selectedTab.setAttribute("aria-selected", "true");

      // Get content sections for this navigation type
      const contentSections = this.getContentSections(navType);

      // Hide all sections
      contentSections.forEach((section) => {
        section.classList.remove("active");
        section.setAttribute("aria-hidden", "true");
        section.style.display = "none";
      });

      // Show target section
      const targetSection = document.getElementById(targetId);
      if (targetSection) {
        targetSection.classList.add("active");
        targetSection.setAttribute("aria-hidden", "false");
        targetSection.style.display = "block";
      }
    },

    // Get content sections based on navigation type
    getContentSections(navType) {
      switch (navType) {
        case "primary-nav":
          return document.querySelectorAll(
            ".main-content > .container > .tab-content"
          );
        default:
          return [];
      }
    },
  };

  // Initialize Tab Manager
  TabManager.init();

// ---------- Grades Functionality ----------
const studentViewBtn = document.getElementById("student-view-btn");
const teacherViewBtn = document.getElementById("teacher-view-btn");
const studentView = document.getElementById("student-view");
const teacherView = document.getElementById("teacher-view");

// Ensure teacher view is visible by default
studentView.style.display = "none";
teacherView.style.display = "block";

// Set initial ARIA attributes
studentViewBtn.setAttribute("aria-selected", "false");
teacherViewBtn.setAttribute("aria-selected", "true");

// Optional: set initial "active" class
studentViewBtn.classList.remove("active");
teacherViewBtn.classList.add("active");

studentViewBtn.addEventListener("click", function () {
  studentView.style.display = "block";
  teacherView.style.display = "none";

  studentViewBtn.classList.add("active");
  teacherViewBtn.classList.remove("active");

  studentViewBtn.setAttribute("aria-selected", "true");
  teacherViewBtn.setAttribute("aria-selected", "false");
});

teacherViewBtn.addEventListener("click", function () {
  studentView.style.display = "none";
  teacherView.style.display = "block";

  teacherViewBtn.classList.add("active");
  studentViewBtn.classList.remove("active");

  teacherViewBtn.setAttribute("aria-selected", "true");
  studentViewBtn.setAttribute("aria-selected", "false");
});

  // ---------- Grades Functionality ----------

  // Student Grade Form (Student View)
  document
    .getElementById("student-grade-form")
    .addEventListener("submit", function (event) {
      event.preventDefault();
      const studentId = document.getElementById("student-id").value.trim();
      const assignmentId = document
        .getElementById("assignment-id-student")
        .value.trim();
      if (!studentId || !assignmentId) {
        UIManager.showAlert(
          "Please fill in all required fields in student view",
          "danger"
        );
        return;
      }
      fetchStudentGrades(studentId, assignmentId);
    });

  // Teacher Grade Form (Teacher View)
  document
    .getElementById("teacher-grade-form")
    .addEventListener("submit", function (event) {
      event.preventDefault();
      const qpId = document.getElementById("qp-id").value.trim();
      const assignmentId = document
        .getElementById("assignment-id-teacher")
        .value.trim();
      if (!qpId || !assignmentId) {
        UIManager.showAlert(
          "Please fill in all required fields in teacher view",
          "danger"
        );
        return;
      }
      fetchAllStudentGrades(qpId, assignmentId);
    });

  // Utility for API requests using the configured GRADES endpoint
  async function makeAPIRequest(data) {
    try {
      const response = await fetch(CONFIG.API.GRADES_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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

  function showLoading(elementId) {
    document.getElementById(elementId).style.display = "block";
  }

  function hideLoading(elementId) {
    document.getElementById(elementId).style.display = "none";
  }

  function showResults(elementId) {
    document.getElementById(elementId).style.display = "block";
  }

  function hideResults(elementId) {
    document.getElementById(elementId).style.display = "none";
  }

  async function fetchStudentGrades(studentId, assignmentId) {
    showLoading("student-loader");

    try {
      const data = {
        operation: "getSingleStudentGrade",
        student_id: studentId,
        assignment_id: assignmentId,
      };
      const response = await makeAPIRequest(data);

      displayStudentSummary(response);
      displayDetails(response);
    } catch (error) {
      console.error("Grade fetch error:", error);
      UIManager.showAlert(`Failed to load grades: ${error.message}`, "danger");
    } finally {
      hideLoading("student-loader");
    }
  }

  // Fetch all student grades (Teacher View)
  async function fetchAllStudentGrades(qpId, assignmentId) {
    showLoading("teacher-loader");
    try {
      const data = {
        operation: "getAllStudentGrades",
        qp_id: qpId,
        assignment_id: assignmentId,
      };
      const response = await makeAPIRequest(data);
      displayAllStudentGrades(response);
    } catch (error) {
      UIManager.showAlert(
        `Failed to fetch all grades: ${error.message}`,
        "danger"
      );
    } finally {
      hideLoading("teacher-loader");
    }
  }
// summary view
  // function displayAllStudentGrades(data) {
  //   const studentsListElement = document.getElementById("students-list");
  //   const teacherResultContainer = document.getElementById("teacher-result");
  //   studentsListElement.innerHTML = "";

  //   let result;
  //   if (data && data.body) {
  //     try {
  //       result = JSON.parse(data.body);
  //     } catch (error) {
  //       UIManager.showAlert("Failed to parse grade data", "danger");
  //       return;
  //     }
  //   } else {
  //     UIManager.showAlert("Invalid response from server", "danger");
  //     return;
  //   }

  //   if (!result.grades || !Array.isArray(result.grades)) {
  //     UIManager.showAlert("No grades available", "danger");
  //     return;
  //   }

  //   result.grades.forEach((grade) => {
  //     const row = document.createElement("tr");
  //     const dateStr = new Date(grade.timestamp * 1000).toLocaleString();
  //     row.innerHTML = `
  //               <td>${grade.evaluation_id}</td>
  //               <td>${grade.student_id}</td>
  //               <td>${grade.qp_id}</td>
  //               <td>${grade.total_marks}</td>
  //               <td>${dateStr}</td>
  //           `;
  //     studentsListElement.appendChild(row);
  //   });
  //   teacherResultContainer.style.display = "block";
  // }
function displayAllStudentGrades(data) {
  const studentsListElement = document.getElementById("students-list");
  const teacherResultContainer = document.getElementById("teacher-result");
  
  // Clear existing content
  studentsListElement.innerHTML = "";

  // Validate input data
  if (!data) {
    UIManager.showAlert("No data received from server", "danger");
    return;
  }

  let result;
  if (data.body) {
    try {
      result = JSON.parse(data.body);
    } catch (error) {
      console.error("JSON parse error:", error);
      UIManager.showAlert("Failed to parse grade data", "danger");
      return;
    }
  } else {
    // Handle case where data is already parsed
    result = data;
  }

  // Validate result structure
  if (!result || typeof result !== 'object') {
    UIManager.showAlert("Invalid response format from server", "danger");
    return;
  }

  if (!result.grades) {
    UIManager.showAlert("No grades data received", "warning");
    return;
  }

  if (!Array.isArray(result.grades)) {
    UIManager.showAlert("Invalid grades format", "danger");
    return;
  }

  if (result.grades.length === 0) {
    UIManager.showAlert("No grades found", "info");
    return;
  }

  // Process each grade record
  let validGradesCount = 0;
  
  result.grades.forEach((grade, index) => {
    // Validate required properties
    if (!grade || typeof grade !== 'object') {
      console.warn(`Skipping invalid grade record at index ${index}:`, grade);
      return;
    }

    if (!grade.evaluation_id || !grade.student_id || !grade.qp_id) {
      console.warn(`Skipping incomplete grade record at index ${index}:`, grade);
      return;
    }

    // Create table row
    const row = document.createElement("tr");

    // Create and populate cells safely
    const evalCell = document.createElement("td");
    evalCell.textContent = String(grade.evaluation_id);
    row.appendChild(evalCell);

    // Student ID cell with link
    const studentCell = document.createElement("td");
    const studentLink = document.createElement("a");
    
    // Safely construct the link URL
    const studentId = encodeURIComponent(grade.student_id);
    const assignmentId = grade.assignment_id ? encodeURIComponent(grade.assignment_id) : '';
    const qpId = encodeURIComponent(grade.qp_id);
    
    let studentDetailLink = `student-details.html?student_id=${studentId}&qp_id=${qpId}`;
    if (assignmentId) {
      studentDetailLink += `&assignment_id=${assignmentId}`;
    }
    
    studentLink.href = studentDetailLink;
    studentLink.textContent = String(grade.student_id);
    studentLink.style.color = "blue";
    studentLink.style.textDecoration = "underline";
    
    studentCell.appendChild(studentLink);
    row.appendChild(studentCell);

    // Question Paper ID cell
    const qpCell = document.createElement("td");
    qpCell.textContent = String(grade.qp_id);
    row.appendChild(qpCell);

    // Total marks cell
    const marksCell = document.createElement("td");
    const marks = grade.total_marks !== undefined && grade.total_marks !== null 
      ? String(grade.total_marks) 
      : 'N/A';
    marksCell.textContent = marks;
    row.appendChild(marksCell);

    // Timestamp cell
    const dateCell = document.createElement("td");
    let dateStr = 'N/A';
    
    if (grade.timestamp) {
      try {
        // Handle both Unix timestamp (seconds) and milliseconds
        const timestamp = grade.timestamp.toString().length === 10 
          ? grade.timestamp * 1000 
          : grade.timestamp;
        const date = new Date(timestamp);
        
        if (!isNaN(date.getTime())) {
          dateStr = date.toLocaleString();
        }
      } catch (error) {
        console.warn(`Invalid timestamp for grade at index ${index}:`, grade.timestamp);
      }
    }
    
    dateCell.textContent = dateStr;
    row.appendChild(dateCell);

    studentsListElement.appendChild(row);
    validGradesCount++;
  });

  // Show success message with count
  if (validGradesCount > 0) {
    UIManager.showAlert(`Successfully loaded ${validGradesCount} grade record(s)`, "success");
    teacherResultContainer.style.display = "block";
  } else {
    UIManager.showAlert("No valid grade records found", "warning");
  }
}

// Single student details view
function displayStudentSummary(data) {
  const summaryBody = document.getElementById("summary-body");
  const studentResultContainer = document.getElementById("student-result");

  // Check if required DOM elements exist
  if (!summaryBody || !studentResultContainer) {
    console.error("Required DOM elements not found");
    UIManager.showAlert("Page elements not found", "danger");
    return;
  }

  // Clear existing content
  summaryBody.innerHTML = "";

  // Validate input data
  if (!data) {
    UIManager.showAlert("No data received from server", "danger");
    return;
  }

  let result;
  if (data.body) {
    try {
      result = JSON.parse(data.body);
    } catch (error) {
      console.error("JSON parse error:", error);
      UIManager.showAlert("Failed to parse summary data", "danger");
      return;
    }
  } else {
    // Handle case where data is already parsed
    result = data;
  }

  // Validate result structure
  if (!result || typeof result !== 'object') {
    UIManager.showAlert("Invalid response format from server", "danger");
    return;
  }

  if (!result.summary) {
    UIManager.showAlert("No summary data received", "warning");
    return;
  }

  if (!Array.isArray(result.summary)) {
    UIManager.showAlert("Invalid summary format", "danger");
    return;
  }

  if (result.summary.length === 0) {
    UIManager.showAlert("No summary records found", "info");
    return;
  }

  // Process each summary record
  let validRecordsCount = 0;

  result.summary.forEach((grade, index) => {
    // Validate grade object
    if (!grade || typeof grade !== 'object') {
      console.warn(`Skipping invalid summary record at index ${index}:`, grade);
      return;
    }

    // Create table row
    const row = document.createElement("tr");

    // Student ID cell
    const studentIdCell = document.createElement("td");
    studentIdCell.textContent = grade.student_id || "N/A";
    row.appendChild(studentIdCell);

    // Assignment ID cell
    const assignmentIdCell = document.createElement("td");
    assignmentIdCell.textContent = grade.assignment_id || "N/A";
    row.appendChild(assignmentIdCell);

    // Total marks cell
    const marksCell = document.createElement("td");
    const marks = grade.total_marks !== undefined && grade.total_marks !== null 
      ? String(grade.total_marks) 
      : "N/A";
    marksCell.textContent = marks;
    row.appendChild(marksCell);

    // Evaluation ID cell
    const evaluationIdCell = document.createElement("td");
    evaluationIdCell.textContent = grade.evaluation_id || "N/A";
    row.appendChild(evaluationIdCell);

    // Question Paper ID cell
    const qpIdCell = document.createElement("td");
    qpIdCell.textContent = grade.qp_id || "N/A";
    row.appendChild(qpIdCell);

    // Timestamp cell
    const timestampCell = document.createElement("td");
    let dateStr = "N/A";
    
    if (grade.timestamp) {
      try {
        // Handle both Unix timestamp (seconds) and milliseconds
        const timestamp = grade.timestamp.toString().length === 10 
          ? grade.timestamp * 1000 
          : grade.timestamp;
        const date = new Date(timestamp);
        
        if (!isNaN(date.getTime())) {
          dateStr = date.toLocaleString();
        }
      } catch (error) {
        console.warn(`Invalid timestamp for summary record at index ${index}:`, grade.timestamp);
      }
    }
    
    timestampCell.textContent = dateStr;
    row.appendChild(timestampCell);

    summaryBody.appendChild(row);
    validRecordsCount++;
  });

  // Show result and success message
  if (validRecordsCount > 0) {
    UIManager.showAlert(`Successfully loaded ${validRecordsCount} summary record(s)`, "success");
    studentResultContainer.style.display = "block";
  } else {
    UIManager.showAlert("No valid summary records found", "warning");
  }
}

/**
 * Displays detailed question information in the questions container
 * @param {Object} data - The data containing question details
 */
function displayDetails(data) {
  const questionsContainer = document.getElementById("questions-container");

  if (!questionsContainer) {
    console.error("Questions container not found");
    showAlert("Page elements not found", "danger");
    return;
  }

  questionsContainer.innerHTML = "";

  // Validate input data
  if (!data) {
    showAlert("No data received from server", "danger");
    return;
  }

  let result;
  if (data.body) {
    try {
      result = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
    } catch (error) {
      console.error("JSON parse error:", error);
      showAlert("Failed to parse details data", "danger");
      return;
    }
  } else {
    // Handle case where data is already parsed
    result = data;
  }

  // Validate result structure
  if (!result || typeof result !== 'object') {
    showAlert("Invalid response format from server", "danger");
    return;
  }

  if (!result.details) {
    showAlert("No details data received", "warning");
    return;
  }

  if (!Array.isArray(result.details)) {
    showAlert("Invalid details format", "danger");
    return;
  }

  if (result.details.length === 0) {
    showAlert("No question details found", "info");
    return;
  }

  // Sort questions by question_number safely
  const validDetails = result.details.filter(question => 
    question && typeof question === 'object'
  );

  if (validDetails.length === 0) {
    showAlert("No valid question details found", "warning");
    return;
  }

  validDetails.sort((a, b) => {
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

  let processedCount = 0;

  validDetails.forEach((question, index) => {
    try {
      const questionCard = document.createElement('div');
      questionCard.className = 'question-item';
      
      // Handle timestamp safely
      let timestamp = '';
      if (question.timestamp) {
        try {
          // Handle both Unix timestamp (seconds) and milliseconds
          const ts = question.timestamp.toString().length === 10 
            ? question.timestamp * 1000 
            : question.timestamp;
          const date = new Date(ts);
          
          if (!isNaN(date.getTime())) {
            timestamp = date.toLocaleString();
          }
        } catch (e) {
          console.warn(`Invalid timestamp for question at index ${index}:`, question.timestamp);
        }
      }

      // Create question header
      const questionHeader = document.createElement('div');
      questionHeader.className = 'question-header';
      
      const questionTitle = document.createElement('h3');
      const questionNum = question.question_number || '';
      const subpart = question.subpart ? ` (${question.subpart})` : '';
      questionTitle.textContent = `Question ${questionNum}${subpart}`;
      questionHeader.appendChild(questionTitle);

      // Create question meta
      const questionMeta = document.createElement('div');
      questionMeta.className = 'question-meta';
      
      const marksSpan = document.createElement('span');
      marksSpan.className = 'marks';
      marksSpan.textContent = 'Marks: ';
      
      const obtainedSpan = document.createElement('span');
      obtainedSpan.className = 'obtained';
      obtainedSpan.textContent = question.marks || 0;
      
      const maxSpan = document.createElement('span');
      maxSpan.className = 'max';
      maxSpan.textContent = question.max_marks || 0;
      
      marksSpan.appendChild(obtainedSpan);
      marksSpan.appendChild(document.createTextNode(' / '));
      marksSpan.appendChild(maxSpan);
      questionMeta.appendChild(marksSpan);

      if (timestamp) {
        const timestampSpan = document.createElement('span');
        timestampSpan.className = 'timestamp';
        timestampSpan.textContent = `Answered on: ${timestamp}`;
        questionMeta.appendChild(timestampSpan);
      }

      // Create question text
      const questionText = document.createElement('p');
      questionText.className = 'question-text';
      questionText.innerHTML = renderContent(question.question || 'Question not available');

      // Create answer section
      const answerSection = document.createElement('div');
      answerSection.className = 'answer-section';
      
      const answerTitle = document.createElement('h4');
      answerTitle.textContent = 'Your Answer:';
      answerSection.appendChild(answerTitle);
      
      const answerPre = document.createElement('pre');
      answerPre.innerHTML = renderContent(question.student_answer || 'No answer provided');
      answerSection.appendChild(answerPre);

      // Create reasoning section
      const reasoningSection = document.createElement('div');
      reasoningSection.className = 'reasoning-section rubric';
      
      const feedbackTitle = document.createElement('h4');
      feedbackTitle.textContent = 'Feedback:';
      reasoningSection.appendChild(feedbackTitle);
      
      const feedbackContainer = document.createElement('div');
      feedbackContainer.className = 'feedback-container';
      feedbackContainer.innerHTML = renderContent(question.feedback || 'No additional reasoning provided');
      reasoningSection.appendChild(feedbackContainer);

      // Assemble the question card
      questionCard.appendChild(questionHeader);
      questionCard.appendChild(questionMeta);
      questionCard.appendChild(questionText);
      questionCard.appendChild(answerSection);
      questionCard.appendChild(reasoningSection);

      questionsContainer.appendChild(questionCard);
      processedCount++;

    } catch (error) {
      console.warn(`Error processing question at index ${index}:`, error);
    }
  });

  if (processedCount > 0) {
    showAlert(`Successfully loaded ${processedCount} question detail(s)`, "success");
    // Load MathJax if needed
    loadMathJax(questionsContainer);
  } else {
    showAlert("No question details could be processed", "warning");
  }
}

function renderContent(text) {
  if (!text || typeof text !== 'string') return '';
  
  // Handle LaTeX format with sections
  if (text.includes('\\textbf{') && text.includes('}:} \\quad \\text{')) {
    const sections = text.match(/\[ \\textbf\{([^}]+)\}\:} \\quad \\text\{([^}]+)\} \]/g) || [];
    
    if (sections.length > 0) {
      const parsedHtml = sections.map(section => {
        const headingMatch = section.match(/\\textbf\{([^}]+)\}/);
        const contentMatch = section.match(/\\quad \\text\{([^}]+)\}/);
        
        const heading = headingMatch ? escapeHtml(headingMatch[1]) : '';
        let content = contentMatch ? contentMatch[1] : '';
        
        // Process itemize blocks safely
        content = content.replace(/\\begin\{itemize\}(.*?)\\end\{itemize\}/gs, (match, items) => {
          const listItems = items.split('\\item').filter(item => item.trim());
          const safeListItems = listItems.map(item => {
            const listItem = document.createElement('li');
            listItem.textContent = item.trim();
            return listItem.outerHTML;
          }).join('');
          return `<ul>${safeListItems}</ul>`;
        });
        
        // Process LaTeX commands safely
        content = content.replace(/\\([a-zA-Z]+)/g, '\\$1');
        content = content.replace(/\\\(([^)]+)\\\)/g, '$$1$');
        
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'feedback-section';
        
        const headingEl = document.createElement('h4');
        headingEl.textContent = heading + ':';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'feedback-content';
        contentDiv.innerHTML = content; // Content is already processed safely above
        
        sectionDiv.appendChild(headingEl);
        sectionDiv.appendChild(contentDiv);
        
        return sectionDiv.outerHTML;
      }).join('');
      
      return parsedHtml;
    }
  }
  
  // Process Markdown formatting safely
  let processedText = escapeHtml(text);
  
  // Apply markdown transformations to escaped text
  processedText = processedText.replace(/^(\d+)\.\s*\*\*(.*?)\*\*/gm, '<br>$1. <strong>$2</strong>');
  processedText = processedText.replace(/^-\s*\*\*(.*?)\*\*/gm, '<br>- <strong>$1</strong>');
  processedText = processedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  processedText = processedText.replace(/^## (.*?)$/gm, '<br><h2>$1</h2>');
  processedText = processedText.replace(/^### (.*?)$/gm, '<br><h3>$1</h3>');
  
  return processedText;
}

function escapeHtml(text) {
  if (typeof text !== 'string') return String(text || '');
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showAlert(message, type = 'info') {
  // Validate inputs
  if (!message || typeof message !== 'string') return;
  if (!['info', 'success', 'warning', 'danger'].includes(type)) {
    type = 'info';
  }

  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type}`;
  alertDiv.textContent = message;
  
  // Set styles safely
  const bgColors = {
    danger: '#f8d7da',
    warning: '#fff3cd',
    success: '#d4edda',
    info: '#d1ecf1'
  };
  
  const textColors = {
    danger: '#721c24',
    warning: '#856404',
    success: '#155724',
    info: '#0c5460'
  };
  
  const borderColors = {
    danger: '#f5c6cb',
    warning: '#ffeaa7',
    success: '#c3e6cb',
    info: '#bee5eb'
  };
  
  alertDiv.style.cssText = `
    padding: 10px;
    margin: 10px 0;
    border-radius: 4px;
    background-color: ${bgColors[type]};
    color: ${textColors[type]};
    border: 1px solid ${borderColors[type]};
  `;
  
  const container = document.querySelector('.container');
  if (container) {
    container.insertBefore(alertDiv, container.firstChild);
    setTimeout(() => {
      if (alertDiv.parentNode) {
        alertDiv.remove();
      }
    }, 5000);
  } else {
    console.warn('Container not found for alert display');
  }
}

function loadMathJax(container) {
  if (!container) return;
  
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
    script.onerror = function() {
      console.error('Failed to load MathJax');
    };
    script.onload = function() {
      if (window.MathJax && MathJax.typeset) {
        try {
          MathJax.typeset([container]);
        } catch (error) {
          console.error('MathJax typeset error:', error);
        }
      }
    };
    document.head.appendChild(script);
  } else {
    if (MathJax.typeset) {
      try {
        MathJax.typeset([container]);
      } catch (error) {
        console.error('MathJax typeset error:', error);
      }
    }
  }
}

// Add CSS for feedback sections and code blocks (run once)
function addStyles() {
  // Check if styles already exist
  if (document.getElementById('question-details-styles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'question-details-styles';
  style.textContent = `
    .feedback-container {
      margin-top: 10px;
    }
    .feedback-section {
      margin-bottom: 15px;
      border-left: 3px solid #4a90e2;
      padding-left: 15px;
    }
    .feedback-section h4 {
      margin-top: 0;
      margin-bottom: 5px;
      color: #4a90e2;
      font-weight: bold;
    }
    .feedback-content {
      margin-left: 5px;
    }
    .feedback-content ul {
      margin-top: 5px;
      padding-left: 20px;
    }
    .feedback-content li {
      margin-bottom: 5px;
    }
    
    /* Code block styling */
    pre {
      background-color: #f5f5f5;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 10px;
      overflow-x: auto;
      margin: 10px 0;
      font-family: 'Courier New', Courier, monospace;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    code {
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.9em;
    }
    
    /* Syntax highlighting based on language */
    .language-python { color: #3572A5; }
    .language-javascript { color: #f1e05a; }
    .language-java { color: #b07219; }
    .language-cpp, .language-c { color: #f34b7d; }
    
    /* Markdown styling */
    strong { font-weight: bold; }
    h2 {
      font-size: 1.5em;
      font-weight: bold;
      margin-top: 15px;
      margin-bottom: 10px;
      border-bottom: 1px solid #eaecef;
      padding-bottom: 5px;
    }
    h3 {
      font-size: 1.25em;
      font-weight: bold;
      margin-top: 12px;
      margin-bottom: 8px;
    }
    
    /* Question item styling */
    .question-item {
      margin-bottom: 20px;
      padding: 15px;
      border: 1px solid #ddd;
      border-radius: 8px;
      background-color: #fff;
    }
    
    .question-header h3 {
      margin: 0;
      color: #333;
    }
    
    .question-meta {
      margin: 10px 0;
      font-size: 0.9em;
      color: #666;
    }
    
    .question-meta .marks {
      margin-right: 15px;
      font-weight: bold;
    }
    
    .obtained { color: #28a745; }
    .max { color: #6c757d; }
    
    .answer-section, .reasoning-section {
      margin-top: 15px;
    }
    
    .answer-section h4, .reasoning-section h4 {
      margin-bottom: 10px;
      color: #495057;
    }
  `;
  document.head.appendChild(style);
}

// Initialize styles
addStyles();
  setupNavLinkHighlighting();

});
  // function displayDetails(data) {
  //     const questionsContainer = document.getElementById("questions-container");

  //     if (!questionsContainer) {
  //         console.error("Questions container not found");
  //         return;
  //     }

  //     questionsContainer.innerHTML = "";

  //     let result;
  //     if (data && data.body) {
  //         try {
  //             result = JSON.parse(data.body);
  //         } catch (error) {
  //             console.error("Parse error:", error);
  //             UIManager.showAlert("Failed to parse details data", "danger");
  //             return;
  //         }
  //     } else {
  //         return;
  //     }

  //     if (!result.details || !Array.isArray(result.details)) {
  //         console.log("No details available");
  //         return;
  //     }

  //     // Create a function to render LaTeX if MathJax is available
  //     const renderLatex = (text) => {
  //         const tempDiv = document.createElement('div');
  //         tempDiv.textContent = text;

  //         // If MathJax is available, process the LaTeX
  //         if (window.MathJax) {
  //             MathJax.Hub.Queue(["Typeset", MathJax.Hub, tempDiv]);
  //         }

  //         return tempDiv.innerHTML;
  //     };

  //     result.details.forEach((question) => {
  //         const questionCard = document.createElement('div');
  //     questionCard.className = 'question-item'; // Updated class to match CSS
  //     questionCard.innerHTML = `
  //         <div class="question-header">
  //             <h3>Question ${question.question_number} ${question.subpart ? `(${question.subpart})` : ''}</h3>
  //             ${question.subpart ? `<span class="subpart">${question.subpart}</span>` : ''}
  //         </div>

  //         <div class="question-meta">
  //             <span class="marks">Marks: <span class="obtained">${question.marks || 0}</span> / <span class="max">${question.max_marks || 0}</span></span>
  //             <span class="timestamp">${Date(question.timestamp * 1000).toLocaleString() ? `Answered on: ${Date(question.timestamp * 1000).toLocaleString()}` : ''}</span>
  //         </div>

  //         <p class="question-text">${renderLatex(question.question || 'Question not available')}</p>

  //         <div class="answer-section">
  //             <h4>Your Answer:</h4>
  //             <pre>${renderLatex(question.student_answer || 'No answer provided')}</pre>
  //         </div>

  //         <div class="reasoning-section rubric">
  //             <h4>Feedback:</h4>
  //             <p>${renderLatex(question.feedback || 'No additional reasoning provided')}</p>
  //         </div>
  //     `;

  //     questionsContainer.appendChild(questionCard);
  //     });

  //     // Ensure MathJax is loaded and configured
  //     if (!window.MathJax) {
  //         const script = document.createElement('script');
  //         script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.7/MathJax.js?config=TeX-MML-AM_CHTML';
  //         script.async = true;
  //         document.head.appendChild(script);
  //     }
  // }

  // function displayDetails(data) {
  //     const questionsContainer = document.getElementById("questions-container");

  //     if (!questionsContainer) {
  //         console.error("Questions container not found");
  //         return;
  //     }

  //     questionsContainer.innerHTML = "";

  //     let result;
  //     if (data && data.body) {
  //         try {
  //             result = JSON.parse(data.body);
  //         } catch (error) {
  //             console.error("Parse error:", error);
  //             if (typeof UIManager !== 'undefined' && UIManager.showAlert) {
  //                 UIManager.showAlert("Failed to parse details data", "danger");
  //             }
  //             return;
  //         }
  //     } else {
  //         return;
  //     }

  //     if (!result.details || !Array.isArray(result.details)) {
  //         console.log("No details available");
  //         return;
  //     }

  //     // Create a function to render LaTeX if MathJax is available
  //     const renderLatex = (text) => {
  //         if (!text) return '';

  //         const tempDiv = document.createElement('div');
  //         tempDiv.textContent = text;

  //         // If MathJax is available, queue it for processing
  //         if (window.MathJax) {
  //             MathJax.Hub.Queue(["Typeset", MathJax.Hub, tempDiv]);
  //         }

  //         return tempDiv.innerHTML;
  //     };

  //     // Sort questions by question_number to ensure they display serially
  //     result.details.sort((a, b) => {
  //         // First compare by question number
  //         const numA = parseInt(a.question_number) || 0;
  //         const numB = parseInt(b.question_number) || 0;

  //         if (numA !== numB) return numA - numB;

  //         // If question numbers are the same, sort by subpart
  //         if (a.subpart && b.subpart) {
  //             return a.subpart.localeCompare(b.subpart);
  //         } else if (a.subpart) {
  //             return 1;
  //         } else if (b.subpart) {
  //             return -1;
  //         }

  //         return 0;
  //     });

  //     result.details.forEach((question) => {
  //         const questionCard = document.createElement('div');
  //         questionCard.className = 'question-item';

  //         // Format timestamp correctly
  //         let timestamp = '';
  //         if (question.timestamp) {
  //             try {
  //                 timestamp = new Date(question.timestamp * 1000).toLocaleString();
  //             } catch (e) {
  //                 console.error("Invalid timestamp format", e);
  //                 timestamp = '';
  //             }
  //         }

  //         questionCard.innerHTML = `
  //             <div class="question-header">
  //                 <h3>Question ${question.question_number || ''} ${question.subpart ? `(${question.subpart})` : ''}</h3>
  //             </div>

  //             <div class="question-meta">
  //                 <span class="marks">Marks: <span class="obtained">${question.marks || 0}</span> / <span class="max">${question.max_marks || 0}</span></span>
  //                 ${timestamp ? `<span class="timestamp">Answered on: ${timestamp}</span>` : ''}
  //             </div>

  //             <p class="question-text">${renderLatex(question.question || 'Question not available')}</p>

  //             <div class="answer-section">
  //                 <h4>Your Answer:</h4>
  //                 <pre>${renderLatex(question.student_answer || 'No answer provided')}</pre>
  //             </div>

  //             <div class="reasoning-section rubric">
  //                 <h4>Feedback:</h4>
  //                 <p>${renderLatex(question.feedback || 'No additional reasoning provided')}</p>
  //             </div>
  //         `;

  //         questionsContainer.appendChild(questionCard);
  //     });

  //     // Ensure MathJax is loaded and configured
  //     if (!window.MathJax) {
  //         const script = document.createElement('script');
  //         script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.7/MathJax.js?config=TeX-MML-AM_CHTML';
  //         script.async = true;
  //         document.head.appendChild(script);

  //         script.onload = function() {
  //             // Initialize MathJax with proper configuration
  //             window.MathJax = {
  //                 tex2jax: {
  //                     inlineMath: [['$','$'], ['\\(','\\)']],
  //                     processEscapes: true
  //                 }
  //             };

  //             // Process all math in the container
  //             MathJax.Hub.Queue(["Typeset", MathJax.Hub, questionsContainer]);
  //         };
  //     } else {
  //         // If MathJax is already loaded, process the container
  //         MathJax.Hub.Queue(["Typeset", MathJax.Hub, questionsContainer]);
  //     }
  // }
