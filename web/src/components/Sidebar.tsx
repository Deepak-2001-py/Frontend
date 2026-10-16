import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import '../styles/sidebar.css'

interface NavItem {
  to: string
  label: string
  /** Other routes that should keep this item highlighted. */
  also?: string[]
}

const NAV: Record<'student' | 'teacher', { items: NavItem[]; avatar: string; role: string; profile: string }> = {
  student: {
    avatar: '/img/student.jpg',
    role: 'Student',
    profile: '/student/profile',
    items: [
      { to: '/student/dashboard', label: 'Dashboard' },
      { to: '/student/upload', label: 'Assignments', also: ['/student/answer-correction'] },
      { to: '/student/grades', label: 'My Grades' },
    ],
  },
  teacher: {
    avatar: '/img/teacher-avatar.jpg',
    role: 'Teacher',
    profile: '/teacher/profile',
    items: [
      { to: '/teacher/dashboard', label: 'Dashboard' },
      { to: '/teacher/upload', label: 'Assignments', also: ['/teacher/question-correction'] },
      { to: '/teacher/grades', label: 'Students Grades', also: ['/teacher/student-details'] },
      { to: '/teacher/correction', label: 'Manual Grading & Correction' },
    ],
  },
}

/** Student/teacher sidebar — replaces nav.html + nav.js + component-loader.js. */
export default function Sidebar() {
  const { session } = useAuth()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const nav = NAV[session?.userType === 'teacher' ? 'teacher' : 'student']

  // Close menus on navigation and on any outside click.
  const [lastPath, setLastPath] = useState(pathname)
  if (pathname !== lastPath) {
    setLastPath(pathname)
    setMenuOpen(false)
    setDropdownOpen(false)
  }
  useEffect(() => {
    if (!dropdownOpen) return
    const close = () => setDropdownOpen(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [dropdownOpen])

  return (
    <aside className="app-sidebar">
      <div className="sidebar-inner">
        <Link to="/" className="sidebar-logo">
          <span className="logo-mark" />
          <span className="logo-word">GradeAnt</span>
        </Link>
        <button className="mobile-menu-btn" onClick={() => setMenuOpen((o) => !o)} aria-label="Toggle menu">
          <span className="material-icons">menu</span>
        </button>
        <nav className={`nav-links${menuOpen ? ' active' : ''}`}>
          {nav.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive || item.also?.some((p) => pathname.startsWith(p)) ? 'active' : ''
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="user-dropdown">
          <div
            className="user-dropdown-toggle"
            onClick={(e) => {
              e.stopPropagation()
              setDropdownOpen((o) => !o)
            }}
          >
            <img src={nav.avatar} alt={`${nav.role} Avatar`} className="avatar" />
            <div className="user-info">
              <span className="user-name">{session?.userName ?? 'User'}</span>
              <span className="user-role">{nav.role}</span>
            </div>
            <span className="material-icons">expand_more</span>
          </div>
          <div className={`dropdown-menu${dropdownOpen ? ' show' : ''}`}>
            <Link to={nav.profile}>
              <span className="material-icons">person</span>
              My Profile
            </Link>
            <Link to={nav.profile.replace('/profile', '/change-password')}>
              <span className="material-icons">lock</span>
              Change Password
            </Link>
            <Link to={`${nav.profile}#request-reset`}>
              <span className="material-icons">help_outline</span>
              Request Password Reset
            </Link>
            <div className="dropdown-divider" />
            <Link to="/logout">
              <span className="material-icons">logout</span>
              Logout
            </Link>
          </div>
        </div>
      </div>
    </aside>
  )
}
