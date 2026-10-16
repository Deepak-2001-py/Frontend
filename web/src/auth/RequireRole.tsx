import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { UserRole } from '../lib/session'
import { useAuth } from './AuthContext'

/**
 * Route guard replacing checkAuthentication() in nav.html and
 * requireAdminAuth() in admin-common.js: no session -> session-expired,
 * wrong role -> unauthorized, temp password still active -> forced change.
 */
export default function RequireRole({ roles }: { roles: UserRole[] }) {
  const { session } = useAuth()
  const location = useLocation()

  if (!session) {
    const returnTo = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/session-expired?returnTo=${returnTo}`} replace />
  }
  if (!roles.includes(session.userType)) {
    return <Navigate to="/unauthorized" replace />
  }

  // An admin-issued temp password must be replaced before anything else works.
  const changePath = `/${session.userType}/change-password`
  if (session.userData.must_change_password === true && session.userType !== 'admin' && location.pathname !== changePath) {
    return <Navigate to={changePath} replace />
  }
  return <Outlet />
}
