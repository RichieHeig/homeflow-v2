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
  Loader2,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  AlertCircle
} from 'lucide-react'

// --- Interfaces ---
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
  
  // Data States
  const [tasks, setTasks] = useState<Task[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [household, setHousehold] = useState<Household | null>(null)
  const [householdId, setHouseholdId] = useState<string | null>(null)
  
  // UI States
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending')
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string | null>(null)
  
  const hasLoadedData = useRef(false)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'general',
    assigned_to: '',
    due_date: '',
    points: 10,
  })

  // --- SAFETY VALVE ---
  // Si le chargement dure plus de 3s, on considère qu'on est en "Cache Empoisonné"
  // et on force le nettoyage.
  useEffect(() => {
    let safetyTimer: NodeJS.Timeout;
    if (loading) {
      safetyTimer = setTimeout(() => {
        if (loading) {
            console.warn("🚨 Chargement trop long -> Nettoyage préventif du cache");
            // On ne vide pas tout brutalement, mais on arrête le spinner
            setLoading(false);
        }
      }, 4000)
    }
    return () => clearTimeout(safetyTimer)
  }, [loading])

  // --- NUCLEAR RESET ---
  const handleHardRefresh = async () => {
    try { await supabase.auth.signOut() } catch (e) { /* ignore */ }
    localStorage.clear()
    sessionStorage.clear()
    setUser(null)
    window.location.href = '/login'
  }

  const handleForceReload = () => {
    window.location.reload()
  }

  // --- INITIAL LOAD (CORRIGÉ POUR ÉVITER LE CACHE VIDE) ---
  useEffect(() => {
    // On lance le chargement immédiatement au montage du composant
    // On ne se fie pas uniquement à "user" qui peut venir du cache périmé
    if (!hasLoadedData.current) {
        hasLoadedData.current = true
        checkSessionAndLoadData()
    }
  }, []) // Tableau de dépendance vide = se lance une seule fois au démarrage

  // --- FILTER RELOAD ---
  useEffect(() => {
    const safeHouseholdId = householdId || localStorage.getItem('homeflow_household_id')
    if (hasLoadedData.current && safeHouseholdId && !loading && !error) {
      loadTasksForHousehold(safeHouseholdId)
    }
  }, [filter, selectedMemberFilter]) 

  // --- LA NOUVELLE FONCTION INTELLIGENTE ---
  const checkSessionAndLoadData = async () => {
    try {
        setLoading(true)

        // 1. VÉRIFICATION DOUANIÈRE (On demande au serveur : "Est-il connecté ?")
        // On ne fait pas confiance au localStorage ici.
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

        if (sessionError || !sessionData.session) {
            // Si le serveur dit non, on jette ce qu'on a en mémoire et on sort
            console.log("Session invalide -> Redirection login")
            throw new Error("AUTH_INVALID")
        }

        // Si on est là, c'est que le serveur valide la connexion.
        // On met à jour l'utilisateur dans le store pour être sûr d'être synchro
        if (sessionData.session.user) {
            setUser(sessionData.session.user)
        }
        
        const currentUser = sessionData.session.user

        // 2. CHARGEMENT DES DONNÉES
        const { data: memberData, error: memberError } = await supabase
          .from('members')
          .select('household_id, households(id, name)')
          .eq('id', currentUser.id)
          .single()

        if (memberError || !memberData) throw new Error('MEMBER_FETCH_ERROR')

        const householdData = memberData.households as any
        const hId = householdData.id

        setHousehold({ id: hId, name: householdData.name })
        setHouseholdId(hId)
        localStorage.setItem('homeflow_household_id', hId)

        const { data: membersData } = await supabase
          .from('members')
          .select('id, display_name')
          .eq('household_id', memberData.household_id)
        
        setMembers(membersData || [])

        await loadTasksForHousehold(hId)
        setError(null)

    } catch (error: any) {
        console.error('Erreur démarrage:', error)
        
        if (error.message === 'AUTH_INVALID') {
            // Redirection douce vers le login
            handleHardRefresh()
        } else if (error.message === 'MEMBER_FETCH_ERROR') {
            setError("Impossible de trouver votre profil membre.")
        } else {
            setError("Erreur de connexion.")
        }
    } finally {
        setLoading(false)
    }
  }

  const loadTasksForHousehold = async (targetHouseholdId: string) => {
    try {
      let query = supabase
        .from('tasks')
        .select('*') 
        .eq('household_id', targetHouseholdId)
        .order('created_at', { ascending: false })

      if (filter === 'pending') query = query.in('status', ['pending', 'in_progress'])
      else if (filter === 'completed') query = query.eq('status', 'completed')
      if (selectedMemberFilter) query = query.eq('assigned_to', selectedMemberFilter)

      const { data: tasksData, error } = await query
      if (error) throw error
      setTasks(tasksData || [])
    } catch (error) {
      console.error('Erreur chargement tâches:', error)
    }
  }

  const reloadTasks = async () => {
    const hId = householdId || localStorage.getItem('homeflow_household_id')
    if (hId) await loadTasksForHousehold(hId)
  }

  const handleLogout = async () => {
    await handleHardRefresh()
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    
    if (isSubmitting) return
    setIsSubmitting(true)

    try {
      if (!user) throw new Error('Utilisateur non connecté')
      const hId = householdId || localStorage.getItem('homeflow_household_id')
      if (!hId) throw new Error('Erreur de foyer. Rafraîchissez la page.')

      // PING CHECK
      try {
        const pingPromise = supabase.from('households').select('id').limit(1).single()
        const pingTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('PING_TIMEOUT')), 2000))
        await Promise.race([pingPromise, pingTimeout])
      } catch (pingErr) {
        throw new Error("CONNEXION_MORTE")
      }

      const assignedToValue = formData.assigned_to === "" ? null : formData.assigned_to

      const insertPromise = supabase.from('tasks').insert({
        household_id: hId,
        title: formData.title,
        description: formData.description || null,
        category: formData.category,
        assigned_to: assignedToValue, 
        created_by: user.id,
        points: formData.points,
        due_date: formData.due_date || null,
        status: 'pending',
      })

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT_WRITE')), 5000)
      )

      // @ts-ignore
      const { error } = await Promise.race([insertPromise, timeoutPromise])
      if (error) throw error

      setFormData({
        title: '',
        description: '',
        category: 'general',
        assigned_to: '',
        due_date: '',
        points: 10,
      })
      setShowModal(false)
      loadTasksForHousehold(hId)

    } catch (err: any) {
      console.error('Erreur création:', err)
      if (err.message === 'CONNEXION_MORTE' || err.message === 'PING_TIMEOUT' || err.message === 'TIMEOUT_WRITE') {
        setFormError("Votre connexion s'est endormie. Veuillez rafraîchir la page.")
      } else {
        setFormError(err.message || 'Une erreur est survenue.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleComplete = async (task: Task) => {
    const oldStatus = task.status
    const newStatus = task.status === 'completed' ? 'pending' : 'completed'
    setTasks(current => current.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
    
    const completedAt = newStatus === 'completed' ? new Date().toISOString() : null
    const { error } = await supabase.from('tasks').update({ 
        status: newStatus, completed_at: completedAt
      }).eq('id', task.id)
      
    if (error) setTasks(current => current.map(t => t.id === task.id ? { ...t, status: oldStatus } : t))
    else if (filter !== 'all') reloadTasks()
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Supprimer cette tâche ?')) return
    const previousTasks = [...tasks]
    setTasks(current => current.filter(t => t.id !== taskId))
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId)
      if (error) throw error
    } catch (error) { setTasks(previousTasks) }
  }

  const getCategoryStyle = (category: string) => {
    return CATEGORIES.find(c => c.value === category)?.color || CATEGORIES[0].color
  }

  const pendingCount = tasks.filter(t => t.status !== 'completed').length
  const completedCount = tasks.filter(t => t.status === 'completed').length

  // --- RENDERING ---

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

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md w-full bg-white p-8 rounded-2xl shadow-lg border border-red-100">
          <WifiOff className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Problème de connexion</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="space-y-3">
            <button onClick={handleForceReload} className="w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-medium shadow-md flex items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5" /> Réessayer
            </button>
            <button onClick={handleHardRefresh} className="w-full py-3 bg-white border border-red-200 text-red-600 rounded-xl hover:bg-red-50 transition font-medium flex items-center justify-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Réinitialiser
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button onClick={() => navigate('/dashboard')} className="flex items-center hover:opacity-80 transition">
                <Home className="w-8 h-8 text-blue-600 mr-3" />
                <div>
                  <h1 className="text-xl font-bold text-gray-900">HomeFlow</h1>
                  {household && <p className="text-xs text-gray-500">{household.name}</p>}
                </div>
              </button>
            </div>
            <button onClick={handleLogout} className="flex items-center px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition">
              <LogOut className="w-4 h-4 mr-2" /> Déconnexion
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Tâches familiales</h2>
            <p className="text-gray-600">{pendingCount} en cours • {completedCount} complétées</p>
          </div>
          <button onClick={() => { setFormError(null); setShowModal(true); }} className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium shadow-lg hover:shadow-xl">
            <Plus className="w-5 h-5 mr-2" /> Nouvelle tâche
          </button>
        </div>

        {/* --- FILTRES --- */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6 border border-gray-100">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2"><Filter className="w-5 h-5 text-gray-500" /><span className="text-sm font-medium text-gray-700">Filtres :</span></div>
            <div className="flex gap-2">
              <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Toutes</button>
              <button onClick={() => setFilter('pending')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filter === 'pending' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>En cours</button>
              <button onClick={() => setFilter('completed')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filter === 'completed' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Complétées</button>
            </div>
            <div className="flex gap-2 items-center ml-auto">
              <User className="w-4 h-4 text-gray-500" />
              <select value={selectedMemberFilter || ''} onChange={(e) => setSelectedMemberFilter(e.target.value || null)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="">Tous les membres</option>
                {members.map((member) => (<option key={member.id} value={member.id}>{member.display_name}</option>))}
              </select>
            </div>
          </div>
        </div>

        {/* --- LISTE --- */}
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-100">
              <CheckCircle2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">Aucune tâche pour le moment</p>
              <p className="text-sm text-gray-400">{filter === 'completed' ? 'Aucune tâche complétée' : 'Crée ta première tâche pour commencer !'}</p>
            </div>
          ) : (
            tasks.map((task) => (
              <div key={task.id} className={`bg-white rounded-xl shadow-sm p-6 border transition hover:shadow-md ${task.status === 'completed' ? 'border-green-200 bg-green-50' : 'border-gray-100'}`}>
                <div className="flex items-start gap-4">
                  <button onClick={() => handleToggleComplete(task)} className="mt-1 flex-shrink-0">
                    {task.status === 'completed' ? (<CheckCircle2 className="w-6 h-6 text-green-600" />) : (<Circle className="w-6 h-6 text-gray-400 hover:text-blue-600 transition" />)}
                  </button>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className={`text-lg font-semibold mb-1 ${task.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{task.title}</h3>
                        {task.description && (<p className="text-gray-600 text-sm mb-3">{task.description}</p>)}
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getCategoryStyle(task.category)}`}>{CATEGORIES.find(c => c.value === task.category)?.label}</span>
                          
                          {task.due_date && (<span className="flex items-center text-xs text-gray-600"><Clock className="w-3 h-3 mr-1" />{new Date(task.due_date).toLocaleDateString('fr-FR')}</span>)}
                          <span className="text-xs font-medium text-blue-600">{task.points} pts</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleDeleteTask(task.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Supprimer"><Trash2 className="w-5 h-5" /></button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* --- MODAL --- */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h3 className="text-2xl font-bold text-gray-900">Créer une tâche</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition" disabled={isSubmitting}><X className="w-5 h-5" /></button>
            </div>

            {formError && (
              <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex flex-col gap-2">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div><h4 className="text-sm font-medium text-red-800">Erreur</h4><p className="text-sm text-red-600 mt-1">{formError}</p></div>
                </div>
                <button 
                  onClick={handleForceReload} 
                  className="mt-2 text-sm text-blue-600 font-medium hover:underline flex items-center gap-1 self-end"
                >
                  <RefreshCw className="w-4 h-4" /> Rafraîchir la page pour reconnecter
                </button>
              </div>
            )}

            <form onSubmit={handleCreateTask} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Titre de la tâche *</label>
                <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Ex: Faire les courses" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" required disabled={isSubmitting} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Détails de la tâche..." rows={3} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" disabled={isSubmitting} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Catégorie</label>
                  <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" disabled={isSubmitting}>
                    {CATEGORIES.map((cat) => (<option key={cat.value} value={cat.value}>{cat.label}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assigner à</label>
                  <select value={formData.assigned_to} onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" disabled={isSubmitting}>
                    <option value="">Non assigné</option>
                    {members.map((member) => (<option key={member.id} value={member.id}>{member.display_name}</option>))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date d'échéance</label>
                  <input type="date" value={formData.due_date} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" disabled={isSubmitting} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Points</label>
                  <input type="number" value={formData.points} onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) })} min="1" max="100" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" disabled={isSubmitting} />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium" disabled={isSubmitting}>Annuler</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">
                  {isSubmitting ? (<><Loader2 className="w-5 h-5 mr-2 animate-spin" />Création...</>) : ('Créer la tâche')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
