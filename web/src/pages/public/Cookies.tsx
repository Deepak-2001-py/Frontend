import { useRef } from 'react'
import { Link } from 'react-router-dom'
import PageScope from '../../components/PageScope'
import { useStaticPageBehaviors } from '../../hooks/useStaticPageBehaviors'
import '../../styles/themes/legal.css'

/** Converted from legal/cookies.html; its inline script lives in useStaticPageBehaviors. */
export default function Cookies() {
  const root = useRef<HTMLDivElement>(null)
  useStaticPageBehaviors(root)

  return (
    <PageScope name="cookies" theme="legal" title="Cookie Policy" rootRef={root}>
      <nav className="navbar">
        <div className="navbar-container">
          <Link to="/" className="logo-container">
            <img src="/img/Designer.jpeg" alt="GradeAnt Logo" className="logo-image" />
            <h1 className="logo">
              Grade
              <span>Ant</span>
            </h1>
          </Link>
          {' '}
          <button className="mobile-menu-btn" id="mobileMenuBtn">☰</button>
          <div className="nav-links" id="navLinks">
            <Link to="/">Home</Link>
            {' '}
            <Link to="/about">About</Link>
            {' '}
            <Link to="/contact">Contact</Link>
            <div className="auth-buttons">
              <Link to="/login" className="btn btn-primary">Login</Link>
              {' '}
              <Link to="/signup" className="btn btn-secondary active">Sign Up</Link>
            </div>
          </div>
        </div>
      </nav>
      <div className="policy-container">
        <div className="policy-header">
          <h1>About Cookies</h1>
          <div className="policy-divider"></div>
        </div>
        <div className="policy-intro">
          <p>
            Our mission is to empower educators with intelligent tools that save time and improve student outcomes.
          </p>
        </div>
      </div>
      <a href="#" className="back-to-top" id="backToTop">
        <i className="fas fa-arrow-up"></i>
      </a>
      <footer>
        <p>© 2025 Grade-Ant. All rights reserved.</p>
      </footer>
    </PageScope>
  )
}
