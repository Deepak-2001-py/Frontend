import { useRef } from 'react'
import { Link } from 'react-router-dom'
import PageScope from '../../components/PageScope'
import { useStaticPageBehaviors } from '../../hooks/useStaticPageBehaviors'
import '../../styles/pages/home.css'

/** Converted from index.html; its inline script lives in useStaticPageBehaviors. */
export default function Home() {
  const root = useRef<HTMLDivElement>(null)
  useStaticPageBehaviors(root, { anchorOffset: 70, slideshow: { progressAnimation: 'progress 5s linear', keyboard: true, swipe: true }, revealSelector: '.feature, .step, .section-title, .section-subtitle', activateSections: true })

  return (
    <PageScope name="home" title="AI-Powered Homework Grader" rootRef={root}>
      <nav className="navbar">
        <div className="container navbar-container">
          <a href="#" className="logo-container">
            <img src="/img/grade-antlogo-removebg-preview.png" alt="GradeAnt Logo" className="logo-image" />
            <h1 className="logo">
              Grade
              <span>Ant</span>
            </h1>
          </a>
          {' '}
          <button className="mobile-menu-btn" id="mobileMenuBtn">☰</button>
          <div className="nav-links" id="navLinks">
            <Link to="/" className="active">Home</Link>
            {' '}
            <Link to="/about">About</Link>
            {' '}
            <Link to="/contact">Contact</Link>
            <div className="auth-buttons">
              <Link to="/login" className="btn btn-secondary">Login</Link>
              {' '}
              <Link to="/signup" className="btn btn-primary">Sign Up</Link>
            </div>
          </div>
        </div>
      </nav>
      <section className="hero" id="hero">
        <div className="container">
          <div className="hero-content">
            <span className="hero-eyebrow">AI-Powered STEM Homework Grading</span>
            <h1 className="hero-title">Welcome to GradeAnt The Future of STEM Grading</h1>
            <p className="hero-description">
              Evaluate assignments with personalized rubrics, detailed insights, and effortless handwritten recognition.
            </p>
            <div className="hero-buttons">
              <a href="#getstarted" className="btn btn-primary">Get Started</a>
              {' '}
              <Link to="/features" className="btn btn-secondary">Learn More</Link>
            </div>
          </div>
        </div>
      </section>
      <section className="showcase" id="features">
        <div className="container">
          <h2 className="section-title">Transform Your STEM Grading Workflow</h2>
          <p className="section-subtitle">
            Our AI-powered platform saves educators hours while providing students with detailed, actionable feedback.
          </p>
          <div className="features-grid">
            <div className="feature">
              <div className="ant-thinking text-6xl mb-4">⚡</div>
              <h3>Instant Feedback</h3>
              <p>
                AI analyzes and grades assignments in seconds, not hours. Upload an assignment and get comprehensive grading instantly.
              </p>
            </div>
            <div className="feature">
              <div className="ant-thinking text-6xl mb-4">🔎</div>
              <h3>Rich, Actionable Insights</h3>
              <p>
                Provides comprehensive feedback, pinpointing errors and suggesting improvements to help students learn from their mistakes.
              </p>
            </div>
            <div className="feature">
              <div className="ant-thinking text-6xl mb-4">✍️</div>
              <h3>Conquer Handwritten Chaos</h3>
              <p>
                Effortlessly grades freeform handwritten answersheets with ease. No more struggling to decipher student handwriting.
              </p>
            </div>
            <div className="feature">
              <div className="ant-thinking text-6xl mb-4">🎯</div>
              <h3>AI-Powered Precision</h3>
              <p>
                GradeFlow™ model analyzes STEM subjects with unmatched accuracy, understanding math, physics, chemistry, and more.
              </p>
            </div>
            <div className="feature">
              <div className="ant-thinking text-6xl mb-4">⚙️</div>
              <h3>Grade Your Way</h3>
              <p>
                Customize grading with specific rubrics, question papers, and teacher personas to match your exact requirements.
              </p>
            </div>
            <div className="feature">
              <div className="ant-thinking text-6xl mb-4">⏱️</div>
              <h3>Save Time</h3>
              <p>
                No more manual grading—focus on what really matters: teaching and supporting your students' learning journey.
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="how-it-works">
        <div className="container">
          <h2>How GradeAnt Works</h2>
          <p className="subtitle">
            Our intuitive 4-step process makes automated grading simple, accurate, and time-saving for educators.
          </p>
          <div className="steps">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" stroke="#0088cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                  <path d="M14 2V8H20" stroke="#0088cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                  <path d="M12 18V12" stroke="#0088cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                  <path d="M9 15H15" stroke="#0088cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
              </div>
              <h3>Upload Content</h3>
              <p>
                Upload your assignments or question papers with detailed answer keys to our secure platform.
              </p>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <div className="step-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.709 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18455 2.99721 7.13631 4.39828 5.49706C5.79935 3.85781 7.69279 2.71537 9.79619 2.24013C11.8996 1.7649 14.1003 1.98232 16.07 2.85999" stroke="#0088cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                  <path d="M22 4L12 14.01L9 11.01" stroke="#0088cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
              </div>
              <h3>Verify Settings</h3>
              <p>
                Customize grading parameters, scoring criteria, and feedback preferences to match your teaching style.
              </p>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <div className="step-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="#0088cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                  <path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" stroke="#0088cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
              </div>
              <h3>Automated Grading</h3>
              <p>
                Our AI system analyzes student submissions against your answer key with advanced natural language processing.
              </p>
            </div>
            <div className="step">
              <div className="step-number">4</div>
              <div className="step-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 19.5C4 20.163 4.26339 20.7989 4.73223 21.2678C5.20107 21.7366 5.83696 22 6.5 22H20C20.5304 22 21.0391 21.7893 21.4142 21.4142C21.7893 21.0391 22 20.5304 22 20V8L14 0H6.5C5.83696 0 5.20107 0.263392 4.73223 0.732233C4.26339 1.20107 4 1.83696 4 2.5V19.5Z" stroke="#0088cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                  <path d="M14 0V8H22" stroke="#0088cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                  <path d="M16 13H8" stroke="#0088cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                  <path d="M16 17H8" stroke="#0088cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                  <path d="M10 9H8" stroke="#0088cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
              </div>
              <h3>Review & Export</h3>
              <p>
                Access detailed analytics, review grades, provide personalized feedback, and export reports instantly.
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="slideshow-section" id="demo">
        <div className="container">
          <h2 className="section-title">See GradeAnt in Action</h2>
          <div className="bg-amber-50 p-6 rounded-lg flex flex-col items-center justify-center text-center feedback-card min-h-[300px] md:min-h-full">
            <div className="ant-thinking text-10xl mb-4">🐜</div>
          </div>
          <p className="section-subtitle">Experience how our platform transforms grading workflow</p>
          <div className="slideshow-container">
            <a className="prev" data-slide-step="-1">❮</a>
            <div className="slides">
              <img src="/img/pitch_gradeant.pptx (1).png" alt="GradeAnt Dashboard" />
              <div className="slide-caption">Intuitive dashboard for managing all assignments</div>
            </div>
            <div className="slides">
              <img src="/img/pitch_gradeant.pptx (2).png" alt="Grading Process" />
              <div className="slide-caption">Powerful AI analyzes every detail of student work</div>
            </div>
            <div className="slides">
              <img src="/img/pitch_gradeant.pptx (3).png" alt="Feedback Generation" />
              <div className="slide-caption">Comprehensive feedback with actionable insights</div>
            </div>
            <div className="slides">
              <img src="/img/pitch_gradeant.pptx (4).png" alt="Performance Analytics" />
              <div className="slide-caption">Track progress with detailed analytics</div>
            </div>
            <div className="slides">
              <img src="/img/pitch_gradeant.pptx (5).png" alt="Student View" />
              <div className="slide-caption">Student-friendly interface for reviewing feedback</div>
            </div>
            <a className="next" data-slide-step="1">❯</a>
            <div className="progress-bar" id="slideProgressBar"></div>
          </div>
          <div className="dot-container">
            <span className="dot" data-slide-to="1"></span>
            {' '}
            <span className="dot" data-slide-to="2"></span>
            {' '}
            <span className="dot" data-slide-to="3"></span>
            {' '}
            <span className="dot" data-slide-to="4"></span>
            {' '}
            <span className="dot" data-slide-to="5"></span>
          </div>
        </div>
      </section>
      <section className="cta-section" id="getstarted">
        <div className="container">
          <h2 className="cta-title">Ready to Transform Your Grading Experience?</h2>
          <p className="cta-description">
            Join thousands of educators who have reclaimed their time while providing better feedback to students.
          </p>
          <button data-nav-to="/signup" className="btn cta-button pulse" id="getStartedButton">
            Get Started Today{' '}
            <span>→</span>
          </button>
        </div>
      </section>
      <footer className="footer" id="contact">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-column">
              <h3>Quick Links</h3>
              <ul>
                <li>
                  <Link to="/features">Features</Link>
                </li>
                <li>
                  <Link to="/signup">Get Started</Link>
                </li>
              </ul>
            </div>
            <div className="footer-column">
              <h3>Resources</h3>
              <ul>
                <li>
                  <Link to="/about">About Us</Link>
                </li>
                <li>
                  <Link to="/contact">Contact</Link>
                </li>
              </ul>
            </div>
            <div className="footer-column">
              <h3>Legal</h3>
              <ul>
                <li>
                  <Link to="/terms">Terms of Service</Link>
                </li>
                <li>
                  <Link to="/privacy">Privacy Policy</Link>
                </li>
              </ul>
            </div>
            <div className="footer-column">
              <h3>Contact Us</h3>
              <ul>
                <li>
                  <a href="mailto:contact@gradeant.com">contact@gradeant.com</a>
                </li>
                <li>
                  <a href="tel:+1-573-341-4720">+1-573-341-4720</a>
                </li>
                <li>222 Fulton Hall, 301 W. 14th Street, Rolla MO 65409</li>
              </ul>
              <div className="social-icons mt-3">
                <a href="#linkedin">
                  <span>in</span>
                </a>
                {' '}
                <a href="#twitter">
                  <span>𝕏</span>
                </a>
                {' '}
                <a href="#github">
                  <span>GH</span>
                </a>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>© 2025 GradeAnt. All rights reserved.</p>
          </div>
        </div>
      </footer>
      <a href="#" id="backToTop" className="back-to-top" aria-label="Back to top">
        <span>↑</span>
      </a>
      <div id="preloader">
        <div className="loader"></div>
      </div>
    </PageScope>
  )
}
