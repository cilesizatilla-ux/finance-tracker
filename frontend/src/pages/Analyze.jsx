import { useState, useEffect } from 'react'
import { runAnalysis, getStatus } from '../api/index.js'
import CurrencyAmount from '../components/CurrencyAmount.jsx'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function GradeRing({ grade, score }) {
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#6366f1' : score >= 40 ? '#f59e0b' : '#ef4444'
  const r = 54, c = 2 * Math.PI * r
  const dash = (score / 100) * c

  return (
    <div className="relative flex items-center justify-center" style={{ width: 148, height: 148 }}>
      <svg width="148" height="148" className="-rotate-90">
        <circle cx="74" cy="74" r={r} fill="none" stroke="#1e293b" strokeWidth="12" />
        <circle
          cx="74" cy="74" r={r} fill="none"
          stroke={color} strokeWidth="12"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-4xl font-bold text-white">{grade}</span>
        <span className="text-xs mt-0.5" style={{ color: '#64748b' }}>{score}/100</span>
      </div>
    </div>
  )
}

function PriorityBadge({ priority }) {
  const styles = {
    high: 'bg-red-500/15 text-red-400 border-red-500/20',
    medium: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    low: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border uppercase tracking-wide ${styles[priority] || styles.low}`}>
      {priority}
    </span>
  )
}

export default function Analyze() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [aiConfigured, setAiConfigured] = useState(true)
  const [cachedAt, setCachedAt] = useState(null)
  const [justRan, setJustRan] = useState(false)

  useEffect(() => {
    getStatus().then(r => setAiConfigured(r.data?.ai_configured !== false)).catch(() => {})
    const cached = localStorage.getItem('ft_last_analysis')
    if (cached) {
      try {
        const { result: r, timestamp: ts } = JSON.parse(cached)
        setResult(r)
        setCachedAt(ts)
      } catch {}
    }
  }, [])

  const handleAnalyze = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await runAnalysis()
      const analysisResult = res.data?.data || res.data
      setResult(analysisResult)
      setJustRan(true)
      setCachedAt(Date.now())
      localStorage.setItem('ft_last_analysis', JSON.stringify({ result: analysisResult, timestamp: Date.now() }))
    } catch (err) {
      setError(err.response?.data?.detail || 'Analysis failed. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }

  const scoreColor = result
    ? result.health_score >= 80 ? '#22c55e'
    : result.health_score >= 60 ? '#6366f1'
    : result.health_score >= 40 ? '#f59e0b'
    : '#ef4444'
    : '#6366f1'

  return (
    <div className="space-y-6">
      {/* API key banner */}
      {!aiConfigured && (
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-xl border text-sm"
          style={{ backgroundColor: '#f59e0b10', borderColor: '#f59e0b30', color: '#fbbf24' }}
        >
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <span>
            <strong>AI not configured.</strong> Add your <code className="px-1 rounded" style={{ backgroundColor: '#f59e0b20' }}>ANTHROPIC_API_KEY</code> to <code className="px-1 rounded" style={{ backgroundColor: '#f59e0b20' }}>.env</code> and restart the backend. Analysis will run in demo mode until then.
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Financial Analysis</h1>
          <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>
            AI-powered health check of your finances
          </p>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 shadow-lg shadow-indigo-500/20"
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Analyzing…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Run Analysis
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl p-4 border border-red-500/20 bg-red-500/10 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <div
          className="rounded-2xl border p-16 flex flex-col items-center justify-center text-center"
          style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 border"
            style={{ backgroundColor: '#6366f115', borderColor: '#6366f130' }}>
            <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Ready to analyze</h2>
          <p className="text-sm max-w-sm" style={{ color: '#64748b' }}>
            Click <strong className="text-white">Run Analysis</strong> to get an AI-powered health check of your spending, budget adherence, and financial trends.
          </p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border p-6 animate-pulse" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
              <div className="h-4 w-40 rounded bg-slate-700/50 mb-3" />
              <div className="h-3 w-full rounded bg-slate-700/50 mb-2" />
              <div className="h-3 w-3/4 rounded bg-slate-700/50" />
            </div>
          ))}
        </div>
      )}

      {/* Cached analysis banner */}
      {cachedAt && !justRan && result && !loading && (
        <div style={{ color: '#64748b', fontSize: 12, marginBottom: 12 }}>
          Last analyzed: {new Date(cachedAt).toLocaleString()} —{' '}
          <button onClick={handleAnalyze} style={{ color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>Re-run</button>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-5">
          {/* Top row: grade ring + summary + quick stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Health score */}
            <div
              className="rounded-2xl border p-6 flex flex-col items-center justify-center text-center"
              style={{ backgroundColor: '#1e293b', borderColor: '#334155', borderTop: `3px solid ${scoreColor}` }}
            >
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#64748b' }}>Health Score</p>
              <GradeRing grade={result.grade} score={result.health_score} />
              <p className="text-sm mt-4" style={{ color: '#94a3b8' }}>{result.summary}</p>
            </div>

            {/* Quick stats */}
            <div className="lg:col-span-2 grid grid-cols-2 gap-4">
              {[
                {
                  label: 'Income This Month',
                  value: <CurrencyAmount cents={result.snapshot?.current_month?.income_cents || 0} />,
                  accent: '#22c55e',
                  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                },
                {
                  label: 'Expenses This Month',
                  value: <CurrencyAmount cents={-(result.snapshot?.current_month?.expense_cents || 0)} />,
                  accent: '#ef4444',
                  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                },
                {
                  label: 'Net This Month',
                  value: <CurrencyAmount cents={result.snapshot?.current_month?.net_cents || 0} />,
                  accent: '#6366f1',
                  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                },
                {
                  label: 'Savings Rate',
                  value: result.savings_rate_pct != null ? `${result.savings_rate_pct.toFixed(1)}%` : '—',
                  accent: '#f59e0b',
                  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                },
              ].map(({ label, value, accent, icon }) => (
                <div key={label}
                  className="rounded-2xl border p-4"
                  style={{ backgroundColor: '#1e293b', borderColor: '#334155', borderLeft: `4px solid ${accent}` }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#64748b' }}>{label}</p>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${accent}18` }}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke={accent} viewBox="0 0 24 24">{icon}</svg>
                    </div>
                  </div>
                  <div className="text-xl font-bold text-white">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Strengths + Warnings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-2xl border p-5" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-white">Strengths</h3>
              </div>
              <ul className="space-y-2.5">
                {(result.strengths || []).map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: '#94a3b8' }}>
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border p-5" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-lg bg-amber-500/15 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-white">Warnings</h3>
              </div>
              <ul className="space-y-2.5">
                {(result.warnings || []).map((w, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: '#94a3b8' }}>
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Recommendations */}
          <div className="rounded-2xl border p-5" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
            <h3 className="text-sm font-semibold text-white mb-4">Recommendations</h3>
            <div className="space-y-3">
              {(result.recommendations || []).map((rec, i) => (
                <div key={i} className="flex items-start gap-4 p-4 rounded-xl" style={{ backgroundColor: '#0f172a' }}>
                  <div className="w-7 h-7 rounded-lg bg-indigo-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-indigo-400">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-white">{rec.title}</span>
                      <PriorityBadge priority={rec.priority} />
                    </div>
                    <p className="text-sm" style={{ color: '#94a3b8' }}>{rec.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Category breakdown */}
          {result.snapshot?.category_spending?.length > 0 && (
            <div className="rounded-2xl border p-5" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
              <h3 className="text-sm font-semibold text-white mb-4">Category Breakdown — This Month</h3>
              <div className="space-y-3">
                {result.snapshot.category_spending
                  .filter(c => c.spent_cents > 0)
                  .sort((a, b) => b.spent_cents - a.spent_cents)
                  .map((cat) => {
                    const pct = cat.budget_cents > 0 ? Math.min((cat.spent_cents / cat.budget_cents) * 100, 100) : 0
                    const barColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : cat.color || '#6366f1'
                    return (
                      <div key={cat.category}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color || '#6366f1' }} />
                            <span className="text-sm font-medium text-white">{cat.category}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs" style={{ color: '#64748b' }}>
                            <CurrencyAmount cents={cat.spent_cents} className="text-xs" />
                            {cat.budget_cents > 0 && (
                              <span>of <CurrencyAmount cents={cat.budget_cents} className="text-xs" /></span>
                            )}
                          </div>
                        </div>
                        {cat.budget_cents > 0 && (
                          <div className="h-1.5 rounded-full bg-slate-700">
                            <div className="h-1.5 rounded-full transition-all duration-700"
                              style={{ width: `${pct}%`, backgroundColor: barColor }} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                {result.snapshot.category_spending.every(c => c.spent_cents === 0) && (
                  <p className="text-sm text-center py-4" style={{ color: '#64748b' }}>No spending recorded this month yet.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
