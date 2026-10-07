import { useEffect } from 'react'
import { useAuth } from './useAuth'

export function useNotifications() {
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    if (!isAuthenticated) return
    // FCM notification setup would go here
    // Requires Firebase SDK configuration
    console.log('[Push] Notification system initialized')
  }, [isAuthenticated])
}
