import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import adminApi from '../adminApi.js'

const fmt = (cents) => '$' + (Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function fmtDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return '—'
  }
}

function StatCard({ label, value, accent }) {
  return (
    <div className="rounded-xl ring-1 ring-slate-700/50 p-4" style={{ backgroundColor: '#1e293b', borderLeft: `3px solid ${accent}` }}>
      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#94a3b8' }}>{label}</p>
      <p className="text-xl font-bold text-white">{value || '—'}</p>
    </div>
  )
}

const FILTERS = ['All', 'Income', 'Expense']

export default function AdminUserDetail() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [txTotal, setTxTotal] = useState(0)
  const [txPage, setTxPage] = useState(0)
  const [txFilter, setTxFilter] = useState('All')
  const [loading, setLoading] = useState(true)
  const [txLoading, setTxLoading] = useState(false)
  const [suspendLoading, setSuspendLoading] = useState(false)
  const [error, setError] = useState(null)
  const PER_PAGE = 20

  useEffect(() => {
    async function fetchUser() {
      setLoading(true)
      setError(null)
      try {
        const res = await adminApi.get(`/users/${userId}`)
        setUser(res.data?.data || res.data)
      } catch {
        setError('Failed to load user.')
      } finally {
        setLoading(false)
      }
    }
    fetchUser()
  }, [userId])

  useEffect(() => {
    fetchTransactions()
  }, [userId, txPage, txFilter])

  async function fetchTransactions() {
    setTxLoading(true)
    try {
      const params = { page: txPage, per_page: PER_PAGE }
      if (txFilter === 'Income') params.is_income = true
      if (txFilter === 'Expense') params.is_income = false
      const res = await adminApi.get(`/users/${userId}/transactions`, { params })
      setTransactions(res.data?.data || res.data || [])
      setTxTotal(res.data?.total || 0)
    } catch {
      // ignore
    } finally {
      setTxLoading(false)
    }
  }

  async function handleSuspend() {
    setSuspendLoading(true)
    try {
      await adminApi.patch(`/users/${userId}/suspend`)
      setUser((prev) => ({
        ...prev,
        profile: { ...prev.profile, is_suspended: !prev.profile?.is_suspended },
      }))
    } catch {
      // ignore
    } finally {
      setSuspendLoading(false)
    }
  }

  const isSuspended = user?.profile?.is_suspended
  const txPages = Math.ceil(txTotal / PER_PAGE)

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-8 w-48 rounded-xl bg-slate-700/40" />
        <div className="h-32 rounded-xl bg-slate-700/40" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-slate-700/40" />)}
        </div>
      </div>
    )
  }

  if (error) {
    return <div className="rounded-xl p-5 border border-red-500/30 bg-red-500/10 text-red-400 text-sm">{error}</div>
  }

  const stats = user?.stats || {}
  const profile = user?.profile || {}

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/admin/users')}
        className="flex items-center gap-2 text-sm transition-colors"
        style={{ color: '#94a3b8' }}
        onMouseEnter={(e) => e.currentTarget.style.color = '#f8fafc'}
        onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Users
      </button>

      {/* Header */}
      <div className="rounded-xl ring-1 ring-slate-700/50 p-6" style={{ backgroundColor: '#1e293b' }}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
              style={{ backgroundColor: '#6366f1' }}
            >
              {(user?.email?.[0] || 'U').toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-white">{user?.name || 'Unknown User'}</h1>
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={isSuspended
                    ? { backgroundColor: '#ef444420', color: '#fca5a5' }
                    : { backgroundColor: '#22c55e20', color: '#4ade80' }
                  }
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isSuspended ? '#ef4444' : '#22c55e' }} />
                  {isSuspended ? 'Suspended' : 'Active'}
                </span>
              </div>
              <p className="text-sm mt-0.5" style={{ color: '#94a3b8' }}>{user?.email}</p>
              <p className="text-xs mt-1" style={{ color: '#64748b' }}>
                Joined {fmtDate(user?.created_at)} &middot; Last active {fmtDate(user?.last_active_at)}
              </p>
            </div>
          </div>
          <button
            onClick={handleSuspend}
            disabled={suspendLoading}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
            style={isSuspended
              ? { backgroundColor: '#22c55e20', color: '#4ade80' }
              : { backgroundColor: '#ef444420', color: '#fca5a5' }
            }
          >
            {suspendLoading ? '...' : isSuspended ? 'Unsuspend User' : 'Suspend User'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Transactions" value={stats.transaction_count?.toLocaleString()} accent="#6366f1" />
        <StatCard label="Total Income" value={stats.total_income_cents != null ? fmt(stats.total_income_cents) : null} accent="#22c55e" />
        <StatCard label="Total Expenses" value={stats.total_expense_cents != null ? fmt(stats.total_expense_cents) : null} accent="#ef4444" />
        <StatCard label="Avg Transaction" value={stats.avg_transaction_cents != null ? fmt(stats.avg_transaction_cents) : null} accent="#f59e0b" />
        <StatCard label="Top Category" value={stats.top_category} accent="#94a3b8" />
        <StatCard label="Streak Days" value={stats.streak_days_active != null ? `${stats.streak_days_active} days` : null} accent="#22c55e" />
      </div>

      {/* Profile */}
      <div className="rounded-xl ring-1 ring-slate-700/50 p-5" style={{ backgroundColor: '#1e293b' }}>
        <h2 className="text-sm font-semibold text-white mb-4">Profile Details</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: 'Country', value: profile.country },
            { label: 'Currency', value: profile.currency },
            { label: 'Income Bracket', value: profile.income_bracket },
            { label: 'Financial Goal', value: profile.financial_goal },
            { label: 'Occupation', value: profile.occupation },
            { label: 'Suspended At', value: profile.suspended_at ? fmtDate(profile.suspended_at) : '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#64748b' }}>{label}</p>
              <p className="text-sm text-white">{value || '—'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Transactions */}
      <div className="rounded-xl ring-1 ring-slate-700/50" style={{ backgroundColor: '#1e293b' }}>
        <div className="px-5 pt-5 pb-4 border-b flex items-center justify-between" style={{ borderColor: '#334155' }}>
          <div>
            <h2 className="text-sm font-semibold text-white">Transactions</h2>
            <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>{txTotal} total</p>
          </div>
          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => { setTxFilter(f); setTxPage(0) }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={txFilter === f
                  ? { backgroundColor: '#6366f1', color: '#fff' }
                  : { backgroundColor: 'transparent', color: '#94a3b8' }
                }
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {txLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: '#334155' }}>
                  {['Date', 'Description', 'Amount', 'Category', 'Method', 'Source', 'Anomaly'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-sm" style={{ color: '#64748b' }}>No transactions found.</td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#94a3b8' }}>
                        {fmtDate(tx.date)}
                      </td>
                      <td className="px-4 py-3 text-white max-w-[180px] truncate">{tx.description || '—'}</td>
                      <td className="px-4 py-3 text-xs font-semibold whitespace-nowrap" style={{ color: tx.is_income ? '#22c55e' : '#ef4444' }}>
                        {tx.is_income ? '+' : '-'}{fmt(tx.amount_cents)}
                      </td>
                      <td className="px-4 py-3">
                        {tx.category_name ? (
                          <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full" style={{ backgroundColor: '#0f172a', color: '#94a3b8' }}>
                            {tx.category_color && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tx.category_color }} />}
                            {tx.category_name}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#94a3b8' }}>{tx.payment_method || '—'}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#94a3b8' }}>{tx.source || '—'}</td>
                      <td className="px-4 py-3">
                        {tx.is_anomaly && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#f59e0b20', color: '#fbbf24' }}>
                            Anomaly
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {!txLoading && txPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: '#334155' }}>
            <p className="text-xs" style={{ color: '#64748b' }}>Page {txPage + 1} of {txPages}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setTxPage((p) => Math.max(0, p - 1))}
                disabled={txPage === 0}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40"
                style={{ borderColor: '#334155', color: '#94a3b8', backgroundColor: 'transparent' }}
              >
                Prev
              </button>
              <button
                onClick={() => setTxPage((p) => Math.min(txPages - 1, p + 1))}
                disabled={txPage >= txPages - 1}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40"
                style={{ borderColor: '#334155', color: '#94a3b8', backgroundColor: 'transparent' }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
