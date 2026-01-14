import { useEffect, useMemo, useRef, useState } from 'react'
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
} from 'lucide-react'

/** ========= Types ========= */
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
  household_id: string
  members?: {
    display_name: string
  } | null
}

interface Member {
  id: string
  display_name: string
}

interface Household {
  id: string
  name: string
}

/** ========= Const ========= */
const STORAGE_KEY = 'homeflow_household_id'

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

/** ========= Helpers ========= */
function withTimeout<T>(promise: Promise<T>, ms: number, label = 'TIMEOUT') {
  let timer: any
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(label)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>
}

export default function Tasks() {
  const navigate = useNavigate()
  const { user, setUser } = useAuthStore()

  const [tasks, setTasks] = useState<Task[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [household, setHousehold] = useState<Household | null>(null)
  const [householdId, setHouseholdId] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending')
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string | null>(null)

  const mountedRef = useRef(true)
  const didInitRef = useRef(false)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'general',
    assigned_to: '',
    due_date: '',
    points: 10,
  })

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const safeSetState = <T,>(setter: (v: T) => void, value: T) => {
    if (mountedRef.current) setter(value)
  }

  const getCategoryStyle = (category: string) =>
    CATEGORIES.find((c) => c.value === category)?.color || CATEGORIES[0].color

  const pendingCount = useMemo(() => tasks.filter((t) => t.status !== 'completed').length, [tasks])
  const completedCount = useMemo(() => tasks.filter((t) => t.status === 'completed').length, [tasks])

  const hardReset = () => {
    console.log('🧹 Hard reset (cache household + reload)')
    localStorage.removeItem(STORAGE_KEY)
    window.location.reload()
  }

  /** ========= Auth/session guard =========
   * Important en prod : parfois ton store a user=null au premier render.
   * On tente de récupérer la session Supabase pour éviter le "loading infini".
   */
  useEffect(() => {
    if (didInitRef.current) return
    didInitRef.current = true

    const init = async () => {
      try {
        setLoading(true)
        setError(null)

        // 1) Si le store n’a pas encore user, on tente getSession()
        if (!user) {
          const { data } = awaitẮ withTimeout(supabase.auth.getSession(), 8000, 'SESSION_TIMEOUT')
          const sessionUser = data.session?.user ?? null
          if (sessionUser) setUser(sessionUser)
        }

        // 2) Si toujours pas user => go login (pas de spinner infini)
        const currentUser = user ?? (await supabase.auth.getUser()).data.user
        if (!currentUser) {
          setLoading(false)
          navigate('/login')
          return
        }

        // 3) Charger données
        await loadInitialData(currentUser.id)
        safeSetState(setLoading, false)
      } catch (e: any) {
        console.error('Init error:', e)
        safeSetState(setError, e.message === 'SESSION_TIMEOUT'
          ? "Timeout session. Rafraîchis la page (ou Hard Reset)."
          : "Erreur d'initialisation. Essaie Hard Reset."
        )
        safeSetState(setLoading, false)
      }
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** ========= Reload tasks quand filtre change ========= */
  useEffect(() => {
    if (!householdId || loading || error) return
    loadTasksForHousehold(householdId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, selectedMemberFilter, householdId])

  const loadInitialData = async (userId: string) => {
    try {
      setError(null)

      // member + household
      const memberRes = await withTimeout(
        supabase
          .from('members')
          .select('household_id, households(id, name)')
          .eq('id', userId)
          .single(),
        8000,
        'INIT_TIMEOUT'
      )

      if (memberRes.error) throw memberRes.error
      if (!memberRes.data) throw new Error('No member data')

      const householdData = memberRes.data.households as any
      const hId = householdData?.id as string | undefined
      if (!hId) throw new Error('Household introuvable')

      safeSetState(setHousehold, { id: hId, name: householdData.name })
      safeSetState(setHouseholdId, hId)
      localStorage.setItem(STORAGE_KEY, hId)

      // members list
      const membersRes = await withTimeout(
        supabase.from('members').select('id, display_name').eq('household_id', memberRes.data.household_id),
        8000,
        'MEMBERS_TIMEOUT'
      )
      if (membersRes.error) throw membersRes.error
      safeSetState(setMembers, membersRes.data || [])

      await loadTasksForHousehold(hId)
    } catch (e: any) {
      console.error('loadInitialData error:', e)
      localStorage.removeItem(STORAGE_KEY)
      throw e
    }
  }

  const loadTasksForHousehold = async (hId: string) => {
    try {
      let query = supabase
        .from('tasks')
        .select('*, members:assigned_to(display_name)')
        .eq('household_id', hId)
        .order('created_at', { ascending: false })

      if (filter === 'pending') query = query.in('status', ['pending', 'in_progress'])
      if (filter === 'completed') query = query.eq('status', 'completed')
      if (selectedMemberFilter) query = query.eq('assigned_to', selectedMemberFilter)

      const res = await withTimeout(query, 8000, 'TASKS_TIMEOUT')
      // @ts-ignore
      if (res.error) throw res.error
      // @ts-ignore
      safeSetState(setTasks, res.data || [])
    } catch (e: any) {
      console.error('loadTasksForHousehold error:', e)
      safeSetState(setError, e.message === 'TASKS_TIMEOUT'
        ? "Timeout chargement tâches. Réessaie, ou Hard Reset."
        : "Erreur chargement tâches. Réessaie, ou Hard Reset."
      )
    }
  }

  const handleLogout = async () => {
    localStorage.removeItem(STORAGE_KEY)
    await supabase.auth.signOut()
    setUser(null)
    navigate('/login')
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: 'general',
      assigned_to: '',
      due_date: '',
      points: 10,
    })
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    try {
      setIsSubmitting(true)

      const sessionUser = user ?? (await supabase.auth.getUser()).data.user
      if (!sessionUser) throw new Error('Utilisateur non connecté')

      const hId = householdId || localStorage.getItem(STORAGE_KEY)
      if (!hId) throw new Error('Famille introuvable. Hard Reset conseillé.')

      const payload = {
        household_id: hId,
        title: formData.title.trim(),
        description: formData.description?.trim() ? formData.description.trim() : null,
        category: formData.category,
        assigned_to: formData.assigned_to || null,
        created_by: sessionUser.id,
        points: Number.isFinite(formData.points) ? formData.points : 10,
        due_date: formData.due_date || null,
        status: 'pending' as const,
      }

      // IMPORTANT: select() pour récupérer la ligne insérée => affichage immédiat
      const insertRes = await withTimeout(
        supabase
          .from('tasks')
          .insert(payload)
          .select('*, members:assigned_to(display_name)')
          .single(),
        8000,
        'INSERT_TIMEOUT'
      )

      if (insertRes.error) throw insertRes.error
      if (!insertRes.data) throw new Error('Insertion OK mais aucune donnée retournée')

      // UI: on ajoute direct en haut
      safeSetState(setTasks, (current: any) => [insertRes.data, ...(current || [])])

      resetForm()
      safeSetState(setShowModal, false)
    } catch (e: any) {
      console.error('handleCreateTask error:', e)
      const msg =
        e.message === 'INSERT_TIMEOUT'
          ? 'Timeout insertion. Ta tâche est peut-être créée (recharge la liste).'
          : e.message || 'Erreur création tâche'

      // On ne bloque pas l’UI avec un confirm qui peut provoquer des comportements bizarres
      safeSetState(setError, msg)
    } finally {
      safeSetState(setIsSubmitting, false)
    }
  }

  const handleToggleComplete = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed'
    const completedAt = newStatus === 'completed' ? new Date().toISOString() : null

    // Optimistic UI
    setTasks((current) => current.map((t) => (t.id === task.id ? { ...t, status: newStatus, completed_at: completedAt } : t)))

    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus, completed_at: completedAt })
      .eq('id', task.id)

    if (error) {
      console.error('toggle error:', error)
      // rollback via reload
      const hId = householdId || localStorage.getItem(STORAGE_KEY)
      if (hId) loadTasksForHousehold(hId)
    } else {
      // si filtre != all, on recharge pour éviter incohérences
      if (filter !== 'all') {
        const hId = householdId || localStorage.getItem(STORAGE_KEY)
        if (hId) loadTasksForHousehold(hId)
      }
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Supprimer cette tâche ?')) return

    // Optimistic remove
    setTasks((current) => current.filter((t) => t.id !== taskId))

    const { error } = await supabase.from('tasks').delete().eq('id', taskId)
    if (error) {
      console.error('delete error:', error)
      const hId = householdId || localStorage.getItem(STORAGE_KEY)
      if (hId) loadTasksForHousehold(hId)
    }
  }

  /** ========= UI states ========= */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-lg font-medium text-gray-700">Chargement de HomeFlow...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md w-full bg-white p-8 rounded-2xl shadow-lg border border-red-100">
          <WifiOff className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Problème de synchronisation</h2>
          <p className="text-gray-600 mb-6">{error}</p>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setError(null)
                const hId = householdId || localStorage.getItem(STORAGE_KEY)
                if (hId) loadTasksForHousehold(hId)
              }}
              className="flex-1 py-3 bg-gray-900 text-white rounded-xl hover:bg-black transition font-medium shadow-md"
            >
              Réessayer
            </button>

            <button
              onClick={hardReset}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-medium shadow-md flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              Hard Reset
            </button>
          </div>

          <p className="text-xs text-gray-400 mt-4">Le Hard Reset supprime le cache local “household_id” et recharge proprement.</p>
        </div>
      </div>
    )
  }

  /** ========= Page ========= */
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
                  filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Toutes
              </button>
              <button
                onClick={() => setFilter('pending')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  filter === 'pending' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                En cours
              </button>
              <button
                onClick={() => setFilter('completed')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  filter === 'completed' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Liste */}
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-100">
              <CheckCircle2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">Aucune tâche pour le moment</p>
              <p className="text-sm text-gray-400">
                {filter === 'completed' ? 'Aucune tâche complétée' : 'Crée ta première tâche pour commencer !'}
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
                  <button onClick={() => handleToggleComplete(task)} className="mt-1 flex-shrink-0">
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
                            task.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-900'
                          }`}
                        >
                          {task.title}
                        </h3>

                        {task.description && <p className="text-gray-600 text-sm mb-3">{task.description}</p>}

                        <div className="flex flex-wrap gap-2 items-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getCategoryStyle(task.category)}`}>
                            {CATEGORIES.find((c) => c.value === task.category)?.label}
                          </span>

                          {task.members?.display_name && (
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

                          <span className="text-xs font-medium text-blue-600">{task.points} pts</span>
                        </div>
                      </div>

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
            ))
          )}
        </div>
      </main>

      {/* Modal */}
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Titre de la tâche *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Ex: Faire les courses"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Détails de la tâche..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isSubmitting}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Catégorie</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assigner à</label>
                  <select
                    value={formData.assigned_to}
                    onChange={(e) => setFormData((p) => ({ ...p, assigned_to: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isSubmitting}
                  >
                    <option value="">Non assigné</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.display_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date d'échéance</label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData((p) => ({ ...p, due_date: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Points</label>
                  <input
                    type="number"
                    value={formData.points}
                    onChange={(e) => setFormData((p) => ({ ...p, points: parseInt(e.target.value || '10', 10) }))}
                    min={1}
                    max={100}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    resetForm()
                  }}
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
