import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'

export function useAuth() {
  const { user, loading, error, signIn, signOut, clearError, refreshUser } = useAuthStore()

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, auth_id, badge_number, role, centre, is_active')
          .eq('auth_id', session.user.id)
          .eq('is_active', true)
          .single()

        if (!userError && userData) {
          const { data: sewadarData } = await supabase
            .from('sewadars')
            .select('name')
            .eq('badge_number', userData.badge_number)
            .single()

          useAuthStore.setState({
            user: {
              id: userData.id,
              auth_id: userData.auth_id,
              badge_number: userData.badge_number,
              role: userData.role,
              centre: userData.centre,
              is_active: userData.is_active,
              name: sewadarData?.name ?? userData.badge_number,
            },
          })
        } else {
          await supabase.auth.signOut()
          useAuthStore.setState({ user: null })
        }
      } else if (user) {
        useAuthStore.setState({ user: null })
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        useAuthStore.setState({ user: null })
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading, error, signIn, signOut, clearError, refreshUser }
}
