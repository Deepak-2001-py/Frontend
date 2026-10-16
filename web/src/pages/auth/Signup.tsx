import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import PageScope from '../../components/PageScope'
import { apiRequest } from '../../lib/api'
import { dashboardPath } from '../../lib/session'
import '../../styles/pages/auth.css'
import AuthNavbar from './AuthNavbar'

type Role = 'student' | 'teacher'

const BENEFITS: Record<Role, { title: string; items: string[] }> = {
  student: {
    title: 'Why students love GradeAnt',
    items: [
      'Track your progress across subjects',
      'Get detailed feedback on assignments',
      'Access study resources and tips',
      'Collaborate with classmates on projects',
    ],
  },
  teacher: {
    title: 'Why educators love GradeAnt',
    items: [
      'Save up to 70% of grading time',
      'Provide consistent, detailed feedback',
      'Track student progress with analytics',
      'Seamless integration with your LMS',
    ],
  },
}

const PASSWORD_RULE = /^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{8,}$/

export default function Signup() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [role, setRole] = useState<Role>('student')
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    studentId: '',
    gradeLevel: '',
    institution: '',
    department: '',
    password: '',
    terms: false,
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const field = (name: keyof typeof form) => ({
    id: name,
    name,
    value: form[name] as string,
    onChange: (e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [name]: e.target.value })),
  })

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const firstName = form.firstName.trim()
    const lastName = form.lastName.trim()
    const email = form.email.trim()

    if (!firstName || !lastName || !email || !form.password || !form.terms) {
      setError('Please fill in all required fields and accept the terms.')
      return
    }
    if (!PASSWORD_RULE.test(form.password)) {
      setError('Password must be at least 8 characters long, include a number and a special character.')
      return
    }

    const roleSpecific =
      role === 'student'
        ? { studentId: form.studentId.trim(), gradeLevel: form.gradeLevel.trim() }
        : { institution: form.institution.trim(), department: form.department.trim() }
    const name = `${firstName} ${lastName}`

    setSubmitting(true)
    try {
      const data = await apiRequest<{ token: string; user_id: string }>('/auth/signup', {
        auth: false,
        body: { email, password: form.password, name, role, ...roleSpecific },
      })
      // The old page stored only token/userId/"userRole" here, so the rest of
      // the app (which reads "userType") treated every new user as a student.
      login({ token: data.token, userId: data.user_id, userType: role, userName: name, userData: data }, true)
      navigate(dashboardPath(role), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error signing up. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageScope name="auth" className="auth-page" title="Sign Up">
      <AuthNavbar active="signup" />

      <section className="auth-section">
        <div className="container">
          <div className="auth-container">
            <div className="auth-form-container">
              <div className="auth-brand-row">
                <span className="auth-logo-mark" />
                <span className="auth-logo-word">GradeAnt</span>
              </div>
              <h1>Create Your Account</h1>
              <p className="auth-subtitle">Join thousands of users on GradeAnt</p>

              {error && (
                <div className="alert alert-error" style={{ display: 'block' }}>
                  {error}
                </div>
              )}

              <form className="auth-form" onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>I am a:</label>
                  <div className="role-selector">
                    {(['student', 'teacher'] as const).map((r) => (
                      <div key={r} className={`role-option${role === r ? ' active' : ''}`} onClick={() => setRole(r)}>
                        {r === 'student' ? 'Student' : 'Teacher'}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="firstName">First Name</label>
                    <input type="text" required {...field('firstName')} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="lastName">Last Name</label>
                    <input type="text" required {...field('lastName')} />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="email">Email Address</label>
                  <input type="email" required {...field('email')} />
                </div>

                <div className={`student-fields${role === 'student' ? ' active' : ''}`}>
                  <div className="form-group">
                    <label htmlFor="studentId">Student ID</label>
                    <input type="text" {...field('studentId')} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="gradeLevel">Grade/Year Level</label>
                    <input type="text" {...field('gradeLevel')} />
                  </div>
                </div>

                <div className={`teacher-fields${role === 'teacher' ? ' active' : ''}`}>
                  <div className="form-group">
                    <label htmlFor="institution">Institution</label>
                    <input type="text" {...field('institution')} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="department">Department</label>
                    <input type="text" {...field('department')} />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <input type="password" required {...field('password')} />
                  <p className="password-hint">Must be at least 8 characters with a number and special character</p>
                </div>
                <div className="form-group terms-checkbox">
                  <label className="checkbox-container">
                    <input
                      type="checkbox"
                      required
                      checked={form.terms}
                      onChange={(e) => setForm((f) => ({ ...f, terms: e.target.checked }))}
                    />
                    <span className="checkmark" />
                    I agree to the <Link to="/terms">Terms of Service</Link> and <Link to="/privacy">Privacy Policy</Link>
                  </label>
                </div>
                <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
                  Create Account
                </button>
              </form>

              <p className="auth-switch">
                Already have an account? <Link to="/login">Log in</Link>
              </p>
            </div>

            <div className="auth-image">
              <img src="/img/Sign_Up.png" alt="Sign Up Illustration" />
              <div className="feature-highlights">
                <h3>{BENEFITS[role].title}</h3>
                <ul>
                  {BENEFITS[role].items.map((item) => (
                    <li key={item}>
                      <span className="check-icon">✓</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PageScope>
  )
}
