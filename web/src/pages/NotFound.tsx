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
  )
}
