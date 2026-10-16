import { useNavigate } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import PageScope from '../../components/PageScope'
import { useDisplayName } from '../../hooks/useDisplayName'
import '../../styles/pages/teacher-dashboard.css'

// Sample figures carried over from the static page (it never loaded real stats).
const STATS = [
  { title: 'Assignments Graded', value: '24', note: '8% from last month' },
  { title: 'Papers Processed', value: '547', note: '12% from last month' },
  { title: 'Average Score', value: '78%', note: '3% from last month' },
  { title: 'Time Saved', value: '42hrs', note: '15% from last month' },
]

const OPTIONS: { img: string; title: string; text: string; cta: string; to: string | null }[] = [
  {
    img: '/img/Screenshot 2025-04-03 164627.png',
    title: 'Upload Assignment / Question Paper',
    text: 'Upload your assignments or question papers for automated grading and analysis.',
    cta: 'Go to Upload',
    to: '/teacher/upload',
  },
  {
    img: '/img/ChatGPT Image Apr 3, 2025, 04_52_22 PM.png',
    title: 'View Grades',
    text: 'Access all your graded assignments, view statistics and download reports.',
    cta: 'Go to Grades',
    to: '/teacher/grades',
  },
  {
    img: '/img/ChatGPT Image Apr 3, 2025, 04_52_22 PM.png',
    title: 'Manual Grading & Correction',
    text: 'Review AI-flagged answers, annotate, adjust rubric scores, and finalize corrections before publishing.',
    cta: 'Open Correction Workspace',
    to: '/teacher/correction',
  },
  {
    img: '/img/analytic_dashboard.png',
    title: 'Analytics Dashboard',
    text: 'Get detailed insights into student performance with advanced analytics.',
    cta: 'View Analytics',
    to: null,
  },
  {
    img: '/img/student_magement_dashboard.png',
    title: 'Student Management',
    text: 'Add, update, and organize student information in your classes.',
    cta: 'Manage Students',
    to: null,
  },
]

export default function TeacherDashboard() {
  const navigate = useNavigate()
  const name = useDisplayName('Teacher')

  return (
    <PageScope name="teacher-dashboard" title="Teacher Dashboard">
      <AppShell>
        <section className="dashboard-container container">
          <div className="welcome-section">
            <div className="welcome-text">
              <h1>
                Welcome, <span>{name}</span>!
              </h1>
              <p>Here's an overview of your grading activities</p>
            </div>
            <div>
              <button className="btn btn-primary" onClick={() => navigate('/teacher/upload')}>
                <i className="material-icons">add</i> New Assignment
              </button>
            </div>
          </div>

          <div className="dashboard-stats">
            {STATS.map((s) => (
              <div className="stat-card" key={s.title}>
                <h3>{s.title}</h3>
                <div className="stat-value">{s.value}</div>
                <div className="stat-change positive">
                  <i className="material-icons">arrow_upward</i> {s.note}
                </div>
              </div>
            ))}
          </div>

          <div className="dashboard-options">
            {OPTIONS.map((o) => (
              <div className="option-card" key={o.title}>
                <div className="option-image">
                  <img src={o.img} alt={o.title} />
                </div>
                <div className="option-content">
                  <h3>{o.title}</h3>
                  <p>{o.text}</p>
                  {o.to ? (
                    <button className="btn btn-primary" onClick={() => navigate(o.to!)}>
                      {o.cta}
                    </button>
                  ) : (
                    <button className="btn btn-primary btn-upcoming" disabled title="Coming soon!">
                      {o.cta}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </AppShell>
    </PageScope>
  )
}
