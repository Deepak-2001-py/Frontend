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

export function SessionExpired() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
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
  )
}

export function Unauthorized() {
  const { session } = useAuth()
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

export function MultipleLogin() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()
  return (
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
  )
}
