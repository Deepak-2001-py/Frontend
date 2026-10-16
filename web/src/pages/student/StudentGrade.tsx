import { useEffect, useState, type FormEvent } from 'react'
import AlertStack from '../../components/AlertStack'
import AppShell from '../../components/AppShell'
import PageScope from '../../components/PageScope'
import StudentResult from '../../components/grades/StudentResult'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useAlerts } from '../../hooks/useAlerts'
import { apiCache } from '../../lib/apiCache'
import { gradesRequest, type GradeResult } from '../../lib/grading'
import '../../styles/themes/aesthetic.css'
import '../../styles/pages/student-grade.css'

const LAST_QUERY_KEY = 'lastQuery:studentGradePage'

export default function StudentGrade() {
  const { alerts, show, dismiss } = useAlerts()
  const [studentId, setStudentId] = useState('')
  const [assignmentId, setAssignmentId] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<GradeResult | null>(null)
  // Bumped on every successful search so the reveal animation replays.
  const [revealKey, setRevealKey] = useState(0)

  async function fetchGrades(sid: string, aid: string) {
    setResult(null)
    setLoading(true)
    try {
      const data = await gradesRequest({ operation: 'getSingleStudentGrade', student_id: sid, assignment_id: aid })
      apiCache.set(LAST_QUERY_KEY, { studentId: sid, assignmentId: aid })
      if (!Array.isArray(data?.summary)) {
        show('No summary available', 'danger')
        return
      }
      setResult(data)
      setRevealKey((k) => k + 1)
    } catch (err) {
      show(`Failed to load grades: ${(err as Error).message}`, 'danger')
    } finally {
      setLoading(false)
    }
  }

  // Coming back to this page re-shows the last search (served from cache).
  // ?assignment_id= (from My Assignments → View feedback) loads the signed-in student's result.
  const [params] = useSearchParams()
  const { session } = useAuth()
  useEffect(() => {
    const linked = params.get('assignment_id')
    if (linked && session?.userId) {
      setStudentId(session.userId)
      setAssignmentId(linked)
      void fetchGrades(session.userId, linked)
      return
    }
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
      show('Please fill in all required fields in student view', 'danger')
      return
    }
    void fetchGrades(sid, aid)
  }

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
  )
}
