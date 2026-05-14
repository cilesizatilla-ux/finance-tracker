import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import adminApi from '../adminApi.js'
import { useAdminAuth } from '../AdminAuthContext.jsx'
import { useAdminToast } from '../AdminToast.jsx'

const fmt = (cents) => '$' + (Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function fmtDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return '—'
  }
}

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState({})
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const navigate = useNavigate()
  const { admin } = useAdminAuth()
  const { toast, ToastContainer } = useAdminToast()
  const isSuperAdmin = admin?.role === 'super_admin'
  const PER_PAGE = 20
  const debounceRef = useRef(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(0)
    }, 400)
    return () => clearTimeout(debounceRef.current)
  }, [search])

  useEffect(() => {
    fetchUsers()
  }, [page, debouncedSearch])

  async function fetchUsers() {
    setLoading(true)
    setError(null)
    try {
      const res = await adminApi.get('/users', {
        params: { page, per_page: PER_PAGE, search: debouncedSearch || undefined }
      })
      setUsers(res.data?.data || res.data || [])
      setTotal(res.data?.total || 0)
    } catch {
      setError('Failed to load users.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSuspend(userId, currentlySuspended) {
    setActionLoading((prev) => ({ ...prev, [userId]: 'suspend' }))
    setUsers((prev) => prev.map((u) =>
      u.id === userId ? { ...u, is_suspended: !currentlySuspended } : u
    ))
    try {
      await adminApi.patch(`/users/${userId}/suspend`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update user status.')
      setUsers((prev) => prev.map((u) =>
        u.id === userId ? { ...u, is_suspended: currentlySuspended } : u
      ))
    } finally {
      setActionLoading((prev) => ({ ...prev, [userId]: null }))
    }
  }

  async function handleDelete(userId) {
    setActionLoading((prev) => ({ ...prev, [userId]: 'delete' }))
    try {
      await adminApi.delete(`/users/${userId}`)
      setUsers((prev) => prev.filter((u) => u.id !== userId))
      setTotal((t) => t - 1)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete user.')
    } finally {
      setActionLoading((prev) => ({ ...prev, [userId]: null }))
      setConfirmDelete(null)
      setSelectedUser(null)
    }
  }

  const totalPages = Math.ceil(total / PER_PAGE)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>{total.toLocaleString()} total users</p>
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#64748b' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="pl-9 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-slate-500 border outline-none focus:ring-2 focus:ring-indigo-500 w-72 transition"
            style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl p-4 border border-red-500/30 bg-red-500/10 text-red-400 text-sm">{error}</div>
      )}

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="rounded-2xl border p-6 max-w-sm w-full mx-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
            <h3 className="text-base font-bold text-white mb-2">Delete User?</h3>
            <p className="text-sm mb-5" style={{ color: '#94a3b8' }}>
              Are you sure you want to delete {selectedUser?.email}? This will permanently delete the user and all their data. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors text-slate-300 hover:text-white"
                style={{ borderColor: '#334155', backgroundColor: 'transparent' }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={actionLoading[confirmDelete] === 'delete'}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#ef4444' }}
              >
                {actionLoading[confirmDelete] === 'delete' ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
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
                  {['User', 'Joined', 'Last Active', 'Transactions', 'Income', 'Expenses', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={isSuperAdmin ? 8 : 8} className="text-center py-12 text-sm" style={{ color: '#64748b' }}>
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr
                      key={user.id}
                      className="transition-colors hover:bg-slate-800/40"
                      style={user.is_suspended ? { backgroundColor: '#ef444408' } : {}}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-white">{user.name || '—'}</p>
                          <p className="text-xs" style={{ color: '#64748b' }}>{user.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#94a3b8' }}>
                        {fmtDate(user.created_at)}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#94a3b8' }}>
                        {fmtDate(user.last_active_at)}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-white">
                        {user.transaction_count?.toLocaleString() ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium" style={{ color: '#22c55e' }}>
                        {user.total_income_cents != null ? fmt(user.total_income_cents) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium" style={{ color: '#ef4444' }}>
                        {user.total_expense_cents != null ? fmt(user.total_expense_cents) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold"
                          style={user.is_suspended
                            ? { backgroundColor: '#ef444420', color: '#fca5a5' }
                            : { backgroundColor: '#22c55e20', color: '#4ade80' }
                          }
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: user.is_suspended ? '#ef4444' : '#22c55e' }} />
                          {user.is_suspended ? 'Suspended' : 'Active'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => navigate(`/admin/users/${user.id}`)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors"
                            style={{ backgroundColor: '#6366f1' }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = '#4f46e5'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = '#6366f1'}
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleSuspend(user.id, user.is_suspended)}
                            disabled={actionLoading[user.id] === 'suspend'}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                            style={user.is_suspended
                              ? { backgroundColor: '#22c55e20', color: '#4ade80' }
                              : { backgroundColor: '#f59e0b20', color: '#fbbf24' }
                            }
                          >
                            {actionLoading[user.id] === 'suspend' ? '...' : user.is_suspended ? 'Unsuspend' : 'Suspend'}
                          </button>
                          {isSuperAdmin && (
                            <button
                              onClick={() => { setConfirmDelete(user.id); setSelectedUser(user) }}
                              disabled={actionLoading[user.id] === 'delete'}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                              style={{ backgroundColor: '#ef444420', color: '#fca5a5' }}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: '#334155' }}>
            <p className="text-xs" style={{ color: '#64748b' }}>
              Page {page + 1} of {totalPages} &middot; {total} total
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
      <ToastContainer />
    </div>
  )
}
