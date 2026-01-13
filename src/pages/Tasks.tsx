import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { 
  Home, 
  LogOut, 
  Plus, 
  CheckCircle2, 
  Circle, 
  Trash2, 
  Clock,
  User,
  Filter,
  X,
  Loader2 // J'ai ajouté l'icône de chargement
} from 'lucide-react'

interface Task {
  id: string
  title: string
  description: string | null
  category: string
  status: 'pending' | 'in_progress' | 'completed'
  points: number
  assigned_to: string | null
  created_by: string
  due_date: string | null
  completed_at: string | null
  created_at: string
  members?: {
    display_name: string
  }
}

interface Member {
  id: string
  display_name: string
}

interface Household {
  id: string
  name: string
}

const CATEGORIES = [
  { value: 'general', label: 'Général', color: 'bg-gray-100 text-gray-700' },
  { value: 'cuisine', label: 'Cuisine', color: 'bg-orange-100 text-orange-700' },
  { value: 'menage', label: 'Ménage', color: 'bg-blue-100 text-blue-700' },
  { value: 'courses', label: 'Courses', color: 'bg-green-100 text-green-700' },
  { value: 'jardin', label: 'Jardin', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'bricolage', label: 'Bricolage', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'administratif', label: 'Administratif', color: 'bg-purple-100 text-purple-700' },
  { value: 'autre', label: 'Autre', color: 'bg-pink-100 text-pink-700' },
]

export default function Tasks() {
  const navigate = useNavigate()
  const { user, setUser } = useAuthStore()
  
  // States de données
  const [tasks, setTasks] = useState<Task[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [household, setHousehold] = useState<Household | null>(null)
  const [householdId, setHouseholdId] = useState<string | null>(null)
  
  // States d'interface
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false) // NOUVEAU : Pour bloquer le bouton
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending')
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string | null>(null)
  
  // Ref pour éviter les rechargements multiples au démarrage
  const hasLoadedData = useRef(false)

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'general',
    assigned_to: '',
    due_date: '',
    points: 10,
  })

  // 1. Premier chargement
  useEffect(() => {
    if (!hasLoadedData.current && user) {
      hasLoadedData.current = true
      loadInitialData()
    }
  }, [user])

  // 2. Rechargement sur changement de filtre (uniquement si déjà chargé)
  useEffect(() => {
    const safeHouseholdId = householdId || localStorage.getItem('homeflow_household_id')
    if (hasLoadedData.current && safeHouseholdId) {
      loadTasksForHousehold(safeHouseholdId)
    }
  }, [filter, selectedMemberFilter]) 

  const loadInitialData = async () => {
    if (!user) {
      setLoading(false)
      return
    }

    try {
      // Récupérer les infos du membre et de la famille
      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .select('household_id, households(id, name)')
        .eq('id', user.id)
        .single()

      if (memberError || !memberData) throw memberError || new Error('No member data')

      const householdData = memberData.households as any
      const hId = householdData.id

      // Mises à jour du state
      setHousehold({ id: hId, name: householdData.name })
      setHouseholdId(hId)
      
      // SAUVEGARDE DE SECOURS DANS LE STORAGE
      localStorage.setItem('homeflow_household_id', hId)

      // Récupérer les membres
      const { data: membersData } = await supabase
        .from('members')
        .select('id, display_name')
        .eq('household_id', memberData.household_id)
      
      setMembers(membersData || [])

      // Charger les tâches
      await loadTasksForHousehold(hId)

    } catch (error) {
      console.error('Erreur chargement initial:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fonction centrale de rechargement des tâches
  const loadTasksForHousehold = async (targetHouseholdId: string) => {
    try {
      console.log("📥 Chargement des tâches pour:", targetHouseholdId)
      
      let query = supabase
        .from('tasks')
        .select(`
          *,
          members:assigned_to(display_name)
        `)
        .eq('household_id', targetHouseholdId)
        .order('created_at', { ascending: false })

      // Application des filtres
      if (filter === 'pending') {
        query = query.in('status', ['pending', 'in_progress'])
      } else if (filter === 'completed') {
        query = query.eq('status', 'completed')
      }

      if (selectedMemberFilter) {
        query = query.eq('assigned_to', selectedMemberFilter)
      }

      const { data: tasksData, error } = await query

      if (error) throw error

      setTasks(tasksData || [])
      console.log("✅ Tâches chargées:", tasksData?.length)
    } catch (error) {
      console.error('Erreur chargement tâches:', error)
    }
  }

  // Wrapper simple pour recharger
  const reloadTasks = async () => {
    const hId = householdId || localStorage.getItem('homeflow_household_id')
    if (hId) await loadTasksForHousehold(hId)
  }

  const handleLogout = async () => {
    localStorage.removeItem('homeflow_household_id')
    await supabase.auth.signOut()
    setUser(null)
    navigate('/login')
  }

  // --- CRÉATION DE TÂCHE CORRIGÉE ---
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 1. Bloquer les doubles clics
    if (isSubmitting) return
    setIsSubmitting(true)

    try {
      if (!user) throw new Error('Utilisateur non connecté')

      // 2. Récupération robuste de l'ID
      const hId = householdId || localStorage.getItem('homeflow_household_id')
      if (!hId) throw new Error('Impossible de retrouver votre famille. Veuillez recharger la page.')

      // 3. Insertion
      const { error } = await supabase.from('tasks').insert({
        household_id: hId,
        title: formData.title,
        description: formData.description || null,
        category: formData.category,
        assigned_to: formData.assigned_to || null,
        created_by: user.id,
        points: formData.points,
        due_date: formData.due_date || null,
        status: 'pending',
      })

      if (error) throw error

      // 4. Succès : On vide le formulaire
      setFormData({
        title: '',
        description: '',
        category: 'general',
        assigned_to: '',
        due_date: '',
        points: 10,
      })

      // 5. IMPORTANT : On recharge les données AVANT de fermer la modale
      // Cela garantit que la tâche s'affiche quand la fenêtre disparaît
      await loadTasksForHousehold(hId)
      
      // 6. Fermeture propre
      setShowModal(false)

    } catch (err: any) {
      console.error('Erreur création:', err)
      alert(err.message || 'Une erreur est survenue')
    } finally {
      // Quoi qu'il arrive, on débloque le bouton
      setIsSubmitting(false)
    }
  }

  const handleToggleComplete = async (task: Task) => {
    // Optimistic UI update (mise à jour visuelle immédiate)
    const newStatus = task.status === 'completed' ? 'pending' : 'completed'
    
    // On met à jour l'interface locale tout de suite pour la réactivité
    setTasks(currentTasks => 
      currentTasks.map(t => 
        t.id === task.id ? { ...t, status: newStatus } : t
      )
    )

    const completedAt = newStatus === 'completed' ? new Date().toISOString() : null

    const { error } = await supabase
      .from('tasks')
      .update({ 
        status: newStatus,
        completed_at: completedAt
      })
      .eq('id', task.id)

    if (error) {
      // Si erreur serveur, on revient en arrière (rollback)
      console.error("Erreur update task", error)
      reloadTasks()
    } else {
      // Si on filtre par statut, il faut recharger pour que la tâche disparaisse/apparaisse correctement
      if (filter !== 'all') {
         reloadTasks()
      }
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Es-tu sûr de vouloir supprimer cette tâche ?')) return

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)

      if (error) throw error
      
      // Suppression locale immédiate
      setTasks(current => current.filter(t => t.id !== taskId))
      
    } catch (error) {
      console.error("Erreur suppression", error)
      reloadTasks()
    }
  }

  const getCategoryStyle = (category: string) => {
    return CATEGORIES.find(c => c.value === category)?.color || CATEGORIES[0].color
  }

  const pendingCount = tasks.filter(t => t.status !== 'completed').length
  const completedCount = tasks.filter(t => t.status === 'completed').length

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
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
              <button onClick={() => navigate('/dashboard')} className="flex items-center hover:opacity-80 transition">
                <Home className="w-8 h-8 text-blue-600 mr-3" />
                <div>
                  <h1 className="text-xl font-bold text-gray-900">HomeFlow</h1>
                  {household && (
                    <p className="text-xs text-gray-500">{household.name}</p>
                  )}
                </div>
              </button>
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
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Tâches familiales</h2>
            <p className="text-gray-600">
              {pendingCount} en cours • {completedCount} complétées
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium shadow-lg hover:shadow-xl"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nouvelle tâche
          </button>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6 border border-gray-100">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filtres :</span>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  filter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Toutes
              </button>
              <button
                onClick={() => setFilter('pending')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  filter === 'pending'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                En cours
              </button>
              <button
                onClick={() => setFilter('completed')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  filter === 'completed'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Complétées
              </button>
            </div>

            <div className="flex gap-2 items-center ml-auto">
              <User className="w-4 h-4 text-gray-500" />
              <select
                value={selectedMemberFilter || ''}
                onChange={(e) => setSelectedMemberFilter(e.target.value || null)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Tous les membres</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.display_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Liste des tâches */}
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-100">
              <CheckCircle2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">Aucune tâche pour le moment</p>
              <p className="text-sm text-gray-400">
                {filter === 'completed' 
                  ? 'Aucune tâche complétée' 
                  : 'Crée ta première tâche pour commencer !'}
              </p>
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className={`bg-white rounded-xl shadow-sm p-6 border transition hover:shadow-md ${
                  task.status === 'completed' ? 'border-green-200 bg-green-50' : 'border-gray-100'
                }`}
              >
                <div className="flex items-start gap-4">
                  <button
                    onClick={() => handleToggleComplete(task)}
                    className="mt-1 flex-shrink-0"
                  >
                    {task.status === 'completed' ? (
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    ) : (
                      <Circle className="w-6 h-6 text-gray-400 hover:text-blue-600 transition" />
                    )}
                  </button>

                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3
                          className={`text-lg font-semibold mb-1 ${
                            task.status === 'completed'
                              ? 'text-gray-500 line-through'
                              : 'text-gray-900'
                          }`}
                        >
                          {task.title}
                        </h3>
                        {task.description && (
                          <p className="text-gray-600 text-sm mb-3">{task.description}</p>
                        )}
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getCategoryStyle(task.category)}`}>
                            {CATEGORIES.find(c => c.value === task.category)?.label}
                          </span>
                          {task.members && (
                            <span className="flex items-center text-xs text-gray-600">
                              <User className="w-3 h-3 mr-1" />
                              {task.members.display_name}
                            </span>
                          )}
                          {task.due_date && (
                            <span className="flex items-center text-xs text-gray-600">
                              <Clock className="w-3 h-3 mr-1" />
                              {new Date(task.due_date).toLocaleDateString('fr-FR')}
                            </span>
                          )}
                          <span className="text-xs font-medium text-blue-600">
                            {task.points} pts
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Supprimer"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Modal Créer une tâche */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h3 className="text-2xl font-bold text-gray-900">Créer une tâche</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
                disabled={isSubmitting}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Titre de la tâche *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Faire les courses"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Détails de la tâche..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isSubmitting}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Catégorie
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isSubmitting}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assigner à
                  </label>
                  <select
                    value={formData.assigned_to}
                    onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isSubmitting}
                  >
                    <option value="">Non assigné</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.display_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date d'échéance
                  </label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Points
                  </label>
                  <input
                    type="number"
                    value={formData.points}
                    onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) })}
                    min="1"
                    max="100"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                  disabled={isSubmitting}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Création...
                    </>
                  ) : (
                    'Créer la tâche'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
