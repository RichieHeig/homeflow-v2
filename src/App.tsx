import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { useStore } from '@/store/authStore'

import Login from '@/pages/Login'
import SignUp from '@/pages/SignUp'
import Onboarding from '@/pages/Onboarding'
import Dashboard from '@/pages/Dashboard'
import Tasks from '@/pages/Tasks'

function App() {
  const { user } = useStore()
  const { loading } = useSupabaseAuth()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <div>Chargement...</div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Auth */}
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/signup" element={user ? <Navigate to="/" replace /> : <SignUp />} />

        {/* Home */}
        <Route
          path="/"
          element={!user ? <Navigate to="/login" replace /> : <Navigate to="/dashboard" replace />}
        />

        {/* App */}
        <Route path="/onboarding" element={!user ? <Navigate to="/login" replace /> : <Onboarding />} />
        <Route path="/dashboard" element={!user ? <Navigate to="/login" replace /> : <Dashboard />} />
        <Route path="/tasks" element={!user ? <Navigate to="/login" replace /> : <Tasks />} />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
