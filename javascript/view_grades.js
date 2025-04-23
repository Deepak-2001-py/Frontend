document.addEventListener('DOMContentLoaded', function() {
    // Configuration
    const CONFIG = {
        API: {
            GRADES_ENDPOINT: 'https://rus9nultj9.execute-api.eu-north-1.amazonaws.com/dev/getgrades'
        },
        UPLOAD: {
            MAX_FILE_SIZE_MB: 10,
            ALLOWED_FILE_TYPES: ['application/pdf'],
            TIMEOUT_MS: 60000,
            MAX_RETRIES: 2,
            RETRY_DELAY_MS: 2000
        },
        UI: {
            ALERT_TIMEOUT_MS: 5000,
            PROGRESS_HIDE_DELAY_MS: 3000
        }
    };

    // Utility Functions
    const Utils = {
        generateUUID() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        },

        formatFileSize(bytes) {
            if (bytes < 1024) return `${bytes} bytes`;
            if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
            return `${(bytes / 1048576).toFixed(1)} MB`;
        },

        sanitizeHTML(str) {
            const temp = document.createElement('div');
            temp.textContent = str;
            return temp.innerHTML;
        }
    };

    // UI Manager for notifications and progress indication
    const UIManager = {
        showAlert(message, type = 'info') {
            const alertsContainer = document.getElementById('alerts-container');
            if (!alertsContainer) {
                console.error('Alerts container not found');
                return;
            }
            
            const alert = document.createElement('div');
            alert.className = `alert alert-${type}`;
            alert.innerHTML = Utils.sanitizeHTML(message);
            
            const closeBtn = document.createElement('button');
            closeBtn.className = 'close-btn';
            closeBtn.innerHTML = '&times;';
            closeBtn.addEventListener('click', () => alert.remove());
            
            alert.appendChild(closeBtn);
            alertsContainer.appendChild(alert);
            
            setTimeout(() => {
                alert.classList.add('fade-out');
                setTimeout(() => alert.remove(), 500);
            }, CONFIG.UI.ALERT_TIMEOUT_MS);
        },
        
        showProgress(message, progress = 0) {
            const progressContainer = document.getElementById('progress-container');
            if (!progressContainer) {
                console.error('Progress container not found');
                return;
            }
            
            progressContainer.style.display = 'block';
            
            const progressBar = document.getElementById('progress-bar');
            const progressText = document.getElementById('progress-text');
            
            if (progressBar) progressBar.style.width = `${progress}%`;
            if (progressText) progressText.textContent = message;
            
            if (progress === 100) {
                setTimeout(() => {
                    progressContainer.style.display = 'none';
                }, CONFIG.UI.PROGRESS_HIDE_DELAY_MS);
            }
        },
        
        hideProgress() {
            const progressContainer = document.getElementById('progress-container');
            if (progressContainer) {
                progressContainer.style.display = 'none';
            }
        }
    };

    // Unified Tab Management System
    const TabManager = {
        // Initialize all tab systems
        init() {
            // Primary Navigation Tabs
            this.setupTabSystem('.primary-nav .tab-btn', 'primary-nav');
        },

        // Generic tab setup method
        setupTabSystem(tabSelector, navType) {
            const tabButtons = document.querySelectorAll(tabSelector);
            
            tabButtons.forEach(tab => {
                tab.addEventListener('click', () => {
                    this.switchTab(tabButtons, tab, navType);
                });
            });

            // Setup initial state
            this.setupInitialState(tabButtons, navType);
        },

        // Setup initial tab state
        setupInitialState(tabs, navType) {
            const activeTab = Array.from(tabs).find(tab => tab.classList.contains('active'));
            
            if (activeTab) {
                const targetId = activeTab.getAttribute('data-tab');
                const contentSections = this.getContentSections(navType);
                
                // Hide all sections
                contentSections.forEach(section => {
                    section.classList.remove('active');
                    section.setAttribute('aria-hidden', 'true');
                    section.style.display = 'none';
                });
                
                // Show initial active section
                const initialSection = document.getElementById(targetId);
                if (initialSection) {
                    initialSection.classList.add('active');
                    initialSection.setAttribute('aria-hidden', 'false');
                    initialSection.style.display = 'block';
                }
            }
        },

        // Switch between tabs
        switchTab(tabGroup, selectedTab, navType) {
            const targetId = selectedTab.getAttribute('data-tab');
            
            // Reset all tabs in this group
            tabGroup.forEach(tab => {
                tab.classList.remove('active');
                tab.setAttribute('aria-selected', 'false');
            });
            
            // Activate selected tab
            selectedTab.classList.add('active');
            selectedTab.setAttribute('aria-selected', 'true');
            
            // Get content sections for this navigation type
            const contentSections = this.getContentSections(navType);
            
            // Hide all sections
            contentSections.forEach(section => {
                section.classList.remove('active');
                section.setAttribute('aria-hidden', 'true');
                section.style.display = 'none';
            });
            
            // Show target section
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.add('active');
                targetSection.setAttribute('aria-hidden', 'false');
                targetSection.style.display = 'block';
            }
        },

        // Get content sections based on navigation type
        getContentSections(navType) {
            switch(navType) {
                case 'primary-nav':
                    return document.querySelectorAll('.main-content > .container > .tab-content');
                default:
                    return [];
            }
        }
    };

    // Initialize Tab Manager
    TabManager.init();

    // ---------- Grades Functionality ----------
    const studentViewBtn = document.getElementById("student-view-btn");
    const teacherViewBtn = document.getElementById("teacher-view-btn");
    const studentView = document.getElementById("student-view");
    const teacherView = document.getElementById("teacher-view");
  
    // Ensure student view is visible by default
    studentView.style.display = "block";
    teacherView.style.display = "none";
  
    // Set initial ARIA attributes
    studentViewBtn.setAttribute("aria-selected", "true");
    teacherViewBtn.setAttribute("aria-selected", "false");
  
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
    document.getElementById("student-grade-form").addEventListener("submit", function (event) {
        event.preventDefault();
        const studentId = document.getElementById("student-id").value.trim();
        const assignmentId = document.getElementById("assignment-id-student").value.trim();
        if (!studentId || !assignmentId) {
            UIManager.showAlert("Please fill in all required fields in student view", "danger");
            return;
        }
        fetchStudentGrades(studentId, assignmentId);
    });

    // Teacher Grade Form (Teacher View)
    document.getElementById("teacher-grade-form").addEventListener("submit", function (event) {
        event.preventDefault();
        const qpId = document.getElementById("qp-id").value.trim();
        const assignmentId = document.getElementById("assignment-id-teacher").value.trim();
        if (!qpId || !assignmentId) {
            UIManager.showAlert("Please fill in all required fields in teacher view", "danger");
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
            UIManager.showAlert(`Failed to fetch all grades: ${error.message}`, "danger");
        } finally {
            hideLoading("teacher-loader");
        }
    }

    function displayAllStudentGrades(data) {
        const studentsListElement = document.getElementById("students-list");
        const teacherResultContainer = document.getElementById("teacher-result");
        studentsListElement.innerHTML = "";

        let result;
        if (data && data.body) {
            try {
                result = JSON.parse(data.body);
            } catch (error) {
                UIManager.showAlert("Failed to parse grade data", "danger");
                return;
            }
        } else {
            UIManager.showAlert("Invalid response from server", "danger");
            return;
        }

        if (!result.grades || !Array.isArray(result.grades)) {
            UIManager.showAlert("No grades available", "danger");
            return;
        }

        result.grades.forEach((grade) => {
            const row = document.createElement("tr");
            const dateStr = new Date(grade.timestamp * 1000).toLocaleString();
            row.innerHTML = `
                <td>${grade.evaluation_id}</td>
                <td>${grade.student_id}</td>
                <td>${grade.qp_id}</td>
                <td>${grade.total_marks}</td>
                <td>${dateStr}</td>
            `;
            studentsListElement.appendChild(row);
        });
        teacherResultContainer.style.display = "block";
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
            const dateStr = grade.timestamp ? new Date(grade.timestamp * 1000).toLocaleString() : 'N/A';
            row.innerHTML = `
                <td>${grade.student_id || 'N/A'}</td>
                <td>${grade.assignment_id || 'N/A'}</td>
                <td>${grade.total_marks !== undefined && grade.total_marks !== null ? grade.total_marks : 'N/A'}</td>
                <td>${grade.evaluation_id || 'N/A'}</td>
                <td>${grade.qp_id || 'N/A'}</td>
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
            return;
        }
        
        if (!result.details || !Array.isArray(result.details)) {
            console.log("No details available");
            return;
        }
        
        // Create a function to render LaTeX if MathJax is available
        const renderLatex = (text) => {
            const tempDiv = document.createElement('div');
            tempDiv.textContent = text;
            
            // If MathJax is available, process the LaTeX
            if (window.MathJax) {
                MathJax.Hub.Queue(["Typeset", MathJax.Hub, tempDiv]);
            }
            
            return tempDiv.innerHTML;
        };
    
        result.details.forEach((question) => {
            const questionCard = document.createElement('div');
        questionCard.className = 'question-item'; // Updated class to match CSS
        questionCard.innerHTML = `
            <div class="question-header">
                <h3>Question ${question.question_number} ${question.subpart ? `(${question.subpart})` : ''}</h3>
                ${question.subpart ? `<span class="subpart">${question.subpart}</span>` : ''}
            </div>
            
            <div class="question-meta">
                <span class="marks">Marks: <span class="obtained">${question.marks || 0}</span> / <span class="max">${question.max_marks || 0}</span></span>
                <span class="timestamp">${Date(question.timestamp * 1000).toLocaleString() ? `Answered on: ${Date(question.timestamp * 1000).toLocaleString()}` : ''}</span>
            </div>

            <p class="question-text">${renderLatex(question.question || 'Question not available')}</p>

            <div class="answer-section">
                <h4>Your Answer:</h4>
                <pre>${renderLatex(question.student_answer || 'No answer provided')}</pre>
            </div>

            <div class="reasoning-section rubric">
                <h4>Feedback:</h4>
                <p>${renderLatex(question.feedback || 'No additional reasoning provided')}</p>
            </div>
        `;

        questionsContainer.appendChild(questionCard);
        });

        // Ensure MathJax is loaded and configured
        if (!window.MathJax) {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.7/MathJax.js?config=TeX-MML-AM_CHTML';
            script.async = true;
            document.head.appendChild(script);
        }
    }
});