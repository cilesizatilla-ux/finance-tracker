import { useState, useEffect } from 'react'
import { getProfile, updateProfile, changePassword, exportUserData } from '../api/index.js'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'TRY', 'JPY', 'CAD', 'AUD', 'CHF', 'INR', 'BRL']

const INCOME_BRACKETS = [
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
  { value: 'under_25k', label: 'Under $25k' },
  { value: '25k_50k', label: '$25k – $50k' },
  { value: '50k_100k', label: '$50k – $100k' },
  { value: '100k_250k', label: '$100k – $250k' },
  { value: 'over_250k', label: 'Over $250k' },
]

const FINANCIAL_GOALS = [
  { value: 'save_money', label: 'Save Money', emoji: '💰', desc: 'Build up your savings' },
  { value: 'track_spending', label: 'Track Spending', emoji: '📊', desc: 'Know where money goes' },
  { value: 'manage_budget', label: 'Manage Budget', emoji: '📋', desc: 'Stay within limits' },
  { value: 'grow_wealth', label: 'Grow Wealth', emoji: '📈', desc: 'Invest and compound' },
]

function Skeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-xl animate-pulse"
          style={{ backgroundColor: '#1e293b', border: '1px solid #334155', height: 160 }}
        />
      ))}
    </div>
  )
}

const cardStyle = {
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '1rem',
  padding: '1.5rem',
  marginBottom: '1.5rem',
}

const labelStyle = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 600,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: '#64748b',
  marginBottom: '0.375rem',
}

const inputStyle = {
  width: '100%',
  backgroundColor: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '0.625rem',
  padding: '0.5rem 0.75rem',
  color: '#e2e8f0',
  fontSize: '0.875rem',
  outline: 'none',
  boxSizing: 'border-box',
}

const readOnlyInputStyle = {
  ...inputStyle,
  color: '#64748b',
  cursor: 'not-allowed',
}

export default function Settings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState(null)
  const [pwSaved, setPwSaved] = useState(false)

  const [exportingData, setExportingData] = useState(false)

  const [form, setForm] = useState({
    name: '',
    email: '',
    created_at: '',
    currency: 'USD',
    country: '',
    occupation: '',
    income_bracket: '',
    financial_goal: '',
  })

  useEffect(() => {
    getProfile()
      .then((res) => {
        const d = res.data?.data || {}
        setForm({
          name: d.name || '',
          email: d.email || '',
          created_at: d.created_at || '',
          currency: d.currency || 'USD',
          country: d.country || '',
          occupation: d.occupation || '',
          income_bracket: d.income_bracket || '',
          financial_goal: d.financial_goal || '',
        })
      })
      .finally(() => setLoading(false))
  }, [])

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    setSaveError(null)
    try {
      await updateProfile({
        name: form.name || undefined,
        country: form.country || undefined,
        currency: form.currency || undefined,
        income_bracket: form.income_bracket || undefined,
        financial_goal: form.financial_goal || undefined,
        occupation: form.occupation || undefined,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setSaveError('Failed to save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async () => {
    setPwError(null)
    setPwSaved(false)
    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match')
      return
    }
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters')
      return
    }
    setPwLoading(true)
    try {
      await changePassword({ current_password: currentPassword, new_password: newPassword })
      setPwSaved(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPwSaved(false), 3000)
    } catch (err) {
      setPwError(err.response?.data?.detail || 'Failed to update password')
    } finally {
      setPwLoading(false)
    }
  }

  const handleDataExport = async () => {
    setExportingData(true)
    try {
      const res = await exportUserData()
      const json = JSON.stringify(res.data, null, 2)
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'my-finance-data.json'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // export failed silently
    } finally {
      setExportingData(false)
    }
  }

  const memberSince = form.created_at
    ? new Date(form.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—'

  if (loading) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h1 className="text-xl font-bold text-white mb-6">Settings</h1>
        <Skeleton />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1 className="text-xl font-bold text-white mb-6">Settings</h1>

      {/* Section 1: Account Info */}
      <div style={cardStyle}>
        <h2 className="text-sm font-semibold text-white mb-4" style={{ letterSpacing: '0.02em' }}>
          Account Info
        </h2>
        <div className="space-y-4">
          <div>
            <label style={labelStyle}>Name</label>
            <input
              style={inputStyle}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input
              style={readOnlyInputStyle}
              value={form.email}
              readOnly
              tabIndex={-1}
            />
          </div>
          <div>
            <label style={labelStyle}>Member Since</label>
            <p className="text-sm" style={{ color: '#94a3b8' }}>{memberSince}</p>
          </div>
        </div>
      </div>

      {/* Section 2: Preferences */}
      <div style={cardStyle}>
        <h2 className="text-sm font-semibold text-white mb-4" style={{ letterSpacing: '0.02em' }}>
          Preferences
        </h2>
        <div className="space-y-4">
          <div>
            <label style={labelStyle}>Currency</label>
            <select
              style={inputStyle}
              value={form.currency}
              onChange={(e) => set('currency', e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Country</label>
            <input
              style={inputStyle}
              value={form.country}
              onChange={(e) => set('country', e.target.value)}
              placeholder="e.g. United States"
            />
          </div>
          <div>
            <label style={labelStyle}>Occupation</label>
            <input
              style={inputStyle}
              value={form.occupation}
              onChange={(e) => set('occupation', e.target.value)}
              placeholder="e.g. Software Engineer"
            />
          </div>
          <div>
            <label style={labelStyle}>Income Bracket</label>
            <select
              style={inputStyle}
              value={form.income_bracket}
              onChange={(e) => set('income_bracket', e.target.value)}
            >
              <option value="">Select…</option>
              {INCOME_BRACKETS.map((b) => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Section 3: Financial Goal */}
      <div style={cardStyle}>
        <h2 className="text-sm font-semibold text-white mb-4" style={{ letterSpacing: '0.02em' }}>
          Financial Goal
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {FINANCIAL_GOALS.map((goal) => {
            const isSelected = form.financial_goal === goal.value
            return (
              <button
                key={goal.value}
                onClick={() => set('financial_goal', goal.value)}
                style={{
                  padding: '1rem',
                  borderRadius: '0.75rem',
                  border: isSelected ? '2px solid #6366f1' : '2px solid #334155',
                  backgroundColor: isSelected ? 'rgba(99,102,241,0.1)' : '#0f172a',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, background-color 0.15s',
                }}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: '0.375rem' }}>{goal.emoji}</div>
                <div
                  className="text-sm font-semibold"
                  style={{ color: isSelected ? '#a5b4fc' : '#e2e8f0' }}
                >
                  {goal.label}
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#64748b' }}>{goal.desc}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Save button + feedback */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            backgroundColor: saving ? '#4338ca' : '#6366f1',
            color: '#fff',
            padding: '0.625rem 1.5rem',
            borderRadius: '0.625rem',
            fontWeight: 600,
            fontSize: '0.875rem',
            border: 'none',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.8 : 1,
            transition: 'background-color 0.15s',
          }}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>

        {saved && (
          <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: '#4ade80' }}>
            <svg style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            Changes saved
          </span>
        )}

        {saveError && (
          <span className="text-sm" style={{ color: '#f87171' }}>{saveError}</span>
        )}
      </div>

      {/* Change Password */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 mb-6">
        <h2 className="text-base font-semibold text-white mb-4">Change Password</h2>
        <div className="space-y-3 max-w-md">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              placeholder="Enter current password"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              placeholder="Repeat new password"
            />
          </div>
          <div className="flex items-center gap-4 pt-1">
            <button
              onClick={handlePasswordChange}
              disabled={pwLoading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {pwLoading ? 'Updating…' : 'Update Password'}
            </button>
            {pwSaved && (
              <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: '#4ade80' }}>
                <svg style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Password updated
              </span>
            )}
            {pwError && (
              <span className="text-sm" style={{ color: '#f87171' }}>{pwError}</span>
            )}
          </div>
        </div>
      </div>

      {/* Data & Privacy */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 mb-8">
        <h2 className="text-base font-semibold text-white mb-1">Data & Privacy</h2>
        <p className="text-sm text-slate-400 mb-4">Export or delete your account data</p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleDataExport}
            disabled={exportingData}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exportingData ? 'Preparing…' : 'Download My Data'}
          </button>
        </div>
      </div>
    </div>
  )
}
