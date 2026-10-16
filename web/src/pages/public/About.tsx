import { useRef } from 'react'
import { Link } from 'react-router-dom'
import PageScope from '../../components/PageScope'
import { useStaticPageBehaviors } from '../../hooks/useStaticPageBehaviors'
import '../../styles/themes/site.css'

/** Converted from resoures/about.html; its inline script lives in useStaticPageBehaviors. */
export default function About() {
  const root = useRef<HTMLDivElement>(null)
  useStaticPageBehaviors(root)

  return (
    <PageScope name="about" theme="site" title="About" rootRef={root}>
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
            <Link to="/about" className="active">About</Link>
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
      <section className="page-hero mission-banner about-hero">
        <div className="container">
          <span className="eyebrow">Our Mission</span>
          <h1>About GradeAnt</h1>
          <p>
            Our mission is to empower educators with intelligent tools that save time and improve student outcomes.
          </p>
        </div>
      </section>
      <section className="our-story">
        <div className="container">
          <div className="story-content">
            <h2>Our Story</h2>
            <p>
              GradeAnt began in 2024 when a group of educators and technologists came together with a shared vision: to solve one of education's most persistent challenges - the grading bottleneck.
            </p>
            <p>
              After spending countless late nights grading papers, our founders realized there had to be a better way. They set out to build an AI-powered grading assistant that could understand nuanced responses while maintaining the human touch that makes feedback valuable.
            </p>
            <p>
              Today, GradeAnt helps thousands of educators across the globe reclaim their time while providing more consistent, thoughtful feedback to their students.
            </p>
          </div>
          <div className="story-image">
            <img src="/img/group.jpeg" alt="GradeAnt Team" />
          </div>
        </div>
      </section>
      <section className="team-section">
        <div className="container">
          <h2 className="section-title">Meet Our Team</h2>
          <div className="team-grid">
            <div className="team-member">
              <span className="team-avatar">SA</span>
              <h3>Dr. Shradha Agarwal</h3>
              <p className="member-title">Head of AI</p>
              <h4>Subject Matter Expert:</h4>
              <p className="expertise">Physics</p>
              <h4>About:</h4>
              <p>
                Head of ML/AI at a stealth startup. Leads advanced LLM projects including RAG, prompt engineering, subject classification, and OCR-based image analysis. Specialized in NLP, Computer Vision, and Generative AI with deep expertise in GANs, transformers, and diffusion models.
              </p>
            </div>
            <div className="team-member">
              <span className="team-avatar">NC</span>
              <h3>Dr. Nilanjan Chakraborty</h3>
              <p className="member-title">Assistant Professor Mathematics and Statistics</p>
              <h4>Subject Matter Expert:</h4>
              <p className="expertise">Mathematics and Statistics</p>
              <h4>About:</h4>
              <p>
                Assistant Professor of Mathematics and Statistics at Missouri S&T, focusing on advanced statistical inference and AI.
              </p>
            </div>
            <div className="team-member">
              <span className="team-avatar">DW</span>
              <h3>Dr. Donald C. Wunsch</h3>
              <p className="member-title">Professor Electrical and Computer Engineering</p>
              <h4>Subject Matter Expert:</h4>
              <p className="expertise">Electrical and Computer Engineering</p>
              <h4>About:</h4>
              <p>
                A distinguished professor and director of the Kummer Centre at Missouri S&T, specializing in neural networks, reinforcement learning, and XAI.
              </p>
            </div>
            <div className="team-member">
              <span className="team-avatar">BK</span>
              <h3>Dr. Beth Kania-Gosche</h3>
              <p className="member-title">Professor</p>
              <h4>Subject Matter Expert:</h4>
              <p className="expertise">Education and Cognitive Science</p>
              <h4>About:</h4>
              <p>
                Chair of Education at Missouri S&T, with expertise in STEM education and teacher preparation programs.
              </p>
            </div>
            <div className="team-member">
              <span className="team-avatar">TJ</span>
              <h3>Tariq Jamil</h3>
              <p className="member-title">Head of Pedagogy</p>
              <p>Former principal and curriculum specialist focused on assessment strategies.</p>
            </div>
            <div className="team-member">
              <span className="team-avatar">DR</span>
              <h3>Deepak Rajbhar</h3>
              <p className="member-title">AI Engineer</p>
              <p>AI/ML Engineer for EdTech and AI.</p>
            </div>
            <div className="team-member">
              <span className="team-avatar">NA</span>
              <h3>Narayan Adhikari</h3>
              <p className="member-title">AI Engineer</p>
              <p>AI researcher specializing in natural language processing and education.</p>
            </div>
          </div>
        </div>
      </section>
      <section className="values-section">
        <div className="container">
          <h2 className="section-title">Our Values</h2>
          <div className="values-grid">
            <div className="value-card">
              <div className="value-icon">🎯</div>
              <h3>Educator-First</h3>
              <p>
                We build everything with teachers in mind, prioritizing their needs and workflows.
              </p>
            </div>
            <div className="value-card">
              <div className="value-icon">💡</div>
              <h3>Innovation</h3>
              <p>We constantly push the boundaries of what's possible in educational technology.</p>
            </div>
            <div className="value-card">
              <div className="value-icon">🤝</div>
              <h3>Partnership</h3>
              <p>We see ourselves as partners in education, not just a tool provider.</p>
            </div>
            <div className="value-card">
              <div className="value-icon">🔒</div>
              <h3>Trust & Privacy</h3>
              <p>We maintain the highest standards for data security and student privacy.</p>
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
