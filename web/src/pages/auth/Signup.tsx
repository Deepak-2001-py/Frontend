import { useState, type ChangeEvent, type FormEvent } from 'react'
<<<<<<< HEAD
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { API, ROLES, SELF_SIGNUP_ROLES, type RoleName } from '../../config'
import { apiRequest } from '../../lib/api'
import { dashboardPath } from '../../lib/session'
import { AuthShell, Notice, PasswordInput, PasswordRules, RoleSwitch, SignupPreview } from './AuthLayout'
import { unmetPasswordRule } from './passwordRules'

// Which roles can sign up here comes from config/app.yaml (roles.<role>.signup
// includes "self"). Invite-only roles are created from an admin's emailed invite.
const INVITE_ONLY = ROLES.filter((r) => !r.signup.includes('self') && r.signup.includes('invite') && r.name !== 'admin')

const EMPTY = {
  firstName: '',
  lastName: '',
  email: '',
  studentId: '',
  gradeLevel: '',
  institution: '',
  department: '',
  password: '',
}

export default function Signup() {
  const { login } = useAuth()
  const navigate = useNavigate()
  // ?role=teacher preselects a role (e.g. from the demo page), if that role can self-sign-up.
  const [params] = useSearchParams()
  const wanted = SELF_SIGNUP_ROLES.find((r) => r.name === params.get('role'))
  const [role, setRole] = useState<RoleName>(wanted?.name ?? SELF_SIGNUP_ROLES[0]?.name ?? 'student')
  const [form, setForm] = useState(EMPTY)
  const [terms, setTerms] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const field = (name: keyof typeof EMPTY) => ({
    id: name,
    name,
    className: 'lp-input',
    value: form[name],
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, [name]: e.target.value }))
      setError(null) // an error stays until the person changes something
    },
=======
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
>>>>>>> origin/main
  })

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const firstName = form.firstName.trim()
    const lastName = form.lastName.trim()
    const email = form.email.trim()

<<<<<<< HEAD
    if (!firstName || !lastName || !email || !form.password) {
      setError('Fill in your name, email and a password.')
      return
    }
    const unmet = unmetPasswordRule(form.password)
    if (unmet) {
      setError(`Your password needs ${unmet.label.toLowerCase()}.`)
      return
    }
    if (!terms) {
      setError('Accept the Terms of Service and Privacy Policy to create your account.')
=======
    if (!firstName || !lastName || !email || !form.password || !form.terms) {
      setError('Please fill in all required fields and accept the terms.')
      return
    }
    if (!PASSWORD_RULE.test(form.password)) {
      setError('Password must be at least 8 characters long, include a number and a special character.')
>>>>>>> origin/main
      return
    }

    const roleSpecific =
<<<<<<< HEAD
      role === 'teacher'
        ? { institution: form.institution.trim(), department: form.department.trim() }
        : { studentId: form.studentId.trim(), gradeLevel: form.gradeLevel.trim() }
=======
      role === 'student'
        ? { studentId: form.studentId.trim(), gradeLevel: form.gradeLevel.trim() }
        : { institution: form.institution.trim(), department: form.department.trim() }
>>>>>>> origin/main
    const name = `${firstName} ${lastName}`

    setSubmitting(true)
    try {
<<<<<<< HEAD
      const data = await apiRequest<{ token: string; user_id: string }>(API.auth.signup, {
        auth: false,
        body: { email, password: form.password, name, role, ...roleSpecific },
      })
      login({ token: data.token, userId: data.user_id, userType: role, userName: name, userData: data }, true)
      navigate(dashboardPath(role), { replace: true })
    } catch (err) {
      const text = err instanceof Error ? err.message : ''
      setError(
        text === 'User already exists'
          ? 'An account with this email already exists. Log in instead, or use a different email.'
          : text || 'Sign up failed. Try again.',
      )
=======
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
>>>>>>> origin/main
    } finally {
      setSubmitting(false)
    }
  }

  return (
<<<<<<< HEAD
    <AuthShell title="Sign up" aside={<SignupPreview role={role} />}>
      <h1>Create your account</h1>
      <p className="au-lead">Free to start. Takes about a minute.</p>

      {INVITE_ONLY.length > 0 && (
        <Notice tone="info">
          {INVITE_ONLY.map((r) => r.label).join(' and ')} accounts are created by your school administrator. Check your
          email for an invite.
        </Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}

      <form className="lp-form au-form" onSubmit={handleSubmit} noValidate>
        {SELF_SIGNUP_ROLES.length > 1 && (
          <RoleSwitch name="role" legend="I am a" roles={SELF_SIGNUP_ROLES} value={role} onChange={setRole} />
        )}

        <div className="lp-form-row">
          <div className="lp-field">
            <label htmlFor="firstName">First name</label>
            <input type="text" autoComplete="given-name" required {...field('firstName')} />
          </div>
          <div className="lp-field">
            <label htmlFor="lastName">Last name</label>
            <input type="text" autoComplete="family-name" required {...field('lastName')} />
          </div>
        </div>

        <div className="lp-field">
          <label htmlFor="email">Email</label>
          <input type="email" autoComplete="email" required {...field('email')} />
        </div>

        {role === 'teacher' ? (
          <div className="lp-form-row">
            <div className="lp-field">
              <label htmlFor="institution">
                School <span className="au-optional">(optional)</span>
              </label>
              <input type="text" autoComplete="organization" {...field('institution')} />
            </div>
            <div className="lp-field">
              <label htmlFor="department">
                Department <span className="au-optional">(optional)</span>
              </label>
              <input type="text" {...field('department')} />
            </div>
          </div>
        ) : (
          <div className="lp-form-row">
            <div className="lp-field">
              <label htmlFor="studentId">
                Student ID <span className="au-optional">(optional)</span>
              </label>
              <input type="text" {...field('studentId')} />
            </div>
            <div className="lp-field">
              <label htmlFor="gradeLevel">
                Grade or year <span className="au-optional">(optional)</span>
              </label>
              <input type="text" {...field('gradeLevel')} />
            </div>
          </div>
        )}

        <div className="lp-field">
          <label htmlFor="password">Password</label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            describedBy="password-rules"
            value={form.password}
            onChange={field('password').onChange}
          />
          <PasswordRules id="password-rules" value={form.password} />
        </div>

        <label className="au-check au-terms">
          <input
            type="checkbox"
            checked={terms}
            onChange={(e) => {
              setTerms(e.target.checked)
              setError(null)
            }}
          />
          <span>
            I agree to the{' '}
            <Link to="/terms" className="au-link">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="au-link">
              Privacy Policy
            </Link>
          </span>
        </label>

        <button type="submit" className="lp-btn lp-btn-primary lp-btn-lg au-submit" disabled={submitting || !SELF_SIGNUP_ROLES.length}>
          {submitting ? 'Creating your account…' : 'Create account'}
        </button>
      </form>

      <p className="au-switch">
        Already have an account?{' '}
        <Link to="/login" className="au-link">
          Log in
        </Link>
      </p>
    </AuthShell>
=======
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
>>>>>>> origin/main
  )
}
