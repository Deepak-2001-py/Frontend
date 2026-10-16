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

  // Shows a .result-container and (re)plays its CSS reveal animation
  // (asthetic_style.css's resultReveal keyframes) — removing the class
  // before re-adding it, via a forced reflow, is what lets the animation
  // replay on a second search rather than only firing once ever.
  function revealResultContainer(el) {
    if (!el) return;
    el.style.display = "block";
    el.classList.remove("is-revealed");
    void el.offsetWidth;
    el.classList.add("is-revealed");
  }
  
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

  // Restore the last search on this tab so navigating back to this page
  // shows the same result again instead of an empty form. This re-fetch
  // resolves straight from apiCache (same exact query = cache hit).
  (function restoreLastQuery() {
    const last = apiCache.get("lastQuery:studentGradePage");
    if (last && last.studentId && last.assignmentId) {
      document.getElementById("student-id").value = last.studentId;
      document.getElementById("assignment-id-student").value = last.assignmentId;
      fetchStudentGrades(last.studentId, last.assignmentId);
    }
  })();
  
  // Utility for API requests using the configured GRADES endpoint — reads
  // are cached per exact query for the tab session, so re-searching the
  // same student/assignment or coming back to this page doesn't re-fetch.
  async function makeAPIRequest(data) {
    const cacheKey = `grades:${JSON.stringify(data)}`;
    const cached = apiCache.get(cacheKey);
    if (cached !== undefined) return cached;
    try {
      const authToken = sessionStorage.getItem("authToken") || localStorage.getItem("authToken");
      const response = await fetch(CONFIG.API.GRADES_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
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
      apiCache.set("lastQuery:studentGradePage", { studentId, assignmentId });

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

    const scoreHero = document.getElementById("score-hero");
    if (scoreHero && result.summary[0]) {
      const maxMarks = Array.isArray(result.details)
        ? result.details.reduce((sum, q) => sum + (parseFloat(q.max_marks) || 0), 0)
        : 0;
      renderScoreHero(scoreHero, {
        totalMarks: result.summary[0].total_marks,
        maxMarks,
        details: result.details,
      });
    }

    revealResultContainer(studentResultContainer);
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

      result.details.forEach((question, index) => {
        const questionCard = document.createElement('div');
        const status = getMarksStatus(question.marks, question.max_marks);
        const badge = getStatusBadge(status);
        questionCard.className = `question-item status-${status}`;
        questionCard.id = `q-card-${index}`;
        questionCard.dataset.qIndex = String(index);

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
            ${badge.text ? `<span class="status-badge status-badge-${status}">${badge.text}</span>` : ''}
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
            <button type="button" class="feedback-toggle-btn" aria-expanded="false">
              <span>${status === 'correct' ? 'Feedback' : 'Correction'}</span>
              <span class="feedback-toggle-icon">▾</span>
            </button>
            <div class="feedback-container" hidden>${renderContent(question.feedback || 'No additional reasoning provided')}</div>
          </div>
        `;

        questionsContainer.appendChild(questionCard);
      });

      // Horizontal one-question-at-a-time viewer: a scroll-snapped row of
      // cards (CSS) + a pill-based question path nav above it, mirroring the
      // wireframe's "‹ Q3 / Q5 ›" question pager pattern.
      setupQuestionPathNav(result.details);

      // Load MathJax if needed
      loadMathJax(questionsContainer);
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

    // #questions-container is a horizontal flex row of cards laid out
    // side by side — even with align-items:flex-start (so a short card no
    // longer stretches to the tallest one), the ROW itself is still as
    // tall as its tallest child, leaving dead space below whichever
    // (shorter) card is actually in view. Pinning the container's height
    // to just the active card's own height removes that gap; called
    // whenever the active card changes (goToQuestion, swipe scroll-sync)
    // or its content resizes in place (feedback/rubric toggles).
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

    // Keeps the pill nav in sync when the user swipes/scrolls the row
    // directly instead of using the pager buttons.
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

    // Feedback/correction starts collapsed on every card; one delegated
    // listener (bound once, guarded by a dataset flag since cards are
    // rebuilt on every displayDetails() call) toggles it open on click.
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

  // Initialize the page
  document.addEventListener('DOMContentLoaded', function() {
    // Initially hide the student results section
    hideResults("student-result");
    
    // Hide the loader initially
    hideLoading("student-loader-container");
  });