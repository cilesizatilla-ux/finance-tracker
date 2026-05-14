import { useState, useEffect } from 'react'
import adminApi from '../adminApi.js'
import { useAdminAuth } from '../AdminAuthContext.jsx'
import { useAdminToast } from '../AdminToast.jsx'

function fmtDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return '—' }
}

function RoleBadge({ role }) {
  const isSuperAdmin = role === 'super_admin'
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={isSuperAdmin
        ? { backgroundColor: '#7c3aed30', color: '#a78bfa' }
        : { backgroundColor: '#6366f130', color: '#818cf8' }
      }
    >
      {role}
    </span>
  )
}

const EMPTY_FORM = { username: '', email: '', password: '', role: 'admin' }

export default function AdminAdmins() {
  const { admin: currentAdmin } = useAdminAuth()
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState(null)
  const [formLoading, setFormLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState({})
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [selectedAdmin, setSelectedAdmin] = useState(null)
  const { toast, ToastContainer } = useAdminToast()

  useEffect(() => {
    fetchAdmins()
  }, [])

  async function fetchAdmins() {
    setLoading(true)
    setError(null)
    try {
      const res = await adminApi.get('/admins')
      setAdmins(res.data?.data || res.data || [])
    } catch {
      setError('Failed to load admins.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setFormError(null)
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters.')
      return
    }
    setFormLoading(true)
    try {
      const res = await adminApi.post('/admins', form)
      const newAdmin = res.data?.data || res.data
      setAdmins((prev) => [...prev, newAdmin])
      setForm(EMPTY_FORM)
      setShowForm(false)
      toast.success('Admin account created.')
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.message || 'Failed to create admin.'
      setFormError(msg)
    } finally {
      setFormLoading(false)
    }
  }

  async function handleToggle(adminId) {
    setActionLoading((prev) => ({ ...prev, [adminId]: 'toggle' }))
    try {
      await adminApi.patch(`/admins/${adminId}/toggle`)
      setAdmins((prev) => prev.map((a) =>
        a.id === adminId ? { ...a, is_active: !a.is_active } : a
      ))
      const updated = admins.find((a) => a.id === adminId)
      toast.success(updated?.is_active ? 'Admin deactivated.' : 'Admin activated.')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update admin status.')
    } finally {
      setActionLoading((prev) => ({ ...prev, [adminId]: null }))
    }
  }

  async function handleDelete(adminId) {
    setActionLoading((prev) => ({ ...prev, [adminId]: 'delete' }))
    try {
      await adminApi.delete(`/admins/${adminId}`)
      setAdmins((prev) => prev.filter((a) => a.id !== adminId))
      toast.success('Admin account deleted.')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete admin.')
    } finally {
      setActionLoading((prev) => ({ ...prev, [adminId]: null }))
      setConfirmDelete(null)
      setSelectedAdmin(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Management</h1>
          <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>Manage admin accounts and permissions</p>
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); setFormError(null) }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
          style={{ backgroundColor: '#6366f1' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4f46e5'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6366f1'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Admin
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-xl ring-1 ring-slate-700/50 p-5" style={{ backgroundColor: '#1e293b' }}>
          <h2 className="text-sm font-semibold text-white mb-4">New Admin Account</h2>
          {formError && (
            <div className="mb-4 rounded-xl p-3 text-sm border" style={{ backgroundColor: '#ef444420', borderColor: '#ef444450', color: '#fca5a5' }}>
              {formError}
            </div>
          )}
          <form onSubmit={handleCreate} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#94a3b8' }}>Username</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                required
                placeholder="e.g. john_admin"
                className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-slate-600 border outline-none focus:ring-2 focus:ring-indigo-500 transition"
                style={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#94a3b8' }}>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
                placeholder="admin@example.com"
                className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-slate-600 border outline-none focus:ring-2 focus:ring-indigo-500 transition"
                style={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#94a3b8' }}>Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-slate-600 border outline-none focus:ring-2 focus:ring-indigo-500 transition"
                style={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#94a3b8' }}>Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl text-sm text-white border outline-none focus:ring-2 focus:ring-indigo-500 transition"
                style={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
              >
                <option value="admin">admin</option>
                <option value="super_admin">super_admin</option>
              </select>
            </div>
            <div className="lg:col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={formLoading}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#6366f1' }}
              >
                {formLoading ? 'Creating...' : 'Create Admin'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setFormError(null) }}
                className="px-5 py-2.5 rounded-xl text-sm font-medium border transition-colors"
                style={{ borderColor: '#334155', color: '#94a3b8', backgroundColor: 'transparent' }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {error && (
        <div className="rounded-xl p-4 border border-red-500/30 bg-red-500/10 text-red-400 text-sm">{error}</div>
      )}

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="rounded-2xl border p-6 max-w-sm w-full mx-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
            <h3 className="text-base font-bold text-white mb-2">Delete Admin?</h3>
            <p className="text-sm mb-5" style={{ color: '#94a3b8' }}>Are you sure you want to delete admin &quot;{selectedAdmin?.username}&quot;? This will permanently remove this admin account.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border"
                style={{ borderColor: '#334155', color: '#94a3b8', backgroundColor: 'transparent' }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={actionLoading[confirmDelete] === 'delete'}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: '#ef4444' }}
              >
                {actionLoading[confirmDelete] === 'delete' ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
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
                  {['Username', 'Email', 'Role', 'Status', 'Created By', 'Last Login', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {admins.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-sm" style={{ color: '#64748b' }}>No admins found.</td>
                  </tr>
                ) : (
                  admins.map((a) => {
                    const isSelf = a.id === currentAdmin?.id
                    return (
                      <tr key={a.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-medium text-white">{a.username}</span>
                          {isSelf && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: '#6366f120', color: '#818cf8' }}>You</span>}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#94a3b8' }}>{a.email}</td>
                        <td className="px-4 py-3"><RoleBadge role={a.role} /></td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                            style={a.is_active
                              ? { backgroundColor: '#22c55e20', color: '#4ade80' }
                              : { backgroundColor: '#ef444420', color: '#fca5a5' }
                            }
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: a.is_active ? '#22c55e' : '#ef4444' }} />
                            {a.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#94a3b8' }}>{a.created_by || '—'}</td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#94a3b8' }}>{fmtDate(a.last_login_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggle(a.id)}
                              disabled={actionLoading[a.id] === 'toggle' || isSelf}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
                              style={a.is_active
                                ? { backgroundColor: '#ef444420', color: '#fca5a5' }
                                : { backgroundColor: '#22c55e20', color: '#4ade80' }
                              }
                            >
                              {actionLoading[a.id] === 'toggle' ? '...' : a.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              onClick={() => { setConfirmDelete(a.id); setSelectedAdmin(a) }}
                              disabled={isSelf || actionLoading[a.id] === 'delete'}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              style={{ backgroundColor: '#ef444420', color: '#fca5a5' }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ToastContainer />
    </div>
  )
}
