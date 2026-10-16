import { useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { FaqList, LandingPage, PageHero, Reveal, SectionHead } from '../../components/landing/LandingKit'
import { EASE, fadeUp } from '../../components/landing/motion'
import { CONTACT } from '../../components/landing/site'

const FAQ = [
  {
    q: 'How quickly can I get started with GradeAnt?',
    a: 'In minutes. Once your account is set up you can upload a question paper and start grading straight away.',
  },
  {
    q: 'Does GradeAnt integrate with my existing LMS?',
    a: 'GradeAnt is designed to work alongside popular learning management systems such as Canvas, Blackboard, Moodle and Google Classroom. Get in touch to discuss your setup.',
  },
  {
    q: "Is my students' data secure?",
    a: 'Yes. We take privacy and security seriously: data is encrypted, access is role-based, and we never share or sell your data.',
  },
  {
    q: 'Can I customise the grading criteria?',
    a: 'Yes. Upload your own solution key or edit the AI-drafted rubric, and choose how strict the grading should be.',
  },
]

const SUBJECTS = ['General question', 'Request a demo', 'Partnership', 'Support', 'Feedback']

const MAP_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CONTACT.address)}`

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: SUBJECTS[0], message: '' })
  const [sent, setSent] = useState(false)
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  // No contact API yet: hand the message to the visitor's email app, pre-filled.
  function submit(e: FormEvent) {
    e.preventDefault()
    const body = `${form.message}\n\n— ${form.name} (${form.email})`
    window.location.href = `mailto:${CONTACT.email}?subject=${encodeURIComponent(`[${form.subject}] from ${form.name}`)}&body=${encodeURIComponent(body)}`
    setSent(true)
  }

  return (
    <LandingPage title="Contact Us">
      <PageHero
        eyebrow="Contact"
        title={
          <>
            We'd love to <span className="lp-gradient-text">hear from you</span>
          </>
        }
        lead="Questions, feedback or partnership ideas — reach out and the team will get back to you."
      />

      <section className="lp-section" style={{ paddingTop: 8 }}>
        <Reveal className="lp-container lp-contact">
          <motion.div className="lp-panel" variants={fadeUp}>
            <h2>Send us a message</h2>
            <p>Tell us a little about what you need and the team will get back to you.</p>
            <form className="lp-form" onSubmit={submit}>
              <div className="lp-form-row">
                <div className="lp-field">
                  <label htmlFor="c-name">Full name</label>
                  <input id="c-name" className="lp-input" required autoComplete="name" value={form.name} onChange={set('name')} />
                </div>
                <div className="lp-field">
                  <label htmlFor="c-email">Email address</label>
                  <input id="c-email" className="lp-input" type="email" required autoComplete="email" value={form.email} onChange={set('email')} />
                </div>
              </div>
              <div className="lp-field">
                <label htmlFor="c-subject">Subject</label>
                <select id="c-subject" className="lp-input" value={form.subject} onChange={set('subject')}>
                  {SUBJECTS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="lp-field">
                <label htmlFor="c-message">Message</label>
                <textarea id="c-message" className="lp-input" required value={form.message} onChange={set('message')} />
              </div>
              <AnimatePresence>
                {sent && (
                  <motion.div className="lp-success" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ ease: EASE }} role="status">
                    <span className="material-icons" aria-hidden>
                      mark_email_read
                    </span>
                    Your email app should open with the message ready — just hit send.
                  </motion.div>
                )}
              </AnimatePresence>
              <motion.button type="submit" className="lp-btn lp-btn-primary lp-btn-lg" whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
                Send message →
              </motion.button>
            </form>
          </motion.div>

          <motion.div className="lp-info" variants={fadeUp}>
            <a className="lp-info-item" href={`mailto:${CONTACT.email}`}>
              <span className="lp-info-icon material-icons" aria-hidden>
                mail
              </span>
              <div>
                <b>Email</b>
                <span>{CONTACT.email}</span>
              </div>
            </a>
            <a className="lp-info-item" href={`tel:${CONTACT.phone}`}>
              <span className="lp-info-icon material-icons" aria-hidden>
                call
              </span>
              <div>
                <b>Phone</b>
                <span>
                  {CONTACT.phone}
                  <br />
                  {CONTACT.hours}
                </span>
              </div>
            </a>
            <a className="lp-info-item" href={MAP_URL} target="_blank" rel="noreferrer">
              <span className="lp-info-icon material-icons" aria-hidden>
                location_on
              </span>
              <div>
                <b>Location</b>
                <span>{CONTACT.address}</span>
              </div>
            </a>
          </motion.div>
        </Reveal>
      </section>

      <section className="lp-section lp-section-soft">
        <div className="lp-container lp-faq-wrap">
          <SectionHead eyebrow="FAQ" title="Frequently asked questions" />
          <FaqList items={FAQ} />
        </div>
      </section>
    </LandingPage>
  )
}
