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

function DirectoryCard({ title, count, columns, rows, renderRow }) {
  return (
    <div className="rounded-xl ring-1 ring-slate-700/50 overflow-hidden" style={{ backgroundColor: '#1e293b' }}>
      <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: '#334155' }}>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <span
          className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
          style={{ backgroundColor: '#6366f120', color: '#818cf8' }}
        >
          {count}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-center" style={{ color: '#64748b' }}>No records yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: '#334155' }}>
                {columns.map((col) => (
                  <th key={col} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {rows.map((row, i) => renderRow(row, i))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function AuditDirectory() {
  const [directory, setDirectory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    adminApi.get('/audit/directory')
      .then((res) => setDirectory(res.data?.data ?? res.data))
      .catch(() => setError('Failed to load audit directory.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return <div className="rounded-xl p-4 border border-red-500/30 bg-red-500/10 text-red-400 text-sm">{error}</div>
  }

  const customers    = directory?.customers    || []
  const factories    = (directory?.factories   || []).filter((f) => f && (f.name || f.id))
  const auditors     = directory?.auditors     || []
  const leadAuditors = directory?.lead_auditors || []
  const observers    = directory?.observers    || []

  return (
    <div className="space-y-4">
      <DirectoryCard
        title="Customers"
        count={customers.length}
        columns={['Name', 'Audits']}
        rows={customers}
        renderRow={(row, i) => (
          <tr key={row.id ?? i} className="hover:bg-slate-800/40 transition-colors">
            <td className="px-4 py-2.5 font-medium text-white text-xs">{row.name || '—'}</td>
            <td className="px-4 py-2.5 text-xs" style={{ color: '#94a3b8' }}>{row.audits ?? row.audit_count ?? '—'}</td>
          </tr>
        )}
      />

      <DirectoryCard
        title="Factories"
        count={factories.length}
        columns={['Name', 'Audits']}
        rows={factories}
        renderRow={(row, i) => (
          <tr key={row.id ?? i} className="hover:bg-slate-800/40 transition-colors">
            <td className="px-4 py-2.5 font-medium text-white text-xs">{row.name || '—'}</td>
            <td className="px-4 py-2.5 text-xs" style={{ color: '#94a3b8' }}>{row.audits ?? row.audit_count ?? '—'}</td>
          </tr>
        )}
      />

      <DirectoryCard
        title="Auditors"
        count={auditors.length}
        columns={['Name', 'Email', 'Audits']}
        rows={auditors}
        renderRow={(row, i) => (
          <tr key={row.id ?? i} className="hover:bg-slate-800/40 transition-colors">
            <td className="px-4 py-2.5 font-medium text-white text-xs">{row.name || '—'}</td>
            <td className="px-4 py-2.5 text-xs" style={{ color: '#64748b' }}>{row.email || '—'}</td>
            <td className="px-4 py-2.5 text-xs" style={{ color: '#94a3b8' }}>{row.audits ?? row.audit_count ?? '—'}</td>
          </tr>
        )}
      />

      <DirectoryCard
        title="Lead Auditors"
        count={leadAuditors.length}
        columns={['Name', 'Email', 'Audits']}
        rows={leadAuditors}
        renderRow={(row, i) => (
          <tr key={row.id ?? i} className="hover:bg-slate-800/40 transition-colors">
            <td className="px-4 py-2.5 font-medium text-white text-xs">{row.name || '—'}</td>
            <td className="px-4 py-2.5 text-xs" style={{ color: '#64748b' }}>{row.email || '—'}</td>
            <td className="px-4 py-2.5 text-xs" style={{ color: '#94a3b8' }}>{row.audits ?? row.audit_count ?? '—'}</td>
          </tr>
        )}
      />

      <DirectoryCard
        title="Observers"
        count={observers.length}
        columns={['Name', 'Email', 'Audits']}
        rows={observers}
        renderRow={(row, i) => (
          <tr key={row.id ?? i} className="hover:bg-slate-800/40 transition-colors">
            <td className="px-4 py-2.5 font-medium text-white text-xs">{row.name || '—'}</td>
            <td className="px-4 py-2.5 text-xs" style={{ color: '#64748b' }}>{row.email || '—'}</td>
            <td className="px-4 py-2.5 text-xs" style={{ color: '#94a3b8' }}>{row.audits ?? row.audit_count ?? '—'}</td>
          </tr>
        )}
      />
    </div>
  )
}

function AdminLogs() {
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
    <div className="space-y-4">
      <p className="text-sm" style={{ color: '#94a3b8' }}>{total.toLocaleString()} total entries</p>

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

const TABS = ['Admin Logs', 'Audit Directory']

export default function AdminAuditLogs() {
  const [activeTab, setActiveTab] = useState('Admin Logs')

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: '#0f172a' }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={
              activeTab === tab
                ? { backgroundColor: '#1e293b', color: '#f1f5f9' }
                : { backgroundColor: 'transparent', color: '#64748b' }
            }
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Admin Logs' && <AdminLogs />}
      {activeTab === 'Audit Directory' && <AuditDirectory />}
    </div>
  )
}
