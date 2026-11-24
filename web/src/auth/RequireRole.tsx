import { Navigate, Outlet, useLocation } from 'react-router-dom'
<<<<<<< HEAD
import { changePasswordPath, type UserRole } from '../lib/session'
=======
import type { UserRole } from '../lib/session'
>>>>>>> origin/main
import { useAuth } from './AuthContext'

/**
 * Route guard replacing checkAuthentication() in nav.html and
<<<<<<< HEAD
 * requireAdminAuth() in admin-common.js: no session -> login,
=======
 * requireAdminAuth() in admin-common.js: no session -> session-expired,
>>>>>>> origin/main
 * wrong role -> unauthorized, temp password still active -> forced change.
 */
export default function RequireRole({ roles }: { roles: UserRole[] }) {
  const { session } = useAuth()
  const location = useLocation()

  if (!session) {
<<<<<<< HEAD
    // Someone who was never signed in goes to the login page; "session
    // expired" is only for a session that actually ended (see lib/api.ts).
    const returnTo = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />
=======
    const returnTo = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/session-expired?returnTo=${returnTo}`} replace />
>>>>>>> origin/main
  }
  if (!roles.includes(session.userType)) {
    return <Navigate to="/unauthorized" replace />
  }

  // An admin-issued temp password must be replaced before anything else works.
<<<<<<< HEAD
  const changePath = changePasswordPath(session.userType)
  if (session.userData.must_change_password === true && location.pathname !== changePath) {
=======
  const changePath = `/${session.userType}/change-password`
  if (session.userData.must_change_password === true && session.userType !== 'admin' && location.pathname !== changePath) {
>>>>>>> origin/main
    return <Navigate to={changePath} replace />
  }
  return <Outlet />
}
