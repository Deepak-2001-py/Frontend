import { Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import PageScope from '../../components/PageScope'
import { useDisplayName } from '../../hooks/useDisplayName'
import '../../styles/pages/student-dashboard.css'

// Placeholder content carried over from the static page. The old page fetched
// /students/{id}/assignments and /grades but never rendered them
// (updateDashboardData only logged), so these remain sample values until
// those endpoints are wired into the cards below.
const STATS = [
  { title: 'Overall Grade', value: 'B+', trend: 'positive', icon: 'arrow_upward', note: 'Improved from B' },
  { title: 'Assignments Completed', value: '18/24', trend: 'neutral', icon: 'timeline', note: '75% completion rate' },
  { title: 'Average Score', value: '83%', trend: 'positive', icon: 'arrow_upward', note: '5% from last month' },
  { title: 'Upcoming Due', value: '3', trend: 'negative', icon: 'today', note: 'Next due in 2 days' },
] as const

type AssignmentStatus = 'pending' | 'submitted' | 'graded'
const ASSIGNMENTS: { name: string; subject: string; due: string; status: AssignmentStatus; grade?: string }[] = [
  { name: 'Final Project Report', subject: 'Computer Science', due: 'Apr 25, 2025', status: 'pending' },
  { name: 'Chapter 8 Problems', subject: 'Mathematics', due: 'Apr 24, 2025', status: 'pending' },
  { name: 'Essay Draft', subject: 'English Literature', due: 'Apr 20, 2025', status: 'submitted' },
  { name: 'Lab Report', subject: 'Physics', due: 'Apr 18, 2025', status: 'graded', grade: 'A-' },
  { name: 'Midterm Exam', subject: 'Chemistry', due: 'Apr 15, 2025', status: 'graded', grade: 'B+' },
]

const SUBJECTS = [
  { name: 'Mathematics', grade: 'B+' },
  { name: 'English Literature', grade: 'A-' },
  { name: 'Computer Science', grade: 'A' },
  { name: 'Physics', grade: 'B' },
  { name: 'Chemistry', grade: 'C+' },
]

const FEEDBACK = [
  {
    title: 'Physics Lab Report',
    text: 'Good experimental procedure, but needs more detailed analysis of results. Consider adding error analysis in future reports.',
    meta: 'Apr 19, 2025 - Dr. Wilson',
  },
  {
    title: 'English Essay',
    text: 'Excellent thesis statement and strong supporting arguments. Work on conclusion to better tie your points together.',
    meta: 'Apr 16, 2025 - Ms. Rodriguez',
  },
  {
    title: 'Chemistry Midterm',
    text: 'Good understanding of basic concepts, but struggled with organic chemistry section. Review chapters 7-9.',
    meta: 'Apr 15, 2025 - Dr. Thompson',
  },
]

function gradeClass(grade: string) {
  return `grade-${grade[0].toLowerCase()}`
}

export default function StudentDashboard() {
  const navigate = useNavigate()
  const name = useDisplayName('Student')

  const options = [
    {
      img: '/img/Screenshot 2025-04-03 164627.png',
      title: 'My Assignments',
      text: 'See what your teachers published, submit your answers and track grading.',
      cta: 'Open Assignments',
      to: '/student/assignments',
    },
    {
      img: '/img/ChatGPT Image Apr 3, 2025, 04_52_22 PM.png',
      title: 'View Feedback & Grades',
      text: 'Access teacher comments, review graded assignments, and track your progress.',
      cta: 'View Grades',
      to: '/student/grades',
    },
    {
      img: '/img/study_resources.png',
      title: 'Study Resources',
      text: 'Access study materials, practice questions, and additional learning resources.',
      cta: 'Browse Resources',
      to: null,
    },
    {
      img: '/img/academic_calendar.png',
      title: 'Academic Calendar',
      text: 'View important dates, upcoming assignments, tests and project deadlines.',
      cta: 'View Calendar',
      to: null,
    },
  ]

  return (
    <PageScope name="student-dashboard" title="Dashboard">
      <AppShell>
        <section className="dashboard-container container">
          <div className="welcome-section">
            <div className="welcome-text">
              <h1>
                Welcome, <span>{name}</span>!
              </h1>
              <p>Here's an overview of your academic progress</p>
            </div>
            <div>
              <button onClick={() => navigate('/student/assignments')} className="btn btn-primary">
                <i className="material-icons">assignment</i> View Assignments
              </button>
            </div>
          </div>

          <div className="dashboard-stats">
            {STATS.map((s) => (
              <div className="stat-card" key={s.title}>
                <h3>{s.title}</h3>
                <div className="stat-value">{s.value}</div>
                <div className={`stat-change ${s.trend}`}>
                  <i className="material-icons">{s.icon}</i> {s.note}
                </div>
              </div>
            ))}
          </div>

          <div className="dashboard-options">
            {options.map((o) => (
              <div className="option-card" key={o.title}>
                <div className="option-image">
                  <img src={o.img} alt={o.title} />
                </div>
                <div className="option-content">
                  <h3>{o.title}</h3>
                  <p>{o.text}</p>
                  {/* Resources and calendar pages don't exist yet (the old links 404'd). */}
                  <button
                    className="btn btn-primary"
                    disabled={!o.to}
                    title={o.to ? undefined : 'Coming soon'}
                    onClick={() => o.to && navigate(o.to)}
                  >
                    {o.cta}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="upcoming-section">
            <h2>Upcoming &amp; Recent Assignments</h2>
            <div className="table-responsive">
              <table className="assignment-table">
                <thead>
                  <tr>
                    <th>Assignment</th>
                    <th>Subject</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {ASSIGNMENTS.map((a) => (
                    <tr key={a.name}>
                      <td>{a.name}</td>
                      <td>{a.subject}</td>
                      <td>{a.due}</td>
                      <td>
                        <span className={`status-badge status-${a.status}`}>
                          {a.status === 'graded' ? `Graded: ${a.grade}` : a.status[0].toUpperCase() + a.status.slice(1)}
                        </span>
                      </td>
                      <td>
                        {a.status === 'pending' ? (
                          <button className="btn btn-sm btn-primary" onClick={() => navigate('/student/upload')}>
                            Start
                          </button>
                        ) : (
                          <button className="btn btn-sm btn-secondary" onClick={() => navigate('/student/grades')}>
                            {a.status === 'graded' ? 'View Feedback' : 'View'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="progress-cards">
            <div className="progress-card">
              <h3>Semester Progress</h3>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: '65%' }} />
              </div>
              <div className="progress-percentage">
                <span>65% Complete</span>
                <span>5 weeks remaining</span>
              </div>
              <div className="subject-scores">
                {SUBJECTS.map((s) => (
                  <div className="subject-score" key={s.name}>
                    <span className="subject-name">{s.name}</span>
                    <span className={`subject-grade ${gradeClass(s.grade)}`}>{s.grade}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="progress-card">
              <h3>Recent Feedback</h3>
              <div className="feedback-items">
                {FEEDBACK.map((f, i) => (
                  <Fragment key={f.title}>
                    {i > 0 && <hr />}
                    <div className="feedback-item">
                      <p>
                        <strong>{f.title}:</strong> {f.text}
                      </p>
                      <small>{f.meta}</small>
                    </div>
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
        </section>
      </AppShell>
    </PageScope>
  )
}
