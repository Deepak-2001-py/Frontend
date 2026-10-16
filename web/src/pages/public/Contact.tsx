import { useRef } from 'react'
import { Link } from 'react-router-dom'
import PageScope from '../../components/PageScope'
import { useStaticPageBehaviors } from '../../hooks/useStaticPageBehaviors'
import '../../styles/themes/site.css'
import '../../styles/pages/contact.css'

/** Converted from resoures/contact.html; its inline script lives in useStaticPageBehaviors. */
export default function Contact() {
  const root = useRef<HTMLDivElement>(null)
  useStaticPageBehaviors(root)

  return (
    <PageScope name="contact" theme="site" title="Contact" rootRef={root}>
      <nav className="navbar">
        <div className="container navbar-container">
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
            <Link to="/contact" className="active">Contact</Link>
            <div className="auth-buttons">
              <Link to="/login" className="btn btn-secondary">Login</Link>
              {' '}
              <Link to="/signup" className="btn btn-primary">Sign Up</Link>
            </div>
          </div>
        </div>
      </nav>
      <section className="page-hero contact-hero">
        <div className="container">
          <h1>Contact Us</h1>
          <p>
            We'd love to hear from you. Reach out with questions, feedback, or partnership inquiries.
          </p>
        </div>
      </section>
      <section className="contact-section">
        <div className="container">
          <div className="contact-grid">
            <div className="contact-form-container">
              <h2>Send Us a Message</h2>
              <form className="contact-form" id="contactForm">
                <div className="form-group">
                  <label htmlFor="name">Full Name</label>
                  {' '}
                  <input type="text" id="name" name="name" required />
                </div>
                <div className="form-group">
                  <label htmlFor="email">Email Address</label>
                  {' '}
                  <input type="email" id="email" name="email" required />
                </div>
                <div className="form-group">
                  <label htmlFor="subject">Subject</label>
                  {' '}
                  <input type="text" id="subject" name="subject" required />
                </div>
                <div className="form-group">
                  <label htmlFor="message">Message</label>
                  {' '}
                  <textarea id="message" name="message" rows={6} required />
                </div>
                <button type="submit" className="btn btn-primary">Send Message</button>
              </form>
            </div>
            <div className="contact-info">
              <h2>Get in Touch</h2>
              <div className="info-item">
                <div className="info-icon">📧</div>
                <div className="info-content">
                  <h3>Email</h3>
                  <p>contact@gradeant.com</p>
                </div>
              </div>
              <div className="info-item">
                <div className="info-icon">📱</div>
                <div className="info-content">
                  <h3>Phone</h3>
                  <p>+1-573-341-4720</p>
                  <p>Mon-Fri: 9AM - 5PM EST</p>
                </div>
              </div>
              <div className="info-item">
                <div className="info-icon">📍</div>
                <div className="info-content">
                  <h3>Location</h3>
                  <p>222 Fulton Hall, 301 W.</p>
                  <p>14th Street, Rolla MO 65409</p>
                </div>
              </div>
              <div className="social-links">
                <h3>Connect With Us</h3>
                <div className="social-icons">
                  <a href="#" className="social-icon">
                    <img src="/img/icon-twitter.svg" alt="Twitter" />
                  </a>
                  {' '}
                  <a href="#" className="social-icon">
                    <img src="/img/icon-linkedin.svg" alt="LinkedIn" />
                  </a>
                  {' '}
                  <a href="#" className="social-icon">
                    <img src="/img/icon-facebook.svg" alt="Facebook" />
                  </a>
                  {' '}
                  <a href="#" className="social-icon">
                    <img src="/img/icon-instagram.svg" alt="Instagram" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="faq-section">
        <div className="container">
          <h2 className="section-title">Frequently Asked Questions</h2>
          <div className="faq-container">
            <div className="faq-item">
              <div className="faq-question">
                <h3>How quickly can I get started with GradeAnt?</h3>
                <span className="faq-toggle">+</span>
              </div>
              <div className="faq-answer">
                <p>
                  You can get started with GradeAnt in minutes! After signing up, you can immediately begin uploading assignments and using our AI-powered grading tools.
                </p>
              </div>
            </div>
            <div className="faq-item">
              <div className="faq-question">
                <h3>Does GradeAnt integrate with my existing LMS?</h3>
                <span className="faq-toggle">+</span>
              </div>
              <div className="faq-answer">
                <p>
                  Yes! GradeAnt integrates seamlessly with popular learning management systems including Canvas, Blackboard, Moodle, and Google Classroom.
                </p>
              </div>
            </div>
            <div className="faq-item">
              <div className="faq-question">
                <h3>Is my student's data secure?</h3>
                <span className="faq-toggle">+</span>
              </div>
              <div className="faq-answer">
                <p>
                  Absolutely. We take data privacy and security very seriously. We are FERPA compliant and never share or sell your data. All information is encrypted and stored securely.
                </p>
              </div>
            </div>
            <div className="faq-item">
              <div className="faq-question">
                <h3>Can I customize the grading criteria?</h3>
                <span className="faq-toggle">+</span>
              </div>
              <div className="faq-answer">
                <p>
                  Yes, GradeAnt allows you to create custom rubrics and grading criteria to match your specific teaching needs and assessment goals.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-logo">
              <h2 className="logo">
                Grade
                <span>Ant</span>
              </h2>
              <p>Making grading smarter and faster.</p>
            </div>
            <div className="footer-links">
              <div className="footer-column">
                <h3>Product</h3>
                <Link to="/features">Features</Link>
              </div>
              <div className="footer-column">
                <h3>Company</h3>
                <Link to="/about">About</Link>
                {' '}
                <Link to="/contact">Contact</Link>
              </div>
              <div className="footer-column">
                <h3>Legal</h3>
                <Link to="/terms">Terms</Link>
                {' '}
                <Link to="/privacy">Privacy</Link>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>© 2025 GradeAnt. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </PageScope>
  )
}
