import { useState, useEffect } from 'react'
import { getParties, createParty, updateParty, deleteParty, getPartyStats } from '../api/index.js'

const PARTY_TYPES = ['vendor', 'customer', 'both']

const emptyForm = {
  name: '',
  party_type: 'vendor',
  tax_id: '',
  email: '',
  phone: '',
  notes: ''
}

function PartyModal({ party, onClose, onSaved }) {
  const [form, setForm] = useState(party ? {
    name: party.name,
    party_type: party.party_type,
    tax_id: party.tax_id || '',
    email: party.email || '',
    phone: party.phone || '',
    notes: party.notes || ''
  } : { ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name.trim(),
        party_type: form.party_type,
        tax_id: form.tax_id.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null
      }
      const res = party
        ? await updateParty(party.id, payload)
        : await createParty(payload)
      const saved = res.data?.data
      if (!saved) { setError('Unexpected server response'); return }
      onSaved(saved)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div className="w-full max-w-lg rounded-2xl border shadow-2xl" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#334155' }}>
          <h2 className="text-base font-semibold text-white">{party ? 'Edit Party' : 'New Party'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>Name *</label>
            <input
              value={form.name}
              onChange={set('name')}
              placeholder="e.g. Acme Corp"
              className="w-full px-3 py-2 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-indigo-500/40 text-white"
              style={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>Type</label>
            <div className="flex gap-2">
              {PARTY_TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, party_type: t }))}
                  className="flex-1 py-2 rounded-xl text-xs font-medium border transition-all capitalize"
                  style={form.party_type === t
                    ? { backgroundColor: '#4f46e5', borderColor: '#4f46e5', color: '#fff' }
                    : { backgroundColor: '#0f172a', borderColor: '#334155', color: '#94a3b8' }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>Tax ID</label>
              <input
                value={form.tax_id}
                onChange={set('tax_id')}
                placeholder="Optional"
                className="w-full px-3 py-2 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-indigo-500/40 text-white"
                style={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>Phone</label>
              <input
                value={form.phone}
                onChange={set('phone')}
                placeholder="Optional"
                className="w-full px-3 py-2 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-indigo-500/40 text-white"
                style={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>Email</label>
            <input
              value={form.email}
              onChange={set('email')}
              type="email"
              placeholder="Optional"
              className="w-full px-3 py-2 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-indigo-500/40 text-white"
              style={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>Notes</label>
            <textarea
              value={form.notes}
              onChange={set('notes')}
              rows={2}
              placeholder="Optional"
              className="w-full px-3 py-2 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-indigo-500/40 text-white resize-none"
              style={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors"
              style={{ borderColor: '#334155', color: '#94a3b8', backgroundColor: 'transparent' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ backgroundColor: '#4f46e5' }}
            >
              {saving ? 'Saving…' : party ? 'Save Changes' : 'Create Party'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const TYPE_COLORS = {
  vendor: { bg: '#1e1b4b', text: '#a5b4fc', border: '#3730a3' },
  customer: { bg: '#064e3b', text: '#6ee7b7', border: '#065f46' },
  both: { bg: '#1c1917', text: '#d6d3d1', border: '#44403c' }
}

export default function Parties() {
  const [parties, setParties] = useState([])
  const [partyStats, setPartyStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('all')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null) // null | 'new' | party object
  const [deleteId, setDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const fetchParties = async () => {
    setLoading(true)
    try {
      const res = await getParties()
      setParties(res.data.data || [])
      const statsRes = await getPartyStats()
      const statsArr = statsRes.data?.data || []
      const statsMap = {}
      statsArr.forEach(s => { statsMap[s.id] = s })
      setPartyStats(statsMap)
    } catch {
      setParties([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchParties() }, [])

  const handleSaved = (savedParty) => {
    setParties(prev => {
      const idx = prev.findIndex(p => p.id === savedParty.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = savedParty
        return next
      }
      return [savedParty, ...prev]
    })
    setModal(null)
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteParty(deleteId)
      setParties(prev => prev.filter(p => p.id !== deleteId))
      setDeleteId(null)
    } catch (err) {
      setDeleteError(err.response?.data?.detail || 'Failed to delete party. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const filtered = parties.filter(p => {
    if (filterType !== 'all' && p.party_type !== filterType) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const counts = { all: parties.length }
  PARTY_TYPES.forEach(t => { counts[t] = parties.filter(p => p.party_type === t).length })

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Parties</h1>
          <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>Manage your vendors, customers and partners</p>
        </div>
        <button
          onClick={() => setModal('new')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#4f46e5' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Party
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#64748b' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search parties…"
            className="w-full pl-9 pr-3 py-2 rounded-xl text-sm border text-white outline-none focus:ring-2 focus:ring-indigo-500/40"
            style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
          />
        </div>
        <div className="flex gap-2">
          {['all', ...PARTY_TYPES].map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className="px-3 py-2 rounded-xl text-xs font-medium border transition-all capitalize"
              style={filterType === t
                ? { backgroundColor: '#4f46e5', borderColor: '#4f46e5', color: '#fff' }
                : { backgroundColor: '#1e293b', borderColor: '#334155', color: '#94a3b8' }}
            >
              {t} <span className="ml-1 opacity-70">({counts[t]})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Table / list */}
      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3">
            <svg className="w-12 h-12" style={{ color: '#334155' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm font-medium" style={{ color: '#475569' }}>
              {search || filterType !== 'all' ? 'No parties match your filters' : 'No parties yet'}
            </p>
            {!search && filterType === 'all' && (
              <button
                onClick={() => setModal('new')}
                className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
              >
                Add your first party
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: '#334155' }}>
                <th className="text-left px-5 py-3 text-xs font-semibold tracking-wide" style={{ color: '#64748b' }}>Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold tracking-wide" style={{ color: '#64748b' }}>Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold tracking-wide hidden sm:table-cell" style={{ color: '#64748b' }}>Tax ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold tracking-wide hidden md:table-cell" style={{ color: '#64748b' }}>Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold tracking-wide hidden md:table-cell" style={{ color: '#64748b' }}>Phone</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((party, i) => {
                const tc = TYPE_COLORS[party.party_type] || TYPE_COLORS.both
                return (
                  <tr
                    key={party.id}
                    className="border-b last:border-0 transition-colors hover:bg-slate-700/20"
                    style={{ borderColor: '#1e293b' }}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: tc.bg, color: tc.text, border: `1px solid ${tc.border}` }}>
                          {party.name[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-white">{party.name}</p>
                          {party.notes && (
                            <p className="text-xs truncate max-w-[160px]" style={{ color: '#64748b' }}>{party.notes}</p>
                          )}
                          {partyStats[party.id] && (
                            <div className="flex gap-4 mt-2 text-xs" style={{ color: '#64748b' }}>
                              <span>{partyStats[party.id].tx_count} transactions</span>
                              {partyStats[party.id].expense_cents > 0 && (
                                <span style={{ color: '#ef4444' }}>
                                  −${(partyStats[party.id].expense_cents / 100).toFixed(2)} spent
                                </span>
                              )}
                              {partyStats[party.id].income_cents > 0 && (
                                <span style={{ color: '#22c55e' }}>
                                  +${(partyStats[party.id].income_cents / 100).toFixed(2)} received
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 rounded-md text-xs font-medium capitalize"
                        style={{ backgroundColor: tc.bg, color: tc.text, border: `1px solid ${tc.border}` }}>
                        {party.party_type}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 hidden sm:table-cell" style={{ color: '#94a3b8' }}>
                      {party.tax_id || <span style={{ color: '#475569' }}>—</span>}
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell" style={{ color: '#94a3b8' }}>
                      {party.email || <span style={{ color: '#475569' }}>—</span>}
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell" style={{ color: '#94a3b8' }}>
                      {party.phone || <span style={{ color: '#475569' }}>—</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => setModal(party)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-slate-700"
                          style={{ color: '#64748b' }}
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteId(party.id)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10"
                          style={{ color: '#64748b' }}
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit modal */}
      {modal && (
        <PartyModal
          party={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-sm rounded-2xl border p-6 space-y-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
            <h3 className="text-base font-semibold text-white">Delete party?</h3>
            <p className="text-sm" style={{ color: '#94a3b8' }}>
              This will remove the party. Transactions linked to it will keep their data but lose the party association.
            </p>
            {deleteError && (
              <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{deleteError}</div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setDeleteId(null); setDeleteError('') }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors"
                style={{ borderColor: '#334155', color: '#94a3b8' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                style={{ backgroundColor: '#ef4444' }}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
