<<<<<<< HEAD
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { dashboardPath } from '../lib/session'
import StateShell from './session/StateShell'

export default function NotFound() {
  const { pathname } = useLocation()
  const { session } = useAuth()
  return (
    <StateShell
      title="Page not found"
      icon="travel_explore"
      tone="info"
      heading="We couldn't find that page"
      actions={
        <>
          {session && (
            <Link to={dashboardPath(session.userType)} className="lp-btn lp-btn-primary lp-btn-lg">
              Go to my dashboard
            </Link>
          )}
          <Link to="/" className={`lp-btn lp-btn-lg ${session ? 'lp-btn-secondary' : 'lp-btn-primary'}`}>
            Go to the home page
          </Link>
        </>
      }
    >
      <p>
        There's no page at <code>{pathname}</code>. It may have moved, or the link may have a typo.
      </p>
    </StateShell>
=======
import { Link } from 'react-router-dom'
import PageScope from '../components/PageScope'
import '../styles/pages/session.css'

export default function NotFound() {
  return (
    <PageScope name="session" className="state-page" title="Page Not Found">
      <main className="state-main">
        <div className="state-card">
          <div className="state-icon state-icon--info">?</div>
          <div className="state-eyebrow">ERROR 404</div>
          <div className="state-title">Page not found</div>
          <p className="state-text">The page you're looking for doesn't exist or has moved.</p>
          <Link to="/" className="state-btn state-btn--primary">
            Go Home
          </Link>
        </div>
      </main>
    </PageScope>
>>>>>>> origin/main
  )
}
