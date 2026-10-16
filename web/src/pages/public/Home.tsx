import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'motion/react'
import { Carousel, CountUp, CtaBand, FaqList, LandingPage, Reveal, SectionHead } from '../../components/landing/LandingKit'
import { EASE, fadeUp, stagger } from '../../components/landing/motion'

/**
 * Marketing homepage (wireframes §01 + §18), rebuilt as a React landing page
 * on the brand tokens with Motion for entrance, scroll and hover animation.
 * Respects prefers-reduced-motion via <MotionConfig reducedMotion="user">.
 */

const FEATURES = [
  { icon: 'bolt', title: 'Instant feedback', text: 'Grades a full batch in seconds, not hours — with a comment on every answer.', tone: 'brand', span: 2 },
  { icon: 'draw', title: 'Reads handwriting', text: 'Messy working, diagrams and equations — GradeFlow™ reads them like a teacher would.', tone: 'accent', span: 1 },
  { icon: 'tune', title: 'Your rubric, your voice', text: 'Upload a solution key or let AI draft the rubric, then grade strict, balanced or lenient.', tone: 'sky', span: 1 },
  { icon: 'functions', title: 'Built for STEM', text: 'Physics, chemistry, maths and more — units, signs and partial-credit method marks included.', tone: 'brand', span: 2 },
  { icon: 'insights', title: 'Class insights', text: 'Score spread, hardest questions and at-risk students the moment grading finishes.', tone: 'accent', span: 2 },
  { icon: 'verified_user', title: 'Teacher stays in control', text: 'Low-confidence answers are flagged for you. Nothing reaches students until you publish.', tone: 'sky', span: 1 },
] as const

const STEPS = [
  { icon: 'upload_file', title: 'Upload', text: 'Drop in the question paper. Students upload photos or scans of their answers.' },
  { icon: 'fact_check', title: 'Verify', text: 'Check what the OCR read and choose AI grading or your own solution key.' },
  { icon: 'auto_awesome', title: 'Auto-grade', text: 'GradeFlow™ scores every answer against the rubric and writes feedback.' },
  { icon: 'send', title: 'Review & publish', text: 'Spot-check flagged answers, adjust anything, then release grades in one click.' },
]

const PIPELINE = [
  { label: 'Image analysis', detail: 'Vision model reads each page' },
  { label: 'Text extraction', detail: 'Handwriting → text & LaTeX' },
  { label: 'Question matching', detail: 'Answers mapped to questions' },
  { label: 'Grading', detail: 'Scored against your rubric' },
  { label: 'Feedback', detail: 'Personal, actionable notes' },
]

const SLIDES = [
  { src: '/img/grading.png', caption: 'GradeFlow™: from answer sheet to scored, explained feedback' },
  { src: '/img/pdf_upload.png', caption: 'A real handwritten answer sheet beside its question paper' },
  { src: '/img/teacher_workflow.png', caption: 'For teachers: create, notify, finalise grades' },
  { src: '/img/student_workflow.png', caption: 'For students: submit, get graded, read feedback' },
]

const FAQ = [
  {
    q: 'Can GradeAnt really read handwritten answers?',
    a: 'Yes. Students photograph or scan their pages and GradeFlow™ extracts the handwriting, equations and working. Before grading, students confirm what was read, and any low-confidence text is flagged.',
  },
  {
    q: 'Do I need to provide an answer key?',
    a: 'No. Choose AI grading and GradeFlow™ drafts a rubric from your question paper for you to review — or upload your own standard solution for the most control.',
  },
  {
    q: 'Who has the final say on grades?',
    a: 'You do. Answers the AI is unsure about are queued for your review, you can override any score, and nothing is visible to students until you publish.',
  },
  {
    q: 'Which subjects does it support?',
    a: 'GradeAnt is built for STEM — physics, chemistry, mathematics and related subjects — including units, sign conventions and partial credit for method.',
  },
  {
    q: 'How do students see their results?',
    a: 'When you publish, every student is notified and sees their score, per-question feedback and can request a re-check that comes straight back to you.',
  },
]

export default function Home() {
  return (
    <LandingPage title="AI-Powered STEM Homework Grading">
      <Hero />
      <Stats />
      <Features />
      <HowItWorks />
      <Technology />
      <Roles />
      <section className="lp-section lp-section-soft" id="demo">
        <div className="lp-container">
          <SectionHead eyebrow="See it in action" title="A closer look at GradeAnt" />
          <Carousel slides={SLIDES} />
        </div>
      </section>
      <section className="lp-section" id="faq">
        <div className="lp-container lp-faq-wrap">
          <SectionHead eyebrow="FAQ" title="Questions teachers ask us" />
          <FaqList items={FAQ} />
        </div>
      </section>
      <CtaBand title="Reclaim your time. Start grading today." text="Set up your first assignment in minutes — your students get better feedback, faster." />
    </LandingPage>
  )
}

// ---- Hero ----

function Hero() {
  return (
    <section className="lp-hero">
      <div className="lp-hero-bg" aria-hidden>
        <motion.span className="lp-blob lp-blob-a" animate={{ x: [0, 40, 0], y: [0, -30, 0] }} transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }} />
        <motion.span className="lp-blob lp-blob-b" animate={{ x: [0, -30, 0], y: [0, 40, 0] }} transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }} />
        <span className="lp-grid-bg" />
      </div>
      <div className="lp-container lp-hero-inner">
        <motion.div className="lp-hero-copy" variants={stagger} initial="hidden" animate="show">
          <motion.span className="lp-eyebrow" variants={fadeUp}>
            <span className="lp-dot" /> AI-powered STEM grading
          </motion.span>
          <motion.h1 variants={fadeUp}>
            Grade STEM homework in <span className="lp-gradient-text">seconds</span>, not hours.
          </motion.h1>
          <motion.p className="lp-lead" variants={fadeUp}>
            GradeFlow™ reads handwritten working, applies your rubric and writes rich feedback for every student — so you can
            get back to teaching.
          </motion.p>
          <motion.div className="lp-hero-ctas" variants={fadeUp}>
            <motion.span whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
              <Link to="/get-started" className="lp-btn lp-btn-primary lp-btn-lg">
                Start grading free <span aria-hidden>→</span>
              </Link>
            </motion.span>
            <motion.span whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
              <Link to="/demo" className="lp-btn lp-btn-secondary lp-btn-lg">
                <span className="material-icons" aria-hidden>
                  play_circle
                </span>
                Watch demo
              </Link>
            </motion.span>
          </motion.div>
          <motion.ul className="lp-hero-points" variants={fadeUp}>
            <li>
              <span className="material-icons">check_circle</span> No answer key needed
            </li>
            <li>
              <span className="material-icons">check_circle</span> You approve every grade
            </li>
            <li>
              <span className="material-icons">check_circle</span> Handwriting & diagrams
            </li>
          </motion.ul>
        </motion.div>
        <HeroMock />
      </div>
    </section>
  )
}

/** Animated product preview: a handwritten paper being scanned and scored. */
function HeroMock() {
  return (
    <motion.div
      className="lp-mock"
      initial={{ opacity: 0, y: 40, rotate: 2 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.9, ease: EASE, delay: 0.25 }}
      aria-label="GradeAnt grading a handwritten physics paper"
      role="img"
    >
      <div className="lp-mock-window">
        <div className="lp-mock-bar">
          <span />
          <span />
          <span />
          <em>Thermodynamics HW · Paper 12 of 31</em>
        </div>
        <div className="lp-mock-body">
          <div className="lp-paper">
            <motion.div
              className="lp-scan"
              animate={{ top: ['4%', '92%', '4%'] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
            />
            {['Q3', 'Q5', 'Q7'].map((q, i) => (
              <div key={q} className="lp-paper-q">
                <b>{q}</b>
                <motion.i
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.8, delay: 0.6 + i * 0.35, ease: EASE }}
                  style={{ width: `${88 - i * 14}%` }}
                />
                <motion.i
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.8, delay: 0.8 + i * 0.35, ease: EASE }}
                  style={{ width: `${62 + i * 10}%` }}
                />
              </div>
            ))}
            <div className="lp-formula">ΔU = Q − W</div>
          </div>
          <div className="lp-mock-side">
            <ScoreRing />
            {[
              { q: 'Q3', t: 'First law stated correctly', s: '10/10', tone: 'ok' },
              { q: 'Q5', t: 'Entropy sign reversed', s: '6/10', tone: 'warn' },
              { q: 'Q7', t: 'Clear diagram & working', s: '8/8', tone: 'ok' },
            ].map((f, i) => (
              <motion.div
                key={f.q}
                className={`lp-chip lp-chip-${f.tone}`}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.4 + i * 0.25, duration: 0.5, ease: EASE }}
              >
                <b>{f.q}</b>
                <span>{f.t}</span>
                <strong>{f.s}</strong>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
      <motion.div
        className="lp-float lp-float-a"
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span className="material-icons">auto_awesome</span>
        <div>
          <b>Feedback drafted</b>
          <small>31 papers · 2 min</small>
        </div>
      </motion.div>
      <motion.div
        className="lp-float lp-float-b"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span className="material-icons">flag</span>
        <div>
          <b>3 answers flagged</b>
          <small>for your review</small>
        </div>
      </motion.div>
    </motion.div>
  )
}

function ScoreRing() {
  const R = 34
  const C = 2 * Math.PI * R
  return (
    <div className="lp-ring">
      <svg viewBox="0 0 80 80" width="88" height="88" aria-hidden>
        <circle cx="40" cy="40" r={R} className="lp-ring-track" />
        <motion.circle
          cx="40"
          cy="40"
          r={R}
          className="lp-ring-fill"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - 0.88) }}
          transition={{ duration: 1.6, delay: 0.9, ease: EASE }}
        />
      </svg>
      <div className="lp-ring-label">
        <b>
          <CountUp to={88} />
        </b>
        <small>/ 100 · A</small>
      </div>
    </div>
  )
}

// ---- Stats ----

function Stats() {
  // Figures from the website wireframes (§01 B) — confirm before launch.
  const stats = [
    { to: 42, suffix: 'hrs', label: 'saved per teacher, per month' },
    { to: 547, suffix: '', label: 'papers graded in a single batch' },
    { to: 98, suffix: '%', label: 'agreement with teacher rubrics' },
  ]
  return (
    <section className="lp-stats" aria-label="GradeAnt in numbers">
      <Reveal className="lp-container lp-stats-grid">
        {stats.map((s) => (
          <motion.div key={s.label} className="lp-stat" variants={fadeUp}>
            <b>
              <CountUp to={s.to} suffix={s.suffix} />
            </b>
            <span>{s.label}</span>
          </motion.div>
        ))}
      </Reveal>
    </section>
  )
}

// ---- Features ----

function Features() {
  return (
    <section className="lp-section" id="features">
      <div className="lp-container">
        <SectionHead
          eyebrow="Why teachers choose GradeAnt"
          title={
            <>
              Everything you need to grade <span className="lp-gradient-text">your way</span>
            </>
          }
          text="From the first upload to the last piece of feedback, GradeAnt handles the busywork and leaves the judgement to you."
        />
        <Reveal className="lp-bento">
          {FEATURES.map((f) => (
            <motion.article
              key={f.title}
              className={`lp-feature lp-tone-${f.tone}${f.span === 2 ? ' is-wide' : ''}`}
              variants={fadeUp}
              whileHover={{ y: -6 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            >
              <span className="lp-feature-icon material-icons" aria-hidden>
                {f.icon}
              </span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </motion.article>
          ))}
        </Reveal>
      </div>
    </section>
  )
}

// ---- How it works ----

function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 80%', 'end 60%'] })
  const scaleX = useTransform(scrollYProgress, [0, 1], [0, 1])

  return (
    <section className="lp-section lp-section-soft" id="how">
      <div className="lp-container">
        <SectionHead eyebrow="How it works" title="From stack of paper to published grades in four steps" />
        <div className="lp-steps" ref={ref}>
          <div className="lp-steps-track" aria-hidden>
            <motion.span style={{ scaleX }} />
          </div>
          <Reveal className="lp-steps-grid" as="ul">
            {STEPS.map((s, i) => (
              <motion.li key={s.title} className="lp-step" variants={fadeUp}>
                <span className="lp-step-num">
                  <span className="material-icons" aria-hidden>
                    {s.icon}
                  </span>
                </span>
                <small>Step {i + 1}</small>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </motion.li>
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  )
}

// ---- Technology (dark) ----

function Technology() {
  return (
    <section className="lp-section lp-dark" id="technology">
      <div className="lp-container">
        <SectionHead
          light
          eyebrow="The technology"
          title={
            <>
              Meet <span className="lp-gradient-text">GradeFlow™</span>
            </>
          }
          text="Vision and language models built for education, working as a pipeline of agents — each step checkable by you."
        />
        <Reveal className="lp-pipeline" as="ul">
          {PIPELINE.map((p, i) => (
            <motion.li key={p.label} variants={fadeUp}>
              <motion.span
                className="lp-pipe-node"
                animate={{ boxShadow: ['0 0 0 0 rgba(255,122,0,0)', '0 0 0 10px rgba(255,122,0,0.18)', '0 0 0 0 rgba(255,122,0,0)'] }}
                transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.5 }}
              >
                {i + 1}
              </motion.span>
              <b>{p.label}</b>
              <small>{p.detail}</small>
            </motion.li>
          ))}
        </Reveal>
        <Reveal className="lp-tech-cards">
          {[
            { icon: 'document_scanner', title: 'Visual language model', text: 'Reads handwriting, diagrams and equations straight from a photo or scan.' },
            { icon: 'hub', title: 'LLM grading agents', text: 'Parse the paper, identify each question and grade against your rubric.' },
            { icon: 'psychology', title: 'Personalised feedback', text: 'Tailored notes that tell each student what to fix and how to improve.' },
          ].map((c) => (
            <motion.div key={c.title} className="lp-tech-card" variants={fadeUp} whileHover={{ y: -4 }}>
              <span className="material-icons" aria-hidden>
                {c.icon}
              </span>
              <h3>{c.title}</h3>
              <p>{c.text}</p>
            </motion.div>
          ))}
        </Reveal>
      </div>
    </section>
  )
}

// ---- Roles ----

function Roles() {
  const roles = [
    {
      who: 'For teachers',
      title: 'Your weekends back',
      icon: 'school',
      points: ['Create an assignment in minutes', 'AI or solution-key grading', 'Spot-check only what the AI flags', 'Class analytics after every batch'],
      to: '/get-started',
      cta: 'Start grading',
      tone: 'brand',
    },
    {
      who: 'For students',
      title: 'Feedback that teaches',
      icon: 'backpack',
      points: ['Snap and upload your answer pages', 'Track grading as it happens', 'Per-question feedback you can act on', 'Request a re-check in one tap'],
      to: '/login',
      cta: 'Student log in',
      tone: 'accent',
    },
  ] as const
  return (
    <section className="lp-section">
      <div className="lp-container">
        <SectionHead eyebrow="Built for the whole class" title="One platform, two great experiences" />
        <Reveal className="lp-roles">
          {roles.map((r) => (
            <motion.article key={r.who} className={`lp-role lp-tone-${r.tone}`} variants={fadeUp} whileHover={{ y: -6 }}>
              <span className="lp-role-icon material-icons" aria-hidden>
                {r.icon}
              </span>
              <small>{r.who}</small>
              <h3>{r.title}</h3>
              <ul>
                {r.points.map((p) => (
                  <li key={p}>
                    <span className="material-icons" aria-hidden>
                      check
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
              <Link to={r.to} className="lp-btn lp-btn-secondary">
                {r.cta} →
              </Link>
            </motion.article>
          ))}
        </Reveal>
      </div>
    </section>
  )
}

// ---- Product showcase carousel ----
