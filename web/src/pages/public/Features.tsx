import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { CountUp, CtaBand, LandingPage, PageHero, Reveal, SectionHead } from '../../components/landing/LandingKit'
import { fadeUp } from '../../components/landing/motion'

const KEY_FEATURES = [
  { icon: 'auto_awesome', title: 'Intelligent grading', text: 'Grades across STEM subjects — from equations to worded answers — consistently, with less bias.', tone: 'brand' },
  { icon: 'chat', title: 'Personalised feedback', text: 'Highlights strengths, pinpoints gaps and gives every student an actionable next step.', tone: 'accent' },
  { icon: 'document_scanner', title: 'Multi-format support', text: 'Typed text, images and handwriting — our visual language model understands them all.', tone: 'sky' },
  { icon: 'insights', title: 'Performance analytics', text: 'Track progress over time, spot knowledge gaps and plan targeted interventions.', tone: 'accent' },
  { icon: 'groups', title: 'Instructor collaboration', text: 'Share rubrics, feedback templates and grades with TAs and co-instructors.', tone: 'sky' },
  { icon: 'lock', title: 'Privacy & security', text: 'Encryption, role-based access and FERPA-aligned handling keep student data protected.', tone: 'brand' },
] as const

const ROWS = [
  {
    eyebrow: 'Grading',
    title: 'From answer sheet to scored, explained feedback',
    text: 'GradeFlow™ identifies every question on the paper, scores each answer against your rubric and explains the marks — so students know exactly why.',
    points: ['Automatic question-number identification', 'Partial credit for correct method', 'Feedback on every answer'],
    img: '/img/grading.png',
    alt: 'GradeFlow scoring a student response and writing feedback',
    tone: 'brand',
  },
  {
    eyebrow: 'Handwriting',
    title: 'Real handwritten work, read properly',
    text: 'Students photograph or scan their pages. The visual language model reads working, units and equations — and anything it is unsure of is flagged for a human check.',
    points: ['Photos, scans and PDFs', 'Equations, units and diagrams', 'Low-confidence text flagged'],
    img: '/img/pdf_upload.png',
    alt: 'A handwritten answer sheet next to its question paper',
    tone: 'accent',
  },
  {
    eyebrow: 'Workflow',
    title: 'Built around how teachers already work',
    text: 'Create an assignment, students are alerted, submissions flow in and you finalise grades from one dashboard — with you approving everything before it is published.',
    points: ['Assignment alerts for students', 'One dashboard for every class', 'Publish only when you are ready'],
    img: '/img/teacher_workflow.png',
    alt: 'Teacher workflow: create assignment, alert students, finalise grades',
    tone: 'sky',
  },
] as const

const STEPS = [
  { icon: 'upload_file', title: 'Upload assignments', text: 'Import submissions in any format through the dashboard.' },
  { icon: 'psychology', title: 'AI assessment', text: 'The VLM-powered system analyses each answer against your rubric.' },
  { icon: 'rate_review', title: 'Review & adjust', text: 'Check AI grades and feedback and tweak anything you like.' },
  { icon: 'send', title: 'Distribute results', text: 'Release personalised feedback and grades in a few clicks.' },
]

const MODELS = [
  { icon: 'hub', title: 'VLM + LLM agents', steps: ['Parsing', 'Question identification', 'Grading'] },
  { icon: 'visibility', title: 'Visual language model', steps: ['Image analysis', 'Text extraction', 'Context understanding'] },
  { icon: 'tips_and_updates', title: 'Personalised feedback', steps: ['Strengths', 'Gaps', 'Next steps'] },
]

export default function Features() {
  return (
    <LandingPage title="Features">
      <PageHero
        eyebrow="Features"
        title={
          <>
            Transform your <span className="lp-gradient-text">grading experience</span>
          </>
        }
        lead="Save time, give better feedback and improve learning outcomes with GradeAnt's intelligent grading platform."
      >
        <Link to="/get-started" className="lp-btn lp-btn-primary lp-btn-lg">
          Get started free →
        </Link>
        <Link to="/demo" className="lp-btn lp-btn-secondary lp-btn-lg">
          <span className="material-icons" aria-hidden>
            play_circle
          </span>
          See the demo
        </Link>
      </PageHero>

      <section className="lp-section" style={{ paddingTop: 24 }}>
        <div className="lp-container">
          <SectionHead eyebrow="Key features" title="Everything in one grading platform" />
          <Reveal className="lp-cards">
            {KEY_FEATURES.map((f) => (
              <motion.article key={f.title} className={`lp-feature lp-tone-${f.tone}`} variants={fadeUp} whileHover={{ y: -6 }}>
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

      <section className="lp-section lp-section-soft">
        <div className="lp-container lp-feature-rows">
          {ROWS.map((r, i) => (
            <Reveal key={r.title} className={`lp-split lp-feature-row lp-tone-${r.tone}${i % 2 ? ' is-flipped' : ''}`}>
              <motion.div variants={fadeUp}>
                <span className="lp-eyebrow">{r.eyebrow}</span>
                <h2>{r.title}</h2>
                <p>{r.text}</p>
                <ul className="lp-checks">
                  {r.points.map((p) => (
                    <li key={p}>
                      <span className="material-icons" aria-hidden>
                        check_circle
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
              </motion.div>
              <motion.div className="lp-visual" variants={fadeUp} whileHover={{ rotate: i % 2 ? -0.6 : 0.6, scale: 1.01 }}>
                <img src={r.img} alt={r.alt} loading="lazy" />
              </motion.div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="lp-section" id="how-it-works">
        <div className="lp-container">
          <SectionHead eyebrow="How it works" title="Simple process, powerful results" text="Four steps that save you time and raise the quality of every piece of feedback." />
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
      </section>

      <section className="lp-section lp-dark" id="technology">
        <div className="lp-container">
          <SectionHead
            light
            eyebrow="Our AI technology"
            title={
              <>
                Powered by <span className="lp-gradient-text">GradeFlow™</span>
              </>
            }
            text="Machine-learning models designed specifically for education."
          />
          <Reveal className="lp-tech-cards">
            {MODELS.map((m) => (
              <motion.div key={m.title} className="lp-tech-card" variants={fadeUp} whileHover={{ y: -4 }}>
                <span className="material-icons" aria-hidden>
                  {m.icon}
                </span>
                <h3>{m.title}</h3>
                <ol className="lp-model-steps">
                  {m.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </motion.div>
            ))}
          </Reveal>
          <Reveal className="lp-stats-grid lp-dark-stats">
            {[
              { to: 99.7, decimals: 1, suffix: '%', label: 'Accuracy compared to human graders' },
              { to: 3, decimals: 0, suffix: '+', label: 'Languages supported' },
              { to: 87, decimals: 0, suffix: '%', label: 'Average time saved on grading' },
            ].map((s) => (
              <motion.div key={s.label} className="lp-stat" variants={fadeUp}>
                <b>
                  <CountUp to={s.to} decimals={s.decimals} suffix={s.suffix} />
                </b>
                <span>{s.label}</span>
              </motion.div>
            ))}
          </Reveal>
        </div>
      </section>

      <div style={{ height: 104 }} />
      <CtaBand title="Ready to transform your grading?" text="Join the educators who save time and improve student outcomes with GradeAnt." />
    </LandingPage>
  )
}
