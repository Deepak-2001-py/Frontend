// Configuration object for API endpoints
const CONFIG = {
    API: {
      GRADES_ENDPOINT: "https://rus9nultj9.execute-api.eu-north-1.amazonaws.com/dev/getgrades", // Update this with your actual API endpoint
    }
  };
  
  // UI Manager for handling alerts and UI interactions
  const UIManager = {
    showAlert: function(message, type) {
      // Create alert element
      const alertDiv = document.createElement("div");
      alertDiv.className = `alert alert-${type}`;
      alertDiv.innerHTML = `
        <span class="material-icons">${type === 'danger' ? 'error' : 'check_circle'}</span>
        <span>${message}</span>
        <button type="button" class="close-btn">
          <span class="material-icons">close</span>
        </button>
      `;
      
      // Add event listener to close button
      alertDiv.querySelector(".close-btn").addEventListener("click", function() {
        alertDiv.remove();
      });
      
      // Insert alert at the top of the main content
      const container = document.querySelector(".container");
      container.insertBefore(alertDiv, container.firstChild);
      
      // Auto-remove after 5 seconds
      setTimeout(() => {
        if (alertDiv.parentNode) {
          alertDiv.remove();
        }
      }, 5000);
    },
    
    // Additional UI methods can be added here
  };
  
  // Event listener for the student grade form
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
    // Hide previous results
    hideResults("student-result");
    
    // Show loading spinner
    showLoading("student-loader-container");
  
    try {
      const data = {
        operation: "getSingleStudentGrade",
        student_id: studentId,
        assignment_id: assignmentId,
      };
      const response = await makeAPIRequest(data);
  
      displayStudentSummary(response);
      displayDetails(response);
      
      // Show results
      showResults("student-result");
    } catch (error) {
      console.error("Grade fetch error:", error);
      UIManager.showAlert(`Failed to load grades: ${error.message}`, "danger");
    } finally {
      hideLoading("student-loader-container");
    }
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
        result = JSON.parse(data.body);
      } catch (error) {
        console.error("Parse error:", error);
        UIManager.showAlert("Failed to parse grade data", "danger");
        return;
      }
    } else {
      UIManager.showAlert("Invalid response from server", "danger");
      return;
    }

    if (!result.summary || !Array.isArray(result.summary)) {
      UIManager.showAlert("No summary available", "danger");
      return;
    }

    result.summary.forEach((grade) => {
      const row = document.createElement("tr");
      const dateStr = grade.timestamp
        ? new Date(grade.timestamp * 1000).toLocaleString()
        : "N/A";
      row.innerHTML = `
                <td>${grade.student_id || "N/A"}</td>
                <td>${grade.assignment_id || "N/A"}</td>
                <td>${
                  grade.total_marks !== undefined && grade.total_marks !== null
                    ? grade.total_marks
                    : "N/A"
                }</td>
                <td>${grade.evaluation_id || "N/A"}</td>
                <td>${grade.qp_id || "N/A"}</td>
                <td>${dateStr}</td>
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

      // Sort questions by question_number
      result.details.sort((a, b) => {
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

      result.details.forEach((question) => {
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
            <span class="marks">Marks: <span class="obtained">${question.marks || 0}</span> / <span class="max">${question.max_marks || 0}</span></span>
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

      // Load MathJax if needed
      loadMathJax(questionsContainer);
    }

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

    function escapeHtml(text) {
      if (typeof text !== 'string') return text;
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function showAlert(message, type = 'info') {
      const alertDiv = document.createElement('div');
      alertDiv.className = `alert alert-${type}`;
      alertDiv.textContent = message;
      alertDiv.style.cssText = `
        padding: 10px;
        margin: 10px 0;
        border-radius: 4px;
        background-color: ${type === 'danger' ? '#f8d7da' : type === 'warning' ? '#fff3cd' : '#d1ecf1'};
        color: ${type === 'danger' ? '#721c24' : type === 'warning' ? '#856404' : '#0c5460'};
        border: 1px solid ${type === 'danger' ? '#f5c6cb' : type === 'warning' ? '#ffeaa7' : '#bee5eb'};
      `;
      
      const container = document.querySelector('.container');
      if (container) {
        container.insertBefore(alertDiv, container.firstChild);
        setTimeout(() => alertDiv.remove(), 5000);
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
          if (MathJax.typeset) {
            MathJax.typeset([container]);
          }
        };
      } else {
        if (MathJax.typeset) {
          MathJax.typeset([container]);
        }
      }
    }

  setupNavLinkHighlighting();
  // Initialize the page
  document.addEventListener('DOMContentLoaded', function() {
    // Initially hide the student results section
    hideResults("student-result");
    
    // Hide the loader initially
    hideLoading("student-loader-container");
  });