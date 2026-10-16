/**
 * Shared "score hero" renderer — grade badge + fraction + progress bar +
 * correct/partial/needs-review counts, matching the wireframe's
 * T-Correction "AI score" panel.
 *
 * Loaded (via a <script> tag) BEFORE javascript/student_grade.js,
 * javascript/view_grades.js and javascript/student-details.js on any page
 * that shows a single student's results, so all three get an identical
 * grade summary instead of three separate implementations.
 */

function getGradeLetter(percent) {
  if (percent >= 90) return { letter: "A", cssVar: "--grade-a" };
  if (percent >= 80) return { letter: "B", cssVar: "--grade-b" };
  if (percent >= 70) return { letter: "C", cssVar: "--grade-c" };
  if (percent >= 60) return { letter: "D", cssVar: "--grade-d" };
  return { letter: "F", cssVar: "--grade-f" };
}

/**
 * @param {HTMLElement} container - element to render into (e.g. #score-hero)
 * @param {{totalMarks: number|string, maxMarks: number, details?: Array}} data
 *   `maxMarks` should be the sum of every question's max_marks (callers
 *   compute this from the `details` array — the summary record itself
 *   only carries total_marks, no assignment-wide max).
 */
function renderScoreHero(container, { totalMarks, maxMarks, details }) {
  if (!container) return;
  const max = parseFloat(maxMarks) || 0;
  const total = parseFloat(totalMarks) || 0;
  const percent = max > 0 ? Math.round((total / max) * 100) : 0;
  const grade = getGradeLetter(percent);

  let correct = 0;
  let partial = 0;
  let incorrect = 0;
  (details || []).forEach((q) => {
    const obtained = parseFloat(q.marks) || 0;
    const qMax = parseFloat(q.max_marks) || 0;
    if (qMax <= 0) return;
    if (obtained >= qMax) correct++;
    else if (obtained <= 0) incorrect++;
    else partial++;
  });

  const statsHtml = details && details.length
    ? `<div class="score-hero-stats">
        <div class="score-hero-stat"><div class="score-hero-stat-value correct">${correct}</div><div class="score-hero-stat-label">Correct</div></div>
        <div class="score-hero-stat"><div class="score-hero-stat-value partial">${partial}</div><div class="score-hero-stat-label">Partial</div></div>
        <div class="score-hero-stat"><div class="score-hero-stat-value incorrect">${incorrect}</div><div class="score-hero-stat-label">Needs review</div></div>
      </div>`
    : "";

  container.innerHTML = `
    <span class="score-hero-badge" style="background: var(${grade.cssVar})">${grade.letter}</span>
    <div class="score-hero-info">
      <div class="score-hero-fraction">${total}<span class="score-hero-max">/${max}</span></div>
      <div class="score-hero-label">Total score</div>
    </div>
    <div class="score-hero-progress">
      <div class="score-hero-progress-top">
        <span class="score-hero-percent-value">${percent}%</span>
        <span class="score-hero-percent-tag">of max marks</span>
      </div>
      <div class="score-hero-bar"><div class="score-hero-bar-fill" style="width: ${percent}%; background: var(${grade.cssVar})"></div></div>
    </div>
    ${statsHtml}
  `;
  container.hidden = false;
}
