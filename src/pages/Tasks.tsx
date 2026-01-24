import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  Filter,
  Home,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Trash2,
  User,
  WifiOff,
  X,
} from 'lucide-react'

type TaskStatus = 'pending' | 'in_progress' | 'completed'

type Task = {
  id: string
  household_id: string
  title: string
  description: string | null
  category: string
  assigned_to: string | null
  created_by: string
  points: number
  due_date: string | null
  status: TaskStatus
  created_at?: string
  completed_at?: string | null
}

type MemberMini = { id: string; display_name: string }

const CATEGORIES = [
  { value: 'general', label: 'Général', color: 'bg-gray-100 text-gray-700' },
  { value: 'courses', label: 'Courses', color: 'bg-green-100 text-green-700' },
  { value: 'menage', label: 'Ménage', color: 'bg-blue-100 text-blue-700' },
  { value: 'bricolage', label: 'Bricolage', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'cuisine', label: 'Cuisine', color: 'bg-orange-100 text-orange-700' },
  { value: 'administratif', label: 'Administratif', color: 'bg-purple-100 text-purple-700' },
] as const

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms))
}

/**
 * ✅ Source de vérité : Supabase Auth
 * - jamais de parsing localStorage à la main
 */
async function getCurrentUserSafe(timeoutMs = 5000) {
  const p = supabase.auth.getUser()
  const t = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs))
  const result = (await Promise.race([p, t])) as Awaited<typeof p> | null

  if (!result) return null
  if (result.error) return null
  return result.data.user ?? null
}

function isJwtExpiredError(err: any) {
  const msg = String(err?.message || '')
  const code = String(err?.code || '')
  return (
    msg.toLowerCase().includes('jwt') ||
    msg.toLowerCase().includes('expired') ||
    msg.toLowerCase().includes('token') ||
    code === 'PGRST301' ||
    code === '401'
  )
}

export default function Tasks() {
  const navigate = useNavigate()

  // UI state
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Data state
  const [householdId, setHouseholdId] = useState<string | null>(localStorage.getItem('homeflow_household_id'))
  const [householdName, setHouseholdName] = useState<string | null>(null)
  const [members, setMembers] = useState<MemberMini[]>([])
  const [tasks, setTasks] = useState<Task[]>([])

  // Filters
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all')
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string | null>(null)

  // Modal create task
  const [showModal, setShowModal] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'general',
    assigned_to: '',
    due_date: '',
    points: 10,
  })

  // ✅ anti-boucle / anti-double init
  const hasInitialized = useRef(false)
  const isMounted = useRef(false)
  const lastRefreshTs = useRef<number>(0)
  const refreshLock = useRef(false)

  const pendingCount = useMemo(() => tasks.filter((t) => t.status !== 'completed').length, [tasks])
  const completedCount = useMemo(() => tasks.filter((t) => t.status === 'completed').length, [tasks])

  const getCategoryStyle = (category: string) => {
    return CATEGORIES.find((c) => c.value === category)?.color || CATEGORIES[0].color
  }

  /**
   * ✅ Hard reset propre :
   * - supabase signOut
   * - clear keys
   * - redirect login
   */
  const hardLogoutAndGoLogin = async () => {
    try {
      await supabase.auth.signOut()
    } catch {
      // ignore
    }
    try {
      localStorage.removeItem('homeflow_household_id')
      localStorage.removeItem('homeflow-auth') // storageKey
    } catch {
      // ignore
    }
    navigate('/login', { replace: true })
  }

  /**
   * ✅ Charge tasks selon filtres
   * (ne touche PAS à loading global pour éviter les loops)
   */
  const loadTasksForHousehold = async (targetHouseholdId: string) => {
    try {
      let query = supabase
        .from('tasks')
        .select('*')
        .eq('household_id', targetHouseholdId)
        .order('created_at', { ascending: false })

      if (filter === 'pending') query = query.in('status', ['pending', 'in_progress'])
      if (filter === 'completed') query = query.eq('status', 'completed')
      if (selectedMemberFilter) query = query.eq('assigned_to', selectedMemberFilter)

      const { data, error } = await query

      if (error) throw error
      setTasks((data || []) as Task[])
    } catch (err: any) {
      console.error('Erreur chargement tâches:', err)
      if (isJwtExpiredError(err)) {
        setError("Votre session a expiré. Veuillez vous reconnecter.")
      }
    }
  }

  /**
   * ✅ Init complet “sans boucle”
   * - getUser() (source de vérité)
   * - members -> household
   * - members list
   * - tasks
   */
  const init = async () => {
    try {
      setLoading(true)
      setError(null)

      const user = await getCurrentUserSafe()
      console.log('👤 user:', user?.id ? 'OK' : 'NULL')

      if (!user) {
        throw new Error('AUTH_INVALID')
      }

      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .select('household_id, households(id, name)')
        .eq('id', user.id)
        .single()

      if (memberError || !memberData) {
        console.error('Erreur membre:', memberError)
        throw new Error('MEMBER_FETCH_ERROR')
      }

      const householdData = memberData.households as any
      const hId = householdData?.id as string
      const hName = householdData?.name as string

      setHouseholdId(hId)
      setHouseholdName(hName)
      localStorage.setItem('homeflow_household_id', hId)

      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select('id, display_name')
        .eq('household_id', memberData.household_id)

      if (membersError) console.warn('Erreur members:', membersError)
      setMembers((membersData || []) as MemberMini[])

      await loadTasksForHousehold(hId)
    } catch (err: any) {
      console.error('Erreur init:', err)

      if (err?.message === 'AUTH_INVALID') {
        await hardLogoutAndGoLogin()
        return
      }

      if (err?.message === 'MEMBER_FETCH_ERROR') {
        setError("Impossible de trouver votre profil membre. Essayez de vous reconnecter.")
        return
      }

      setError("Erreur de connexion. Vérifiez votre réseau et réessayez.")
    } finally {
      setLoading(false)
    }
  }

  /**
   * ✅ Refresh intelligent (appelé au retour onglet/focus)
   * - évite spam
   * - évite double refresh en parallèle
   */
  const refreshIfNeeded = async () => {
    const now = Date.now()

    // anti-spam : max 1 refresh / 3s
    if (now - lastRefreshTs.current < 3000) return
    lastRefreshTs.current = now

    if (refreshLock.current) return
    refreshLock.current = true

    try {
      const user = await getCurrentUserSafe(4000)
      console.log('🔄 refresh user:', user?.id ? 'OK' : 'NULL')

      if (!user) {
        // session perdue → login
        setError("Votre session a expiré. Veuillez vous reconnecter.")
        await sleep(200) // micro délai UI
        await hardLogoutAndGoLogin()
        return
      }

      const hId = householdId || localStorage.getItem('homeflow_household_id')
      if (hId) {
        await loadTasksForHousehold(hId)
      }
    } finally {
      refreshLock.current = false
    }
  }

  /**
   * ✅ Mount / Unmount
   */
  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  /**
   * ✅ INIT une seule fois
   */
  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * ✅ Recharge tasks quand filtres changent (sans relancer init)
   */
  useEffect(() => {
    const hId = householdId || localStorage.getItem('homeflow_household_id')
    if (!hId) return
    if (loading) return
    if (error) return
    loadTasksForHousehold(hId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, selectedMemberFilter])

  /**
   * ✅ Quand tu reviens sur l’onglet = on refresh
   * (c’est LA correction du “ça tourne en rond”)
   */
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshIfNeeded()
      }
    }
    const onFocus = () => refreshIfNeeded()

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId])

  /**
   * ✅ Si Supabase change la session (refresh token / signout),
   * on réagit immédiatement.
   */
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (event) => {
      console.log('🔐 auth event:', event)

      if (event === 'SIGNED_OUT') {
        await hardLogoutAndGoLogin()
        return
      }

      // TOKEN_REFRESHED / SIGNED_IN / INITIAL_SESSION -> refresh data
      await refreshIfNeeded()
    })

    return () => {
      sub?.subscription?.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId])

  /**
   * ✅ Logout bouton
   */
  const handleLogout = async () => {
    await hardLogoutAndGoLogin()
  }

  /**
   * ✅ Create task (robuste)
   */
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (isSubmitting) return
    setIsSubmitting(true)

    try {
      const user = await getCurrentUserSafe(4000)
      console.log('📝 create task user:', user?.id ? 'OK' : 'NULL')

      if (!user) {
        throw new Error('SESSION_EXPIRED')
      }

      const hId = householdId || localStorage.getItem('homeflow_household_id')
      if (!hId) throw new Error('Erreur de foyer. Rafraîchissez la page.')

      const assignedToValue = formData.assigned_to === '' ? null : formData.assigned_to

      const taskData = {
        household_id: hId,
        title: formData.title,
        description: formData.description || null,
        category: formData.category,
        assigned_to: assignedToValue,
        created_by: user.id,
        points: formData.points,
        due_date: formData.due_date || null,
        status: 'pending' as const,
      }

      const { error: insertError } = await supabase.from('tasks').insert(taskData)

      if (insertError) throw insertError

      setFormData({
        title: '',
        description: '',
        category: 'general',
        assigned_to: '',
        due_date: '',
        points: 10,
      })

      setShowModal(false)
      await loadTasksForHousehold(hId)
    } catch (err: any) {
      console.error('❌ create task error:', err)

      if (err?.message === 'SESSION_EXPIRED' || isJwtExpiredError(err)) {
        setFormError('Votre session a expiré. Rafraîchissez la page pour vous reconnecter.')
        return
      }

      setFormError(err?.message || 'Une erreur est survenue lors de la création.')
    } finally {
      setIsSubmitting(false)
    }
  }

  /**
   * ✅ Toggle completion (optimistic)
   */
  const handleToggleComplete = async (task: Task) => {
    const oldStatus = task.status
    const newStatus: TaskStatus = task.status === 'completed' ? 'pending' : 'completed'

    setTasks((current) => current.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)))

    try {
      const completedAt = newStatus === 'completed' ? new Date().toISOString() : null
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus, completed_at: completedAt })
        .eq('id', task.id)

      if (error) throw error

      if (filter !== 'all') {
        const hId = householdId || localStorage.getItem('homeflow_household_id')
        if (hId) await loadTasksForHousehold(hId)
      }
    } catch (err: any) {
      console.error('toggle error:', err)
      setTasks((current) => current.map((t) => (t.id === task.id ? { ...t, status: oldStatus } : t)))

      if (isJwtExpiredError(err)) {
        setError('Votre session a expiré. Veuillez vous reconnecter.')
        await hardLogoutAndGoLogin()
      }
    }
  }

  /**
   * ✅ Delete task (optimistic)
   */
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Supprimer cette tâche ?')) return

    const previous = [...tasks]
    setTasks((curr) => curr.filter((t) => t.id !== taskId))

    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId)
      if (error) throw error
    } catch (err: any) {
      console.error('delete error:', err)
      setTasks(previous)

      if (isJwtExpiredError(err)) {
        setError('Votre session a expiré. Veuillez vous reconnecter.')
        await hardLogoutAndGoLogin()
      }
    }
  }

  // ✅ UI Loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-lg font-medium text-gray-700">Chargement...</p>
          <p className="mt-2 text-sm text-gray-500">Connexion en cours...</p>
        </div>
      </div>
    )
  }

  // ✅ UI Error
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md w-full bg-white p-8 rounded-2xl shadow-lg border border-red-100">
          <WifiOff className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Problème de connexion</h2>
          <p className="text-gray-600 mb-6">{error}</p>

          <div className="space-y-3">
            <button
              onClick={() => {
                setError(null)
                init()
              }}
              className="w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-medium shadow-md flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-5 h-5" /> Réessayer
            </button>

            <button
              onClick={hardLogoutAndGoLogin}
              className="w-full py-3 bg-white border border-red-200 text-red-600 rounded-xl hover:bg-red-50 transition font-medium flex items-center justify-center gap-2"
            >
              <AlertTriangle className="w-5 h-5" /> Se reconnecter
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ✅ UI Normal
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center hover:opacity-80 transition"
              >
                <Home className="w-8 h-8 text-blue-600 mr-3" />
                <div>
                  <h1 className="text-xl font-bold text-gray-900">HomeFlow</h1>
                  {householdName && <p className="text-xs text-gray-500">{householdName}</p>}
                </div>
              </button>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
            >
              <LogOut className="w-4 h-4 mr-2" /> Déconnexion
            </button>
          </div>
        </div>
      </nav>

      {/* Main */}
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
            onClick={() => {
              setFormError(null)
              setShowModal(true)
            }}
            className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium shadow-lg hover:shadow-xl"
          >
            <Plus className="w-5 h-5 mr-2" /> Nouvelle tâche
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
                            {CATEGORIES.find((c) => c.value === task.category)?.label || 'Général'}
                          </span>

                          {task.due_date && (
                            <span className="flex items-center text-xs text-gray-600">
                              <Clock className="w-3 h-3 mr-1" />
                              {new Date(task.due_date).toLocaleDateString('fr-FR')}
                            </span>
                          )}

                          <span className="text-xs font-medium text-blue-600">{task.points} pts</span>
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

      {/* MODAL */}
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

            {formError && (
              <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex flex-col gap-2">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-red-800">Erreur</h4>
                    <p className="text-sm text-red-600 mt-1">{formError}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowModal(false)
                    refreshIfNeeded()
                  }}
                  className="mt-2 text-sm text-blue-600 font-medium hover:underline flex items-center gap-1 self-end"
                >
                  <RefreshCw className="w-4 h-4" /> Rafraîchir
                </button>
              </div>
            )}

            <form onSubmit={handleCreateTask} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Titre de la tâche *</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Catégorie</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assigner à</label>
                  <select
                    value={formData.assigned_to}
                    onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
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
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Points</label>
                  <input
                    type="number"
                    value={formData.points}
                    onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value || '10') })}
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
