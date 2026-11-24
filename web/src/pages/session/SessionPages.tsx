<<<<<<< HEAD
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { roleLabel, type RoleName } from '../../config'
import { dashboardPath } from '../../lib/session'
import StateShell, { WhoChip } from './StateShell'

const label = (role?: string) => (role ? roleLabel(role as RoleName) : '')

export function Logout() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()

  if (!session) {
    return (
      <StateShell
        title="Log out"
        icon="logout"
        tone="info"
        heading="You're not signed in"
        actions={
          <>
            <Link to="/login" className="lp-btn lp-btn-primary lp-btn-lg">
              Log in
            </Link>
            <Link to="/" className="lp-btn lp-btn-secondary lp-btn-lg">
              Go to the home page
            </Link>
          </>
        }
      >
        <p>There's no account to log out of on this device.</p>
      </StateShell>
    )
  }

  return (
    <StateShell
      title="Log out"
      icon="logout"
      tone="brand"
      heading="Log out of GradeAnt?"
      actions={
        <>
          <button
            type="button"
            className="lp-btn lp-btn-primary lp-btn-lg"
            onClick={() => {
              logout()
              navigate('/login', { replace: true })
            }}
          >
            Log out
          </button>
          <button
            type="button"
            className="lp-btn lp-btn-secondary lp-btn-lg"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(dashboardPath(session.userType)))}
          >
            Stay signed in
          </button>
        </>
      }
    >
      <p>You'll need to log in again to get back to your dashboard.</p>
      <WhoChip name={session.userName} role={label(session.userType)} />
    </StateShell>
  )
}

/**
 * Shown when the server rejects the sign-in token (lib/api.ts): it expired
 * (after 24 hours), the account was suspended, or it was signed out elsewhere.
 */
=======
import type { ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import PageScope from '../../components/PageScope'
import { dashboardPath } from '../../lib/session'
import '../../styles/pages/session.css'

function StateFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <PageScope name="session" className="state-page" title={title}>
      <header className="state-topbar">
        <Link to="/" className="state-brand">
          <span className="state-logo-mark" />
          <span className="state-logo-word">GradeAnt</span>
        </Link>
      </header>
      <main className="state-main">{children}</main>
    </PageScope>
  )
}

export function Logout() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  return (
    <PageScope name="session" className="state-page state-page--scrim" title="Log Out">
      <main className="state-main">
        <div className="modal-card">
          <div className="modal-avatar" />
          <div className="state-title state-title--lg">Log out of GradeAnt?</div>
          <p className="state-text">You'll need to sign in again to access your dashboard.</p>
          <div className="state-actions state-actions--row">
            <button
              type="button"
              className="state-btn state-btn--secondary"
              onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
            >
              Cancel
            </button>
            <button
              type="button"
              className="state-btn state-btn--primary"
              onClick={() => {
                logout()
                navigate('/login', { replace: true })
              }}
            >
              Log Out
            </button>
          </div>
        </div>
      </main>
    </PageScope>
  )
}

>>>>>>> origin/main
export function SessionExpired() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
<<<<<<< HEAD
  const returnTo = params.get('returnTo')
  return (
    <StateShell
      title="Session ended"
      icon="schedule"
      tone="warn"
      heading="Your session has ended"
      actions={
        <button
          type="button"
          className="lp-btn lp-btn-primary lp-btn-lg"
          onClick={() => {
            logout()
            navigate('/login' + (returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''), { replace: true })
          }}
        >
          Log in again
        </button>
      }
    >
      <p>
        For your security, sign-ins don't last forever. Log in again to continue
        {returnTo ? ', and you\'ll go straight back to the page you were on.' : '.'}
      </p>
    </StateShell>
=======
  return (
    <StateFrame title="Session Expired">
      <div className="state-card">
        <div className="state-icon state-icon--warn">⏱</div>
        <div className="state-title">Your session has expired</div>
        <p className="state-text">For your security you've been signed out after 30 minutes of inactivity.</p>
        <button
          type="button"
          className="state-btn state-btn--primary"
          onClick={() => {
            logout()
            const returnTo = params.get('returnTo')
            navigate('/login' + (returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''), { replace: true })
          }}
        >
          Log In Again
        </button>
      </div>
    </StateFrame>
>>>>>>> origin/main
  )
}

export function Unauthorized() {
  const { session } = useAuth()
<<<<<<< HEAD
  return (
    <StateShell
      title="No access"
      icon="lock"
      tone="danger"
      heading="You don't have access to this page"
      actions={
        session ? (
          <>
            <Link to={dashboardPath(session.userType)} className="lp-btn lp-btn-primary lp-btn-lg">
              Go to my dashboard
            </Link>
            <Link to="/logout" className="lp-btn lp-btn-secondary lp-btn-lg">
              Log in with a different account
            </Link>
          </>
        ) : (
          <Link to="/login" className="lp-btn lp-btn-primary lp-btn-lg">
            Log in
          </Link>
        )
      }
    >
      {session ? (
        <p>
          This page is for a different role. You're signed in as <strong>{session.userName}</strong> (
          {label(session.userType).toLowerCase()}). If you should have access, ask your administrator.
        </p>
      ) : (
        <p>Log in with an account that has access to this page.</p>
      )}
    </StateShell>
  )
}

/**
 * "Was this you?" check after a sign-in elsewhere. GradeAnt doesn't record other
 * devices, so this only explains what to do; it doesn't show (invented) device details.
 */
=======
  const navigate = useNavigate()
  return (
    <StateFrame title="Access Denied">
      <div className="state-card">
        <div className="state-icon state-icon--danger">✕</div>
        <div className="state-eyebrow">ERROR 403</div>
        <div className="state-title" style={{ marginTop: 4 }}>
          Access denied
        </div>
        <p className="state-text">
          Your role doesn't have permission to view this page. Contact your administrator if you think this is a
          mistake.
        </p>
        <button
          type="button"
          className="state-btn state-btn--secondary"
          onClick={() => navigate(dashboardPath(session?.userType))}
        >
          Back to Dashboard
        </button>
      </div>
    </StateFrame>
  )
}

>>>>>>> origin/main
export function MultipleLogin() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()
  return (
<<<<<<< HEAD
    <StateShell
      title="New sign-in"
      icon="devices"
      tone="info"
      heading="Signed in on another device?"
      actions={
        <>
          <button
            type="button"
            className="lp-btn lp-btn-primary lp-btn-lg"
            onClick={() => navigate(session ? dashboardPath(session.userType) : '/login')}
          >
            Yes, that was me
          </button>
          <button
            type="button"
            className="st-link-danger"
            onClick={() => {
              logout()
              navigate('/forgot-password', { replace: true })
            }}
          >
            It wasn't me: log out and reset my password
          </button>
        </>
      }
    >
      <p>Your account was used to sign in somewhere else. If that was you, carry on.</p>
      <p>If you don't recognise it, log out here and ask for a password reset.</p>
    </StateShell>
=======
    <StateFrame title="New Sign-In Detected">
      <div className="state-card" style={{ alignItems: 'stretch', textAlign: 'left' }}>
        <div className="state-icon state-icon--info">⚠</div>
        <div className="state-title" style={{ textAlign: 'left' }}>
          New sign-in detected
        </div>
        <p className="state-text" style={{ textAlign: 'left' }}>
          Your account was just signed in on another device.
        </p>
        <div className="device-box">
          <div className="device-name">Chrome · Windows</div>
          <div className="device-meta">192.168.4.21 · just now</div>
        </div>
        <div className="state-actions">
          <button
            type="button"
            className="state-btn state-btn--primary"
            onClick={() => navigate(dashboardPath(session?.userType))}
          >
            This Was Me
          </button>
          <button
            type="button"
            className="link-danger"
            onClick={() => {
              logout()
              navigate('/login', { replace: true })
            }}
          >
            End other sessions &amp; reset password
          </button>
        </div>
      </div>
    </StateFrame>
>>>>>>> origin/main
  )
}
