<<<<<<< HEAD
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { API, roleLabel, type RoleName } from '../../config'
import { apiRequest } from '../../lib/api'
import { dashboardPath, type UserRole } from '../../lib/session'
import { AuthShell, Notice, PasswordInput, PasswordRules, StepsPreview } from '../auth/AuthLayout'
import { unmetPasswordRule } from '../auth/passwordRules'
=======
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import PageScope from '../../components/PageScope'
import { apiRequest } from '../../lib/api'
import { dashboardPath, type UserRole } from '../../lib/session'
import { capitalize } from './AdminLayout'
import '../../styles/themes/aesthetic.css'
import '../../styles/themes/admin.css'
>>>>>>> origin/main

interface Invite {
  role?: string
  fullName?: string
  className?: string
}

<<<<<<< HEAD
=======
type Alert = { message: string; type: 'warning' | 'danger' } | null

>>>>>>> origin/main
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
<<<<<<< HEAD
  const [linkError, setLinkError] = useState<string | null>(token ? null : 'This invite link is missing part of its address.')
  const [error, setError] = useState<string | null>(null)
=======
  const [alert, setAlert] = useState<Alert>(null)
  const [blocked, setBlocked] = useState(false)
>>>>>>> origin/main
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
<<<<<<< HEAD
    if (!token) return
    apiRequest<Invite>(API.admin, { auth: false, body: { operation: 'getInviteDetails', token } })
      .then(setInvite)
      .catch((err) => setLinkError((err as Error).message || 'This invite link doesn’t work.'))
  }, [token])

  const role = invite?.role ? roleLabel(invite.role as RoleName) : ''
  const edited = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setError(null) // an error stays until the person changes something
  }

  async function finish(e?: FormEvent) {
    e?.preventDefault()
    if (!invite || submitting) return
    const unmet = unmetPasswordRule(password)
    if (unmet) return setError(`Your password needs ${unmet.label.toLowerCase()}.`)
    if (password !== confirm) return setError('The two passwords don’t match.')
    if (!agreed) return setError('Accept the acceptable-use and privacy policy to finish setting up.')

    setSubmitting(true)
    try {
      const result = await apiRequest<{ token: string; userId: string; role: UserRole; fullName: string }>(API.admin, {
        auth: false,
        body: { operation: 'completeFirstLogin', token, password },
      })
      login({ token: result.token, userId: result.userId, userType: result.role, userName: result.fullName, userData: result }, false)
      navigate(dashboardPath(result.role), { replace: true })
    } catch (err) {
      setError((err as Error).message || 'Setup didn’t finish. Try again.')
=======
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
>>>>>>> origin/main
      setSubmitting(false)
    }
  }

<<<<<<< HEAD
  const aside = (
    <StepsPreview
      k={invite ? 'invite-ready' : 'invite-waiting'}
      title={invite ? `Welcome${invite.fullName ? `, ${invite.fullName.split(' ')[0]}` : ''}. One step to go` : 'Setting up an invited account'}
      text={invite ? 'Your administrator has already created your account.' : 'Invites come from your school’s GradeAnt administrator.'}
      steps={[
        [
          'You were invited',
          invite ? `As ${/^[aeiou]/i.test(role) ? 'an' : 'a'} ${role.toLowerCase() || 'member'}${invite.className ? ` for ${invite.className}` : ''}.` : 'Your administrator sends a link to your email.',
        ],
        ['Choose your password', 'You’ll use it with your email to log in from now on.'],
        [role ? `Open your ${role.toLowerCase()} dashboard` : 'Open your dashboard', 'You go straight there when you finish.'],
      ]}
      done={invite ? 1 : 0}
    />
  )

  if (linkError) {
    return (
      <AuthShell title="Set up your account" aside={aside}>
        <h1>This invite link doesn’t work</h1>
        <Notice tone="error">{linkError}</Notice>
        <p className="au-lead" style={{ marginTop: 18 }}>
          Invite links can only be used once and expire after a while. Ask your administrator to send you a new invite.
        </p>
        <div className="lp-form au-form">
          <Link to="/login" className="lp-btn lp-btn-primary lp-btn-lg au-submit">
            I already have an account
          </Link>
          <Link to="/" className="lp-btn lp-btn-secondary lp-btn-lg au-submit">
            Go to the home page
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Set up your account" aside={aside}>
      <h1>Set up your account</h1>
      <p className="au-lead">
        {invite ? (
          <>
            You were invited as {/^[aeiou]/i.test(role) ? 'an' : 'a'} <b>{role.toLowerCase()}</b>
            {invite.className ? (
              <>
                {' '}for <b>{invite.className}</b>
              </>
            ) : null}
            . Choose a password to finish.
          </>
        ) : (
          'Checking your invite…'
        )}
      </p>

      {error && <Notice tone="error">{error}</Notice>}

      <form id="firstlogin-form" className="lp-form au-form" onSubmit={finish} noValidate>
        <div className="lp-field">
          <label htmlFor="createPassword">Password</label>
          <PasswordInput
            id="createPassword"
            autoComplete="new-password"
            describedBy="firstlogin-rules"
            value={password}
            onChange={(e) => edited(setPassword)(e.target.value)}
          />
          <PasswordRules id="firstlogin-rules" value={password} />
        </div>

        <div className="lp-field">
          <label htmlFor="confirmPassword">Type it again</label>
          <PasswordInput id="confirmPassword" autoComplete="new-password" value={confirm} onChange={(e) => edited(setConfirm)(e.target.value)} />
        </div>

        <label className="au-check au-terms">
          <input type="checkbox" checked={agreed} onChange={(e) => edited(setAgreed)(e.target.checked)} />
          <span>
            I agree to the{' '}
            <Link to="/terms" className="au-link">
              acceptable-use terms
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="au-link">
              privacy policy
            </Link>
          </span>
        </label>

        <button type="submit" className="lp-btn lp-btn-primary lp-btn-lg au-submit" disabled={!invite || submitting}>
          {submitting ? 'Setting up your account…' : role ? `Finish and open my ${role.toLowerCase()} dashboard` : 'Finish setting up'}
        </button>
      </form>
    </AuthShell>
=======
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
>>>>>>> origin/main
  )
}
