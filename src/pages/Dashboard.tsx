import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore, type AuthState } from '@/store/authStore'

export default function Dashboard() {
  const navigate = useNavigate()
  const setUser = useAuthStore((state: AuthState) => state.setUser)

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      const { data } = await supabase.auth.getUser()
      const user = data.user
      if (!user) {
        navigate('/login', { replace: true })
        return
      }
      setUser(user)
      navigate('/tasks', { replace: true })
    }

    init().finally(() => setLoading(false))
  }, [navigate, setUser])

  return (
    <div className="min-h-screen flex items-center justify-center">
      {loading ? <p>Chargement...</p> : <p>Redirection...</p>}
    </div>
  )
}
