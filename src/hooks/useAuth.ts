import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'

export function useAuth() {
  const { user, loading, error, signIn, signOut, clearError, refreshUser } = useAuthStore()

  // Sync with Supabase session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session && user) {
        // Session expired — clear local state
        useAuthStore.setState({ user: null })
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        useAuthStore.setState({ user: null })
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading, error, signIn, signOut, clearError, refreshUser }
}
