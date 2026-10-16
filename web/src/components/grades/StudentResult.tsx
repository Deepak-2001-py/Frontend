import { formatTimestamp, maxMarksOf, type GradeResult } from '../../lib/grading'
import QuestionViewer from './QuestionViewer'
import ScoreHero from './ScoreHero'

/**
 * One student's result for one assignment: score hero, summary table and
 * the question-by-question breakdown. `revealKey` remounts the container so
 * the CSS reveal animation replays on each new search.
 */
export default function StudentResult({ result, revealKey }: { result: GradeResult; revealKey?: number }) {
  const summary = result.summary ?? []
  const first = summary[0]

  return (
    <div key={revealKey} className="result-container is-revealed" style={{ display: 'block' }}>
      {first && (
        <ScoreHero totalMarks={first.total_marks} maxMarks={maxMarksOf(result.details)} details={result.details} />
      )}
      <h4>Your Assignment Summary</h4>
      <table className="summary-table">
        <thead>
          <tr>
            <th>Student ID</th>
            <th>Assignment ID</th>
            <th>Total Marks</th>
            <th>Evaluation ID</th>
            <th>QP ID</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {summary.map((g, i) => (
            <tr key={i}>
              <td>{g.student_id || 'N/A'}</td>
              <td>{g.assignment_id || 'N/A'}</td>
              <td>{g.total_marks ?? 'N/A'}</td>
              <td>{g.evaluation_id || 'N/A'}</td>
              <td>{g.qp_id || 'N/A'}</td>
              <td>{formatTimestamp(g.timestamp) || 'N/A'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h4>Question Breakdown</h4>
      {Array.isArray(result.details) && <QuestionViewer details={result.details} />}
    </div>
  )
}
