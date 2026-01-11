import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { LogOut, Home } from 'lucide-react'

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, setUser } = useAuthStore()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Home className="w-8 h-8 text-blue-600 mr-3" />
              <h1 className="text-xl font-bold text-gray-900">HomeFlow</h1>
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
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Bienvenue sur HomeFlow ! 🎉
          </h2>
          <p className="text-gray-600 mb-4">
            Connecté en tant que : <span className="font-medium text-gray-900">{user?.email}</span>
          </p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800">
              ✅ L'authentification fonctionne parfaitement !
            </p>
            <p className="text-green-700 text-sm mt-2">
              Tu peux maintenant développer les fonctionnalités de gestion des tâches familiales.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
