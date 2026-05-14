import { useState, useEffect } from 'react'
import adminApi from '../adminApi.js'

function fmtDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return '—' }
}

function actionColor(action) {
  if (!action) return { bg: '#64748b20', color: '#94a3b8' }
  const lower = action.toLowerCase()
  if (lower.includes('delete') || lower.includes('suspend')) return { bg: '#ef444420', color: '#fca5a5' }
  if (lower.includes('create')) return { bg: '#22c55e20', color: '#4ade80' }
  if (lower.includes('toggle') || lower.includes('update') || lower.includes('patch')) return { bg: '#f59e0b20', color: '#fbbf24' }
  return { bg: '#6366f120', color: '#818cf8' }
}

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState({})
  const PER_PAGE = 20

  useEffect(() => {
    fetchLogs()
  }, [page])

  async function fetchLogs() {
    setLoading(true)
    setError(null)
    try {
      const res = await adminApi.get('/audit-logs', { params: { page, per_page: PER_PAGE } })
      setLogs(res.data?.data || res.data || [])
      setTotal(res.data?.total || 0)
    } catch {
      setError('Failed to load audit logs.')
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.ceil(total / PER_PAGE)

  function toggleExpand(id) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
        <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>{total.toLocaleString()} total entries</p>
      </div>

      {error && (
        <div className="rounded-xl p-4 border border-red-500/30 bg-red-500/10 text-red-400 text-sm">{error}</div>
      )}

      <div className="rounded-xl ring-1 ring-slate-700/50 overflow-hidden" style={{ backgroundColor: '#1e293b' }}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: '#334155' }}>
                  {['Admin', 'Action', 'Target', 'Detail', 'Timestamp'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-sm" style={{ color: '#64748b' }}>No audit log entries.</td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const { bg, color } = actionColor(log.action)
                    const isExpanded = !!expanded[log.id]
                    let detailStr = '—'
                    if (log.detail) {
                      try {
                        detailStr = typeof log.detail === 'string' ? log.detail : JSON.stringify(log.detail, null, 2)
                      } catch {
                        detailStr = String(log.detail)
                      }
                    }

                    return (
                      <tr key={log.id} className="hover:bg-slate-800/40 transition-colors align-top">
                        <td className="px-4 py-3">
                          <p className="font-medium text-white">{log.admin_username || '—'}</p>
                          <p className="text-xs" style={{ color: '#64748b' }}>ID: {log.admin_id}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                            style={{ backgroundColor: bg, color }}
                          >
                            {log.action || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-medium text-white">{log.target_type || '—'}</p>
                          <p className="text-xs" style={{ color: '#64748b' }}>{log.target_id ? `ID: ${log.target_id}` : ''}</p>
                        </td>
                        <td className="px-4 py-3 max-w-[240px]">
                          {log.detail ? (
                            <div>
                              <button
                                onClick={() => toggleExpand(log.id)}
                                className="text-xs flex items-center gap-1 transition-colors"
                                style={{ color: '#6366f1' }}
                              >
                                <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                {isExpanded ? 'Hide' : 'Show'} detail
                              </button>
                              {isExpanded && (
                                <pre
                                  className="mt-2 p-2 rounded-lg text-[10px] overflow-x-auto max-h-40"
                                  style={{ backgroundColor: '#0f172a', color: '#94a3b8', fontFamily: 'monospace' }}
                                >
                                  {detailStr}
                                </pre>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs" style={{ color: '#64748b' }}>—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#94a3b8' }}>
                          {fmtDate(log.created_at)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: '#334155' }}>
            <p className="text-xs" style={{ color: '#64748b' }}>
              Page {page + 1} of {totalPages} &middot; {total} entries
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40"
                style={{ borderColor: '#334155', color: '#94a3b8', backgroundColor: 'transparent' }}
              >
                Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
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
