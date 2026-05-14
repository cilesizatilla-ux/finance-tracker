import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx'
import { ToastProvider } from './contexts/ToastContext.jsx'
import ProfileSetupModal from './components/ProfileSetupModal.jsx'
import { getProfile } from './api/index.js'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Transactions from './pages/Transactions.jsx'
import Budget from './pages/Budget.jsx'
import Chat from './pages/Chat.jsx'
import Analyze from './pages/Analyze.jsx'
import Login from './pages/Login.jsx'
import Parties from './pages/Parties.jsx'
import Reports from './pages/Reports.jsx'
import SharedReportView from './pages/SharedReportView.jsx'
import AuthCallback from './pages/AuthCallback.jsx'
import AdminApp from './admin/AdminApp.jsx'
import Settings from './pages/Settings.jsx'
import AuditCalendar from './pages/AuditCalendar.jsx'
import AuditExpenses from './pages/AuditExpenses.jsx'
import Goals from './pages/Goals.jsx'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0f172a' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center animate-pulse">
          <svg className="text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: 20, height: 20 }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-sm" style={{ color: '#64748b' }}>Loading…</p>
      </div>
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

function ProfileSetupGate({ children }) {
  const { user } = useAuth()
  const [showSetup, setShowSetup] = useState(false)
  const [profileChecked, setProfileChecked] = useState(false)

  useEffect(() => {
    if (!user) { setProfileChecked(true); return }
    const key = `ft_profile_setup_${user.id}`
    if (localStorage.getItem(key)) { setProfileChecked(true); return }
    getProfile()
      .then((res) => {
        const profile = res.data?.data || res.data
        if (!profile?.user_type) setShowSetup(true)
        else localStorage.setItem(key, '1')
      })
      .catch(() => {})
      .finally(() => setProfileChecked(true))
  }, [user])

  function handleComplete(role) {
    if (user) localStorage.setItem(`ft_profile_setup_${user.id}`, '1')
    setShowSetup(false)
  }

  if (!profileChecked) return null
  return (
    <>
      {showSetup && <ProfileSetupModal onComplete={handleComplete} />}
      {children}
    </>
  )
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/admin/*" element={<AdminApp />} />
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />
      <Route path="/shared/:token" element={<SharedReportView />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <ProfileSetupGate>
              <Layout />
            </ProfileSetupGate>
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="budget" element={<Budget />} />
        <Route path="chat" element={<Chat />} />
        <Route path="analyze" element={<Analyze />} />
        <Route path="parties" element={<Parties />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
        <Route path="audit-calendar" element={<AuditCalendar />} />
        <Route path="audit-expenses" element={<AuditExpenses />} />
        <Route path="goals" element={<Goals />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}>
      <ToastProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ToastProvider>
    </GoogleOAuthProvider>
  )
}
