import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore, type AuthState } from '@/store/authStore'

export default function Login() {
  const navigate = useNavigate()
  const setUser = useAuthStore((state: AuthState) => state.setUser)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      setUser(data.user ?? null)
      navigate('/tasks', { replace: true })
    } catch (err: any) {
      setError(err?.message || 'Impossible de se connecter.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-lg border">
        <h1 className="text-2xl font-bold mb-6">Connexion</h1>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="mt-1 w-full border rounded-lg px-4 py-3"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Mot de passe</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="mt-1 w-full border rounded-lg px-4 py-3"
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-60"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <p className="mt-4 text-sm text-gray-600">
          Pas de compte ?{' '}
          <Link to="/signup" className="text-blue-600 font-medium hover:underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  )
}
