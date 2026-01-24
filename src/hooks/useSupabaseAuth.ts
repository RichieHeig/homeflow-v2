import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/store/authStore'

export function useSupabaseAuth() {
  const [loading, setLoading] = useState(true)

  const setUser = useStore((s) => s.setUser)
  const clearAuth = useStore((s) => s.clearAuth)

  useEffect(() => {
    let mounted = true

    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error

        setUser(data.session?.user ?? null)
      } catch (err) {
        console.error('useSupabaseAuth init error:', err)
        clearAuth()
      } finally {
        if (mounted) setLoading(false)
      }
    }

    init()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session) clearAuth()
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [setUser, clearAuth])

  return { loading }
}
