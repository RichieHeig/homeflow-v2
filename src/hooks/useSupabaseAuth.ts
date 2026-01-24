import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/stores/useStore'

export function useSupabaseAuth() {
  const [loading, setLoading] = useState(true)

  // On récupère des fonctions du store (si elles existent)
  const setUser = useStore((s: any) => s.setUser)
  const setHousehold = useStore((s: any) => s.setHousehold)
  const clearAuth = useStore((s: any) => s.clearAuth)

  useEffect(() => {
    let isMounted = true

    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error

        const session = data.session
        setUser?.(session?.user ?? null)

        // ⚠️ On ne touche pas au household ici si tu le charges ailleurs
      } catch (err) {
        console.error('useSupabaseAuth init error:', err)
        clearAuth?.()
        setUser?.(null)
        setHousehold?.(null)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    init()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser?.(session?.user ?? null)

      if (!session) {
        clearAuth?.()
        setHousehold?.(null)
      }
    })

    return () => {
      isMounted = false
      listener.subscription.unsubscribe()
    }
  }, [setUser, setHousehold, clearAuth])

  return { loading }
}
