import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
<<<<<<< HEAD
import { API, API_BASE_URL, ROLES, type RoleName } from '../../config'
import { apiRequest, isRouteMissing } from '../../lib/api'
import { changePasswordPath, safeReturnTo, type UserRole } from '../../lib/session'
import { AuthShell, LoginPreview, Notice, PasswordInput, RoleSwitch } from './AuthLayout'
=======
import PageScope from '../../components/PageScope'
import Spinner from '../../components/Spinner'
import { apiRequest } from '../../lib/api'
import { dashboardPath, type UserRole } from '../../lib/session'
import '../../styles/pages/auth.css'
import AuthNavbar from './AuthNavbar'
>>>>>>> origin/main

interface LoginResponse {
  token: string
  user_id: string
  userRole?: UserRole
  name?: string
  [key: string]: unknown
}

<<<<<<< HEAD
type Message = { text: string; tone: 'error' | 'success' } | null
=======
type Alert = { message: string; error: boolean } | null
>>>>>>> origin/main

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
<<<<<<< HEAD
  const [userType, setUserType] = useState<RoleName>('student')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const redirectTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(redirectTimer.current), [])

  // An error stays on screen until the person changes something.
  const edited = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    if (message?.tone === 'error') setMessage(null)
=======
  const [userType, setUserType] = useState<UserRole>('student')
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState<Alert>(null)
  const alertTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(alertTimer.current), [])

  function showAlert(message: string, error = false) {
    setAlert({ message, error })
    window.clearTimeout(alertTimer.current)
    alertTimer.current = window.setTimeout(() => setAlert(null), 5000)
>>>>>>> origin/main
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
<<<<<<< HEAD
    // Autofill and phone keyboards often add a trailing space.
    const typedEmail = email.trim()
    if (!typedEmail || !password) {
      setMessage({ text: 'Enter your email and password.', tone: 'error' })
=======
    if (!email || !password) {
      showAlert('Please enter both email and password', true)
>>>>>>> origin/main
      return
    }

    setLoading(true)
<<<<<<< HEAD
    setMessage(null)
    try {
      const data = await apiRequest<LoginResponse>(API.auth.login, {
        auth: false,
        body: { email: typedEmail, password, userType },
      })
      if (!data?.token) throw new Error('The server sent an unexpected response. Try again.')

      const role = data.userRole || userType
      login({ token: data.token, userId: data.user_id, userType: role, userName: data.name ?? 'User', userData: data }, remember)
      setMessage({ text: `Welcome back${data.name ? `, ${data.name}` : ''}. Opening your dashboard…`, tone: 'success' })

      // A temporary password (issued after an admin approves a reset) must be replaced first.
      const target = data.must_change_password === true ? changePasswordPath(role) : safeReturnTo(params.get('returnTo'), role)
      redirectTimer.current = window.setTimeout(() => navigate(target, { replace: true }), 700)
    } catch (err) {
      const text = err instanceof Error ? err.message : ''
      const label = (ROLES.find((r) => r.name === userType)?.label ?? userType).toLowerCase()
      const article = /^[aeiou]/.test(label) ? 'an' : 'a'
      setMessage({
        text:
          text === 'Invalid credentials'
            ? `That email and password don't match ${article} ${label} account. Check both, and that the right role is selected.` +
              // Easy to miss when a password is pasted; not trimmed, since a real password may contain spaces.
              (password !== password.trim() ? ' Your password starts or ends with a space — remove it unless it is part of your password.' : '')
            : isRouteMissing(err)
              ? `Can't reach the GradeAnt server (${API_BASE_URL}). Check your connection; if you're running locally, start the API with "cd backend && npm run dev".`
              : text || 'Login failed. Try again.',
        tone: 'error',
      })
=======
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
>>>>>>> origin/main
    } finally {
      setLoading(false)
    }
  }

  return (
<<<<<<< HEAD
    <AuthShell title="Log in" aside={<LoginPreview role={userType} />}>
      <h1>Welcome back</h1>
      <p className="au-lead">Log in to pick up where you left off.</p>

      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <form className="lp-form au-form" onSubmit={handleSubmit} noValidate>
        {/* Roles and their labels come from config/app.yaml. */}
        <RoleSwitch name="userType" legend="I am a" roles={ROLES} value={userType} onChange={edited(setUserType)} />

        <div className="lp-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            className="lp-input"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => edited(setEmail)(e.target.value)}
          />
        </div>

        <div className="lp-field">
          <label htmlFor="password">Password</label>
          <PasswordInput id="password" autoComplete="current-password" value={password} onChange={(e) => edited(setPassword)(e.target.value)} />
        </div>

        <div className="au-row">
          <label className="au-check">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Keep me signed in on this device
          </label>
          <Link to="/forgot-password" className="au-link">
            Forgot password?
          </Link>
        </div>

        <button type="submit" className="lp-btn lp-btn-primary lp-btn-lg au-submit" disabled={loading}>
          {loading ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <p className="au-switch">
        New to GradeAnt?{' '}
        <Link to="/signup" className="au-link">
          Create an account
        </Link>
      </p>
    </AuthShell>
=======
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
>>>>>>> origin/main
  )
}
