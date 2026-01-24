import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function Onboarding() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setError(null)

      try {
        const { data } = await supabase.auth.getUser()
        const user = data.user
        if (!user) {
          navigate('/login', { replace: true })
          return
        }

        // Si l'utilisateur est déjà membre → go tasks
        const { data: member } = await supabase
          .from('members')
          .select('id')
          .eq('id', user.id)
          .single()

        if (member?.id) {
          navigate('/tasks', { replace: true })
          return
        }

        // Sinon, fallback minimal : on redirige vers login
        // (car créer un foyer + member dépend de tes policies RLS)
        setError("Profil membre introuvable. Veuillez vous reconnecter.")
      } catch (e: any) {
        setError(e?.message || "Erreur onboarding")
      } finally {
        setLoading(false)
      }
    }

    run()
  }, [navigate])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Chargement...</div>
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-lg border">
        <h1 className="text-xl font-bold mb-3">Onboarding</h1>
        <p className="text-gray-600 text-sm mb-4">
          {error || "Tout est prêt."}
        </p>
        <button
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700"
          onClick={() => navigate('/login', { replace: true })}
        >
          Retour connexion
        </button>
      </div>
    </div>
  )
}
