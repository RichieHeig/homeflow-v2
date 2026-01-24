import type { ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from '@/contexts/ToastContext'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { useStore } from '@/stores/useStore'
import { supabaseEnabled, getSupabaseError } from '@/lib/supabase'

import Onboarding from '@/pages/Onboarding'
import Dashboard from '@/pages/Dashboard'
import Tasks from '@/pages/Tasks'
import Members from '@/pages/Members'
import TaskFlow from '@/pages/TaskFlow'
import Settings from '@/pages/Settings'
import LoginPassword from '@/pages/LoginPassword'
import SignUp from '@/pages/SignUp'

import AppLayout from '@/components/layout/AppLayout'
import { AlertCircle } from 'lucide-react'

// ✅ Guard : utilisateur obligatoire
function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useStore()
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

// ✅ Guard : household obligatoire (sinon onboarding)
function RequireHousehold({ children }: { children: ReactNode }) {
  const { household } = useStore()
  if (!household) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

function App() {
  // ✅ Supabase mal configuré → écran explicite
  if (!supabaseEnabled) {
    const error = getSupabaseError()
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 border-2 border-red-200 dark:border-red-900">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-red-100 dark:bg-red-900/30 rounded-full p-4">
              <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-400" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-4">
            Configuration Supabase Manquante
          </h1>

          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-800 dark:text-red-200 font-medium">
              {error}
            </p>
          </div>

          <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
            <div>
              <p className="font-semibold mb-2">Variables d'environnement requises :</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>
                  <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">
                    VITE_SUPABASE_URL
                  </code>
                </li>
                <li>
                  <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">
                    VITE_SUPABASE_ANON_KEY
                  </code>
                </li>
              </ul>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Consultez la documentation Supabase pour obtenir vos clés API
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const { user, household } = useStore()
  const { loading } = useSupabaseAuth()

  // ✅ Loader global (évite redirects prématurés)
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-lg font-medium text-gray-700 dark:text-gray-300">
            Chargement...
          </p>
        </div>
      </div>
    )
  }

  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          {/* ✅ Auth */}
          <Route
            path="/login"
            element={user ? <Navigate to="/" replace /> : <LoginPassword />}
          />
          <Route
            path="/signup"
            element={user ? <Navigate to="/" replace /> : <SignUp />}
          />

          {/* ✅ Home */}
          <Route
            path="/"
            element={
              !user ? (
                <Navigate to="/login" replace />
              ) : !household ? (
                <Navigate to="/onboarding" replace />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            }
          />

          {/* ✅ Onboarding */}
          <Route
            path="/onboarding"
            element={
              <RequireAuth>
                <Onboarding />
              </RequireAuth>
            }
          />

          {/* ✅ App layout */}
          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route
              path="/dashboard"
              element={
                <RequireHousehold>
                  <Dashboard />
                </RequireHousehold>
              }
            />
            <Route
              path="/tasks"
              element={
                <RequireHousehold>
                  <Tasks />
                </RequireHousehold>
              }
            />
            <Route
              path="/members"
              element={
                <RequireHousehold>
                  <Members />
                </RequireHousehold>
              }
            />
            <Route
              path="/taskflow"
              element={
                <RequireHousehold>
                  <TaskFlow />
                </RequireHousehold>
              }
            />
            <Route
              path="/settings"
              element={
                <RequireHousehold>
                  <Settings />
                </RequireHousehold>
              }
            />
          </Route>

          {/* ✅ Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  )
}

export default App
