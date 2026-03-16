//Ha
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'
import type { AppUser, Role } from '@/types'

interface AuthState {
  user: AppUser | null
  loading: boolean
  error: string | null
  signIn: (badgeNumber: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  clearError: () => void
  refreshUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      loading: false,
      error: null,

      signIn: async (badgeNumber: string, password: string) => {
        set({ loading: true, error: null })
        try {
          // Badge number is used as the email: badge@asms.local
          const email = `${badgeNumber.trim().toLowerCase()}@asms.local`

          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
          })

          if (authError) {
            set({ error: 'Invalid badge number or password. (बैज संख्या या पासवर्ड गलत है)', loading: false })
            return
          }

          if (!authData.user) {
            set({ error: 'Login failed. Please try again.', loading: false })
            return
          }

          // Fetch user profile
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id, auth_id, badge_number, role, centre, is_active')
            .eq('auth_id', authData.user.id)
            .eq('is_active', true)
            .single()

          if (userError || !userData) {
            await supabase.auth.signOut()
            set({ error: 'No active account found for this badge. Contact ASO.', loading: false })
            return
          }

          // Fetch sewadar name separately
          const { data: sewadarData } = await supabase
            .from('sewadars')
            .select('name')
            .eq('badge_number', userData.badge_number)
            .single()

          const appUser: AppUser = {
            id: userData.id,
            auth_id: userData.auth_id,
            badge_number: userData.badge_number,
            role: userData.role as Role,
            centre: userData.centre,
            is_active: userData.is_active,
            name: sewadarData?.name ?? userData.badge_number,
          }

          set({ user: appUser, loading: false, error: null })
        } catch (err) {
          console.error('Login error:', err)
          set({ error: 'Connection error. Please check your internet.', loading: false })
        }
      },

      signOut: async () => {
        await supabase.auth.signOut()
        set({ user: null, error: null })
      },

      clearError: () => set({ error: null }),

      refreshUser: async () => {
        const currentUser = get().user
        if (!currentUser) return

        const { data } = await supabase
          .from('users')
          .select('id, auth_id, badge_number, role, centre, is_active')
          .eq('badge_number', currentUser.badge_number)
          .single()

        if (data) {
          const { data: sw } = await supabase
            .from('sewadars')
            .select('name')
            .eq('badge_number', currentUser.badge_number)
            .single()

          set({
            user: {
              ...currentUser,
              role: data.role as Role,
              centre: data.centre,
              is_active: data.is_active,
              name: sw?.name ?? currentUser.name,
            },
          })
        }
      },
    }),
    {
      name: 'asms-auth',
      partialize: (state) => ({ user: state.user }),
    }
  )
)