import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AlertStack from '../../components/AlertStack'
import AppShell from '../../components/AppShell'
import PageScope from '../../components/PageScope'
import StudentResult from '../../components/grades/StudentResult'
import { useAlerts } from '../../hooks/useAlerts'
import { apiCache } from '../../lib/apiCache'
import { formatTimestamp, gradesRequest, type GradeResult, type GradeSummary } from '../../lib/grading'
import '../../styles/themes/aesthetic.css'
import '../../styles/themes/teacher-grade.css'
import '../../styles/pages/teacher-view-grade.css'

type Tab = 'student' | 'teacher'
type RosterRow = GradeSummary & { evaluation_id: string; student_id: string; qp_id: string }

const LAST_STUDENT = 'lastQuery:studentGrade'
const LAST_TEACHER = 'lastQuery:teacherGrades'

function ClassStats({ grades }: { grades: GradeSummary[] }) {
  const marks = grades.map((g) => parseFloat(String(g.total_marks))).filter((n) => !Number.isNaN(n))
  if (marks.length === 0) return null
  const average = marks.reduce((s, n) => s + n, 0) / marks.length
  return (
    <div className="class-stats">
      <div className="class-stat">
        <div className="class-stat-value">{grades.length}</div>
        <div className="class-stat-label">Students</div>
      </div>
      <div className="class-stat">
        <div className="class-stat-value">{average.toFixed(1)}</div>
        <div className="class-stat-label">Average</div>
      </div>
      <div className="class-stat">
        <div className="class-stat-value highest">{Math.max(...marks)}</div>
        <div className="class-stat-label">Highest</div>
      </div>
      <div className="class-stat">
        <div className="class-stat-value lowest">{Math.min(...marks)}</div>
        <div className="class-stat-label">Lowest</div>
      </div>
    </div>
  )
}

function SearchActions({ disabled }: { disabled: boolean }) {
  return (
    <div className="form-actions">
      <button type="submit" className="btn btn-primary" disabled={disabled}>
        <i className="fas fa-search" /> Retrieve Results
      </button>
      <button type="reset" className="btn btn-secondary">
        <i className="fas fa-redo" /> Clear
      </button>
    </div>
  )
}

export default function TeacherViewGrade() {
  const [params] = useSearchParams()
  const { alerts, show, dismiss } = useAlerts()
  const [tab, setTab] = useState<Tab>('teacher')

  // "Preview: what the student sees"
  const [studentId, setStudentId] = useState('')
  const [studentAssignment, setStudentAssignment] = useState('')
  const [studentLoading, setStudentLoading] = useState(false)
  const [studentResult, setStudentResult] = useState<GradeResult | null>(null)
  const [revealKey, setRevealKey] = useState(0)

  // "All student summary"
  const [qpId, setQpId] = useState('')
  const [teacherAssignment, setTeacherAssignment] = useState('')
  const [teacherLoading, setTeacherLoading] = useState(false)
  const [roster, setRoster] = useState<RosterRow[] | null>(null)
  const [rosterQuery, setRosterQuery] = useState<{ qpId: string; assignmentId: string } | null>(null)

  async function fetchStudentGrades(sid: string, aid: string) {
    setStudentLoading(true)
    try {
      const data = await gradesRequest({ operation: 'getSingleStudentGrade', student_id: sid, assignment_id: aid })
      apiCache.set(LAST_STUDENT, { studentId: sid, assignmentId: aid })
      if (!Array.isArray(data?.summary) || data.summary.length === 0) {
        show('No summary records found', 'info')
        return
      }
      setStudentResult(data)
      setRevealKey((k) => k + 1)
      show(`Successfully loaded ${data.summary.length} summary record(s)`, 'success')
    } catch (err) {
      show(`Failed to load grades: ${(err as Error).message}`, 'danger')
    } finally {
      setStudentLoading(false)
    }
  }

  async function fetchAllGrades(qp: string, aid: string) {
    setTeacherLoading(true)
    setRosterQuery({ qpId: qp, assignmentId: aid })
    try {
      const data = await gradesRequest<{ grades?: GradeSummary[] }>({
        operation: 'getAllStudentGrades',
        qp_id: qp,
        assignment_id: aid,
      })
      apiCache.set(LAST_TEACHER, { qpId: qp, assignmentId: aid })
      if (!Array.isArray(data?.grades)) {
        show('No grades data received', 'warning')
        return
      }
      if (data.grades.length === 0) {
        show('No grades found', 'info')
        return
      }
      const valid = data.grades.filter((g): g is RosterRow => !!(g?.evaluation_id && g.student_id && g.qp_id))
      if (valid.length === 0) {
        show('No valid grade records found', 'warning')
        return
      }
      setRoster(valid)
      show(`Successfully loaded ${valid.length} grade record(s)`, 'success')
    } catch (err) {
      show(`Failed to fetch all grades: ${(err as Error).message}`, 'danger')
    } finally {
      setTeacherLoading(false)
    }
  }

  // Coming back to this page re-shows the last searches (served from cache).
  useEffect(() => {
    const s = apiCache.get<{ studentId?: string; assignmentId?: string }>(LAST_STUDENT)
    if (s?.studentId && s.assignmentId) {
      setStudentId(s.studentId)
      setStudentAssignment(s.assignmentId)
      void fetchStudentGrades(s.studentId, s.assignmentId)
    }
    // ?qp_id=&assignment_id= (from the correction worklist's Finalize) wins over the last search.
    const linkQp = params.get('qp_id')
    const linkAssignment = params.get('assignment_id')
    const t =
      linkQp && linkAssignment
        ? { qpId: linkQp, assignmentId: linkAssignment }
        : apiCache.get<{ qpId?: string; assignmentId?: string }>(LAST_TEACHER)
    if (t?.qpId && t.assignmentId) {
      setQpId(t.qpId)
      setTeacherAssignment(t.assignmentId)
      void fetchAllGrades(t.qpId, t.assignmentId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onStudentSubmit(e: FormEvent) {
    e.preventDefault()
    if (!studentId.trim() || !studentAssignment.trim()) {
      show('Please fill in all required fields in student view', 'danger')
      return
    }
    void fetchStudentGrades(studentId.trim(), studentAssignment.trim())
  }

  function onTeacherSubmit(e: FormEvent) {
    e.preventDefault()
    if (!qpId.trim() || !teacherAssignment.trim()) {
      show('Please fill in all required fields in teacher view', 'danger')
      return
    }
    void fetchAllGrades(qpId.trim(), teacherAssignment.trim())
  }

  // "Open Correction Workspace" carries the current search across.
  const correctionLink = rosterQuery
    ? `/teacher/correction?${new URLSearchParams({ qp_id: rosterQuery.qpId, assignment_id: rosterQuery.assignmentId })}`
    : '/teacher/correction'

  const detailsLink = (g: RosterRow) => {
    const p = new URLSearchParams({ student_id: g.student_id, qp_id: g.qp_id })
    if (g.assignment_id) p.set('assignment_id', g.assignment_id)
    return `/teacher/student-details?${p}`
  }

  return (
    <PageScope name="teacher-view-grade" theme={['aesthetic', 'teacher-grade']} title="Students Grades">
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
                  <h2>View Grades</h2>
                  <p>Look up any student's results or pull the full class summary for a question paper.</p>
                </div>
                <div className="card-body">
                  <nav className="secondary-nav" aria-label="User Type Navigation">
                    <ul className="nav-tabs" role="tablist">
                      <li role="presentation">
                        <button
                          className={`tab-btn${tab === 'student' ? ' active' : ''}`}
                          aria-selected={tab === 'student'}
                          onClick={() => setTab('student')}
                        >
                          <i className="fas fa-eye" /> Preview: What the Student Sees
                        </button>
                      </li>
                      <li role="presentation">
                        <button
                          className={`tab-btn${tab === 'teacher' ? ' active' : ''}`}
                          aria-selected={tab === 'teacher'}
                          onClick={() => setTab('teacher')}
                        >
                          <i className="fas fa-chalkboard-teacher" /> All Student Summary View
                        </button>
                      </li>
                    </ul>
                  </nav>

                  <div className="sub-tab-content" style={{ display: tab === 'student' ? 'block' : 'none' }}>
                    <h3>Preview a student's result</h3>
                    <div className="preview-banner">
                      <i className="fas fa-eye" /> This renders exactly what the student sees on their own grade page —
                      same question breakdown, same correct/needs-correction badges, no editing controls.
                    </div>
                    <form
                      className="form"
                      onSubmit={onStudentSubmit}
                      onReset={() => {
                        setStudentId('')
                        setStudentAssignment('')
                      }}
                    >
                      <div className="form-row">
                        <div className="form-group">
                          <label htmlFor="student-id">Student ID</label>
                          <input
                            type="text"
                            id="student-id"
                            className="form-control"
                            placeholder="Enter your student ID"
                            required
                            value={studentId}
                            onChange={(e) => setStudentId(e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor="assignment-id-student">Assignment ID</label>
                          <input
                            type="text"
                            id="assignment-id-student"
                            className="form-control"
                            placeholder="Enter assignment ID"
                            required
                            value={studentAssignment}
                            onChange={(e) => setStudentAssignment(e.target.value)}
                          />
                        </div>
                      </div>
                      <SearchActions disabled={studentLoading} />
                    </form>
                    {studentLoading && (
                      <div className="loader-container">
                        <div className="loader" id="student-loader" />
                      </div>
                    )}
                    {studentResult && <StudentResult result={studentResult} revealKey={revealKey} />}
                    <button className="print-button" onClick={() => window.print()}>
                      Print Section
                    </button>
                  </div>

                  <div className="sub-tab-content active" style={{ display: tab === 'teacher' ? 'block' : 'none' }}>
                    <div className="questions-toolbar">
                      <h3>All Student Grades</h3>
                      <Link to={correctionLink} className="preview-toggle-btn">
                        <i className="fas fa-marker" /> Open Correction Workspace
                      </Link>
                    </div>
                    <form
                      className="form"
                      onSubmit={onTeacherSubmit}
                      onReset={() => {
                        setQpId('')
                        setTeacherAssignment('')
                      }}
                    >
                      <div className="form-row">
                        <div className="form-group">
                          <label htmlFor="qp-id">Question Paper ID</label>
                          <input
                            type="text"
                            id="qp-id"
                            className="form-control"
                            placeholder="Enter question paper ID"
                            required
                            value={qpId}
                            onChange={(e) => setQpId(e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor="assignment-id-teacher">Assignment ID</label>
                          <input
                            type="text"
                            id="assignment-id-teacher"
                            className="form-control"
                            placeholder="Enter assignment ID"
                            required
                            value={teacherAssignment}
                            onChange={(e) => setTeacherAssignment(e.target.value)}
                          />
                        </div>
                      </div>
                      <SearchActions disabled={teacherLoading} />
                    </form>
                    {teacherLoading && (
                      <div className="loader-container">
                        <div className="loader" />
                      </div>
                    )}
                    {roster && (
                      <div className="result-container is-revealed" style={{ display: 'block' }}>
                        <ClassStats grades={roster} />
                        <h4>Student Grades Summary</h4>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Evaluation ID</th>
                              <th>Student ID</th>
                              <th>QP-ID</th>
                              <th>Total Marks</th>
                              <th>Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {roster.map((g) => (
                              <tr key={g.evaluation_id}>
                                <td>{g.evaluation_id}</td>
                                <td>
                                  <Link to={detailsLink(g)} style={{ color: 'blue', textDecoration: 'underline' }}>
                                    {g.student_id}
                                  </Link>
                                </td>
                                <td>{g.qp_id}</td>
                                <td>{g.total_marks ?? 'N/A'}</td>
                                <td>{formatTimestamp(g.timestamp) || 'N/A'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
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

