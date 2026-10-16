import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, MotionConfig, motion, useMotionValueEvent, useScroll, useSpring } from 'motion/react'
import { EASE, fadeUp, stagger } from './motion'
import { CONTACT } from './site'
export { default as CountUp } from '../motion/CountUp'
import '../../styles/landing.css'

/**
 * Shared shell and building blocks for the marketing pages (Home, Features,
 * About, Blog, Contact): header, footer, scroll progress, reveal-on-scroll,
 * count-up numbers, section heads, inner-page hero, FAQ and carousel.
 */

const YEAR = new Date().getFullYear()

const NAV = [
  { to: '/features', label: 'Features' },
  { to: '/#how', label: 'How it works' },
  { to: '/features#technology', label: 'Technology' },
  { to: '/blog', label: 'Blog' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
]

/** Page wrapper: reduced-motion aware, skip link, progress bar, header, footer, #hash scrolling. */
export function LandingPage({ title, children }: { title: string; children: ReactNode }) {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    document.title = `GradeAnt | ${title}`
  }, [title])

  // Router navigation doesn't scroll to #anchors (e.g. /#how, /features#technology).
  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0)
      return
    }
    const t = window.setTimeout(() => document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' }), 60)
    return () => clearTimeout(t)
  }, [pathname, hash])

  return (
    <MotionConfig reducedMotion="user">
      <div className="lp">
        <a href="#main" className="lp-skip">
          Skip to content
        </a>
        <ScrollProgress />
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </div>
    </MotionConfig>
  )
}

function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30 })
  return <motion.div className="lp-progress" style={{ scaleX }} aria-hidden />
}

export function Logo() {
  return (
    <Link to="/" className="lp-logo" aria-label="GradeAnt home">
      <img src="/img/grade-antlogo-removebg-preview.png" alt="" width={36} height={36} />
      <span>
        Grade<b>Ant</b>
      </span>
    </Link>
  )
}

function Header() {
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 12))

  return (
    <header className={`lp-header${scrolled || open ? ' is-scrolled' : ''}`}>
      <div className="lp-container lp-header-inner">
        <Logo />
        <nav className={`lp-nav${open ? ' is-open' : ''}`} aria-label="Main">
          {NAV.map((n) =>
            n.to.includes('#') ? (
              <Link key={n.to} to={n.to} onClick={() => setOpen(false)}>
                {n.label}
              </Link>
            ) : (
              <NavLink key={n.to} to={n.to} onClick={() => setOpen(false)} className={({ isActive }) => (isActive ? 'is-active' : '')}>
                {n.label}
              </NavLink>
            ),
          )}
          <div className="lp-nav-cta">
            <Link to="/login" className="lp-btn lp-btn-ghost">
              Log in
            </Link>
            <Link to="/get-started" className="lp-btn lp-btn-primary">
              Get started
            </Link>
          </div>
        </nav>
        <button
          type="button"
          className="lp-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="material-icons">{open ? 'close' : 'menu'}</span>
        </button>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="lp-footer">
      <div className="lp-container lp-footer-grid">
        <div className="lp-footer-brand">
          <Logo />
          <p>AI-powered grading for STEM classrooms — faster feedback, fairer grades, happier teachers.</p>
        </div>
        <div>
          <h3>Product</h3>
          <ul>
            <li>
              <Link to="/features">Features</Link>
            </li>
            <li>
              <Link to="/features#technology">Technology</Link>
            </li>
            <li>
              <Link to="/demo">Demo</Link>
            </li>
            <li>
              <Link to="/get-started">Get started</Link>
            </li>
          </ul>
        </div>
        <div>
          <h3>Company</h3>
          <ul>
            <li>
              <Link to="/about">About us</Link>
            </li>
            <li>
              <Link to="/blog">Blog</Link>
            </li>
            <li>
              <Link to="/contact">Contact</Link>
            </li>
          </ul>
        </div>
        <div>
          <h3>Legal</h3>
          <ul>
            <li>
              <Link to="/terms">Terms of Service</Link>
            </li>
            <li>
              <Link to="/privacy">Privacy Policy</Link>
            </li>
            <li>
              <Link to="/cookies">Cookies</Link>
            </li>
          </ul>
        </div>
        <div>
          <h3>Contact</h3>
          <ul>
            <li>
              <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
            </li>
            <li>
              <a href={`tel:${CONTACT.phone}`}>{CONTACT.phone}</a>
            </li>
            <li>{CONTACT.address}</li>
          </ul>
        </div>
      </div>
      <div className="lp-container lp-footer-bottom">
        <p>© {YEAR} GradeAnt. All rights reserved.</p>
        <a href="#main" className="lp-top" aria-label="Back to top">
          <span className="material-icons">arrow_upward</span>
        </a>
      </div>
    </footer>
  )
}


// ---- Building blocks ----

export function Reveal({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'ul' }) {
  const Tag = motion[as]
  return (
    <Tag className={className} variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }}>
      {children}
    </Tag>
  )
}

export function SectionHead({ eyebrow, title, text, light }: { eyebrow: string; title: ReactNode; text?: string; light?: boolean }) {
  return (
    <Reveal className={`lp-section-head${light ? ' is-light' : ''}`}>
      <motion.span className="lp-eyebrow" variants={fadeUp}>
        {eyebrow}
      </motion.span>
      <motion.h2 variants={fadeUp}>{title}</motion.h2>
      {text && (
        <motion.p className="lp-lead" variants={fadeUp}>
          {text}
        </motion.p>
      )}
    </Reveal>
  )
}

/** Hero for inner pages: eyebrow, h1, lead, optional actions, soft animated backdrop. */
export function PageHero({ eyebrow, title, lead, children }: { eyebrow: string; title: ReactNode; lead: string; children?: ReactNode }) {
  return (
    <section className="lp-page-hero">
      <div className="lp-hero-bg" aria-hidden>
        <motion.span className="lp-blob lp-blob-a" animate={{ x: [0, 30, 0], y: [0, -20, 0] }} transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }} />
        <motion.span className="lp-blob lp-blob-b" animate={{ x: [0, -20, 0], y: [0, 30, 0] }} transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }} />
        <span className="lp-grid-bg" />
      </div>
      <motion.div className="lp-container lp-page-hero-inner" variants={stagger} initial="hidden" animate="show">
        <motion.span className="lp-eyebrow" variants={fadeUp}>
          <span className="lp-dot" /> {eyebrow}
        </motion.span>
        <motion.h1 variants={fadeUp}>{title}</motion.h1>
        <motion.p className="lp-lead" variants={fadeUp}>
          {lead}
        </motion.p>
        {children && (
          <motion.div className="lp-hero-ctas" variants={fadeUp}>
            {children}
          </motion.div>
        )}
      </motion.div>
    </section>
  )
}

/** Accordion FAQ with FAQPage JSON-LD. */
export function FaqList({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }
  return (
    <>
      <Reveal className="lp-faq">
        {items.map((f, n) => {
          const isOpen = open === n
          return (
            <motion.div key={f.q} className={`lp-faq-item${isOpen ? ' is-open' : ''}`} variants={fadeUp}>
              <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : n)}>
                <span>{f.q}</span>
                <motion.span className="material-icons" animate={{ rotate: isOpen ? 45 : 0 }} aria-hidden>
                  add
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    className="lp-faq-a"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                  >
                    <p>{f.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </Reveal>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </>
  )
}

/** Auto-advancing image carousel (pauses on hover; arrows, dots and ←/→ keys). */
export function Carousel({ slides }: { slides: { src: string; caption: string }[] }) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const go = (d: number) => setI((n) => (n + d + slides.length) % slides.length)

  useEffect(() => {
    if (paused) return
    const t = window.setInterval(() => setI((n) => (n + 1) % slides.length), 5000)
    return () => clearInterval(t)
  }, [paused, slides.length])

  return (
    <motion.div
      className="lp-carousel"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.8, ease: EASE }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') go(-1)
        if (e.key === 'ArrowRight') go(1)
      }}
      tabIndex={0}
      role="region"
      aria-roledescription="carousel"
      aria-label="Product screenshots"
    >
      <div className="lp-carousel-frame">
        <AnimatePresence mode="wait">
          <motion.img
            key={slides[i].src}
            src={slides[i].src}
            alt={slides[i].caption}
            loading="lazy"
            initial={{ opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.45, ease: EASE }}
          />
        </AnimatePresence>
        <button type="button" className="lp-car-btn is-prev" onClick={() => go(-1)} aria-label="Previous slide">
          <span className="material-icons">chevron_left</span>
        </button>
        <button type="button" className="lp-car-btn is-next" onClick={() => go(1)} aria-label="Next slide">
          <span className="material-icons">chevron_right</span>
        </button>
      </div>
      <div className="lp-carousel-foot">
        <AnimatePresence mode="wait">
          <motion.p key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} aria-live="polite">
            {slides[i].caption}
          </motion.p>
        </AnimatePresence>
        <div className="lp-dots">
          {slides.map((s, n) => (
            <button key={s.src} type="button" className={n === i ? 'is-active' : ''} onClick={() => setI(n)} aria-label={`Slide ${n + 1}`} aria-current={n === i}>
              {n === i && !paused && <motion.span layoutId="lp-dot-fill" className="lp-dot-fill" />}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

/** Gradient call-to-action band used at the bottom of every marketing page. */
export function CtaBand({ title, text }: { title: string; text: string }) {
  return (
    <section className="lp-cta-section">
      <motion.div
        className="lp-container lp-cta"
        initial={{ opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.7, ease: EASE }}
      >
        <motion.span className="lp-cta-glow" animate={{ rotate: 360 }} transition={{ duration: 30, repeat: Infinity, ease: 'linear' }} aria-hidden />
        <h2>{title}</h2>
        <p>{text}</p>
        <div className="lp-hero-ctas">
          <motion.span whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
            <Link to="/get-started" className="lp-btn lp-btn-light lp-btn-lg">
              Get started free →
            </Link>
          </motion.span>
          <Link to="/contact" className="lp-btn lp-btn-outline-light lp-btn-lg">
            Talk to us
          </Link>
        </div>
      </motion.div>
    </section>
  )
}
