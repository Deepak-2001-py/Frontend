import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import PageScope from '../../components/PageScope'
import { apiRequest } from '../../lib/api'
import { dashboardPath, type UserRole } from '../../lib/session'
import { capitalize } from './AdminLayout'
import '../../styles/themes/aesthetic.css'
import '../../styles/themes/admin.css'

interface Invite {
  role?: string
  fullName?: string
  className?: string
}

type Alert = { message: string; type: 'warning' | 'danger' } | null

/**
 * Step 3 of onboarding: set a password from an *unauthenticated* invite link
 * (?token=...). Not behind RequireRole — the visitor has no session yet.
 */
export default function FirstLoginSetup() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const { login } = useAuth()

  const [invite, setInvite] = useState<Invite | null>(null)
  const [alert, setAlert] = useState<Alert>(null)
  const [blocked, setBlocked] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      setAlert({ message: 'This invite link is missing its token — ask your admin to resend the invite.', type: 'danger' })
      setBlocked(true)
      return
    }
    apiRequest<Invite>('/admin', { auth: false, body: { operation: 'getInviteDetails', token } })
      .then(setInvite)
      .catch((err) => {
        setAlert({ message: `Couldn't load this invite: ${(err as Error).message}`, type: 'danger' })
        setBlocked(true)
      })
  }, [token])

  async function finish() {
    if (password.length < 8) return setAlert({ message: 'Choose a password with at least 8 characters.', type: 'warning' })
    if (password !== confirm) return setAlert({ message: "Passwords don't match.", type: 'warning' })
    if (!agreed) {
      return setAlert({ message: 'You need to accept the acceptable-use & privacy policy to continue.', type: 'warning' })
    }

    setSubmitting(true)
    try {
      const result = await apiRequest<{ token: string; userId: string; role: UserRole; fullName: string }>('/admin', {
        auth: false,
        body: { operation: 'completeFirstLogin', token, password },
      })
      login(
        { token: result.token, userId: result.userId, userType: result.role, userName: result.fullName, userData: result },
        false,
      )
      navigate(dashboardPath(result.role), { replace: true })
    } catch (err) {
      setAlert({ message: `Couldn't finish setup: ${(err as Error).message}`, type: 'danger' })
      setSubmitting(false)
    }
  }

  const role = capitalize(invite?.role) || 'Teacher'

  return (
    <PageScope name="first-login" theme={['aesthetic', 'admin']} className="firstlogin-page" title="Set up your account">
      <header className="firstlogin-topbar">
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
          <span className="logo-mark" />
          <span className="logo-word" style={{ color: 'var(--ink-900)' }}>GradeAnt</span>
        </Link>
        <div className="admin-stepper">
          <span className="step done">
            <span className="dot">✓</span>Roles
          </span>
          <span className="sep">›</span>
          <span className="step current">
            <span className="dot">3</span>First login
          </span>
        </div>
      </header>

      <main className="firstlogin-main">
        <div className="firstlogin-grid">
          <div className="firstlogin-form-col">
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--ink-900)', marginBottom: 2 }}>
              Set your password &amp; profile
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              You were invited as a <b style={{ color: 'var(--brand)' }}>{role}</b> for{' '}
              <b>{invite ? invite.className || 'GradeAnt' : '—'}</b>.
            </div>

            {alert && (
              <span className={`status-pill ${alert.type}`} style={{ display: 'inline-flex', marginBottom: 14 }} role="alert">
                {alert.message}
              </span>
            )}

            <div className="form">
              <div className="form-group">
                <label htmlFor="createPassword">Create password</label>
                <input
                  type="password"
                  className="form-control"
                  id="createPassword"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm password</label>
                <input
                  type="password"
                  className="form-control"
                  id="confirmPassword"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, color: 'var(--ink-700)' }}>
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />I agree to the
                acceptable-use &amp; privacy policy.
              </label>
            </div>
          </div>

          <div className="firstlogin-side-col">
            <div className="firstlogin-side-title">Your account</div>
            <div style={{ flex: 1 }}>
              <div className="firstlogin-side-row">
                <span className="label">Name</span>
                <span className="value">{invite?.fullName ?? '—'}</span>
              </div>
              <div className="firstlogin-side-row">
                <span className="label">Role</span>
                <span className="value" style={{ color: 'var(--brand)' }}>
                  {invite ? role : '—'}
                </span>
              </div>
              <div className="firstlogin-side-row">
                <span className="label">Class</span>
                <span className="value">{invite?.className || '—'}</span>
              </div>
            </div>
            <div className="admin-callout-warning">
              → On finish you land on your <b style={{ color: 'var(--brand)' }}>{invite ? `${role} Dashboard` : 'Dashboard'}</b>.
            </div>
            <button type="button" className="btn btn-primary" style={{ width: '100%' }} disabled={blocked || submitting} onClick={finish}>
              {submitting ? 'Setting up…' : 'Finish & go to dashboard →'}
            </button>
          </div>
        </div>
      </main>
    </PageScope>
  )
}
