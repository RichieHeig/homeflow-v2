import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Home, Users, Plus } from 'lucide-react'

export default function Onboarding() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [step, setStep] = useState<'choice' | 'create' | 'join'>('choice')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // État pour créer un foyer
  const [householdName, setHouseholdName] = useState('')
  const [displayName, setDisplayName] = useState('')

  // État pour rejoindre un foyer
  const [joinCode, setJoinCode] = useState('')
  const [joinDisplayName, setJoinDisplayName] = useState('')

  const handleCreateHousehold = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (!user) throw new Error('Non authentifié')

      // Générer un code de foyer unique (6 caractères alphanumériques)
      const generateJoinCode = () => {
        return Math.random().toString(36).substring(2, 8).toUpperCase()
      }

      const joinCode = generateJoinCode()

      // Créer le foyer
      const { data: household, error: householdError } = await supabase
        .from('households')
        .insert({
          name: householdName,
          join_code: joinCode,
        })
        .select()
        .single()

      if (householdError) throw householdError

      // Ajouter le créateur comme admin du foyer
      const { error: memberError } = await supabase
        .from('members')
        .insert({
          household_id: household.id,
          display_name: displayName,
          role: 'admin',
        })

      if (memberError) throw memberError

      // Rediriger vers le dashboard
      navigate('/dashboard')
    } catch (err: any) {
      console.error('Erreur:', err)
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  const handleJoinHousehold = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (!user) throw new Error('Non authentifié')

      // Vérifier que le code existe
      const { data: household, error: householdError } = await supabase
        .from('households')
        .select('id')
        .eq('join_code', joinCode.toUpperCase())
        .single()

      if (householdError) {
        throw new Error('Code invalide ou foyer introuvable')
      }

      // Ajouter le membre au foyer
      const { error: memberError } = await supabase
        .from('members')
        .insert({
          household_id: household.id,
          display_name: joinDisplayName,
          role: 'member',
        })

      if (memberError) throw memberError

      // Rediriger vers le dashboard
      navigate('/dashboard')
    } catch (err: any) {
      console.error('Erreur:', err)
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <Home className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Bienvenue sur HomeFlow!</h1>
          <p className="text-gray-600">Configurons ton espace familial</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {step === 'choice' && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                Comment veux-tu commencer ?
              </h2>

              <button
                onClick={() => setStep('create')}
                className="w-full flex items-center justify-between p-6 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition group"
              >
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4 group-hover:bg-blue-200">
                    <Plus className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-gray-900">Créer un nouveau foyer</div>
                    <div className="text-sm text-gray-600">Commence un nouveau groupe familial</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setStep('join')}
                className="w-full flex items-center justify-between p-6 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition group"
              >
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4 group-hover:bg-green-200">
                    <Users className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-gray-900">Rejoindre un foyer</div>
                    <div className="text-sm text-gray-600">Entre un code d'invitation</div>
                  </div>
                </div>
              </button>
            </div>
          )}

          {step === 'create' && (
            <form onSubmit={handleCreateHousehold} className="space-y-6">
              <div>
                <button
                  type="button"
                  onClick={() => setStep('choice')}
                  className="text-sm text-gray-600 hover:text-gray-900 mb-6"
                >
                  ← Retour
                </button>
                <h2 className="text-xl font-semibold text-gray-900 mb-6">
                  Créer ton foyer
                </h2>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom du foyer
                </label>
                <input
                  type="text"
                  value={householdName}
                  onChange={(e) => setHouseholdName(e.target.value)}
                  placeholder="Ex: Famille Richard"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ton nom d'affichage
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ex: Richard"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {loading ? 'Création...' : 'Créer le foyer'}
              </button>
            </form>
          )}

          {step === 'join' && (
            <form onSubmit={handleJoinHousehold} className="space-y-6">
              <div>
                <button
                  type="button"
                  onClick={() => setStep('choice')}
                  className="text-sm text-gray-600 hover:text-gray-900 mb-6"
                >
                  ← Retour
                </button>
                <h2 className="text-xl font-semibold text-gray-900 mb-6">
                  Rejoindre un foyer
                </h2>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Code d'invitation
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Ex: ABC123"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                  maxLength={6}
                  required
                />
                <p className="mt-2 text-sm text-gray-500">
                  Demande le code à un membre de ton foyer
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ton nom d'affichage
                </label>
                <input
                  type="text"
                  value={joinDisplayName}
                  onChange={(e) => setJoinDisplayName(e.target.value)}
                  placeholder="Ex: Richard"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {loading ? 'Connexion...' : 'Rejoindre le foyer'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
