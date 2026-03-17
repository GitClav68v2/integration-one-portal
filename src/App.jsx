import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Invoice from './pages/Invoice'
import AdminDashboard from './pages/AdminDashboard'
import AdminCustomer from './pages/AdminCustomer'
import AdminNewCustomer from './pages/AdminNewCustomer'
import ResetPassword from './pages/ResetPassword'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [recoveryMode, setRecoveryMode] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true)
        setSession(session)
        navigate('/reset-password')
      } else if (event === 'SIGNED_IN' && window.location.hash.includes('type=invite')) {
        setRecoveryMode(true)
        setSession(session)
        navigate('/reset-password')
      } else {
        setRecoveryMode(false)
        setSession(session)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return null

  const isAdmin = session?.user?.app_metadata?.is_admin === true

  return (
    <Routes>
      <Route path="/login" element={!session ? <Login /> : <Navigate to={isAdmin ? '/admin' : '/dashboard'} />} />
      <Route path="/dashboard" element={session && !isAdmin ? <Dashboard session={session} /> : <Navigate to={session ? '/admin' : '/login'} />} />
      <Route path="/invoice/:id" element={session ? <Invoice session={session} /> : <Navigate to="/login" state={{ from: window.location.pathname }} />} />
      <Route path="/admin" element={session && isAdmin ? <AdminDashboard session={session} /> : <Navigate to={session ? '/dashboard' : '/login'} />} />
      <Route path="/admin/customers/new" element={session && isAdmin ? <AdminNewCustomer session={session} /> : <Navigate to="/login" />} />
      <Route path="/admin/customers/:id" element={session && isAdmin ? <AdminCustomer session={session} /> : <Navigate to="/login" />} />
      <Route path="/reset-password" element={recoveryMode ? <ResetPassword onDone={() => setRecoveryMode(false)} isAdmin={isAdmin} /> : <Navigate to={session ? (isAdmin ? '/admin' : '/dashboard') : '/login'} />} />
      <Route path="*" element={<Navigate to={session ? (isAdmin ? '/admin' : '/dashboard') : '/login'} />} />
    </Routes>
  )
}
