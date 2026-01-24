import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabaseEnabled = !!supabaseUrl && !!supabaseAnonKey

export const getSupabaseError = () => {
  if (!supabaseUrl) return 'VITE_SUPABASE_URL manquant'
  if (!supabaseAnonKey) return 'VITE_SUPABASE_ANON_KEY manquant'
  return null
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})
