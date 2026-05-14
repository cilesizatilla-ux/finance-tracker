import { Routes, Route, Navigate } from 'react-router-dom'
import { AdminAuthProvider, useAdminAuth } from './AdminAuthContext.jsx'
import AdminLayout from './AdminLayout.jsx'
import AdminLogin from './pages/AdminLogin.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import AdminUsers from './pages/AdminUsers.jsx'
import AdminUserDetail from './pages/AdminUserDetail.jsx'
import AdminAnalytics from './pages/AdminAnalytics.jsx'
import AdminBenchmarks from './pages/AdminBenchmarks.jsx'
import AdminAdmins from './pages/AdminAdmins.jsx'
import AdminAuditLogs from './pages/AdminAuditLogs.jsx'
import AdminNotifications from './pages/AdminNotifications.jsx'
import AdminAuditCalendar from './pages/AdminAuditCalendar.jsx'

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0f172a' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm" style={{ color: '#64748b' }}>Loading…</p>
      </div>
    </div>
  )
}

function ProtectedAdminRoute({ children }) {
  const { admin, loading } = useAdminAuth()
  if (loading) return <LoadingSpinner />
  return admin ? children : <Navigate to="/admin/login" replace />
}

function AdminRoutes() {
  return (
    <Routes>
      <Route path="login" element={<AdminLogin />} />
      <Route
        path="/"
        element={
          <ProtectedAdminRoute>
            <AdminLayout />
          </ProtectedAdminRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="users/:userId" element={<AdminUserDetail />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="benchmarks" element={<AdminBenchmarks />} />
        <Route path="admins" element={<AdminAdmins />} />
        <Route path="audit-logs" element={<AdminAuditLogs />} />
        <Route path="notifications" element={<AdminNotifications />} />
        <Route path="audit-calendar" element={<AdminAuditCalendar />} />
      </Route>
    </Routes>
  )
}

export default function AdminApp() {
  return (
    <AdminAuthProvider>
      <AdminRoutes />
    </AdminAuthProvider>
  )
}
