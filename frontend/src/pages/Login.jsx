import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginApi, register } from '../api/index.js'
import { useAuth } from '../contexts/AuthContext.jsx'

function InputField({ label, type, value, onChange, placeholder, required }) {
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>{label}</label>
      <div className="relative">
        <input
          type={isPassword && show ? 'text' : type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          className="w-full px-4 py-3 rounded-xl text-sm border outline-none transition-all focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
          style={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
            style={{ color: '#64748b' }}
            tabIndex={-1}
          >
            {show ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showForgotInfo, setShowForgotInfo] = useState(false)

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  // Handle impersonation token from admin
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('impersonate')
    if (token) {
      localStorage.setItem('ft_token', token)
      // Clean URL and redirect to home
      window.history.replaceState({}, '', '/')
      window.location.href = '/'
    }
  }, [])

  // Show error from OAuth callback redirects (e.g. ?error=google_denied)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const oauthErr = params.get('error')
    if (oauthErr) {
      const msgs = {
        google_denied: 'Google sign-in was cancelled.',
        not_configured: 'Google OAuth is not configured on the server.',
        token_exchange_failed: 'Google authentication failed. Please try again.',
        audience_mismatch: 'Google token validation failed. Please try again.',
      }
      setError(msgs[oauthErr] || 'Google sign-in failed. Please try again.')
      window.history.replaceState({}, '', '/login')
    }
  }, [])

  const handleGoogleRedirect = () => {
    window.location.href = '/api/v1/auth/google/redirect'
  }

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const fn = mode === 'login' ? loginApi : register
      const payload = mode === 'login'
        ? { email: form.email, password: form.password }
        : { email: form.email, password: form.password, name: form.name }

      const res = await fn(payload)
      const d = res.data?.data
      if (res.data?.error) { setError(res.data.error); return }
      if (!d?.access_token) { setError('Something went wrong. Please try again.'); return }

      const { default: api } = await import('../api/index.js')
      const meRes = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${d.access_token}` }
      })
      login(d.access_token, meRes.data?.data)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#0f172a' }}>
      {/* Left branding panel */}
      <div
        className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ backgroundColor: '#1e293b', borderRight: '1px solid #334155' }}
      >
        {/* Background decoration */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: 'radial-gradient(ellipse at 20% 50%, #6366f140 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, #818cf820 0%, transparent 50%)'
          }}
        />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
              <svg className="text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: 22, height: 22 }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-white">FinanceTrack</span>
          </div>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              Take control of<br />your finances
            </h1>
            <p className="text-base leading-relaxed" style={{ color: '#94a3b8' }}>
              Track spending, set budgets, and get AI-powered insights — all in one place.
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                text: 'Visualize your cash flow in real time',
                svg: (
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#818cf8' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                )
              },
              {
                text: 'AI advisor that understands your finances',
                svg: (
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#818cf8' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2h-2M9 3a2 2 0 002 2h2a2 2 0 002-2M9 3h6m-3 9h.01M9 12h.01M15 12h.01M9 16h6" />
                  </svg>
                )
              },
              {
                text: 'Smart budget tracking per category',
                svg: (
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#818cf8' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )
              },
            ].map(({ svg, text }) => (
              <div key={text} className="flex items-center gap-3">
                {svg}
                <span className="text-sm" style={{ color: '#cbd5e1' }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-xs" style={{ color: '#475569' }}>© 2026 FinanceTrack · Your data stays private</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <svg className="text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="font-bold text-white">FinanceTrack</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-1">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-sm" style={{ color: '#64748b' }}>
              {mode === 'login'
                ? 'Sign in to your account to continue'
                : 'Start tracking your finances today'}
            </p>
          </div>

          {/* Google OAuth — server-side redirect flow */}
          {googleClientId && (
            <button
              type="button"
              onClick={handleGoogleRedirect}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium mb-6 transition-colors hover:bg-slate-700/50"
              style={{ borderColor: '#334155', color: '#f1f5f9', backgroundColor: '#1e293b' }}
            >
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {mode === 'login' ? 'Sign in with Google' : 'Sign up with Google'}
            </button>
          )}

          {/* Divider — only shown when Google OAuth is available */}
          {googleClientId && (
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px" style={{ backgroundColor: '#1e293b' }} />
              <span className="text-xs" style={{ color: '#475569' }}>or continue with email</span>
              <div className="flex-1 h-px" style={{ backgroundColor: '#1e293b' }} />
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              className="flex items-start gap-2.5 px-4 py-3 rounded-xl border text-sm mb-5"
              style={{ backgroundColor: '#ef444410', borderColor: '#ef444430', color: '#f87171' }}
            >
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <InputField
                label="Full name"
                type="text"
                value={form.name}
                onChange={set('name')}
                placeholder="John Doe"
              />
            )}
            <InputField
              label="Email address"
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="you@example.com"
              required
            />
            <InputField
              label="Password"
              type="password"
              value={form.password}
              onChange={set('password')}
              placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
              required
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 shadow-lg shadow-indigo-500/20 mt-2"
            >
              {loading
                ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
                : (mode === 'login' ? 'Sign in' : 'Create account')}
            </button>
          </form>

          {mode === 'login' && (
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => setShowForgotInfo(!showForgotInfo)}
                className="text-xs"
                style={{ color: '#6366f1' }}
              >
                Forgot password?
              </button>
              {showForgotInfo && (
                <div className="mt-3 rounded-xl p-3 text-xs border" style={{ backgroundColor: '#6366f115', borderColor: '#6366f130', color: '#a5b4fc' }}>
                  Password resets are handled by your administrator.<br/>
                  Contact: <strong>admin@financetracker.local</strong>
                </div>
              )}
            </div>
          )}

          <p className="text-center text-sm mt-6" style={{ color: '#64748b' }}>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError(null) }}
              className="font-semibold transition-colors"
              style={{ color: '#818cf8' }}
            >
              {mode === 'login' ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
