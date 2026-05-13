import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { getCashflow, getBudgetStatus, getTransactions } from '../api/index.js'
import CurrencyAmount from '../components/CurrencyAmount.jsx'

function SkeletonBlock({ className = '' }) {
  return (
    <div className={`animate-pulse rounded-xl bg-slate-700/40 ${className}`} />
  )
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl px-4 py-3 shadow-2xl border text-sm"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}>
        <p className="font-semibold mb-2 text-white">{label}</p>
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 mb-0.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span style={{ color: '#94a3b8' }}>{entry.name}:</span>
            <span className="font-medium" style={{ color: entry.color }}>
              ${(entry.value / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

function KpiCard({ label, value, accent, icon, trend }) {
  return (
    <div
      className="rounded-2xl border shadow-sm relative overflow-hidden"
      style={{ backgroundColor: '#1e293b', borderColor: '#334155', borderLeft: `4px solid ${accent}` }}
    >
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#94a3b8' }}>{label}</p>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${accent}18` }}
          >
            <span style={{ color: accent }}>{icon}</span>
          </div>
        </div>
        <div className="text-2xl font-bold text-white mb-1">{value}</div>
        {trend && (
          <p className="text-xs flex items-center gap-1" style={{ color: '#64748b' }}>
            {trend}
          </p>
        )}
      </div>
    </div>
  )
}

function CategoryBadge({ color, name }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ backgroundColor: '#0f172a', color: '#94a3b8' }}
    >
      {color && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />}
      {name}
    </span>
  )
}

export default function Dashboard() {
  const [cashflow, setCashflow] = useState([])
  const [budget, setBudget] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [cfRes, budRes, txRes] = await Promise.all([
          getCashflow(6),
          getBudgetStatus(),
          getTransactions({ limit: 5, skip: 0 })
        ])
        setCashflow(cfRes.data?.data || cfRes.data || [])
        setBudget(budRes.data?.data || budRes.data || [])
        setTransactions(txRes.data?.data || txRes.data || [])
      } catch {
        setError('Failed to load dashboard data.')
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  const totalIncome = cashflow.reduce((s, m) => s + (m.income_cents || 0), 0)
  const totalExpenses = cashflow.reduce((s, m) => s + (m.expense_cents || 0), 0)
  const netSavings = totalIncome - totalExpenses
  const categoryCount = budget.length

  const chartData = cashflow.map((m) => ({
    month: m.month ? `${MONTH_NAMES[m.month - 1]} '${String(m.year).slice(2)}` : '',
    Income: m.income_cents || 0,
    Expenses: m.expense_cents || 0
  }))

  const getBudgetBarColor = (spent, limit) => {
    if (!limit) return '#6366f1'
    const pct = (spent / limit) * 100
    if (pct >= 90) return '#ef4444'
    if (pct >= 70) return '#f59e0b'
    return '#22c55e'
  }

  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <SkeletonBlock className="h-8 w-56 mb-2" />
          <SkeletonBlock className="h-4 w-80" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <SkeletonBlock key={i} className="h-32" />)}
        </div>
        <SkeletonBlock className="h-80" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3"><SkeletonBlock className="h-72" /></div>
          <div className="lg:col-span-2"><SkeletonBlock className="h-72" /></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl p-6 border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          {greeting} <span>👋</span>
        </h1>
        <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>{todayStr}</p>
      </div>

      {/* 4 KPI stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Income (6mo)"
          value={<CurrencyAmount cents={totalIncome} />}
          accent="#22c55e"
          trend={
            <span className="flex items-center gap-1" style={{ color: '#22c55e' }}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              Last 6 months
            </span>
          }
          icon={
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: 18, height: 18 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 11l5-5m0 0l5 5m-5-5v12" />
            </svg>
          }
        />
        <KpiCard
          label="Total Expenses (6mo)"
          value={<CurrencyAmount cents={-totalExpenses} />}
          accent="#ef4444"
          trend={
            <span className="flex items-center gap-1" style={{ color: '#ef4444' }}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              Last 6 months
            </span>
          }
          icon={
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: 18, height: 18 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 13l-5 5m0 0l-5-5m5 5V6" />
            </svg>
          }
        />
        <KpiCard
          label="Net Savings (6mo)"
          value={<CurrencyAmount cents={netSavings} />}
          accent="#6366f1"
          trend={
            <span style={{ color: '#64748b' }}>Income minus expenses</span>
          }
          icon={
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: 18, height: 18 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          }
        />
        <KpiCard
          label="Categories"
          value={<span className="text-white">{categoryCount}</span>}
          accent="#64748b"
          trend={
            <span style={{ color: '#64748b' }}>Active budget categories</span>
          }
          icon={
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: 18, height: 18 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          }
        />
      </div>

      {/* Cash Flow Chart */}
      <div className="rounded-2xl border shadow-sm" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        <div className="px-6 pt-5 pb-4 border-b" style={{ borderColor: '#334155' }}>
          <h2 className="text-base font-semibold text-white">Cash Flow</h2>
          <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>Income vs. expenses over the last 6 months</p>
        </div>
        <div className="p-6">
          {chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16" style={{ color: '#64748b' }}>
              <svg className="w-10 h-10 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-sm">No cash flow data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#64748b', fontSize: 12, fontFamily: 'Inter' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'Inter' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${(v / 100).toLocaleString('en-US', { notation: 'compact' })}`}
                  width={60}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.05)' }} />
                <Bar dataKey="Income" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {/* Legend */}
          {chartData.length > 0 && (
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
          )}
        </div>
      </div>

      {/* Two-column grid: Recent Transactions + Budget Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Recent Transactions — col-span-3 */}
        <div className="lg:col-span-3 rounded-2xl border shadow-sm" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <div className="px-6 pt-5 pb-4 border-b flex items-center justify-between" style={{ borderColor: '#334155' }}>
            <div>
              <h2 className="text-base font-semibold text-white">Recent Transactions</h2>
              <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>Latest activity</p>
            </div>
          </div>
          <div className="p-2">
            {transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12" style={{ color: '#64748b' }}>
                <svg className="w-9 h-9 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-sm">No recent transactions</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Date</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Description</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Category</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="border-t transition-colors hover:bg-slate-800/50"
                      style={{ borderColor: '#334155' }}
                    >
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#64748b' }}>
                        {tx.date ? new Date(tx.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                      </td>
                      <td className="px-4 py-3 font-medium text-white max-w-[160px] truncate">
                        {tx.description}
                      </td>
                      <td className="px-4 py-3">
                        {tx.category_name ? (
                          <CategoryBadge color={tx.category_color} name={tx.category_name} />
                        ) : (
                          <span style={{ color: '#64748b' }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <CurrencyAmount
                          cents={tx.is_income ? tx.amount_cents : -Math.abs(tx.amount_cents || 0)}
                          className="text-sm font-semibold"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Budget Overview — col-span-2 */}
        <div className="lg:col-span-2 rounded-2xl border shadow-sm" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <div className="px-6 pt-5 pb-4 border-b" style={{ borderColor: '#334155' }}>
            <h2 className="text-base font-semibold text-white">Budget Overview</h2>
            <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>Monthly spending limits</p>
          </div>
          <div className="p-6">
            {budget.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10" style={{ color: '#64748b' }}>
                <svg className="w-9 h-9 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                </svg>
                <p className="text-sm">No budget data available</p>
              </div>
            ) : (
              <div className="space-y-5">
                {budget.map((cat) => {
                  const spent = cat.spent_cents || 0
                  const limit = cat.budget_cents || 1
                  const pct = Math.min((spent / limit) * 100, 100)
                  const barColor = getBudgetBarColor(spent, limit)
                  return (
                    <div key={cat.category_id || cat.name}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          {cat.color && (
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                          )}
                          <span className="text-sm font-medium text-white">{cat.name}</span>
                        </div>
                        <span className="text-xs font-medium" style={{ color: barColor }}>
                          {pct.toFixed(0)}% used
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ backgroundColor: '#0f172a' }}>
                        <div
                          className="h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: barColor }}
                        />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-xs" style={{ color: '#64748b' }}>
                          <CurrencyAmount cents={spent} className="text-xs" /> spent
                        </span>
                        <span className="text-xs" style={{ color: '#64748b' }}>
                          of <CurrencyAmount cents={cat.budget_cents || 0} className="text-xs" />
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
