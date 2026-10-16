import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import PageScope from '../../components/PageScope'
import { useStaticPageBehaviors } from '../../hooks/useStaticPageBehaviors'
import '../../styles/pages/features.css'

/** Converted from quick_links/features.html; its inline script lives in useStaticPageBehaviors. */
export default function Features() {
  const root = useRef<HTMLDivElement>(null)
  useStaticPageBehaviors(root, { slideshow: { progressAnimation: 'progress 5s linear infinite' } })
  // /features#technology (homepage "Technology" link) lands on that section.
  const { hash } = useLocation()
  useEffect(() => {
    if (hash) root.current?.querySelector(hash)?.scrollIntoView()
  }, [hash])

  return (
    <PageScope name="features" title="Features" rootRef={root}>
      <header>
        <div className="header-content">
          <a href="#" className="logo-container">
            <img src="/img/grade-antlogo-removebg-preview.png" alt="GradeAnt Logo" className="logo-image" />
            <h1 className="logo">
              Grade
              <span>Ant</span>
            </h1>
          </a>
          <nav className="nav-links">
            <Link to="/" className="nav-link">Home</Link>
            {' '}
            <a href="#features" className="nav-link">Features</a>
            {' '}
            <a href="#demo" className="nav-link">Demo</a>
            {' '}
            <a href="#how-it-works" className="nav-link">How It Works</a>
            {' '}
            <a href="#technology" className="nav-link">Technology</a>
          </nav>
        </div>
      </header>
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">Transform Your Grading Experience</h1>
          <p className="hero-subtitle">
            Save time, provide better feedback, and improve learning outcomes with GradeAnt's intelligent grading platform.
          </p>
          <a href="#features" className="cta-button">Explore Features</a>
        </div>
      </section>
      <section id="features" className="section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Key Features</h2>
            <p className="section-subtitle">Discover how GradeAnt revolutionizes the grading process</p>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
              <div className="feature-content">
                <h3 className="feature-title">Intelligent Grading</h3>
                <p>
                  Our AI-powered system accurately grades assignments across subjects, from math equations to essay questions, maintaining consistency and reducing bias.
                </p>
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
              </div>
              <div className="feature-content">
                <h3 className="feature-title">Personalized Feedback</h3>
                <p>
                  Generate tailored feedback that highlights strengths, identifies areas for improvement, and provides actionable suggestions for every student.
                </p>
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                  <line x1="8" y1="21" x2="16" y2="21"></line>
                  <line x1="12" y1="17" x2="12" y2="21"></line>
                </svg>
              </div>
              <div className="feature-content">
                <h3 className="feature-title">Multi-Format Support</h3>
                <p>
                  Process text, images, handwritten answers, and more with our advanced Visual Language Model (VLM) technology that understands various submission formats.
                </p>
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                </svg>
              </div>
              <div className="feature-content">
                <h3 className="feature-title">Performance Analytics</h3>
                <p>
                  Track student progress over time with comprehensive analytics that identify trends, highlight knowledge gaps, and inform targeted interventions.
                </p>
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <div className="feature-content">
                <h3 className="feature-title">Instructor Collaboration</h3>
                <p>
                  Easily share grades, feedback templates, and rubrics with teaching assistants and co-instructors to maintain grading consistency across large courses.
                </p>
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
              </div>
              <div className="feature-content">
                <h3 className="feature-title">Privacy & Security</h3>
                <p>
                  Enterprise-grade security ensures student data remains protected with end-to-end encryption, role-based access controls, and full FERPA compliance.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section id="demo" className="slideshow-section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">See GradeAnt in Action</h2>
            <p className="section-subtitle">Experience how our platform transforms your grading workflow</p>
          </div>
          <div className="slideshow-container">
            <button className="prev" data-slide-step="-1">❮</button>
            <div className="slides fade">
              <img src="/img/teacher_workflow.png" alt="GradeAnt Dashboard" />
              <div className="slide-caption">teacher view</div>
            </div>
            <div className="slides fade">
              <img src="/img/student_workflow.png" alt="Grading Process" />
              <div className="slide-caption">student view</div>
            </div>
            <div className="slides fade">
              <img src="/img/pdf_upload.png" alt="Feedback Generation" />
              <div className="slide-caption">pdf upload</div>
            </div>
            <div className="slides fade">
              <img src="/img/grading.png" alt="Performance Analytics" />
              <div className="slide-caption">grenerating grades</div>
            </div>
            <button className="next" data-slide-step="1">❯</button>
            <div id="slideProgressBar" className="progress-bar"></div>
          </div>
          <div className="dot-container">
            <span className="dot" data-slide-to="1"></span>
            {' '}
            <span className="dot" data-slide-to="2"></span>
            {' '}
            <span className="dot" data-slide-to="3"></span>
            {' '}
            <span className="dot" data-slide-to="4"></span>
          </div>
        </div>
      </section>
      <section id="how-it-works" className="how-it-works">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">How GradeAnt Works</h2>
            <p className="section-subtitle">A simple yet powerful process that saves you time and improves feedback quality</p>
          </div>
          <div className="steps">
            <div className="step">
              <div className="step-number">1</div>
              <h3 className="step-title">Upload Assignments</h3>
              <p>
                Import student submissions in various formats through our intuitive interface or integrate directly with your LMS.
              </p>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <h3 className="step-title">AI Assessment</h3>
              <p>
                Our VLM-powered system analyzes each submission against your rubric, identifying key concepts and responses.
              </p>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <h3 className="step-title">Review & Adjust</h3>
              <p>
                Quickly review AI-generated grades and feedback, making adjustments where necessary with our user-friendly tools.
              </p>
            </div>
            <div className="step">
              <div className="step-number">4</div>
              <h3 className="step-title">Distribute Results</h3>
              <p>
                Send personalized feedback and grades to students through your preferred platform with just a few clicks.
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="ai-technology-section" id="technology">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Our AI Technology</h2>
            <p className="section-subtitle">Powered by advanced machine learning models designed specifically for education</p>
          </div>
          <div className="model-showcase">
            <div className="model-diagram-container">
              <div className="model-card">
                <div className="model-header">
                  <div className="model-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2l2 2m-2-2l-2 2m2-2v6m7 6l-2 2m2-2l-2-2m2 2h-6M5 14l-2-2m2 2l2-2m-2 2H5"></path>
                    </svg>
                  </div>
                  <h3 className="model-title">VLM LLM Agents</h3>
                </div>
                <div className="model-flow">
                  <div className="process-node">
                    <div className="process-circle">1</div>
                    <div className="process-label">Parsing</div>
                  </div>
                  <div className="flow-arrow">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                  </div>
                  <div className="process-node">
                    <div className="process-circle">2</div>
                    <div className="process-label">Question Identification</div>
                  </div>
                  <div className="flow-arrow">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                  </div>
                  <div className="process-node">
                    <div className="process-circle">3</div>
                    <div className="process-label">Grading</div>
                  </div>
                </div>
                <div className="model-badge">GradeAnt Core</div>
              </div>
              <div className="model-card">
                <div className="model-header">
                  <div className="model-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <circle cx="8.5" cy="8.5" r="1.5"></circle>
                      <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                  </div>
                  <h3 className="model-title">Visual Language Model</h3>
                </div>
                <div className="model-flow">
                  <div className="process-node">
                    <div className="process-circle">1</div>
                    <div className="process-label">Image Analysis</div>
                  </div>
                  <div className="flow-arrow">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                  </div>
                  <div className="process-node">
                    <div className="process-circle">2</div>
                    <div className="process-label">Text Extraction</div>
                  </div>
                  <div className="flow-arrow">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                  </div>
                  <div className="process-node">
                    <div className="process-circle">3</div>
                    <div className="process-label">Context Understanding</div>
                  </div>
                </div>
                <div className="model-badge">Visual Processing</div>
              </div>
              <div className="output-card">
                <div className="output-glow"></div>
                <div className="output-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                </div>
                <h3 className="output-title">Personalized Feedback</h3>
                <p className="output-description">Tailored insights and suggestions that help students improve</p>
              </div>
            </div>
          </div>
          <div className="technology-features">
            <div className="tech-feature">
              <div className="tech-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v4"></path>
                  <path d="M12 18v4"></path>
                  <path d="M4.93 4.93l2.83 2.83"></path>
                  <path d="M16.24 16.24l2.83 2.83"></path>
                  <path d="M2 12h4"></path>
                  <path d="M18 12h4"></path>
                  <path d="M4.93 19.07l2.83-2.83"></path>
                  <path d="M16.24 7.76l2.83-2.83"></path>
                </svg>
              </div>
              <h4>99.7% Accuracy</h4>
              <p>Compared to human graders</p>
            </div>
            <div className="tech-feature">
              <div className="tech-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                  <line x1="8" y1="21" x2="16" y2="21"></line>
                  <line x1="12" y1="17" x2="12" y2="21"></line>
                </svg>
              </div>
              <h4>3+ Languages</h4>
              <p>Multilingual support</p>
            </div>
            <div className="tech-feature">
              <div className="tech-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z"></path>
                  <path d="M10 2c1 .5 2 2 2 5"></path>
                </svg>
              </div>
              <h4>87% Time Saved</h4>
              <p>Average grading efficiency</p>
            </div>
          </div>
        </div>
      </section>
      <section className="cta-section">
        <div className="container">
          <div className="cta-section-header">
            <h2 className="cta-section-title">Ready to Transform Your Grading?</h2>
            <p className="cta-section-subtitle">
              Join thousands of educators who save time and improve student outcomes with GradeAnt
            </p>
            <p className="cta-section-subtitle">TBA</p>
          </div>
          <div className="text-center mt-8">
            <Link to="/signup" className="cta-button">Request a Demo</Link>
          </div>
        </div>
      </section>
      <footer>
        <div className="footer">
          <div className="footer-content">
            <div className="container">
              <div className="footer-column">
                <h3 className="footer-title">GradeAnt</h3>
                <p>
                  AI-powered grading platform that helps educators save time and provide better feedback.
                </p>
              </div>
              <div className="footer-column">
                <h3 className="footer-title">Quick Links</h3>
                <ul className="footer-links">
                  <li>
                    <Link to="/" className="footer-link">Home</Link>
                  </li>
                  <li>
                    <a href="#features" className="footer-link">Features</a>
                  </li>
                  <li>
                    <a href="#demo" className="footer-link">Demo</a>
                  </li>
                  <li>
                    <a href="#how-it-works" className="footer-link">How It Works</a>
                  </li>
                </ul>
              </div>
              <div className="footer-column">
                <h3 className="footer-title">Resources</h3>
                <ul className="footer-links">
                  <li>
                    <a href="#" className="footer-link">Documentation</a>
                  </li>
                </ul>
              </div>
              <div className="footer-column">
                <h3 className="footer-title">Connect</h3>
                <ul className="footer-links">
                  <li>
                    <Link to="/contact" className="footer-link">Contact Us</Link>
                  </li>
                  <li>
                    <a href="#" className="footer-link">Twitter</a>
                  </li>
                  <li>
                    <a href="#" className="footer-link">LinkedIn</a>
                  </li>
                </ul>
              </div>
            </div>
            <div className="copyright">
              <p>© 2025 GradeAnt. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
      <a href="#" className="back-to-top" id="backToTop">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="18 15 12 9 6 15"></polyline>
        </svg>
      </a>
    </PageScope>
  )
}
