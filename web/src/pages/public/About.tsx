import { motion } from 'motion/react'
import { CtaBand, LandingPage, PageHero, Reveal, SectionHead } from '../../components/landing/LandingKit'
import { fadeUp } from '../../components/landing/motion'

const TEAM = [
  {
    name: 'Dr. Shradha Agarwal',
    role: 'Head of AI',
    subject: 'Physics',
    photo: '/img/shradha.jpg',
    bio: 'Head of ML/AI at a stealth startup, leading LLM work in RAG, prompt engineering, subject classification and OCR-based image analysis. Specialises in NLP, computer vision and generative AI.',
  },
  {
    name: 'Dr. Nilanjan Chakraborty',
    role: 'Assistant Professor, Mathematics & Statistics',
    subject: 'Mathematics & Statistics',
    photo: '/img/nirlanjan_chakarborty.jpg',
    bio: 'Assistant Professor of Mathematics and Statistics at Missouri S&T, focusing on advanced statistical inference and AI.',
  },
  {
    name: 'Dr. Donald C. Wunsch',
    role: 'Professor, Electrical & Computer Engineering',
    subject: 'Electrical & Computer Engineering',
    photo: '/img/Don_Wunsh.jpg',
    bio: 'Distinguished professor and director of the Kummer Centre at Missouri S&T, specialising in neural networks, reinforcement learning and XAI.',
  },
  {
    name: 'Dr. Beth Kania-Gosche',
    role: 'Professor',
    subject: 'Education & Cognitive Science',
    photo: '/img/Kania_beth.jpg',
    bio: 'Chair of Education at Missouri S&T, with expertise in STEM education and teacher preparation programmes.',
  },
  {
    name: 'Tariq Jamil',
    role: 'Head of Pedagogy',
    photo: '/img/tariq.jpg',
    bio: 'Former principal and curriculum specialist focused on assessment strategies.',
  },
  {
    name: 'Deepak Rajbhar',
    role: 'AI Engineer',
    photo: '/img/deepak.jpg',
    bio: 'AI/ML engineer for EdTech and AI.',
  },
  {
    name: 'Narayan Adhikari',
    role: 'AI Engineer',
    photo: '/img/narayan.jpg',
    bio: 'AI researcher specialising in natural language processing and education.',
  },
]

const VALUES = [
  { icon: 'school', title: 'Educator-first', text: 'We build everything with teachers in mind, prioritising their needs and workflows.', tone: 'brand' },
  { icon: 'lightbulb', title: 'Innovation', text: 'We keep pushing the boundaries of what is possible in educational technology.', tone: 'accent' },
  { icon: 'handshake', title: 'Partnership', text: 'We see ourselves as partners in education, not just a tool provider.', tone: 'sky' },
  { icon: 'shield', title: 'Trust & privacy', text: 'We hold the highest standards for data security and student privacy.', tone: 'brand' },
] as const

function Person({ p }: { p: (typeof TEAM)[number] }) {
  return (
    <motion.article className="lp-person" variants={fadeUp} whileHover={{ y: -6 }}>
      <img src={p.photo} alt={p.name} loading="lazy" />
      <h3>{p.name}</h3>
      <div className="lp-role-tag">{p.role}</div>
      {p.subject && <span className="lp-subject">{p.subject}</span>}
      <p>{p.bio}</p>
    </motion.article>
  )
}

export default function About() {
  return (
    <LandingPage title="About Us">
      <PageHero
        eyebrow="Our mission"
        title={
          <>
            Giving educators their <span className="lp-gradient-text">time back</span>
          </>
        }
        lead="Our mission is to empower educators with intelligent tools that save time and improve student outcomes — without compromising on feedback quality."
      />

      <section className="lp-section" style={{ paddingTop: 24 }}>
        <Reveal className="lp-container lp-split">
          <motion.div className="lp-photo" variants={fadeUp}>
            <img src="/img/group.jpeg" alt="The GradeAnt team" loading="lazy" />
            <span className="lp-photo-badge">Founded in 2024 · Rolla, Missouri</span>
          </motion.div>
          <motion.div variants={fadeUp}>
            <span className="lp-eyebrow">Our story</span>
            <h2>Born from too many late nights of grading</h2>
            <p>
              GradeAnt began in 2024 when a group of educators and technologists came together with a shared vision: to solve one of
              education's most persistent challenges — the grading bottleneck.
            </p>
            <p>
              After countless late nights grading papers, our founders knew there had to be a better way. They set out to build an
              AI grading assistant that understands nuanced responses while keeping the human touch that makes feedback valuable.
            </p>
            <p>Today, GradeAnt helps educators reclaim their time while giving students more consistent, thoughtful feedback.</p>
          </motion.div>
        </Reveal>
      </section>

      <section className="lp-section lp-section-soft">
        <div className="lp-container">
          <SectionHead eyebrow="Meet the team" title="Researchers, educators and engineers" text="Subject experts from Missouri S&T and beyond, building AI that understands how STEM is taught." />
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

      <CtaBand title="Want to build the future of grading with us?" text="Whether you teach, research or run a school, we'd love to hear from you." />
    </LandingPage>
  )
}
