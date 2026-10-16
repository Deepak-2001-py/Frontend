import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { fadeUp, stagger } from '../landing/motion'
import CountUp from '../motion/CountUp'
import '../../styles/app.css'

/**
 * Building blocks for the signed-in pages, matching the marketing site:
 * gradient hero, quick-action tiles, animated stat cards, staggered reveal.
 */

export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={stagger} initial="hidden" animate="show">
      {children}
    </motion.div>
  )
}

/** Greeting banner at the top of a dashboard or tool page. */
export function AppHero({
  eyebrow,
  title,
  text,
  actions,
  aside,
}: {
  eyebrow: string
  title: ReactNode
  text?: ReactNode
  actions?: ReactNode
  aside?: ReactNode
}) {
  return (
    <motion.section className="app-hero" variants={fadeUp} initial="hidden" animate="show">
      <motion.span className="app-hero-orb a" animate={{ x: [0, 24, 0], y: [0, -16, 0] }} transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }} aria-hidden />
      <motion.span className="app-hero-orb b" animate={{ x: [0, -20, 0], y: [0, 18, 0] }} transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }} aria-hidden />
      <div className="app-hero-copy">
        <span className="app-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {text && <p>{text}</p>}
        {actions && <div className="app-hero-actions">{actions}</div>}
      </div>
      {aside && <div className="app-hero-aside">{aside}</div>}
    </motion.section>
  )
}

export function ActionTile({ to, icon, title, text, tone = 'brand' }: { to: string; icon: string; title: string; text: string; tone?: 'brand' | 'accent' | 'sky' | 'ink' }) {
  return (
    <motion.div variants={fadeUp} whileHover={{ y: -5 }} transition={{ type: 'spring', stiffness: 320, damping: 22 }}>
      <Link to={to} className={`app-tile app-tone-${tone}`}>
        <span className="app-tile-icon material-icons" aria-hidden>
          {icon}
        </span>
        <span className="app-tile-title">{title}</span>
        <span className="app-tile-text">{text}</span>
        <span className="app-tile-go material-icons" aria-hidden>
          arrow_forward
        </span>
      </Link>
    </motion.div>
  )
}

/** Stat card; `value` null shows a dash (data not available). */
export function AppStat({
  icon,
  label,
  value,
  suffix,
  note,
  tone = 'brand',
}: {
  icon: string
  label: string
  value: number | null | undefined
  suffix?: string
  note?: ReactNode
  tone?: 'brand' | 'accent' | 'sky' | 'warn' | 'danger'
}) {
  return (
    <motion.div className={`app-stat app-tone-${tone}`} variants={fadeUp}>
      <span className="app-stat-icon material-icons" aria-hidden>
        {icon}
      </span>
      <div>
        <div className="app-stat-label">{label}</div>
        <div className="app-stat-value">{value == null ? '—' : <CountUp to={value} suffix={suffix} />}</div>
        {note && <div className="app-stat-note">{note}</div>}
      </div>
    </motion.div>
  )
}

/** Circular score meter (0–100). */
export function ScoreRing({ percent, label, size = 120 }: { percent: number | null; label?: string; size?: number }) {
  const r = 46
  const c = 2 * Math.PI * r
  const p = percent == null ? 0 : Math.max(0, Math.min(100, percent))
  return (
    <div className="app-ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 108 108" aria-hidden>
        <circle cx="54" cy="54" r={r} className="app-ring-track" />
        <motion.circle
          cx="54"
          cy="54"
          r={r}
          className="app-ring-fill"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - p / 100) }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
        />
      </svg>
      <div className="app-ring-label">
        <b>{percent == null ? '—' : <CountUp to={Math.round(p)} suffix="%" />}</b>
        {label && <small>{label}</small>}
      </div>
    </div>
  )
}

export function Panel({ title, action, children, className }: { title: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <motion.section className={`app-panel${className ? ` ${className}` : ''}`} variants={fadeUp}>
      <header className="app-panel-head">
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </motion.section>
  )
}
