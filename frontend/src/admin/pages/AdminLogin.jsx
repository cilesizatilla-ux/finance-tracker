import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import adminApi from '../adminApi.js'
import { useAdminAuth } from '../AdminAuthContext.jsx'

export default function AdminLogin() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { adminLogin } = useAdminAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await adminApi.post('/auth/login', { username, password })
      const { access_token, admin } = res.data?.data || res.data
      adminLogin(access_token, admin)
      navigate('/admin', { replace: true })
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.message || 'Invalid credentials. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: '#0f172a' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Finance Admin</h1>
          <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>Sign in to your admin account</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border p-8" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          {error && (
            <div className="mb-5 rounded-xl p-3 text-sm border" style={{ backgroundColor: '#ef444420', borderColor: '#ef444450', color: '#fca5a5' }}>
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5" noValidate autoComplete="off">
            {/* Honeypot to prevent browser autofill */}
            <input type="text" name="prevent_autofill" style={{ display: 'none' }} readOnly />
            <input type="password" name="prevent_password" style={{ display: 'none' }} readOnly />
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#94a3b8' }}>
                Username or Email
              </label>
              <input
                type="text"
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="admin or admin@financetracker.local"
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-slate-600 border outline-none focus:ring-2 focus:ring-indigo-500 transition"
                style={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#94a3b8' }}>
                Password
              </label>
              <input
                type="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-slate-600 border outline-none focus:ring-2 focus:ring-indigo-500 transition"
                style={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: loading ? '#4f46e5' : '#6366f1' }}
              onMouseEnter={(e) => { if (!loading) e.target.style.backgroundColor = '#4f46e5' }}
              onMouseLeave={(e) => { if (!loading) e.target.style.backgroundColor = '#6366f1' }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#475569' }}>
          Finance Tracker Admin Panel
        </p>
      </div>
    </div>
  )
}
