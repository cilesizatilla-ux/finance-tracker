import { useState, useEffect } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import adminApi from '../adminApi.js'

const fmt = (cents) => '$' + (Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function StatCard({ label, value, icon, accent, sub }) {
  return (
    <div
      className="rounded-xl ring-1 p-5 relative overflow-hidden"
      style={{ backgroundColor: '#1e293b', ringColor: '#334155', borderLeft: `3px solid ${accent}` }}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>{label}</p>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accent}20` }}>
          <span style={{ color: accent }}>{icon}</span>
        </div>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <p className="text-xs mt-1" style={{ color: '#64748b' }}>{sub}</p>}
    </div>
  )
}

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl px-4 py-3 shadow-2xl border text-sm" style={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}>
        <p className="font-semibold mb-2 text-white">{label}</p>
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 mb-0.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span style={{ color: '#94a3b8' }}>{entry.name}:</span>
            <span className="font-medium" style={{ color: entry.color }}>
              {entry.name === 'Users' ? entry.value : fmt(entry.value)}
            </span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

const RECO_COLORS = {
  warning: { bg: '#f59e0b20', border: '#f59e0b50', text: '#fbbf24', icon: '#f59e0b' },
  info: { bg: '#6366f120', border: '#6366f150', text: '#818cf8', icon: '#6366f1' },
  success: { bg: '#22c55e20', border: '#22c55e50', text: '#4ade80', icon: '#22c55e' },
  error: { bg: '#ef444420', border: '#ef444450', text: '#fca5a5', icon: '#ef4444' },
}

export default function AdminDashboard() {
  const [overview, setOverview] = useState(null)
  const [trends, setTrends] = useState([])
  const [userGrowth, setUserGrowth] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchAll() {
      try {
        const [ovRes, trRes, ugRes, recoRes] = await Promise.all([
          adminApi.get('/analytics/overview'),
          adminApi.get('/analytics/trends?months=6'),
          adminApi.get('/analytics/user-growth'),
          adminApi.get('/analytics/recommendations'),
        ])
        setOverview(ovRes.data?.data || ovRes.data)
        setTrends(trRes.data?.data || trRes.data || [])
        setUserGrowth(ugRes.data?.data || ugRes.data || [])
        setRecommendations(recoRes.data?.data || recoRes.data || [])
      } catch {
        setError('Failed to load dashboard data.')
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 rounded-xl bg-slate-700/40" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-slate-700/40" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-72 rounded-xl bg-slate-700/40" />
          <div className="h-72 rounded-xl bg-slate-700/40" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl p-5 border border-red-500/30 bg-red-500/10 text-red-400 text-sm">{error}</div>
    )
  }

  const trendChartData = trends.map((t) => ({
    month: t.month,
    Income: t.income_cents,
    Expenses: t.expense_cents,
  }))

  const growthChartData = userGrowth.map((t) => ({
    month: t.month,
    Users: t.cumulative_users,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>Platform overview and key metrics</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Users"
          value={overview?.total_users?.toLocaleString() ?? '—'}
          accent="#6366f1"
          sub="Registered accounts"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <StatCard
          label="Active Users"
          value={overview?.active_users?.toLocaleString() ?? '—'}
          accent="#22c55e"
          sub="Last 30 days"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M12 9v3m0 0v3m0-3h3m-3 0H9" />
            </svg>
          }
        />
        <StatCard
          label="Suspended Users"
          value={overview?.suspended_users?.toLocaleString() ?? '—'}
          accent="#ef4444"
          sub="Restricted accounts"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          }
        />
        <StatCard
          label="Total Transactions"
          value={overview?.total_transactions?.toLocaleString() ?? '—'}
          accent="#f59e0b"
          sub="All time"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
        />
        <StatCard
          label="Total Income"
          value={overview?.total_income_cents != null ? fmt(overview.total_income_cents) : '—'}
          accent="#22c55e"
          sub="All platform income"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 11l5-5m0 0l5 5m-5-5v12" />
            </svg>
          }
        />
        <StatCard
          label="Total Expenses"
          value={overview?.total_expense_cents != null ? fmt(overview.total_expense_cents) : '—'}
          accent="#ef4444"
          sub="All platform expenses"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 13l-5 5m0 0l-5-5m5 5V6" />
            </svg>
          }
        />
        <StatCard
          label="New This Month"
          value={overview?.new_users_this_month?.toLocaleString() ?? '—'}
          accent="#6366f1"
          sub="New registrations"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          }
        />
        <StatCard
          label="Avg Tx / User"
          value={overview?.avg_transactions_per_user != null ? Number(overview.avg_transactions_per_user).toFixed(1) : '—'}
          accent="#94a3b8"
          sub="Average per user"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          }
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue/Expense Trend */}
        <div className="rounded-xl ring-1 ring-slate-700/50" style={{ backgroundColor: '#1e293b' }}>
          <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: '#334155' }}>
            <h2 className="text-sm font-semibold text-white">Revenue & Expense Trend</h2>
            <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>Last 6 months</p>
          </div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trendChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${(v / 100).toLocaleString('en-US', { notation: 'compact' })}`}
                  width={65}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="Income" stroke="#22c55e" strokeWidth={2} fill="url(#incomeGrad)" />
                <Area type="monotone" dataKey="Expenses" stroke="#ef4444" strokeWidth={2} fill="url(#expenseGrad)" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-5 mt-2 justify-center">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#22c55e' }} />
                <span className="text-xs" style={{ color: '#94a3b8' }}>Income</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#ef4444' }} />
                <span className="text-xs" style={{ color: '#94a3b8' }}>Expenses</span>
              </div>
            </div>
          </div>
        </div>

        {/* User Growth */}
        <div className="rounded-xl ring-1 ring-slate-700/50" style={{ backgroundColor: '#1e293b' }}>
          <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: '#334155' }}>
            <h2 className="text-sm font-semibold text-white">User Growth</h2>
            <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>Cumulative registered users</p>
          </div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={growthChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="usersGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={45}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="Users" stroke="#6366f1" strokeWidth={2} fill="url(#usersGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="rounded-xl ring-1 ring-slate-700/50 p-5" style={{ backgroundColor: '#1e293b' }}>
          <h2 className="text-sm font-semibold text-white mb-4">Platform Recommendations</h2>
          <div className="space-y-3">
            {recommendations.map((reco, i) => {
              const colors = RECO_COLORS[reco.type] || RECO_COLORS.info
              return (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-xl p-4 border"
                  style={{ backgroundColor: colors.bg, borderColor: colors.border }}
                >
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: `${colors.icon}30` }}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: colors.icon }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm" style={{ color: colors.text }}>{reco.message}</p>
                    {reco.count != null && (
                      <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>Affected: {reco.count}</p>
                    )}
                  </div>
                  <span
                    className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded flex-shrink-0"
                    style={{ backgroundColor: `${colors.icon}20`, color: colors.icon }}
                  >
                    {reco.type}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
