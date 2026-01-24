import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'

export type AuthState = {
  user: User | null
  householdId: string | null
  householdName: string | null
  loading: boolean

  setUser: (user: User | null) => void
  setHousehold: (id: string | null, name?: string | null) => void
  setLoading: (loading: boolean) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  householdId: null,
  householdName: null,
  loading: true,

  setUser: (user) => set({ user }),
  setHousehold: (id, name = null) => set({ householdId: id, householdName: name }),
  setLoading: (loading) => set({ loading }),
  clearAuth: () =>
    set({
      user: null,
      householdId: null,
      householdName: null,
      loading: false,
    }),
}))
