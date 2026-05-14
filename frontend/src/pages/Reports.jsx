import { useState, useEffect, useCallback } from 'react'
import { shareReport, listShares, deleteShare, getCashflow, getTopCategories } from '../api/index.js'
import CurrencyAmount from '../components/CurrencyAmount.jsx'

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])
  const styles = type === 'error'
    ? 'bg-red-500/15 border-red-500/30 text-red-300'
    : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
  return (
    <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl border shadow-2xl text-sm font-medium ${styles}`}>
      {message}
    </div>
  )
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0"
      style={{
        backgroundColor: copied ? '#16a34a20' : '#6366f120',
        color: copied ? '#4ade80' : '#818cf8',
        border: `1px solid ${copied ? '#16a34a40' : '#6366f140'}`,
      }}
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy
        </>
      )}
    </button>
  )
}

export default function Reports() {
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [recipientEmail, setRecipientEmail] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generatedLink, setGeneratedLink] = useState(null)
  const [shares, setShares] = useState([])
  const [sharesLoading, setSharesLoading] = useState(true)
  const [monthStats, setMonthStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [topCats, setTopCats] = useState([])

  const showToast = (message, type = 'success') => setToast({ message, type })

  const fetchShares = useCallback(async () => {
    setSharesLoading(true)
    try {
      const res = await listShares()
      setShares(res.data?.data || res.data || [])
    } catch {
      // silently ignore
    } finally {
      setSharesLoading(false)
    }
  }, [])

  useEffect(() => { fetchShares() }, [fetchShares])

  // Fetch summary stats for the selected month
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setStatsLoading(true)
      setMonthStats(null)
      try {
        // Get cashflow for enough months to cover the selected month
        const monthsBack = (now.getFullYear() - selectedYear) * 12 + (now.getMonth() + 1 - selectedMonth) + 1
        const clampedMonths = Math.max(1, Math.min(monthsBack, 36))
        const res = await getCashflow(clampedMonths)
        const items = res.data?.data || res.data || []
        const found = items.find(i => i.month === selectedMonth && i.year === selectedYear)
        if (!cancelled) setMonthStats(found || { income_cents: 0, expense_cents: 0 })
      } catch {
        if (!cancelled) setMonthStats({ income_cents: 0, expense_cents: 0 })
      } finally {
        if (!cancelled) setStatsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedMonth, selectedYear])

  // Fetch top categories for the selected month
  useEffect(() => {
    const y = selectedYear
    const m = String(selectedMonth).padStart(2, '0')
    const lastDay = new Date(y, selectedMonth, 0).getDate()
    const startDate = `${y}-${m}-01`
    const endDate = `${y}-${m}-${lastDay}`
    getTopCategories({ start_date: startDate, end_date: endDate, limit: 8 })
      .then(r => setTopCats(r.data?.data || []))
      .catch(() => setTopCats([]))
  }, [selectedMonth, selectedYear])

  const handleGenerate = async () => {
    setGenerating(true)
    setGeneratedLink(null)
    try {
      const res = await shareReport({
        month: selectedMonth,
        year: selectedYear,
        recipient_email: recipientEmail.trim() || undefined,
      })
      const data = res.data?.data || res.data
      // Construct the share URL using the current origin (overrides hardcoded backend URL)
      const shareUrl = `${window.location.origin}/shared/${data.token}`
      setGeneratedLink({ ...data, share_url: shareUrl })
      showToast(data.email_sent ? 'Report shared via email!' : 'Share link generated!')
      fetchShares()
    } catch {
      showToast('Failed to generate share link.', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const handleDelete = async (id) => {
    setDeletingId(id)
    try {
      await deleteShare(id)
      setShares(prev => prev.filter(s => s.id !== id))
      showToast('Share link revoked.')
    } catch {
      showToast('Failed to revoke share.', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  const netCents = monthStats
    ? (monthStats.income_cents || 0) - (monthStats.expense_cents || 0)
    : 0

  // Build year options: current year ± 3
  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 2 + i).reverse()

  const selectBase = 'px-3 py-2 rounded-xl text-sm border outline-none transition-all focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500'
  const selectStyle = { backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports</h1>
          <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>Generate and share monthly financial summaries</p>
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 rounded-xl text-sm font-medium border flex items-center gap-2"
          style={{ borderColor: '#334155', color: '#94a3b8', backgroundColor: '#1e293b' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
          </svg>
          Print Report
        </button>
      </div>

      {/* Generator card */}
      <div className="rounded-2xl border shadow-sm" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        <div className="px-6 py-5 border-b" style={{ borderColor: '#334155' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-white">Generate Share Link</h2>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Month + year picker */}
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>Month</label>
              <select
                className={selectBase}
                style={selectStyle}
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
              >
                {MONTHS.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>Year</label>
              <select
                className={selectBase}
                style={selectStyle}
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {/* Mini stats for selected month */}
            {!statsLoading && monthStats && (
              <div className="flex items-center gap-4 ml-2 flex-wrap">
                <div className="text-center">
                  <p className="text-[10px] font-medium uppercase tracking-wider mb-0.5" style={{ color: '#64748b' }}>Income</p>
                  <CurrencyAmount cents={monthStats.income_cents || 0} className="text-sm font-semibold text-emerald-400" />
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-medium uppercase tracking-wider mb-0.5" style={{ color: '#64748b' }}>Expenses</p>
                  <CurrencyAmount cents={monthStats.expense_cents || 0} className="text-sm font-semibold text-red-400" />
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-medium uppercase tracking-wider mb-0.5" style={{ color: '#64748b' }}>Net</p>
                  <span className={`font-mono text-sm font-semibold ${netCents >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {netCents >= 0 ? '+' : '-'}${(Math.abs(netCents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Optional email */}
          <div className="max-w-sm">
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>
              Email to recipient <span style={{ color: '#475569' }}>(optional)</span>
            </label>
            <input
              type="email"
              placeholder="colleague@example.com"
              className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none transition-all focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
              style={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }}
              value={recipientEmail}
              onChange={e => setRecipientEmail(e.target.value)}
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-lg shadow-indigo-500/20 disabled:opacity-50"
          >
            {generating ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Generating…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Generate Share Link
              </>
            )}
          </button>

          {/* Generated link result */}
          {generatedLink && (
            <div
              className="rounded-xl border p-4 space-y-2"
              style={{ backgroundColor: '#0f172a', borderColor: '#6366f140' }}
            >
              <p className="text-xs font-medium" style={{ color: '#94a3b8' }}>
                Share link for {MONTHS[generatedLink.month - 1]} {generatedLink.year}
              </p>
              <div className="flex items-center gap-2">
                <code
                  className="flex-1 text-xs px-3 py-2 rounded-lg truncate"
                  style={{ backgroundColor: '#1e293b', color: '#818cf8' }}
                >
                  {generatedLink.share_url}
                </code>
                <CopyButton text={generatedLink.share_url} />
                <a
                  href={generatedLink.share_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0"
                  style={{ backgroundColor: '#334155', color: '#94a3b8' }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open
                </a>
              </div>
              {generatedLink.email_sent && (
                <p className="text-xs" style={{ color: '#4ade80' }}>
                  ✓ Email sent to {generatedLink.recipient_email}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Category breakdown chart */}
      {topCats.length > 0 && (
        <div className="rounded-2xl border p-6" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <h2 className="text-base font-semibold text-white mb-1">Spending by Category</h2>
          <p className="text-xs mb-5" style={{ color: '#64748b' }}>
            {MONTHS[selectedMonth - 1]} {selectedYear} — top expense categories
          </p>
          <div className="space-y-3">
            {(() => {
              const maxCents = Math.max(...topCats.map(c => c.total_cents || 0), 1)
              return topCats.map((cat, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color || '#6366f1' }} />
                      <span className="text-sm text-white">{cat.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-white">
                      ${((cat.total_cents || 0) / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="h-2 rounded-full" style={{ backgroundColor: '#334155' }}>
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${((cat.total_cents || 0) / maxCents) * 100}%`, backgroundColor: cat.color || '#6366f1' }}
                    />
                  </div>
                </div>
              ))
            })()}
          </div>
        </div>
      )}

      {/* Previous shares */}
      <div className="rounded-2xl border shadow-sm" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        <div className="px-6 py-5 border-b" style={{ borderColor: '#334155' }}>
          <h2 className="text-sm font-semibold text-white">Shared Links</h2>
          <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>Previously generated report links</p>
        </div>

        <div className="divide-y" style={{ borderColor: '#1e293b' }}>
          {sharesLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="h-4 w-28 rounded-lg" style={{ backgroundColor: '#334155' }} />
                  <div className="flex-1 h-4 rounded-lg" style={{ backgroundColor: '#334155' }} />
                  <div className="h-7 w-16 rounded-lg" style={{ backgroundColor: '#334155' }} />
                </div>
              ))}
            </div>
          ) : shares.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12" style={{ color: '#64748b' }}>
              <svg className="w-9 h-9 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <p className="text-sm font-medium">No shared reports yet</p>
              <p className="text-xs mt-1" style={{ color: '#475569' }}>Generate your first share link above</p>
            </div>
          ) : (
            shares.map((share) => {
              const shareUrl = `${window.location.origin}/shared/${share.token}`
              const createdDate = new Date(share.created_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
              })
              return (
                <div key={share.id} className="flex items-center gap-3 px-6 py-4">
                  {/* Month badge */}
                  <div
                    className="flex-shrink-0 rounded-xl px-3 py-1.5 text-center min-w-[72px]"
                    style={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}
                  >
                    <p className="text-xs font-semibold text-white">{MONTHS[share.month - 1].slice(0, 3)}</p>
                    <p className="text-[10px]" style={{ color: '#64748b' }}>{share.year}</p>
                  </div>

                  {/* URL */}
                  <code
                    className="flex-1 text-xs truncate px-3 py-2 rounded-lg"
                    style={{ backgroundColor: '#0f172a', color: '#64748b' }}
                  >
                    {shareUrl}
                  </code>

                  {/* Created date */}
                  <span className="text-xs flex-shrink-0 hidden sm:block" style={{ color: '#475569' }}>
                    {createdDate}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <CopyButton text={shareUrl} />
                    <a
                      href={shareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: '#64748b', backgroundColor: '#0f172a' }}
                      title="Open report"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                    <button
                      onClick={() => handleDelete(share.id)}
                      disabled={deletingId === share.id}
                      className="p-1.5 rounded-lg transition-colors disabled:opacity-40"
                      style={{ color: '#64748b', backgroundColor: '#0f172a' }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.backgroundColor = '#ef444420' }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.backgroundColor = '#0f172a' }}
                      title="Revoke link"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
