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
            result = JSON.parse(data.body);
        } catch (error) {
            console.error("Parse error:", error);
            UIManager.showAlert("Failed to parse details data", "danger");
            return;
        }
    } else {
        UIManager.showAlert("No details available", "warning");
        return;
    }
  
    if (!result.details || !Array.isArray(result.details) || result.details.length === 0) {
        questionsContainer.innerHTML = "<p class='no-data-message'>No question details available for this assignment.</p>";
        return;
    }
  
    // Check if any question contains code blocks and initialize syntax highlighting
    const hasCodeBlocks = result.details.some(question => 
        question.feedback && question.feedback.includes('```')
    );
    
    if (hasCodeBlocks) {
        // Check if highlight.js is loaded
        if (!window.hljs) {
            // Load highlight.js for syntax highlighting
            const hljs = document.createElement('script');
            hljs.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/highlight.min.js';
            document.head.appendChild(hljs);
            
            // Load a stylesheet for highlight.js
            const hljsCSS = document.createElement('link');
            hljsCSS.rel = 'stylesheet';
            hljsCSS.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/default.min.css';
            document.head.appendChild(hljsCSS);
            
            hljs.onload = function() {
                // Initialize highlight.js
                window.hljs.highlightAll();
            };
        } else {
            // If highlight.js is already loaded, highlight all code blocks
            setTimeout(() => window.hljs.highlightAll(), 100);
        }
    }
  
    // Create a function to render LaTeX and Markdown
    const renderContent = (text) => {
        if (!text) return '';
        
        // Special handling for feedback in LaTeX format with sections
        if (text.includes('\\textbf{') && text.includes('}:} \\quad \\text{')) {
            // Parse the structured LaTeX feedback
            const sections = text.match(/\[ \\textbf\{([^}]+)\}\:} \\quad \\text\{([^}]+)\} \]/g) || [];
            
            if (sections.length > 0) {
                const parsedHtml = sections.map(section => {
                    // Extract the heading and content from each section
                    const headingMatch = section.match(/\\textbf\{([^}]+)\}/);
                    const contentMatch = section.match(/\\quad \\text\{([^}]+)\}/);
                    
                    const heading = headingMatch ? headingMatch[1] : '';
                    let content = contentMatch ? contentMatch[1] : '';
                    
                    // Handle itemize environments within the content
                    content = content.replace(/\\begin\{itemize\}(.*?)\\end\{itemize\}/gs, (match, items) => {
                        const listItems = items.split('\\item').filter(item => item.trim());
                        return `<ul>${listItems.map(item => `<li>${item.trim()}</li>`).join('')}</ul>`;
                    });
                    
                    // Convert basic LaTeX math to HTML with MathJax compatible syntax
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
        let processedText = text;
        
        // Handle code blocks
        processedText = processedText.replace(/```(\w*)([\s\S]*?)```/g, (match, language, code) => {
            const langClass = language ? `language-${language}` : '';
            return `<pre><code class="${langClass}">${code.trim()}</code></pre>`;
        });
        
        // Handle numbered list with bold first (e.g., 1. **Item**)
        processedText = processedText.replace(/^(\d+)\.\s*\*\*(.*?)\*\*/gm, '<br>$1. <strong>$2</strong>');
  
        processedText = processedText.replace(/^-\s*\*\*(.*?)\*\*/gm, '<br>-<strong>$1</strong>');
  
        // Then handle any remaining bold text (**bold**) not in lists
        processedText = processedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
        // Ensure new line before main headings (## heading)
        processedText = processedText.replace(/^## (.*?)$/gm, '<br><h2>$1</h2>');
  
        // Ensure new line before subheadings (### heading)
        processedText = processedText.replace(/^### (.*?)$/gm, '<br><h3>$1</h3>');
        
        // Create a div for the processed content
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = processedText;
        
        // If MathJax is available, queue it for processing
        if (window.MathJax) {
            setTimeout(() => {
                if (MathJax.version && MathJax.version[0] === '3') {
                    MathJax.typeset([tempDiv]);
                } else {
                    MathJax.Hub.Queue(["Typeset", MathJax.Hub, tempDiv]);
                }
            }, 100);
        }
        
        return tempDiv.innerHTML;
    };
  
    // Sort questions by question_number to ensure they display serially
    result.details.sort((a, b) => {
        // First compare by question number
        const numA = parseInt(a.question_number) || 0;
        const numB = parseInt(b.question_number) || 0;
        
        if (numA !== numB) return numA - numB;
        
        // If question numbers are the same, sort by subpart
        if (a.subpart && b.subpart) {
            return a.subpart.localeCompare(b.subpart);
        } else if (a.subpart) {
            return 1;
        } else if (b.subpart) {
            return -1;
        }
        
        return 0;
    });
  
    // Create an accordion for better organization of questions
    const accordion = document.createElement('div');
    accordion.className = 'questions-accordion';
    questionsContainer.appendChild(accordion);
  
    result.details.forEach((question, index) => {
        const questionCard = document.createElement('div');
        questionCard.className = 'question-item';
        
        // Format timestamp correctly
        let timestamp = '';
        if (question.timestamp) {
            try {
                timestamp = new Date(question.timestamp * 1000).toLocaleString();
            } catch (e) {
                console.error("Invalid timestamp format", e);
                timestamp = '';
            }
        }
        
        // Create a unique ID for this question item
        const questionId = `question-${index}`;
        
        questionCard.innerHTML = `
            <div class="question-header" id="${questionId}-header">
                <h3>Question ${question.question_number || ''} ${question.subpart ? `(${question.subpart})` : ''}</h3>
                <div class="question-meta">
                    <span class="marks ${(question.marks / question.max_marks) >= 0.7 ? 'high-score' : (question.marks / question.max_marks) >= 0.4 ? 'medium-score' : 'low-score'}">
                        Marks: <span class="obtained">${question.marks || 0}</span> / <span class="max">${question.max_marks || 0}</span>
                    </span>
                    ${timestamp ? `<span class="timestamp">Answered on: ${timestamp}</span>` : ''}
                    <button class="toggle-details" aria-expanded="false" aria-controls="${questionId}-content">
                        <i class="material-icons">expand_more</i>
                    </button>
                </div>
            </div>
            
            <div class="question-content" id="${questionId}-content" style="display: none;">
                <p class="question-text">${renderContent(question.question || 'Question not available')}</p>
  
                <div class="answer-section">
                    <h4>Your Answer:</h4>
                    <pre>${renderContent(question.student_answer || 'No answer provided')}</pre>
                </div>
  
                <div class="reasoning-section rubric">
                    <h4>Feedback:</h4>
                    <div class="feedback-container">${renderContent(question.feedback || 'No additional reasoning provided')}</div>
                </div>
            </div>
        `;
  
        accordion.appendChild(questionCard);
        
        // Add toggle functionality
        const toggleBtn = questionCard.querySelector('.toggle-details');
        const contentSection = questionCard.querySelector('.question-content');
        
        toggleBtn.addEventListener('click', function() {
            const isExpanded = this.getAttribute('aria-expanded') === 'true';
            
            if (isExpanded) {
                contentSection.style.display = 'none';
                this.setAttribute('aria-expanded', 'false');
                this.querySelector('i').textContent = 'expand_more';
            } else {
                contentSection.style.display = 'block';
                this.setAttribute('aria-expanded', 'true');
                this.querySelector('i').textContent = 'expand_less';
            }
        });
    });
  
    // Add CSS for feedback sections and code blocks
    const style = document.createElement('style');
    style.textContent = `
        .questions-accordion {
            width: 100%;
        }
        
        .question-item {
            margin-bottom: 15px;
            border: 1px solid #ddd;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
        
        .question-header {
            background-color: #f8f9fa;
            padding: 12px 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
        }
        
        .question-header h3 {
            margin: 0;
            font-size: 1.1rem;
            flex: 1;
        }
        
        .question-meta {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        
        .toggle-details {
            background: none;
            border: none;
            cursor: pointer;
            color: #4a90e2;
            padding: 5px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .toggle-details:hover {
            background-color: rgba(74, 144, 226, 0.1);
            border-radius: 50%;
        }
        
        .question-content {
            padding: 15px;
            background-color: #fff;
        }
        
        .high-score {
            color: #28a745;
            font-weight: bold;
        }
        
        .medium-score {
            color: #ffc107;
            font-weight: bold;
        }
        
        .low-score {
            color: #dc3545;
            font-weight: bold;
        }
        
        .timestamp {
            font-size: 0.85rem;
            color: #6c757d;
        }
        
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
        }
        
        code {
            font-family: 'Courier New', Courier, monospace;
            font-size: 0.9em;
        }
        
        /* Syntax highlighting based on language */
        .language-python {
            color: #3572A5;
        }
        
        .language-javascript {
            color: #f1e05a;
        }
        
        .language-java {
            color: #b07219;
        }
        
        .language-cpp, .language-c {
            color: #f34b7d;
        }
        
        /* Markdown styling */
        strong {
            font-weight: bold;
        }
        
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
        
        .no-data-message {
            padding: 20px;
            text-align: center;
            color: #6c757d;
            font-style: italic;
        }
        
        /* Alert styling */
        .alert {
            padding: 12px 15px;
            margin-bottom: 15px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            animation: fadeIn 0.3s;
        }
        
        .alert-danger {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        
        .alert-success {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        
        .alert-warning {
            background-color: #fff3cd;
            color: #856404;
            border: 1px solid #ffeeba;
        }
        
        .alert .material-icons {
            margin-right: 10px;
        }
        
        .alert .close-btn {
            margin-left: auto;
            background: none;
            border: none;
            cursor: pointer;
            color: inherit;
            opacity: 0.7;
        }
        
        .alert .close-btn:hover {
            opacity: 1;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        /* Print styles */
        @media print {
            body * {
                visibility: hidden;
            }
            
            #student-result, #student-result * {
                visibility: visible;
            }
            
            #student-result {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
            }
            
            .toggle-details, .print-button {
                display: none !important;
            }
            
            .question-content {
                display: block !important;
            }
            
            .question-item {
                break-inside: avoid;
                page-break-inside: avoid;
            }
        }
    `;
    document.head.appendChild(style);
  
    // Ensure MathJax is loaded and configured
    if (!window.MathJax) {
        // Configure MathJax first
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
            // Process all math in the container
            MathJax.typeset([questionsContainer]);
        };
    } else {
        // If MathJax is already loaded, process the container
        setTimeout(() => {
            if (MathJax.version && MathJax.version[0] === '3') {
                MathJax.typeset([questionsContainer]);
            } else {
                MathJax.Hub.Queue(["Typeset", MathJax.Hub, questionsContainer]);
            }
        }, 200);
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