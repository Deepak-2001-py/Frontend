import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import PageScope from '../../components/PageScope'
import Spinner from '../../components/Spinner'
import { apiRequest } from '../../lib/api'
import { dashboardPath, type UserRole } from '../../lib/session'
import '../../styles/pages/auth.css'
import AuthNavbar from './AuthNavbar'

interface LoginResponse {
  token: string
  user_id: string
  userRole?: UserRole
  name?: string
  [key: string]: unknown
}

type Alert = { message: string; error: boolean } | null

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [userType, setUserType] = useState<UserRole>('student')
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState<Alert>(null)
  const alertTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(alertTimer.current), [])

  function showAlert(message: string, error = false) {
    setAlert({ message, error })
    window.clearTimeout(alertTimer.current)
    alertTimer.current = window.setTimeout(() => setAlert(null), 5000)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email || !password) {
      showAlert('Please enter both email and password', true)
      return
    }

    setLoading(true)
    try {
      const data = await apiRequest<LoginResponse>('/auth/login', {
        auth: false,
        body: { email, password, userType },
      })
      if (!data?.token) throw new Error('Invalid authentication response')

      const role = data.userRole || userType
      login(
        { token: data.token, userId: data.user_id, userType: role, userName: data.name ?? 'User', userData: data },
        remember,
      )
      showAlert(`Login successful! Welcome ${data.name ?? ''}. Redirecting to ${role} dashboard...`)

      const returnTo = params.get('returnTo')
      // A temporary password (issued after an admin approves a reset) must be replaced first.
      const target = data.must_change_password === true ? `/${role}/change-password` : returnTo?.startsWith('/') ? returnTo : dashboardPath(role)
      setTimeout(() => navigate(target, { replace: true }), 1000)
    } catch (err) {
      showAlert(err instanceof Error ? err.message : 'An error occurred during login. Please try again.', true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageScope name="auth" className="auth-page" title="Login">
      <AuthNavbar active="login" />

      <section className="auth-section">
        <div className="container">
          <div className="auth-container">
            <div className="auth-form-container">
              <div className="auth-brand-row">
                <span className="auth-logo-mark" />
                <span className="auth-logo-word">GradeAnt</span>
              </div>
              <h1>Welcome Back</h1>
              <p className="auth-subtitle">Log in to your GradeAnt account</p>

              {alert && (
                <div className={`alert ${alert.error ? 'alert-error' : 'alert-success'}`} style={{ display: 'block' }}>
                  {alert.message}
                </div>
              )}

              <form className="auth-form" onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="email">Email Address</label>
                  <input type="email" id="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <input
                    type="password"
                    id="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="remember-forgot-row">
                  <label className="checkbox-container">
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                    <span className="checkmark" />
                    Remember me for 30 days
                  </label>
                  <Link to="/forgot-password" className="forgot-password">
                    Forgot password?
                  </Link>
                </div>
                <div className="form-group user-type">
                  <p>I am a:</p>
                  <div className="radio-options">
                    {(['student', 'teacher'] as const).map((role) => (
                      <label className="radio-container" key={role}>
                        <input
                          type="radio"
                          name="userType"
                          value={role}
                          checked={userType === role}
                          onChange={() => setUserType(role)}
                        />
                        <span className="radio-mark" />
                        {role === 'student' ? 'Student' : 'Teacher'}
                      </label>
                    ))}
                  </div>
                </div>
                <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                  Log In
                </button>
              </form>

              <p className="auth-switch">
                Don't have an account? <Link to="/signup">Sign up</Link>
              </p>
            </div>

            <div className="auth-image">
              <img src="/img/Login_Illustration.jpg" alt="Login Illustration" />
              <div className="testimonial-bubble">
                <p>"GradeAnt has saved me countless hours of grading time. I can't imagine teaching without it now!"</p>
                <div className="testimonial-author">
                  <img src="/img/teacher-avatar.jpg" alt="Teacher" />
                  <div>
                    <h4>Maria Johnson</h4>
                    <p>High School English Teacher</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Spinner show={loading} />
    </PageScope>
  )
}
