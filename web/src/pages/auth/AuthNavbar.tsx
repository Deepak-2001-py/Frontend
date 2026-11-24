import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function AuthNavbar({ active }: { active: 'login' | 'signup' }) {
  const [open, setOpen] = useState(false)
  return (
    <nav className="navbar">
      <div className="container navbar-container">
        <Link to="/" className="logo-container">
          <img src="/img/Designer.jpeg" alt="GradeAnt Logo" className="logo-image" />
          <h1 className="logo">
            Grade<span>Ant</span>
          </h1>
        </Link>
        <button className="mobile-menu-btn" onClick={() => setOpen((o) => !o)}>
          ☰
        </button>
        <div className={`nav-links${open ? ' active' : ''}`}>
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
          <Link to="/contact">Contact</Link>
          <div className="auth-buttons">
            <Link to="/login" className={`btn ${active === 'login' ? 'btn-secondary active' : 'btn-primary'}`}>
              Login
            </Link>
            <Link to="/signup" className={`btn ${active === 'signup' ? 'btn-secondary active' : 'btn-primary'}`}>
              Sign Up
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}
