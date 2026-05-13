import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getSharedReport } from '../api/index.js'

function fmt(cents) {
  return (Math.abs(cents) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

export default function SharedReportView() {
  const { token } = useParams()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getSharedReport(token)
        setReport(res.data.data)
      } catch (err) {
        if (err.response?.status === 404) setError('This report link is invalid or has expired.')
        else setError('Failed to load report.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0f172a' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
          <p className="text-sm" style={{ color: '#64748b' }}>Loading report…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0f172a' }}>
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-white font-semibold">{error}</p>
          <p className="text-sm" style={{ color: '#64748b' }}>Ask the sender to share a new link.</p>
        </div>
      </div>
    )
  }

  // Backend shape: { month, year, user_name, summary: { income_cents, expense_cents, net_cents }, transactions: [...], category_breakdown: [...] }
  const { month, year, user_name, summary = {}, category_breakdown = [], transactions = [] } = report
  const { income_cents = 0, expense_cents = 0, net_cents = 0 } = summary

  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`
  const netPositive = net_cents >= 0

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0f172a' }}>
      {/* Top bar */}
      <header className="border-b px-6 py-4 flex items-center gap-3" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
          <svg className="text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <span className="font-bold text-white text-sm">FinanceTrack</span>
        <span className="ml-2 px-2 py-0.5 rounded-md text-xs font-medium border" style={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#94a3b8' }}>
          Shared Report
        </span>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-white">{monthLabel} Financial Report</h1>
          {user_name && (
            <p className="text-sm mt-1" style={{ color: '#64748b' }}>Shared by <span style={{ color: '#94a3b8' }}>{user_name}</span></p>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total Income', value: fmt(income_cents), color: '#22c55e', bg: '#052e16', border: '#14532d' },
            { label: 'Total Expenses', value: fmt(expense_cents), color: '#ef4444', bg: '#2d0a0a', border: '#7f1d1d' },
            {
              label: 'Net',
              value: fmt(net_cents),
              color: netPositive ? '#22c55e' : '#ef4444',
              bg: netPositive ? '#052e16' : '#2d0a0a',
              border: netPositive ? '#14532d' : '#7f1d1d'
            }
          ].map(card => (
            <div key={card.label} className="rounded-2xl border p-5" style={{ backgroundColor: card.bg, borderColor: card.border }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: card.color, opacity: 0.7 }}>{card.label}</p>
              <p className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Category breakdown (expenses) */}
        {category_breakdown.length > 0 && (
          <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
            <div className="px-5 py-3.5 border-b" style={{ borderColor: '#334155' }}>
              <h2 className="text-sm font-semibold text-white">Breakdown by Category</h2>
            </div>
            <div className="divide-y" style={{ borderColor: '#334155' }}>
              {category_breakdown.map((cat, i) => {
                const pct = expense_cents > 0
                  ? Math.min(100, Math.round((cat.spent_cents / expense_cents) * 100))
                  : 0
                return (
                  <div key={i} className="px-5 py-3 flex items-center gap-4">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color || '#6366f1' }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-white font-medium truncate">{cat.category}</span>
                        <span className="text-sm font-semibold ml-3 flex-shrink-0" style={{ color: '#ef4444' }}>
                          -{fmt(cat.spent_cents)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#334155' }}>
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: cat.color || '#6366f1' }} />
                      </div>
                    </div>
                    <span className="text-xs w-10 text-right flex-shrink-0" style={{ color: '#64748b' }}>{pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Transactions table */}
        {transactions.length > 0 && (
          <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
            <div className="px-5 py-3.5 border-b" style={{ borderColor: '#334155' }}>
              <h2 className="text-sm font-semibold text-white">Transactions ({transactions.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: '#334155' }}>
                    <th className="text-left px-5 py-3 text-xs font-semibold" style={{ color: '#64748b' }}>Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: '#64748b' }}>Description</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold hidden sm:table-cell" style={{ color: '#64748b' }}>Category</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold hidden md:table-cell" style={{ color: '#64748b' }}>Party</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: '#64748b' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-slate-700/20 transition-colors" style={{ borderColor: '#0f172a' }}>
                      <td className="px-5 py-3 text-xs whitespace-nowrap" style={{ color: '#64748b' }}>
                        {new Date(txn.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="text-white truncate">{txn.description}</p>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {txn.category_name
                          ? <span className="text-xs" style={{ color: '#94a3b8' }}>{txn.category_name}</span>
                          : <span style={{ color: '#475569' }}>—</span>
                        }
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs" style={{ color: '#94a3b8' }}>
                        {txn.party_name || <span style={{ color: '#475569' }}>—</span>}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold whitespace-nowrap" style={{ color: txn.is_income ? '#22c55e' : '#ef4444' }}>
                        {txn.is_income ? '+' : '-'}{fmt(txn.amount_cents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs pb-4" style={{ color: '#334155' }}>
          This is a read-only shared report · Powered by FinanceTrack
        </p>
      </div>
    </div>
  )
}
