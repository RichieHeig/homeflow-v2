import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'

type Household = {
  id: string
  name?: string | null
} | null

type StoreState = {
  user: User | null
  household: Household
  setUser: (user: User | null) => void
  setHousehold: (household: Household) => void
  clearAuth: () => void
}

export const useStore = create<StoreState>((set) => ({
  user: null,
  household: null,

  setUser: (user) => set({ user }),
  setHousehold: (household) => set({ household }),

  clearAuth: () =>
    set({
      user: null,
      household: null,
    }),
}))
