import { useState, useEffect, useCallback } from 'react'
import adminApi from '../adminApi.js'
import {
  adminGetAuditEntries,
  adminCreateAuditEntry,
  adminUpdateAuditEntry,
  adminDeleteAuditEntry,
  adminAssignAuditor,
  adminUnassignAuditor,
  adminGetAllExpenses,
  adminReviewExpense,
  adminListUsers,
} from '../../api/index.js'
import { useToast } from '../../contexts/ToastContext.jsx'

// ─── helpers ────────────────────────────────────────────────────────────────

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const fmt = (cents) =>
  '$' + (Math.abs(cents ?? 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const STATUS_COLORS = {
  scheduled:   'bg-indigo-600',
  in_progress: 'bg-amber-500',
  completed:   'bg-emerald-600',
  cancelled:   'bg-slate-600',
}

const STATUS_BADGE_STYLES = {
  scheduled:   { bg: '#6366f120', border: '#6366f150', text: '#a5b4fc' },
  in_progress: { bg: '#f59e0b20', border: '#f59e0b50', text: '#fbbf24' },
  completed:   { bg: '#22c55e20', border: '#22c55e50', text: '#4ade80' },
  cancelled:   { bg: '#64748b20', border: '#64748b50', text: '#94a3b8' },
  pending:     { bg: '#f59e0b20', border: '#f59e0b50', text: '#fbbf24' },
  approved:    { bg: '#22c55e20', border: '#22c55e50', text: '#4ade80' },
  rejected:    { bg: '#ef444420', border: '#ef444450', text: '#fca5a5' },
}

function StatusBadge({ status }) {
  const s = STATUS_BADGE_STYLES[status] || STATUS_BADGE_STYLES.pending
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold capitalize"
      style={{ backgroundColor: s.bg, border: `1px solid ${s.border}`, color: s.text }}
    >
      {status?.replace('_', ' ')}
    </span>
  )
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-slate-600 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  )
}

// ─── Calendar tab ────────────────────────────────────────────────────────────

function buildAuditsByDay(entries, year, month) {
  const map = {}
  entries.forEach(entry => {
    const start = new Date(entry.audit_date + 'T00:00:00')
    const end = new Date(start)
    end.setDate(end.getDate() + (entry.duration_days || 1) - 1)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate()
        if (!map[day]) map[day] = []
        if (!map[day].find(e => e.id === entry.id)) map[day].push(entry)
      }
    }
  })
  return map
}

const EMPTY_FORM = {
  client_name: '',
  company_name: '',
  audit_date: '',
  duration_days: 1,
  location: '',
  status: 'scheduled',
  notes: '',
}

function AuditModal({ entry, onClose, onSaved, toast }) {
  const isNew = !entry
  const [form, setForm] = useState(
    isNew
      ? EMPTY_FORM
      : {
          client_name:   entry.client_name   || '',
          company_name:  entry.company_name  || '',
          audit_date:    entry.audit_date     || '',
          duration_days: entry.duration_days  || 1,
          location:      entry.location       || '',
          status:        entry.status         || 'scheduled',
          notes:         entry.notes          || '',
        }
  )
  const [saving, setSaving] = useState(false)

  // Auditor assignment state
  const [assignments, setAssignments]   = useState(entry?.assignments || [])
  const [userSearch, setUserSearch]     = useState('')
  const [userResults, setUserResults]   = useState([])
  const [userLoading, setUserLoading]   = useState(false)
  const [assigningId, setAssigningId]   = useState(null)
  const [unassigningId, setUnassigningId] = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Search users
  useEffect(() => {
    if (!userSearch.trim()) { setUserResults([]); return }
    const t = setTimeout(async () => {
      setUserLoading(true)
      try {
        const res = await adminListUsers({ search: userSearch, per_page: 10 })
        setUserResults(res.data?.users || res.data?.data || res.data || [])
      } catch {
        setUserResults([])
      } finally {
        setUserLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [userSearch])

  const handleAssign = async (user) => {
    setAssigningId(user.id)
    try {
      const res = await adminAssignAuditor(entry.id, { user_id: user.id, role: 'auditor' })
      const updated = res.data?.assignments || [...assignments, { user_id: user.id, role: 'auditor', user }]
      setAssignments(updated)
      setUserSearch('')
      setUserResults([])
      toast.success('Auditor assigned')
    } catch {
      toast.error('Failed to assign auditor')
    } finally {
      setAssigningId(null)
    }
  }

  const handleUnassign = async (userId) => {
    setUnassigningId(userId)
    try {
      await adminUnassignAuditor(entry.id, userId)
      setAssignments(a => a.filter(x => x.user_id !== userId && x.user?.id !== userId))
      toast.success('Auditor removed')
    } catch {
      toast.error('Failed to remove auditor')
    } finally {
      setUnassigningId(null)
    }
  }

  const handleChangeRole = async (userId, role) => {
    try {
      await adminAssignAuditor(entry.id, { user_id: userId, role })
      setAssignments(a => a.map(x => {
        const xId = x.user_id || x.user?.id
        return xId === userId ? { ...x, role } : x
      }))
    } catch {
      toast.error('Failed to update role')
    }
  }

  const handleSave = async () => {
    if (!form.client_name.trim() || !form.company_name.trim() || !form.audit_date) {
      toast.error('Client name, company name, and start date are required')
      return
    }
    setSaving(true)
    try {
      if (isNew) {
        await adminCreateAuditEntry(form)
        toast.success('Audit entry created')
      } else {
        await adminUpdateAuditEntry(entry.id, form)
        toast.success('Audit entry updated')
      }
      onSaved()
    } catch {
      toast.error('Failed to save audit entry')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this audit entry? This cannot be undone.')) return
    setSaving(true)
    try {
      await adminDeleteAuditEntry(entry.id)
      toast.success('Audit entry deleted')
      onSaved()
    } catch {
      toast.error('Failed to delete audit entry')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-lg rounded-2xl shadow-2xl overflow-y-auto"
        style={{ backgroundColor: '#1e293b', border: '1px solid #334155', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#334155' }}>
          <h2 className="text-base font-semibold text-white">{isNew ? 'Add New Audit' : 'Edit Audit'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-lg leading-none">&times;</button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Client Name */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Client Name *</label>
            <input
              type="text"
              value={form.client_name}
              onChange={e => set('client_name', e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              style={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}
              placeholder="Jane Smith"
            />
          </div>

          {/* Company Name */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Company Name *</label>
            <input
              type="text"
              value={form.company_name}
              onChange={e => set('company_name', e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              style={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}
              placeholder="Acme Corp"
            />
          </div>

          {/* Start Date + Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Start Date *</label>
              <input
                type="date"
                value={form.audit_date}
                onChange={e => set('audit_date', e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                style={{ backgroundColor: '#0f172a', border: '1px solid #334155', colorScheme: 'dark' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Duration (days)</label>
              <input
                type="number"
                min={1}
                value={form.duration_days}
                onChange={e => set('duration_days', Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                style={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={e => set('location', e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              style={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}
              placeholder="New York, NY"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
            <select
              value={form.status}
              onChange={e => set('status', e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              style={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}
            >
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              style={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}
              placeholder="Optional notes..."
            />
          </div>

          {/* Assign Auditors — only for existing entries */}
          {!isNew && (
            <div className="pt-2 border-t" style={{ borderColor: '#334155' }}>
              <p className="text-xs font-semibold text-slate-300 mb-3">Assigned Auditors</p>

              {/* Current assignments */}
              {assignments.length > 0 ? (
                <div className="space-y-2 mb-3">
                  {assignments.map(a => {
                    const uid = a.user_id || a.user?.id
                    const name = a.user?.name || a.user?.email || `User #${uid}`
                    return (
                      <div
                        key={uid}
                        className="flex items-center justify-between gap-2 rounded-lg px-3 py-2"
                        style={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}
                      >
                        <span className="text-sm text-white truncate">{name}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <select
                            value={a.role || 'auditor'}
                            onChange={e => handleChangeRole(uid, e.target.value)}
                            className="rounded px-2 py-0.5 text-xs text-white focus:outline-none"
                            style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                          >
                            <option value="auditor">Auditor</option>
                            <option value="lead">Lead</option>
                            <option value="reviewer">Reviewer</option>
                          </select>
                          <button
                            onClick={() => handleUnassign(uid)}
                            disabled={unassigningId === uid}
                            className="text-slate-500 hover:text-red-400 transition-colors text-base leading-none"
                            title="Remove"
                          >
                            &times;
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-500 mb-3">No auditors assigned yet.</p>
              )}

              {/* User search */}
              <div className="relative">
                <input
                  type="text"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  style={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}
                  placeholder="Search users to add..."
                />
                {userLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border border-slate-600 border-t-indigo-500 rounded-full animate-spin" />
                  </div>
                )}
                {userResults.length > 0 && (
                  <div
                    className="absolute z-10 w-full mt-1 rounded-lg shadow-xl overflow-hidden"
                    style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                  >
                    {userResults.map(u => (
                      <button
                        key={u.id}
                        onClick={() => handleAssign(u)}
                        disabled={assigningId === u.id || assignments.some(a => (a.user_id || a.user?.id) === u.id)}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-700 transition-colors text-left disabled:opacity-40"
                      >
                        <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs text-white font-semibold flex-shrink-0">
                          {(u.name || u.email || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm text-white">{u.name || '—'}</p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </div>
                        {assignments.some(a => (a.user_id || a.user?.id) === u.id) && (
                          <span className="ml-auto text-xs text-emerald-400">Added</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t" style={{ borderColor: '#334155' }}>
          <div>
            {!isNew && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                Delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CalendarTab({ toast }) {
  const now = new Date()
  const [year, setYear]     = useState(now.getFullYear())
  const [month, setMonth]   = useState(now.getMonth())
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal]     = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)

  const loadEntries = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminGetAuditEntries({ year, month: month + 1 })
      setEntries(res.data?.entries || res.data?.data || res.data || [])
    } catch {
      toast.error('Failed to load audit entries')
    } finally {
      setLoading(false)
    }
  }, [year, month, toast])

  useEffect(() => { loadEntries() }, [loadEntries])

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const auditsByDay = buildAuditsByDay(entries, year, month)

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay() // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  // pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null)

  const openNew = () => { setEditingEntry(null); setShowModal(true) }
  const openEdit = (entry) => { setEditingEntry(entry); setShowModal(true) }
  const handleSaved = () => { setShowModal(false); loadEntries() }

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            &#8249;
          </button>
          <span className="text-base font-semibold text-white w-40 text-center">
            {MONTHS[month]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            &#8250;
          </button>
        </div>
        <button
          onClick={openNew}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
        >
          + Add New Audit
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #334155' }}>
          {/* Day headers */}
          <div className="grid grid-cols-7" style={{ backgroundColor: '#0f172a' }}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} className="text-center text-xs font-semibold text-slate-400 py-2">{d}</div>
            ))}
          </div>
          {/* Grid */}
          <div className="grid grid-cols-7">
            {cells.map((day, idx) => (
              <div
                key={idx}
                className="min-h-[90px] border border-slate-700 p-1 cursor-pointer hover:bg-slate-700/50 transition-colors"
                style={{ backgroundColor: day ? '#1e293b' : '#0f172a' }}
                onClick={() => { if (!day) return }}
              >
                {day && (
                  <>
                    <div className="text-xs text-slate-400 mb-1 px-0.5">{day}</div>
                    <div className="space-y-0.5">
                      {(auditsByDay[day] || []).map(entry => (
                        <div
                          key={entry.id}
                          onClick={(e) => { e.stopPropagation(); openEdit(entry) }}
                          className={`${STATUS_COLORS[entry.status] || 'bg-indigo-600'} text-white text-[10px] font-medium rounded px-1 py-0.5 truncate cursor-pointer hover:opacity-80 transition-opacity`}
                          title={`${entry.client_name} — ${entry.company_name}`}
                        >
                          {entry.client_name}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-5 mt-3">
        {[
          { label: 'Scheduled',   cls: 'bg-indigo-600' },
          { label: 'In Progress', cls: 'bg-amber-500' },
          { label: 'Completed',   cls: 'bg-emerald-600' },
          { label: 'Cancelled',   cls: 'bg-slate-600' },
        ].map(({ label, cls }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-sm ${cls}`} />
            <span className="text-xs text-slate-400">{label}</span>
          </div>
        ))}
      </div>

      {showModal && (
        <AuditModal
          entry={editingEntry}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
          toast={toast}
        />
      )}
    </div>
  )
}

// ─── Expense Review tab ───────────────────────────────────────────────────────

function ExpenseReviewTab({ toast }) {
  const [filter, setFilter] = useState('all')
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading]   = useState(false)
  const [rejectNotes, setRejectNotes] = useState({}) // id -> note text
  const [rejectOpen, setRejectOpen]   = useState({}) // id -> bool
  const [acting, setActing]           = useState(null) // id currently being actioned

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = filter !== 'all' ? { status: filter } : {}
      const res = await adminGetAllExpenses(params)
      setExpenses(res.data?.expenses || res.data?.data || res.data || [])
    } catch {
      toast.error('Failed to load expenses')
    } finally {
      setLoading(false)
    }
  }, [filter, toast])

  useEffect(() => { load() }, [load])

  const handleApprove = async (id) => {
    setActing(id)
    try {
      await adminReviewExpense(id, { status: 'approved' })
      toast.success('Expense approved')
      load()
    } catch {
      toast.error('Failed to approve expense')
    } finally {
      setActing(null)
    }
  }

  const handleReject = async (id) => {
    const note = rejectNotes[id] || ''
    setActing(id)
    try {
      await adminReviewExpense(id, { status: 'rejected', review_note: note })
      toast.success('Expense rejected')
      setRejectOpen(o => ({ ...o, [id]: false }))
      setRejectNotes(n => ({ ...n, [id]: '' }))
      load()
    } catch {
      toast.error('Failed to reject expense')
    } finally {
      setActing(null)
    }
  }

  const FILTERS = ['all','pending','approved','rejected']

  return (
    <div>
      {/* Filter pills */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
              filter === f
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : expenses.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <p className="text-lg mb-1">No expenses found</p>
          <p className="text-sm">There are no {filter !== 'all' ? filter : ''} expenses to display.</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #334155' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#0f172a' }}>
                {['Date','Auditor','Audit','Category','Amount','Status','Actions'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-400 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp, i) => (
                <>
                  <tr
                    key={exp.id}
                    style={{
                      backgroundColor: i % 2 === 0 ? '#1e293b' : '#1a2540',
                      borderTop: '1px solid #334155',
                    }}
                  >
                    <td className="px-4 py-3 text-slate-300">
                      {exp.expense_date ? new Date(exp.expense_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-300 max-w-[120px] truncate">
                      {exp.user?.name || exp.user?.email || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-300 max-w-[140px] truncate">
                      {exp.audit_entry?.client_name || exp.audit_entry?.company_name || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-300 capitalize">
                      {exp.category?.replace('_', ' ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-white font-medium">
                      {exp.amount_cents != null ? fmt(exp.amount_cents) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={exp.status} />
                    </td>
                    <td className="px-4 py-3">
                      {exp.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApprove(exp.id)}
                            disabled={acting === exp.id}
                            className="px-2.5 py-1 rounded text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setRejectOpen(o => ({ ...o, [exp.id]: !o[exp.id] }))}
                            disabled={acting === exp.id}
                            className="px-2.5 py-1 rounded text-xs font-semibold text-white bg-red-600 hover:bg-red-500 transition-colors disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {rejectOpen[exp.id] && (
                    <tr
                      key={`reject-${exp.id}`}
                      style={{ backgroundColor: '#1e293b', borderTop: '1px solid #334155' }}
                    >
                      <td colSpan={7} className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <input
                            type="text"
                            value={rejectNotes[exp.id] || ''}
                            onChange={e => setRejectNotes(n => ({ ...n, [exp.id]: e.target.value }))}
                            className="flex-1 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                            style={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}
                            placeholder="Rejection reason (optional)..."
                          />
                          <button
                            onClick={() => handleReject(exp.id)}
                            disabled={acting === exp.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-500 transition-colors disabled:opacity-50"
                          >
                            {acting === exp.id ? 'Rejecting...' : 'Confirm Reject'}
                          </button>
                          <button
                            onClick={() => setRejectOpen(o => ({ ...o, [exp.id]: false }))}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({ toast }) {
  const [stats, setStats]   = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const thisYear = new Date().getFullYear()
        const [entriesRes, expensesRes] = await Promise.all([
          adminGetAuditEntries({ year: thisYear }),
          adminGetAllExpenses({}),
        ])
        const entries  = entriesRes.data?.entries  || entriesRes.data?.data  || entriesRes.data  || []
        const expenses = expensesRes.data?.expenses || expensesRes.data?.data || expensesRes.data || []

        const pendingExpenses  = expenses.filter(e => e.status === 'pending')
        const approvedExpenses = expenses.filter(e => e.status === 'approved')
        const totalApproved    = approvedExpenses.reduce((sum, e) => sum + (e.amount_cents || 0), 0)

        // Unique auditor count across all assignments
        const userIds = new Set()
        entries.forEach(entry => {
          (entry.assignments || []).forEach(a => {
            const uid = a.user_id || a.user?.id
            if (uid) userIds.add(uid)
          })
        })

        setStats({
          totalAudits:      entries.length,
          pendingExpenses:  pendingExpenses.length,
          totalApproved,
          activeAuditors:   userIds.size,
        })
      } catch {
        toast.error('Failed to load overview data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [toast])

  const cards = stats ? [
    { label: 'Total Audits This Year', value: stats.totalAudits.toLocaleString(), accent: '#6366f1', icon: '📋' },
    { label: 'Pending Expenses',       value: stats.pendingExpenses.toLocaleString(), accent: '#f59e0b', icon: '⏳' },
    { label: 'Total Approved',         value: fmt(stats.totalApproved), accent: '#22c55e', icon: '✓' },
    { label: 'Active Auditors',        value: stats.activeAuditors.toLocaleString(), accent: '#a78bfa', icon: '👤' },
  ] : []

  if (loading) return <Spinner />

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(({ label, value, accent, icon }) => (
        <div
          key={label}
          className="rounded-xl p-5 relative overflow-hidden"
          style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderLeft: `3px solid ${accent}` }}
        >
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
              style={{ backgroundColor: `${accent}20`, color: accent }}
            >
              {icon}
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{value}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const TABS = ['Calendar', 'Expense Review', 'Overview']

export default function AdminAuditCalendar() {
  const [activeTab, setActiveTab] = useState('Calendar')
  const toast = useToast()

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Audit Calendar</h1>
        <p className="text-sm mt-1 text-slate-400">Manage audit assignments, expenses, and scheduling</p>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 border-b" style={{ borderColor: '#334155' }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors ${
              activeTab === tab
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'Calendar'       && <CalendarTab toast={toast} />}
        {activeTab === 'Expense Review' && <ExpenseReviewTab toast={toast} />}
        {activeTab === 'Overview'       && <OverviewTab toast={toast} />}
      </div>
    </div>
  )
}
