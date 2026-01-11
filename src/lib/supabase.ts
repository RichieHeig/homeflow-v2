import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://phojtiaeesozznnlaxrl.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBob2p0aWFlZXNvenpubmxheHJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4NTg5NzUsImV4cCI6MjA4MzQzNDk3NX0.OREWne9nPKZdaRMWaTR3715LAor9I7jJ60JLaDrIFb8'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
