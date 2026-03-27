import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Invoice from './pages/Invoice'
import ResetPassword from './pages/ResetPassword'
import PaymentConfirmed from './pages/PaymentConfirmed'

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
      } else if (event === 'SIGNED_IN' && new URLSearchParams(window.location.hash.slice(1)).get('type') === 'invite') {
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

  return (
    <Routes>
      <Route path="/login" element={!session ? <Login /> : <Navigate to="/dashboard" />} />
      <Route path="/dashboard" element={session ? <Dashboard session={session} /> : <Navigate to="/login" />} />
      <Route path="/invoice/:id" element={session ? <Invoice session={session} /> : <Navigate to="/login" state={{ from: window.location.pathname }} />} />
      <Route path="/payment-confirmed" element={session ? <PaymentConfirmed /> : <Navigate to="/login" />} />
      <Route path="/reset-password" element={recoveryMode ? <ResetPassword onDone={() => setRecoveryMode(false)} isAdmin={false} /> : <Navigate to={session ? '/dashboard' : '/login'} />} />
      <Route path="*" element={<Navigate to={session ? '/dashboard' : '/login'} />} />
    </Routes>
  )
}
