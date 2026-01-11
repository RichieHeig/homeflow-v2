import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { LogOut, Home, Users, Copy, Check, Crown, UserCircle, CheckSquare, ListTodo } from 'lucide-react'

interface Household {
  id: string
  name: string
  join_code: string
  created_at: string
}

interface Member {
  id: string
  display_name: string
  avatar_url: string | null
  role: 'admin' | 'member'
  created_at: string
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, setUser } = useAuthStore()
  const [household, setHousehold] = useState<Household | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [currentMember, setCurrentMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadDashboardData()
  }, [user])

  const loadDashboardData = async () => {
    if (!user) return

    try {
      // Récupérer les infos du membre actuel
      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .select('*, households(*)')
        .eq('id', user.id)
        .single()

      if (memberError) throw memberError

      setCurrentMember({
        id: memberData.id,
        display_name: memberData.display_name,
        avatar_url: memberData.avatar_url,
        role: memberData.role,
        created_at: memberData.created_at,
      })

      setHousehold(memberData.households)

      // Récupérer tous les membres du foyer
      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select('*')
        .eq('household_id', memberData.households.id)
        .order('created_at', { ascending: true })

      if (membersError) throw membersError

      setMembers(membersData || [])
    } catch (error) {
      console.error('Erreur lors du chargement:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    navigate('/login')
  }

  const copyJoinCode = async () => {
    if (household?.join_code) {
      await navigator.clipboard.writeText(household.join_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-lg font-medium text-gray-700">Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Home className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">HomeFlow</h1>
                {household && (
                  <p className="text-xs text-gray-500">{household.name}</p>
                )}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Déconnexion
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header avec nom du foyer */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Bienvenue, {currentMember?.display_name} ! 👋
          </h2>
          <p className="text-gray-600">
            Voici un aperçu de ton foyer familial
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Colonne gauche - Infos du foyer */}
          <div className="lg:col-span-2 space-y-6">
            {/* Card Foyer */}
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mr-4">
                    <Home className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{household?.name}</h3>
                    <p className="text-sm text-gray-500">
                      {members.length} membre{members.length > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                {currentMember?.role === 'admin' && (
                  <div className="flex items-center px-3 py-1 bg-yellow-50 text-yellow-700 rounded-full text-sm font-medium">
                    <Crown className="w-4 h-4 mr-1" />
                    Admin
                  </div>
                )}
              </div>

              {/* Code d'invitation */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                <p className="text-sm font-medium text-gray-700 mb-2">Code d'invitation</p>
                <div className="flex items-center justify-between">
                  <code className="text-2xl font-bold text-blue-600 tracking-wider">
                    {household?.join_code}
                  </code>
                  <button
                    onClick={copyJoinCode}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Copié !
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copier
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Partage ce code pour inviter des membres dans ton foyer
                </p>
              </div>
            </div>

            {/* Card Tâches (vide pour l'instant) */}
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                    <CheckSquare className="w-5 h-5 text-green-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Tâches récentes</h3>
                </div>
                <button 
                  onClick={() => navigate('/tasks')}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Voir tout →
                </button>
              </div>
              
              <div className="text-center py-12">
                <ListTodo className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-2">Aucune tâche pour le moment</p>
                <p className="text-sm text-gray-400 mb-4">
                  Commence par créer ta première tâche !
                </p>
                <button 
                  onClick={() => navigate('/tasks')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Créer une tâche
                </button>
              </div>
            </div>
          </div>

          {/* Colonne droite - Membres */}
          <div className="space-y-6">
            {/* Card Membres */}
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Membres</h3>
              </div>

              <div className="space-y-3">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                  >
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mr-3">
                        {member.avatar_url ? (
                          <img
                            src={member.avatar_url}
                            alt={member.display_name}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <UserCircle className="w-6 h-6 text-white" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {member.display_name}
                          {member.id === user?.id && (
                            <span className="text-xs text-gray-500 ml-2">(Toi)</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          {member.role === 'admin' ? 'Administrateur' : 'Membre'}
                        </p>
                      </div>
                    </div>
                    {member.role === 'admin' && (
                      <Crown className="w-4 h-4 text-yellow-500" />
                    )}
                  </div>
                ))}
              </div>

              {currentMember?.role === 'admin' && (
                <button className="w-full mt-4 px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition font-medium text-sm">
                  Gérer les membres
                </button>
              )}
            </div>

            {/* Card Stats (placeholder) */}
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-sm p-6 text-white">
              <h3 className="text-lg font-bold mb-4">Cette semaine</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-blue-100">Tâches complétées</span>
                  <span className="text-2xl font-bold">0</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-blue-100">Points gagnés</span>
                  <span className="text-2xl font-bold">0</span>
                </div>
                <div className="w-full bg-blue-400 bg-opacity-30 rounded-full h-2 mt-4">
                  <div className="bg-white h-2 rounded-full" style={{ width: '0%' }}></div>
                </div>
                <p className="text-xs text-blue-100 text-center mt-2">
                  Objectif hebdomadaire : 0/10 tâches
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
