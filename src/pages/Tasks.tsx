import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
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
} from 'lucide-react'

/**
 * ✅ ROBUST Tasks.tsx - OPTIMIZED
 * - init robuste (getSession + getUser + auth listener)
 * - timeouts sur appels Supabase
 * - écran erreur + retry + hard reset
 * - création tâche : timeout + reset UI garanti + refresh tasks
 * - évite les loaders infinis
 * - update optimiste pour meilleure UX
 */

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
  household_id?: string
  members?: {
    display_name: string
  } | null
}

interface Member {
  id: string
  display_name: string
  household_id?: string
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

const LS_HOUSEHOLD_ID_KEY = 'homeflow_household_id'

function timeout(ms: number) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms))
}

async function withTimeout<T>(promiseOrBuilder: Promise<T> | any, ms: number, code: string): Promise<T> {
  try {
    // Si c'est un PostgrestBuilder, on le convertit en Promise
    const promise = typeof (promiseOrBuilder as any)?.then === 'function' 
      ? promiseOrBuilder 
      : Promise.resolve(promiseOrBuilder)
    
    return (await Promise.race([promise, timeout(ms)])) as T
  } catch (e: any) {
    const err = e instanceof Error ? e : new Error(String(e))
    ;(err as any).code = (err as any).code || code
    if (err.message === 'TIMEOUT') (err as any).code = code
    throw err
  }
}

export default function Tasks() {
  const navigate = useNavigate()
  const { user, setUser } = useAuthStore()

  const mountedRef = useRef(true)
  const initInFlightRef = useRef(false)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [household, setHousehold] = useState<Household | null>(null)
  const [householdId, setHouseholdId] = useState<string | null>(null)

  const [tasks, setTasks] = useState<Task[]>([])
  const [members, setMembers] = useState<Member[]>([])

  const [showModal, setShowModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending')
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'general',
    assigned_to: '',
    due_date: '',
    points: 10,
  })


  const hardReset = useCallback(() => {
    try {
      localStorage.removeItem(LS_HOUSEHOLD_ID_KEY)
    } catch {
      // ignore
    }
    window.location.reload()
  }, [])

  const logout = useCallback(async () => {
    try {
      localStorage.removeItem(LS_HOUSEHOLD_ID_KEY)
    } catch {
      // ignore
    }
    await supabase.auth.signOut()
    setUser(null)
    navigate('/login')
  }, [navigate, setUser])

  const getCategoryStyle = useCallback((category: string) => {
    return CATEGORIES.find((c) => c.value === category)?.color || CATEGORIES[0].color
  }, [])

  const pendingCount = useMemo(() => tasks.filter((t) => t.status !== 'completed').length, [tasks])
  const completedCount = useMemo(() => tasks.filter((t) => t.status === 'completed').length, [tasks])

  const loadTasksForHousehold = useCallback(
    async (targetHouseholdId: string) => {
      let query = supabase
        .from('tasks')
        .select('*, members:assigned_to(display_name)')
        .eq('household_id', targetHouseholdId)
        .order('created_at', { ascending: false })

      if (filter === 'pending') query = query.in('status', ['pending', 'in_progress'])
      else if (filter === 'completed') query = query.eq('status', 'completed')

      if (selectedMemberFilter) query = query.eq('assigned_to', selectedMemberFilter)

      const result = await withTimeout(query, 20000, 'TASKS_TIMEOUT') as { data: Task[] | null; error: any }
      const { data, error: qErr } = result
      if (qErr) throw qErr

      if (mountedRef.current) setTasks(data || [])
    },
    [filter, selectedMemberFilter]
  )

  const loadInitialData = useCallback(
    async (userId: string) => {
      const memberQuery = supabase
        .from('members')
        .select('household_id, households(id, name)')
        .eq('id', userId)
        .single()

      const memberResult = await withTimeout(memberQuery, 20000, 'MEMBER_TIMEOUT') as { 
        data: { household_id: string; households: any } | null; 
        error: any 
      }
      const { data: memberData, error: memberError } = memberResult
      if (memberError || !memberData) throw memberError || new Error('Aucune donnée membre')

      const householdData = memberData.households as any
      const hId = householdData?.id as string | undefined
      const hName = householdData?.name as string | undefined
      if (!hId) throw new Error('Household introuvable')

      if (mountedRef.current) setHousehold( { id: hId, name: hName || 'Famille' })
      if (mountedRef.current) setHouseholdId( hId)

      try {
        localStorage.setItem(LS_HOUSEHOLD_ID_KEY, hId)
      } catch {
        // ignore
      }

      const membersQuery = supabase
        .from('members')
        .select('id, display_name')
        .eq('household_id', memberData.household_id)

      const membersResult = await withTimeout(membersQuery, 20000, 'MEMBERS_TIMEOUT') as {
        data: Member[] | null;
        error: any
      }
      const { data: membersData, error: membersError } = membersResult
      if (membersError) throw membersError
      if (mountedRef.current) setMembers(membersData || [])

      await loadTasksForHousehold(hId)
    },
    [loadTasksForHousehold]
  )

  const init = useCallback(async () => {
    if (initInFlightRef.current) return
    initInFlightRef.current = true

    if (mountedRef.current) setLoading( true)
    if (mountedRef.current) setError( null)

    try {
      if (!user) {
        const sessionRes = await withTimeout(supabase.auth.getSession(), 8000, 'SESSION_TIMEOUT') as {
          data: { session: { user: any } | null };
          error: any;
        }
        const sessionUser = sessionRes.data.session?.user ?? null
        if (sessionUser) setUser(sessionUser)
      }

      const userRes = await withTimeout(supabase.auth.getUser(), 8000, 'GETUSER_TIMEOUT') as {
        data: { user: any };
        error: any;
      }
      const currentUser = userRes.data.user
      if (!currentUser) {
        if (mountedRef.current) setLoading(false)
        navigate('/login')
        return
      }

      await loadInitialData(currentUser.id)

      if (mountedRef.current) setLoading( false)
    } catch (e: any) {
      console.error('[Tasks:init] error', e)

      try {
        localStorage.removeItem(LS_HOUSEHOLD_ID_KEY)
      } catch {
        // ignore
      }

      const code = e?.code || e?.message
      const msg =
        code === 'SESSION_TIMEOUT' || code === 'GETUSER_TIMEOUT'
          ? 'Session expirée après changement d\'onglet. Clique sur « Réessayer » ci-dessous.'
          : code === 'MEMBER_TIMEOUT' || code === 'MEMBERS_TIMEOUT'
          ? 'Impossible de charger tes données famille. Vérifie ta connexion internet puis clique « Réessayer ».'
          : code === 'TASKS_TIMEOUT'
          ? 'Impossible de charger les tâches. Vérifie ta connexion puis clique « Réessayer ».'
          : 'Erreur de synchronisation. Vérifie ta connexion internet puis clique « Réessayer ».'

      if (mountedRef.current) setError( msg)
      if (mountedRef.current) setLoading( false)
    } finally {
      initInFlightRef.current = false
    }
  }, [loadInitialData, navigate, setUser, user])

  const retry = useCallback(() => {
    if (mountedRef.current) {
      setError(null)
      setLoading(true)
    }
    
    // Forcer un vrai refresh
    initInFlightRef.current = false
    
    // Attendre que React nettoie
    setTimeout(() => {
      init()
    }, 100)
  }, [init])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null
      setUser(nextUser)
    })
    return () => {
      sub.subscription.unsubscribe()
    }
  }, [setUser])

  useEffect(() => {
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const hId = householdId || (() => {
      try {
        return localStorage.getItem(LS_HOUSEHOLD_ID_KEY)
      } catch {
        return null
      }
    })()

    if (!hId || loading || error) return

    loadTasksForHousehold(hId).catch((e) => {
      console.error('[Tasks:filters] reload error', e)
    })
  }, [filter, selectedMemberFilter, householdId, loading, error, loadTasksForHousehold])

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    if (mountedRef.current) setIsSubmitting( true)

    try {
      const userRes = await withTimeout(supabase.auth.getUser(), 8000, 'GETUSER_TIMEOUT') as {
        data: { user: any };
        error: any;
      }
      const currentUser = userRes.data.user
      if (!currentUser) {
        await logout()
        return
      }

      const hId = householdId || (() => {
        try {
          return localStorage.getItem(LS_HOUSEHOLD_ID_KEY)
        } catch {
          return null
        }
      })()

      if (!hId) throw Object.assign(new Error('Famille introuvable. Réessaye.'), { code: 'NO_HOUSEHOLD' })

      const payload = {
        household_id: hId,
        title: formData.title.trim(),
        description: formData.description?.trim() || null,
        category: formData.category,
        assigned_to: formData.assigned_to || null,
        created_by: currentUser.id,
        points: Number.isFinite(formData.points) ? formData.points : 10,
        due_date: formData.due_date || null,
        status: 'pending' as const,
      }

      const insertQuery = supabase
        .from('tasks')
        .insert(payload)
        .select('*, members:assigned_to(display_name)')
        .single()

      const insertResult = await withTimeout(insertQuery, 20000, 'INSERT_TIMEOUT') as {
        data: Task | null;
        error: any;
      }
      const { data: inserted, error: insErr } = insertResult
      if (insErr) throw insErr
      if (!inserted) throw new Error('Aucune donnée retournée après insertion')

      // Reset form IMMÉDIATEMENT
      if (mountedRef.current) setFormData({
        title: '',
        description: '',
        category: 'general',
        assigned_to: '',
        due_date: '',
        points: 10,
      })

      // Fermer modal IMMÉDIATEMENT
      if (mountedRef.current) setShowModal(false)

      // ✅ FIX: Update optimiste AVANT le refresh serveur
      const canShowInCurrentView =
        filter === 'all' ||
        (filter === 'pending' && inserted.status !== 'completed') ||
        (filter === 'completed' && inserted.status === 'completed')

      if (canShowInCurrentView) {
        // Ajouter la tâche INSTANTANÉMENT à la liste
        if (mountedRef.current) setTasks((current) => [inserted, ...current])
      }

      // ✅ FIX: Refresh serveur APRÈS (pour synchroniser)
      // Utiliser setTimeout pour éviter les conflits React
      setTimeout(() => {
        loadTasksForHousehold(hId).catch((e) => {
          console.error('[Tasks:create] refresh error', e)
        })
      }, 100)

    } catch (err: any) {
      console.error('[Tasks:create] error', err)

      const code = err?.code || err?.message
      
      if (code === 'INSERT_TIMEOUT' || code === 'CONNECTION_LOST') {
        alert(
          'Impossible de créer la tâche (connexion trop lente).\n\n' +
          '✅ Solution rapide :\n' +
          '1. Ferme ce modal (clique Annuler)\n' +
          '2. Clique sur « Sync » en haut\n' +
          '3. Réessaye de créer la tâche\n\n' +
          'Si ça persiste, rafraîchis la page (F5).'
        )
      } else {
        alert(err?.message || 'Erreur lors de la création')
      }
    } finally {
      if (mountedRef.current) setIsSubmitting( false)
    }
  }

  const handleToggleComplete = async (task: Task) => {
    const newStatus: Task['status'] = task.status === 'completed' ? 'pending' : 'completed'
    const completedAt = newStatus === 'completed' ? new Date().toISOString() : null

    // Update optimiste
    if (mountedRef.current) setTasks( (current) => 
      current.map((t) => (t.id === task.id ? { ...t, status: newStatus, completed_at: completedAt } : t))
    )

    try {
      const updateQuery = supabase
        .from('tasks')
        .update({ status: newStatus, completed_at: completedAt })
        .eq('id', task.id)

      const updateResult = await withTimeout(updateQuery, 20000, 'UPDATE_TIMEOUT') as {
        data: any;
        error: any;
      }
      const { error: upErr } = updateResult
      if (upErr) throw upErr

      // Si filtre actif, refresh pour retirer la tâche de la vue
      if (filter !== 'all') {
        const hId = householdId || localStorage.getItem(LS_HOUSEHOLD_ID_KEY)
        if (hId) {
          setTimeout(() => {
            loadTasksForHousehold(hId).catch(() => {})
          }, 100)
        }
      }
    } catch (e) {
      console.error('[Tasks:toggle] error', e)
      // Rollback optimiste
      if (mountedRef.current) setTasks( (current) => 
        current.map((t) => (t.id === task.id ? task : t))
      )
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Supprimer cette tâche ?')) return

    const prev = tasks
    if (mountedRef.current) setTasks( (current) => current.filter((t) => t.id !== taskId))

    try {
      const delQuery = supabase.from('tasks').delete().eq('id', taskId)
      const deleteResult = await withTimeout(delQuery, 20000, 'DELETE_TIMEOUT') as {
        data: any;
        error: any;
      }
      const { error: delErr } = deleteResult
      if (delErr) throw delErr
    } catch (e) {
      console.error('[Tasks:delete] error', e)
      if (mountedRef.current) setTasks( prev)
    }
  }

  // ------------------ UI ------------------

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-lg font-medium text-gray-700">Chargement de HomeFlow...</p>
          <p className="mt-2 text-sm text-gray-400">Si ça dure trop, rafraîchis la page.</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md w-full bg-white p-8 rounded-2xl shadow-lg border border-red-100">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
              <WifiOff className="h-8 w-8 text-red-500" />
            </div>
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-2">Problème de synchronisation</h2>
          <p className="text-gray-600 mb-6">{error}</p>

          <div className="space-y-3">
            <button
              onClick={retry}
              className="w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-medium shadow-md flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              Réessayer
            </button>

            <button
              onClick={hardReset}
              className="w-full py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition font-medium flex items-center justify-center gap-2"
            >
              <AlertTriangle className="w-5 h-5" />
              Hard Reset (vider cache)
            </button>

            <button
              onClick={logout}
              className="w-full py-3 border border-gray-200 text-gray-500 rounded-xl hover:bg-gray-50 transition font-medium"
            >
              Se déconnecter
            </button>
          </div>

          <p className="text-xs text-gray-400 mt-4">
            Astuce : si tu as changé d'onglet longtemps, la session peut expirer. « Réessayer » suffit souvent.
          </p>
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

            <div className="flex items-center gap-3">
              <button
                onClick={retry}
                className="hidden sm:flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition"
                title="Rafraîchir"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Sync
              </button>

              <button
                onClick={logout}
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Déconnexion
              </button>
            </div>
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
                            {CATEGORIES.find((c) => c.value === task.category)?.label || 'Général'}
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
                    onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value || '0', 10) })}
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

              <p className="text-xs text-gray-400">
                Astuce : Si le modal reste bloqué, clique « Sync » en haut ou rafraîchis la page.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
