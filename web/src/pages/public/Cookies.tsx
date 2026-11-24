<<<<<<< HEAD
import { Link } from 'react-router-dom'
import LegalLayout from './LegalLayout'

/**
 * Describes what the app actually stores (web/src/lib/session.ts, lib/apiCache.ts,
 * pages/teacher/TeacherCorrection.tsx) and the third-party files in web/index.html.
 * Update it whenever those change.
 */
export default function Cookies() {
  return (
    <LegalLayout
      title="Cookie Policy"
      effective="Last updated: November 2026"
      intro={
        <p>
          This policy explains what GradeAnt ("we", "us") stores in your browser when you use our website and grading
          service (the "Service"), why, and how you can control it. It should be read together with our{' '}
          <Link to="/privacy">Privacy Policy</Link>.
        </p>
      }
    >
      <div id="no-cookies" className="lg-section">
        <h2>1. We don't use cookies</h2>
        <p>
          The Service does not set any cookies, and we do not use advertising, tracking or analytics cookies. We don't
          sell your information or use it to show you ads.
        </p>
      </div>

      <div id="browser-storage" className="lg-section">
        <h2>2. What we store in your browser instead</h2>
        <p>
          To keep you signed in and make pages load faster, the Service uses your browser's built-in storage (
          <em>local storage</em> and <em>session storage</em>). This data stays on your device and is only used by the
          Service:
        </p>
        <ul>
          <li>
            <strong>Sign-in session</strong>: your sign-in token, user ID, name and role, and when you signed in. It's
            kept in session storage, which your browser clears when you close the tab. If you tick{' '}
            <em>Keep me signed in on this device</em>, it's kept in local storage instead so you stay signed in. It's
            strictly necessary: without it you can't use your account.
          </li>
          <li>
            <strong>Page cache</strong>: copies of recently loaded results (for example assignments and grades), kept in
            session storage for the current tab so pages open faster. They're cleared when you close the tab.
          </li>
          <li>
            <strong>Review progress (teachers)</strong>: which questions you've already marked as reviewed on the
            correction screen, kept in local storage on that device.
          </li>
        </ul>
        <p>Logging out removes your sign-in session from both kinds of storage.</p>
      </div>

      <div id="third-parties" className="lg-section">
        <h2>3. Third-party services</h2>
        <p>
          Our pages load fonts and icons from Google Fonts (fonts.googleapis.com, fonts.gstatic.com) and from cdnjs
          (Font Awesome). Your browser contacts these providers directly to download the files, so they receive standard
          request information such as your IP address. We don't use them to track you; see their own privacy policies
          for how they handle that information.
        </p>
      </div>

      <div id="your-choices" className="lg-section">
        <h2>4. Your choices</h2>
        <p>
          You can clear the Service's stored data at any time by logging out or by clearing site data in your browser
          settings. Blocking site storage entirely will stop you from signing in, because the sign-in session can't be
          kept.
        </p>
      </div>

      <div id="changes-and-contact" className="lg-section">
        <h2>5. Changes and contact</h2>
        <p>
          If we start using cookies or change what we store, we'll update this page and its date. Questions? Contact us
          at <strong>contact@gradeant.com</strong>.
        </p>
      </div>
    </LegalLayout>
=======
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
>>>>>>> origin/main
  )
}
