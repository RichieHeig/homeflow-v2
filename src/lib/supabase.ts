import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://phojtiaesozznmlaxrl.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBob2p0aWFlc296em5tbGF4cmwiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczNjM1NDI0MSwiZXhwIjoyMDUxOTMwMjQxfQ.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBob2p0aWFlc296em5tbGF4cmwiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczNjM1NDI0MSwiZXhwIjoyMDUxOTMwMjQxfQ'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})
