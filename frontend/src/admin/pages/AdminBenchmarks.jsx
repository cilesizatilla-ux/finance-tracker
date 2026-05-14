import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import adminApi from '../adminApi.js'

const fmt = (cents) => '$' + (Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl px-4 py-3 border text-sm" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        <p className="font-semibold text-white mb-1">{label}</p>
        {payload.map((p) => (
          <p key={p.dataKey} style={{ color: '#94a3b8' }}>
            {p.name}: <span className="font-medium text-white">{fmt(p.value)}</span>
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function AdminBenchmarks() {
  const [benchmarks, setBenchmarks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchBenchmarks() {
      try {
        const res = await adminApi.get('/analytics/benchmarks')
        setBenchmarks(res.data?.data || res.data || [])
      } catch {
        setError('Failed to load benchmarks.')
      } finally {
        setLoading(false)
      }
    }
    fetchBenchmarks()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 rounded-xl bg-slate-700/40" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-20 rounded-xl bg-slate-700/40" />
          <div className="h-20 rounded-xl bg-slate-700/40" />
        </div>
        <div className="h-72 rounded-xl bg-slate-700/40" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-40 rounded-xl bg-slate-700/40" />)}
        </div>
      </div>
    )
  }

  if (error) {
    return <div className="rounded-xl p-5 border border-red-500/30 bg-red-500/10 text-red-400 text-sm">{error}</div>
  }

  const barData = benchmarks.map((b) => ({
    name: b.category_name,
    'Avg Monthly Spend': b.avg_monthly_spend_cents,
    color: b.color,
  }))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Benchmarks</h1>
        <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>Spending benchmarks per category across all users</p>
      </div>

      {/* Header cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl ring-1 ring-slate-700/50 p-5" style={{ backgroundColor: '#1e293b', borderLeft: '3px solid #6366f1' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#94a3b8' }}>Categories Analyzed</p>
          <p className="text-3xl font-bold text-white">{benchmarks.length}</p>
        </div>
        <div className="rounded-xl ring-1 ring-slate-700/50 p-5" style={{ backgroundColor: '#1e293b', borderLeft: '3px solid #f59e0b' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#94a3b8' }}>Date Range</p>
          <p className="text-lg font-bold text-white">Last 90 Days</p>
        </div>
      </div>

      {/* Bar chart: avg spend across categories */}
      <div className="rounded-xl ring-1 ring-slate-700/50 p-5" style={{ backgroundColor: '#1e293b' }}>
        <h2 className="text-sm font-semibold text-white mb-4">Average Monthly Spend by Category</h2>
        {benchmarks.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: '#64748b' }}>No benchmark data.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData} layout="vertical" margin={{ top: 4, right: 20, left: 120, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${(v / 100).toLocaleString('en-US', { notation: 'compact' })}`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={120}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Avg Monthly Spend" radius={[0, 4, 4, 0]} maxBarSize={24}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={entry.color || '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Per-category cards */}
      {benchmarks.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-white mb-4">Category Detail Cards</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {benchmarks.map((b, i) => {
              const p25 = b.p25_cents || 0
              const p75 = b.p75_cents || 0
              const max = Math.max(p75, b.avg_monthly_spend_cents || 0, 1)
              const p25Pct = (p25 / max) * 100
              const p75Pct = (p75 / max) * 100
              const avgPct = ((b.avg_monthly_spend_cents || 0) / max) * 100
              const medPct = ((b.median_cents || 0) / max) * 100
              const color = b.color || `hsl(${i * 37}, 70%, 60%)`

              return (
                <div key={i} className="rounded-xl ring-1 ring-slate-700/50 p-5" style={{ backgroundColor: '#1e293b' }}>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <h3 className="text-sm font-semibold text-white">{b.category_name}</h3>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#0f172a', color: '#94a3b8' }}>
                      {b.user_count} users
                    </span>
                  </div>

                  {/* Metrics grid */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: '#64748b' }}>Avg/Month</p>
                      <p className="text-sm font-bold text-white">{fmt(b.avg_monthly_spend_cents || 0)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: '#64748b' }}>Median</p>
                      <p className="text-sm font-bold text-white">{fmt(b.median_cents || 0)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: '#64748b' }}>P25–P75</p>
                      <p className="text-sm font-bold text-white">{fmt(p25)}–{fmt(p75)}</p>
                    </div>
                  </div>

                  {/* Visual range bar */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#64748b' }}>Distribution</p>
                    <div className="relative h-6 rounded-lg overflow-hidden" style={{ backgroundColor: '#0f172a' }}>
                      {/* P25-P75 range */}
                      <div
                        className="absolute top-1 bottom-1 rounded"
                        style={{
                          left: `${p25Pct}%`,
                          width: `${Math.max(p75Pct - p25Pct, 2)}%`,
                          backgroundColor: `${color}40`,
                          border: `1px solid ${color}60`,
                        }}
                      />
                      {/* Median marker */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5"
                        style={{ left: `${medPct}%`, backgroundColor: color }}
                      />
                      {/* Avg marker */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5"
                        style={{ left: `${avgPct}%`, backgroundColor: '#f59e0b' }}
                      />
                    </div>
                    <div className="flex items-center gap-4 mt-1.5">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-0.5 rounded" style={{ backgroundColor: color }} />
                        <span className="text-[10px]" style={{ color: '#64748b' }}>Median</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-0.5 rounded" style={{ backgroundColor: '#f59e0b' }} />
                        <span className="text-[10px]" style={{ color: '#64748b' }}>Avg</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: `${color}40`, border: `1px solid ${color}60` }} />
                        <span className="text-[10px]" style={{ color: '#64748b' }}>P25–P75</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
