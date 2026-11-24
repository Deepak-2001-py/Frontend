import { useEffect, useState, type FormEvent } from 'react'
<<<<<<< HEAD
import { Link, useSearchParams } from 'react-router-dom'
import WorkflowPage from '../../components/WorkflowPage'
import { AppHero } from '../../components/app/AppKit'
import StudentResult from '../../components/grades/StudentResult'
import { EmptyState, GradePill, Notice, Spinner } from '../../components/ui'
import { useAuth } from '../../auth/AuthContext'
import { useAsync } from '../../hooks/useAsync'
import { apiCache } from '../../lib/apiCache'
import { gradesRequest, type GradeResult } from '../../lib/grading'
import { getProgress } from '../../lib/workflow'
import '../../styles/grades.css'
=======
import AlertStack from '../../components/AlertStack'
import AppShell from '../../components/AppShell'
import PageScope from '../../components/PageScope'
import StudentResult from '../../components/grades/StudentResult'
import { useAlerts } from '../../hooks/useAlerts'
import { apiCache } from '../../lib/apiCache'
import { gradesRequest, type GradeResult } from '../../lib/grading'
import '../../styles/themes/aesthetic.css'
import '../../styles/pages/student-grade.css'
>>>>>>> origin/main

const LAST_QUERY_KEY = 'lastQuery:studentGradePage'

export default function StudentGrade() {
<<<<<<< HEAD
  const { session } = useAuth()
  const [params] = useSearchParams()
  const [studentId, setStudentId] = useState(session?.userId ?? '')
  const [assignmentId, setAssignmentId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<GradeResult | null>(null)
  // Which assignment the shown result belongs to (highlights its shortcut).
  const [shownAssignment, setShownAssignment] = useState('')
  // Bumped on every successful search so the reveal animation replays.
  const [revealKey, setRevealKey] = useState(0)

  // Published results, offered as one-tap shortcuts. Optional: the form works without it.
  const progress = useAsync((force) => getProgress(force), [])
  const graded = progress.data?.results ?? []

  async function fetchGrades(sid: string, aid: string) {
    setResult(null)
    setError('')
=======
  const { alerts, show, dismiss } = useAlerts()
  const [studentId, setStudentId] = useState('')
  const [assignmentId, setAssignmentId] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<GradeResult | null>(null)
  // Bumped on every successful search so the reveal animation replays.
  const [revealKey, setRevealKey] = useState(0)

  async function fetchGrades(sid: string, aid: string) {
    setResult(null)
>>>>>>> origin/main
    setLoading(true)
    try {
      const data = await gradesRequest({ operation: 'getSingleStudentGrade', student_id: sid, assignment_id: aid })
      apiCache.set(LAST_QUERY_KEY, { studentId: sid, assignmentId: aid })
<<<<<<< HEAD
      if (!Array.isArray(data?.summary) || data.summary.length === 0) {
        setError('No result was found for that assignment code. Check the code, or ask your teacher whether the grade is published.')
        return
      }
      setResult(data)
      setShownAssignment(aid)
      setRevealKey((k) => k + 1)
    } catch (err) {
      setError(`Could not load your grades: ${(err as Error).message}`)
=======
      if (!Array.isArray(data?.summary)) {
        show('No summary available', 'danger')
        return
      }
      setResult(data)
      setRevealKey((k) => k + 1)
    } catch (err) {
      show(`Failed to load grades: ${(err as Error).message}`, 'danger')
>>>>>>> origin/main
    } finally {
      setLoading(false)
    }
  }

  // Coming back to this page re-shows the last search (served from cache).
<<<<<<< HEAD
  // ?assignment_id= (from My Assignments → View feedback) loads the signed-in student's result.
  useEffect(() => {
    const linked = params.get('assignment_id')
    if (linked && session?.userId) {
      setStudentId(session.userId)
      setAssignmentId(linked)
      void fetchGrades(session.userId, linked)
      return
    }
=======
  useEffect(() => {
>>>>>>> origin/main
    const last = apiCache.get<{ studentId?: string; assignmentId?: string }>(LAST_QUERY_KEY)
    if (last?.studentId && last.assignmentId) {
      setStudentId(last.studentId)
      setAssignmentId(last.assignmentId)
      void fetchGrades(last.studentId, last.assignmentId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const sid = studentId.trim()
    const aid = assignmentId.trim()
    if (!sid || !aid) {
<<<<<<< HEAD
      setError('Enter both your student ID and the assignment code.')
=======
      show('Please fill in all required fields in student view', 'danger')
>>>>>>> origin/main
      return
    }
    void fetchGrades(sid, aid)
  }

<<<<<<< HEAD
  function openGraded(aid: string) {
    const sid = session?.userId || studentId.trim()
    if (!sid) return
    setStudentId(sid)
    setAssignmentId(aid)
    void fetchGrades(sid, aid)
  }

  return (
    <WorkflowPage title="My Grades">
      <AppHero
        eyebrow="My grades"
        title="Your marks and feedback, question by question"
        text="Open a graded assignment to see how each answer was marked and what to fix next time."
        actions={
          <Link to="/student/assignments" className="ga-btn ga-btn-secondary">
            <span className="material-icons" aria-hidden>
              assignment
            </span>
            My assignments
          </Link>
        }
      />

      <section className="app-panel gr-lookup">
        <header className="app-panel-head">
          <h2>Find a result</h2>
        </header>

        {graded.length > 0 && (
          <div className="gr-recent">
            <div className="gr-label">Your graded work</div>
            <div className="gr-recent-list">
              {graded.map((r) => (
                <button
                  key={r.assignment_id}
                  type="button"
                  className={`gr-recent-item${result && shownAssignment === r.assignment_id ? ' is-active' : ''}`}
                  aria-pressed={!!result && shownAssignment === r.assignment_id}
                  disabled={loading}
                  onClick={() => openGraded(r.assignment_id)}
                >
                  <GradePill percent={r.percent} />
                  {r.title}
                  <small>{Math.round(r.percent)}%</small>
                </button>
              ))}
            </div>
          </div>
        )}

        <form
          className="gr-form"
          onSubmit={handleSubmit}
          onReset={() => {
            setStudentId(session?.userId ?? '')
            setAssignmentId('')
            setError('')
          }}
        >
          <div className="ga-field">
            <label htmlFor="assignment-id-student">Assignment code</label>
            <input
              type="text"
              id="assignment-id-student"
              className="ga-input"
              placeholder="e.g. A-thermo"
              required
              autoComplete="off"
              value={assignmentId}
              onChange={(e) => setAssignmentId(e.target.value)}
            />
          </div>
          <div className="ga-field">
            <label htmlFor="student-id">Student ID</label>
            <input
              type="text"
              id="student-id"
              className="ga-input"
              placeholder="Your student ID"
              required
              autoComplete="off"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            />
          </div>
          <div className="gr-form-actions">
            <button type="submit" className="ga-btn ga-btn-primary" disabled={loading}>
              <span className="material-icons" aria-hidden>
                search
              </span>
              {loading ? 'Loading…' : 'View result'}
            </button>
            <button type="reset" className="ga-btn ga-btn-secondary">
              Clear
            </button>
          </div>
        </form>
        <p className="gr-hint">The assignment code is on your assignment sheet. Your student ID is filled in for you.</p>
      </section>

      <div aria-live="polite">
        {error && <Notice tone="danger">{error}</Notice>}
        {loading && <Spinner label="Loading your result…" />}
      </div>

      {result && <StudentResult result={result} revealKey={revealKey} />}

      {!result && !loading && !error && (
        <section className="app-panel">
          <EmptyState title="No result open yet">
            {graded.length > 0
              ? 'Pick one of your graded assignments above, or enter an assignment code.'
              : 'Enter an assignment code above to see your marks and feedback.'}
          </EmptyState>
        </section>
      )}
    </WorkflowPage>
=======
  return (
    <PageScope name="student-grade" theme="aesthetic" title="My Grades">
      <AppShell footer={false}>
        <main className="main-content">
          <div className="container">
            <AlertStack alerts={alerts} onDismiss={dismiss} />
            <section className="tab-content active" role="tabpanel">
              <div className="card">
                <div className="card-header">
                  <span className="header-icon-badge">
                    <i className="fas fa-chart-bar" />
                  </span>
                  <h2>My Grades</h2>
                  <p>Enter your Student ID and Assignment Code to see your results and per-question feedback.</p>
                </div>
                <div className="card-body">
                  <nav className="secondary-nav" aria-label="User Type Navigation">
                    <ul className="nav-tabs" role="tablist">
                      <li role="presentation">
                        <button className="tab-btn active" aria-selected="true">
                          <i className="fas fa-user-graduate" /> Student View
                        </button>
                      </li>
                    </ul>
                  </nav>
                  <div className="student-grade-container">
                    <h3>Check Your Assignment Results</h3>
                    <form
                      className="form"
                      onSubmit={handleSubmit}
                      onReset={() => {
                        setStudentId('')
                        setAssignmentId('')
                      }}
                    >
                      <div className="form-row">
                        <div className="form-group">
                          <label htmlFor="student-id">Student ID Number</label>
                          <input
                            type="text"
                            id="student-id"
                            className="form-control"
                            placeholder="Enter your student ID"
                            required
                            value={studentId}
                            onChange={(e) => setStudentId(e.target.value)}
                          />
                          <small className="form-text">Your unique student identifier</small>
                        </div>
                        <div className="form-group">
                          <label htmlFor="assignment-id-student">Assignment Code</label>
                          <input
                            type="text"
                            id="assignment-id-student"
                            className="form-control"
                            placeholder="Enter assignment code"
                            required
                            value={assignmentId}
                            onChange={(e) => setAssignmentId(e.target.value)}
                          />
                          <small className="form-text">Find this code on your assignment sheet</small>
                        </div>
                      </div>
                      <div className="form-actions">
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                          <i className="fas fa-search" /> Retrieve Results
                        </button>
                        <button type="reset" className="btn btn-secondary">
                          <i className="fas fa-redo" /> Clear
                        </button>
                      </div>
                    </form>

                    {loading && (
                      <div className="loader-container">
                        <div className="loader" id="student-loader" />
                      </div>
                    )}

                    {result && <StudentResult result={result} revealKey={revealKey} />}

                    <button className="print-button" onClick={() => window.print()}>
                      Print Section
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
      </AppShell>
    </PageScope>
>>>>>>> origin/main
  )
}
