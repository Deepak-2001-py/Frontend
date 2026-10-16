import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { apiRequest } from '../lib/api'
import { apiCache } from '../lib/apiCache'

/**
 * The signed-in user's name: the one from the login response right away,
 * then the profile's from GET /users/{id} (cached per tab) if it differs.
 */
export function useDisplayName(fallback: string): string {
  const { session } = useAuth()
  const [name, setName] = useState(session?.userName || fallback)

  useEffect(() => {
    const userId = session?.userId
    if (!userId) return
    let cancelled = false
    apiCache
      .withCache(`user:${userId}`, false, () => apiRequest<{ name?: string }>(`/users/${userId}`))
      .then((user) => {
        if (!cancelled && user?.name) setName(user.name)
      })
      .catch(() => {
        /* keep the name from the login response */
      })
    return () => {
      cancelled = true
    }
  }, [session?.userId])

  return name
}
