import { useState, useEffect } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ComposedChart, Line, Legend
} from 'recharts'
import adminApi from '../adminApi.js'

const fmt = (cents) => '$' + (Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function fmtDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return '—' }
}

function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-5">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {subtitle && <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>{subtitle}</p>}
    </div>
  )
}

function CustomPieTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const d = payload[0]
    return (
      <div className="rounded-xl px-4 py-3 border text-sm" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        <p className="font-semibold text-white mb-1">{d.name}</p>
        <p style={{ color: '#94a3b8' }}>Total: <span className="text-white font-medium">{fmt(d.value)}</span></p>
        <p style={{ color: '#94a3b8' }}>Users: <span className="text-white font-medium">{d.payload.user_count}</span></p>
      </div>
    )
  }
  return null
}

function CustomBarTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl px-4 py-3 border text-sm" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        <p className="font-semibold text-white mb-1">{label}</p>
        {payload.map((p) => (
          <p key={p.dataKey} style={{ color: '#94a3b8' }}>
            {p.name}: <span className="text-white font-medium">{p.value?.toLocaleString()}</span>
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function AdminAnalytics() {
  const [categories, setCategories] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [anomalies, setAnomalies] = useState([])
  const [trends, setTrends] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [anomalyPage, setAnomalyPage] = useState(0)
  const ANOMALY_PAGE_SIZE = 20

  useEffect(() => {
    async function fetchAll() {
      try {
        const [catRes, pmRes, anomRes, trRes] = await Promise.all([
          adminApi.get('/analytics/categories'),
          adminApi.get('/analytics/payment-methods'),
          adminApi.get('/analytics/anomalies'),
          adminApi.get('/analytics/trends?months=12'),
        ])
        setCategories(catRes.data?.data || catRes.data || [])
        setPaymentMethods(pmRes.data?.data || pmRes.data || [])
        setAnomalies(anomRes.data?.data || anomRes.data || [])
        setTrends(trRes.data?.data || trRes.data || [])
      } catch {
        setError('Failed to load analytics data.')
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-8 w-48 rounded-xl bg-slate-700/40" />
        {[...Array(4)].map((_, i) => <div key={i} className="h-80 rounded-xl bg-slate-700/40" />)}
      </div>
    )
  }

  if (error) {
    return <div className="rounded-xl p-5 border border-red-500/30 bg-red-500/10 text-red-400 text-sm">{error}</div>
  }

  const trendChartData = trends.map((t) => ({
    month: t.month,
    Transactions: t.transaction_count,
    Users: t.unique_users,
  }))

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>Platform-wide spending and usage insights</p>
      </div>

      {/* 1. Category Distribution */}
      <section>
        <SectionHeader title="Category Distribution" subtitle="Spending breakdown by category across all users" />
        <div className="rounded-xl ring-1 ring-slate-700/50 p-5" style={{ backgroundColor: '#1e293b' }}>
          {categories.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: '#64748b' }}>No category data.</p>
          ) : (
            <>
              <div className="flex flex-col lg:flex-row gap-6 items-start">
                <div className="flex-1 min-w-0">
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={categories}
                        dataKey="total_cents"
                        nameKey="category_name"
                        cx="50%"
                        cy="50%"
                        outerRadius={110}
                        innerRadius={55}
                      >
                        {categories.map((cat, i) => (
                          <Cell key={i} fill={cat.color || `hsl(${i * 37}, 70%, 60%)`} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full lg:w-52 flex-shrink-0">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#64748b' }}>Legend</p>
                  <div className="space-y-2">
                    {categories.map((cat, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color || `hsl(${i * 37}, 70%, 60%)` }} />
                        <span className="text-sm text-white truncate">{cat.category_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: '#334155' }}>
                      {['#', 'Category', 'Total Spent', 'Users', 'Transactions'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {categories.map((cat, i) => (
                      <tr key={i} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 text-xs" style={{ color: '#64748b' }}>{i + 1}</td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color || '#6366f1' }} />
                            <span className="text-sm text-white">{cat.category_name}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium" style={{ color: '#ef4444' }}>{fmt(cat.total_cents)}</td>
                        <td className="px-4 py-3 text-sm text-white">{cat.user_count?.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-white">{cat.transaction_count?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>

      {/* 2. Payment Methods */}
      <section>
        <SectionHeader title="Payment Methods" subtitle="Transaction count by payment method" />
        <div className="rounded-xl ring-1 ring-slate-700/50 p-5" style={{ backgroundColor: '#1e293b' }}>
          {paymentMethods.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: '#64748b' }}>No payment method data.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={paymentMethods} layout="vertical" margin={{ top: 4, right: 20, left: 80, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="method"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={80}
                />
                <Tooltip content={<CustomBarTooltip />} />
                <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} maxBarSize={28} name="Count" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* 3. Anomalous Transactions */}
      <section>
        <SectionHeader title="Anomalous Transactions" subtitle="Flagged transactions detected across the platform" />
        <div className="rounded-xl ring-1 ring-slate-700/50 overflow-hidden" style={{ backgroundColor: '#1e293b' }}>
          {anomalies.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: '#64748b' }}>No anomalies detected.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: '#334155' }}>
                      {['User Email', 'Date', 'Description', 'Amount', 'Flag'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {anomalies.slice(anomalyPage * ANOMALY_PAGE_SIZE, (anomalyPage + 1) * ANOMALY_PAGE_SIZE).map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 text-sm text-white">{tx.user_email}</td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#94a3b8' }}>{fmtDate(tx.date)}</td>
                        <td className="px-4 py-3 text-sm max-w-[200px] truncate" style={{ color: '#94a3b8' }}>{tx.description || '—'}</td>
                        <td className="px-4 py-3 text-sm font-semibold whitespace-nowrap" style={{ color: tx.is_income ? '#22c55e' : '#ef4444' }}>
                          {tx.is_income ? '+' : '-'}{fmt(tx.amount_cents)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#f59e0b20', color: '#fbbf24' }}>
                            Anomaly
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {anomalies.length > ANOMALY_PAGE_SIZE && (
                <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: '#334155' }}>
                  <p className="text-xs" style={{ color: '#64748b' }}>
                    Page {anomalyPage + 1} of {Math.ceil(anomalies.length / ANOMALY_PAGE_SIZE)} &middot; {anomalies.length} total
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAnomalyPage((p) => Math.max(0, p - 1))}
                      disabled={anomalyPage === 0}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40"
                      style={{ borderColor: '#334155', color: '#94a3b8', backgroundColor: 'transparent' }}
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => setAnomalyPage((p) => Math.min(Math.ceil(anomalies.length / ANOMALY_PAGE_SIZE) - 1, p + 1))}
                      disabled={anomalyPage >= Math.ceil(anomalies.length / ANOMALY_PAGE_SIZE) - 1}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40"
                      style={{ borderColor: '#334155', color: '#94a3b8', backgroundColor: 'transparent' }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* 4. Platform Trends */}
      <section>
        <SectionHeader title="Platform Trends (12 Months)" subtitle="Transaction volume and unique active users over time" />
        <div className="rounded-xl ring-1 ring-slate-700/50 p-5" style={{ backgroundColor: '#1e293b' }}>
          {trends.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: '#64748b' }}>No trend data.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={trendChartData} margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={45} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={45} />
                <Tooltip content={<CustomBarTooltip />} />
                <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12, paddingTop: 8 }} />
                <Bar yAxisId="left" dataKey="Transactions" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={22} />
                <Line yAxisId="right" type="monotone" dataKey="Users" stroke="#22c55e" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
    </div>
  )
}
