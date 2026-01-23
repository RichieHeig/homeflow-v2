import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://phojtiaeesozznnlaxrl.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBob2p0aWFlZXNvenpubmxheHJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4NTg5NzUsImV4cCI6MjA4MzQzNDk3NX0.OREWne9nPKZdaRMWaTR3715LAor9I7jJ60JLaDrIFb8' // ta clé complète

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: 'homeflow-auth',
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: {
      getItem: (key) => {
        try {
          return localStorage.getItem(key)
        } catch {
          return null
        }
      },
      setItem: (key, value) => {
        try {
          localStorage.setItem(key, value)
        } catch {
          // ignore
        }
      },
      removeItem: (key) => {
        try {
          localStorage.removeItem(key)
        } catch {
          // ignore
        }
      },
    },
  },
})
