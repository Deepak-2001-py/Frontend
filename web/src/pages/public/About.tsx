<<<<<<< HEAD
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { CtaBand, LandingPage, PageHero, Reveal, SectionHead } from '../../components/landing/LandingKit'
import { fadeUp } from '../../components/landing/motion'
import { FUNDERS } from '../../components/landing/site'

const TEAM = [
  {
    name: 'Dr. Shradha Agarwal',
    role: 'Head of AI',
    subject: 'Physics',
    photo: '/img/shradha.webp',
    bio: 'Head of ML/AI at a stealth startup, leading LLM work in RAG, prompt engineering, subject classification and OCR-based image analysis. Specialises in NLP, computer vision and generative AI.',
  },
  {
    name: 'Dr. Nilanjan Chakraborty',
    role: 'Assistant Professor, Mathematics & Statistics',
    subject: 'Mathematics & Statistics',
    photo: '/img/nirlanjan_chakarborty.webp',
    bio: 'Assistant Professor of Mathematics and Statistics at Missouri S&T, focusing on advanced statistical inference and AI.',
  },
  {
    name: 'Dr. Donald C. Wunsch',
    role: 'Professor, Electrical & Computer Engineering',
    subject: 'Electrical & Computer Engineering',
    photo: '/img/Don_Wunsh.webp',
    bio: 'Distinguished professor and director of the Kummer Centre at Missouri S&T, specialising in neural networks, reinforcement learning and XAI.',
  },
  {
    name: 'Dr. Beth Kania-Gosche',
    role: 'Professor',
    subject: 'Education & Cognitive Science',
    photo: '/img/Kania_beth.webp',
    bio: 'Chair of Education at Missouri S&T, with expertise in STEM education and teacher preparation programmes.',
  },
  {
    name: 'Tariq Jamil',
    role: 'Head of Pedagogy',
    photo: '/img/tariq.webp',
    bio: 'Former principal and curriculum specialist focused on assessment strategies.',
  },
  {
    name: 'Deepak Rajbhar',
    role: 'AI Engineer',
    photo: '/img/deepak.webp',
    bio: 'AI/ML engineer for EdTech and AI.',
  },
  {
    name: 'Narayan Adhikari',
    role: 'AI Engineer',
    photo: '/img/narayan.webp',
    bio: 'AI researcher specialising in natural language processing and education.',
  },
]

const VALUES = [
  { icon: 'school', title: 'Teacher in control', text: 'GradeAnt drafts; the teacher decides. No grade reaches a student without a teacher publishing it.', tone: 'brand' },
  { icon: 'science', title: 'Research first', text: 'We test where AI grading goes wrong before we rely on it, and publish what we find.', tone: 'accent' },
  { icon: 'fact_check', title: 'Only true claims', text: 'We say what GradeAnt does today, for the subjects we have tested, and nothing more.', tone: 'brand' },
  { icon: 'shield', title: 'Student privacy', text: 'Student work is visible only to the teachers of that course, and deleted on request.', tone: 'accent' },
] as const

function Person({ p }: { p: (typeof TEAM)[number] }) {
  return (
    <motion.article className="lp-person" variants={fadeUp} whileHover={{ y: -6 }}>
      <img src={p.photo} alt={`Portrait of ${p.name}`} loading="lazy" width={240} height={240} />
      <h3>{p.name}</h3>
      <div className="lp-role-tag">{p.role}</div>
      {p.subject && <span className="lp-subject">{p.subject}</span>}
      <p>{p.bio}</p>
    </motion.article>
  )
}

export default function About() {
  return (
    <LandingPage
      title="About"
      description="GradeAnt was founded in 2024 at Missouri S&T by a team of seven researchers, educators and engineers building AI that grades handwritten math and physics."
    >
      <PageHero
        eyebrow="About GradeAnt"
        title="Giving teachers their time back"
        lead="We build AI that does the first pass of grading handwritten math and physics, so teachers can spend their time on feedback and teaching."
      />

      <section className="lp-section" style={{ paddingTop: 24 }}>
        <Reveal className="lp-container lp-split">
          <motion.div className="lp-photo" variants={fadeUp}>
            <img src="/img/group.webp" alt="Portraits of the seven GradeAnt team members, each with their name" loading="lazy" width={1280} height={960} />
            <span className="lp-photo-badge">Founded in 2024 at Missouri S&amp;T</span>
          </motion.div>
          <motion.div variants={fadeUp}>
            <span className="lp-eyebrow">Our story</span>
            <h2>Born from too many late nights of grading</h2>
            <p>
              GradeAnt began in 2024 at Missouri S&amp;T in Rolla, Missouri, when a group of educators and AI researchers set out to
              tackle the grading bottleneck in STEM courses.
            </p>
            <p>
              Grading handwritten working takes hours, and students often wait a week for feedback. We are building an AI assistant
              that reads that working, marks it step by step against the teacher's rubric, and leaves the final call to the teacher.
            </p>
            <p>Today we are piloting GradeAnt with math and physics courses.</p>
          </motion.div>
        </Reveal>
      </section>

      <section className="lp-section lp-section-soft">
        <div className="lp-container">
          <SectionHead
            eyebrow="The team"
            title="Seven researchers, educators and engineers"
            text="One team from Missouri S&T and beyond, building AI that understands how math and physics are taught."
          />
          <Reveal className="lp-cards is-4">
            {TEAM.map((p) => (
              <Person key={p.name} p={p} />
            ))}
          </Reveal>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-container">
          <SectionHead eyebrow="Our values" title="What we stand for" />
          <Reveal className="lp-cards is-4">
            {VALUES.map((v) => (
              <motion.article key={v.title} className={`lp-icon-card lp-tone-${v.tone}`} variants={fadeUp} whileHover={{ y: -6 }}>
                <span className="lp-feature-icon material-icons" aria-hidden>
                  {v.icon}
                </span>
                <h3>{v.title}</h3>
                <p>{v.text}</p>
              </motion.article>
            ))}
          </Reveal>
        </div>
      </section>

      {FUNDERS.length > 0 && (
        <section className="lp-section lp-section-soft" aria-labelledby="backed-by">
          <div className="lp-container">
            <h2 id="backed-by" className="lp-backed-title">
              Backed by
            </h2>
            <ul className="lp-backed">
              {FUNDERS.map((f) => (
                <li key={f.name}>
                  <img src={f.logo} alt={f.name} height={40} loading="lazy" />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <CtaBand />
      <section className="lp-section lp-careers-band">
        <div className="lp-container">
          <p>
            Want to work with us? See <Link to="/careers">open roles</Link>.
          </p>
        </div>
      </section>
    </LandingPage>
=======
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
>>>>>>> origin/main
  )
}
