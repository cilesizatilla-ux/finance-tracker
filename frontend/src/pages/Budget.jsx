import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { getCategories, createCategory, updateCategory, deleteCategory, getBudgetStatus } from '../api/index.js'
import CurrencyAmount from '../components/CurrencyAmount.jsx'

const DEFAULT_COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16'
]

const CustomPieTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const item = payload[0]
    return (
      <div
        className="rounded-xl px-4 py-3 shadow-2xl border text-sm"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
      >
        <p className="font-semibold mb-1">{item.name}</p>
        <p style={{ color: item.payload.fill }}>
          ${(item.value / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </p>
      </div>
    )
  }
  return null
}

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

function AddCategoryForm({ onAdd, onCancel, defaultIsIncome }) {
  const [form, setForm] = useState({
    name: '',
    budget: '',
    color: DEFAULT_COLORS[0],
    is_income: defaultIsIncome ?? false
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onAdd({
        name: form.name,
        budget_cents: Math.round(parseFloat(form.budget || 0) * 100),
        color: form.color,
        is_income: form.is_income
      })
    } finally {
      setSaving(false)
    }
  }

  const inputBase = 'w-full px-3 py-2.5 rounded-xl text-sm border outline-none transition-all focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500'
  const inputStyle = { backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }

  return (
    <div className="rounded-2xl border shadow-sm" style={{ backgroundColor: '#1e293b', borderColor: '#6366f1', borderWidth: '1px' }}>
      <div className="px-6 py-4 border-b" style={{ borderColor: '#334155' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-600/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-white">New Budget Category</h3>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>Category Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Groceries"
              className={inputBase}
              style={inputStyle}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>Monthly Budget ($)</label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              placeholder="0.00"
              className={inputBase}
              style={inputStyle}
              value={form.budget}
              onChange={(e) => setForm({ ...form, budget: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                className="h-10 w-10 rounded-xl border cursor-pointer bg-transparent flex-shrink-0"
                style={{ borderColor: '#334155' }}
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
              />
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_COLORS.slice(0, 6).map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setForm({ ...form, color: c })}
                    className="w-5 h-5 rounded-full transition-all"
                    style={{
                      backgroundColor: c,
                      outline: form.color === c ? '2px solid white' : '2px solid transparent',
                      outlineOffset: '2px'
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Type toggle */}
        <div className="mb-5">
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>Type</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, is_income: false })}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                !form.is_income ? 'bg-red-500/15 border-red-500/40 text-red-300' : 'border-slate-700 text-slate-400 hover:bg-slate-700/40'
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, is_income: true })}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                form.is_income ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'border-slate-700 text-slate-400 hover:bg-slate-700/40'
              }`}
            >
              Income
            </button>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors hover:bg-slate-700/50"
            style={{ borderColor: '#334155', color: '#94a3b8' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 shadow-lg shadow-indigo-500/20"
          >
            {saving ? 'Adding…' : 'Add Category'}
          </button>
        </div>
      </form>
    </div>
  )
}

function CategoryCard({ cat, budgetStatus, onUpdate, onDelete, canDelete }) {
  const [editing, setEditing] = useState(false)
  const [budgetInput, setBudgetInput] = useState(((cat.budget_cents || 0) / 100).toFixed(2))
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const statusInfo = budgetStatus?.find((b) => b.category_id === cat.id || b.name === cat.name) || {}
  const spent = statusInfo.spent_cents || 0
  const budget = cat.budget_cents != null ? cat.budget_cents : (statusInfo.budget_cents || 0)
  const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0
  const limit = budget
  const remaining = Math.max(limit - spent, 0)

  const barColor = limit > 0
    ? pct >= 90 ? '#ef4444'
    : pct >= 70 ? '#f59e0b'
    : '#22c55e'
    : '#6366f1'

  const handleSaveBudget = async () => {
    setSaving(true)
    try {
      await onUpdate(cat.id, { budget_cents: Math.round(parseFloat(budgetInput) * 100) })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await onDelete(cat.id)
    } finally {
      setDeleting(false)
      setConfirmDel(false)
    }
  }

  return (
    <div
      className="rounded-2xl border shadow-sm overflow-hidden"
      style={{
        backgroundColor: '#1e293b',
        borderColor: '#334155',
        borderLeft: `4px solid ${cat.color || '#6366f1'}`
      }}
    >
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: cat.color || '#6366f1' }}
            />
            <span className="font-semibold text-white text-sm">{cat.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${barColor}15`, color: barColor }}
            >
              {limit > 0 ? `${pct.toFixed(0)}%` : 'No limit'}
            </span>
            {canDelete && confirmDel ? (
              <div className="flex items-center gap-1">
                <span className="text-xs" style={{ color: '#94a3b8' }}>Delete?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-2 py-0.5 rounded-lg text-xs bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-50"
                >
                  {deleting ? '…' : 'Yes'}
                </button>
                <button
                  onClick={() => setConfirmDel(false)}
                  className="px-2 py-0.5 rounded-lg text-xs border hover:bg-slate-700 transition-colors"
                  style={{ borderColor: '#334155', color: '#94a3b8' }}
                >
                  No
                </button>
              </div>
            ) : canDelete ? (
              <button
                onClick={() => setConfirmDel(true)}
                className="p-1 rounded-lg transition-colors hover:bg-red-500/10"
                style={{ color: '#475569' }}
                title="Delete category"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            ) : null}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full mb-3" style={{ backgroundColor: '#0f172a' }}>
          <div
            className="h-2 rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: barColor }}
          />
        </div>

        {/* Amounts row */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs" style={{ color: '#64748b' }}>Spent</p>
            <CurrencyAmount cents={spent} className="text-sm font-semibold" />
          </div>
          <div className="text-center">
            {limit > 0 && (
              <>
                <p className="text-xs" style={{ color: '#64748b' }}>Remaining</p>
                <CurrencyAmount cents={remaining} className="text-sm font-semibold" />
              </>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs" style={{ color: '#64748b' }}>Budget</p>
            {editing ? (
              <div className="flex items-center gap-1.5 mt-0.5">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-20 px-2 py-1 rounded-lg text-xs border outline-none focus:ring-1 focus:ring-indigo-500"
                  style={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }}
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveBudget()}
                  autoFocus
                />
                <button
                  onClick={handleSaveBudget}
                  disabled={saving}
                  className="px-2 py-1 rounded-lg text-xs bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
                >
                  {saving ? '…' : 'OK'}
                </button>
                <button
                  onClick={() => { setEditing(false); setBudgetInput(((cat.budget_cents || 0) / 100).toFixed(2)) }}
                  className="p-1 rounded-lg text-xs border hover:bg-slate-700 transition-colors"
                  style={{ borderColor: '#334155', color: '#94a3b8' }}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="text-sm font-semibold flex items-center gap-1 hover:opacity-75 transition-opacity"
                style={{ color: '#94a3b8' }}
              >
                <CurrencyAmount cents={limit} className="text-sm" />
                <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Budget() {
  const [categories, setCategories] = useState([])
  const [budgetStatus, setBudgetStatus] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [activeTab, setActiveTab] = useState('expense')
  const [toast, setToast] = useState(null)

  const now = new Date()
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1)
  const [viewYear, setViewYear] = useState(now.getFullYear())

  const isCurrentMonth = viewMonth === now.getMonth() + 1 && viewYear === now.getFullYear()

  const navBtnStyle = {
    background: '#1e293b', border: '1px solid #334155', color: '#94a3b8',
    borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 14
  }

  const prevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (isCurrentMonth) return
    if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const showToast = (msg, type = 'success') => setToast({ message: msg, type })

  const fetchData = async (month, year) => {
    setLoading(true)
    try {
      const [catRes, budRes] = await Promise.all([
        getCategories(),
        getBudgetStatus({ month, year })
      ])
      setCategories(catRes.data?.data || catRes.data || [])
      setBudgetStatus(budRes.data?.data || budRes.data || [])
    } catch {
      showToast('Failed to load budget data.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData(viewMonth, viewYear) }, [viewMonth, viewYear])

  const handleAdd = async (data) => {
    try {
      const res = await createCategory(data)
      if (res.data?.error) { showToast(res.data.error, 'error'); return }
      showToast('Category added.')
      setShowAddForm(false)
      fetchData(viewMonth, viewYear)
    } catch {
      showToast('Failed to add category.', 'error')
    }
  }

  const handleUpdate = async (id, data) => {
    try {
      const res = await updateCategory(id, data)
      if (res.data?.error) { showToast(res.data.error, 'error'); return }
      showToast('Budget updated.')
      fetchData(viewMonth, viewYear)
    } catch {
      showToast('Failed to update budget.', 'error')
    }
  }

  const handleDelete = async (id) => {
    try {
      const res = await deleteCategory(id)
      if (res.data?.error) { showToast(res.data.error, 'error'); return }
      showToast('Category deleted.')
      fetchData(viewMonth, viewYear)
    } catch {
      showToast('Failed to delete category.', 'error')
    }
  }

  const isIncome = activeTab === 'income'
  const visibleCats = categories.filter((c) => !!c.is_income === isIncome)

  const pieData = visibleCats
    .map((cat) => {
      const bs = budgetStatus.find((b) => b.category_id === cat.id || b.name === cat.name)
      return { name: cat.name, value: bs?.spent_cents || 0, fill: cat.color || DEFAULT_COLORS[0] }
    })
    .filter((d) => d.value > 0)

  const totalSpent = visibleCats.reduce((s, cat) => {
    const bs = budgetStatus.find((b) => b.category_id === cat.id || b.name === cat.name)
    return s + (bs?.spent_cents || 0)
  }, 0)
  const totalBudget = visibleCats.reduce((s, c) => s + (c.budget_cents || 0), 0)

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Budget</h1>
          <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>Track spending against your monthly limits</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={prevMonth} style={navBtnStyle}>‹</button>
            <span style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 600, minWidth: 120, textAlign: 'center' }}>
              {new Date(viewYear, viewMonth - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={nextMonth} style={{ ...navBtnStyle, opacity: isCurrentMonth ? 0.4 : 1 }} disabled={isCurrentMonth}>›</button>
          </div>
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-lg shadow-indigo-500/20"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Category
            </button>
          )}
        </div>
      </div>

      {/* Past month banner */}
      {!isCurrentMonth && (
        <div style={{ backgroundColor: '#f59e0b20', border: '1px solid #f59e0b40', color: '#fbbf24', borderRadius: 8, padding: '8px 14px', fontSize: 12, marginBottom: 16 }}>
          Viewing {new Date(viewYear, viewMonth - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })} — read-only snapshot
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: '#1e293b' }}>
        {[
          { key: 'expense', label: 'Expenses' },
          { key: 'income', label: 'Income' }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setShowAddForm(false) }}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Add form */}
      {showAddForm && (
        <AddCategoryForm
          onAdd={handleAdd}
          onCancel={() => setShowAddForm(false)}
          defaultIsIncome={isIncome}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Category cards — col-span-3 */}
        <div className="lg:col-span-3 space-y-4">
          {/* Summary strip */}
          {!loading && visibleCats.length > 0 && (
            <div
              className="rounded-2xl border px-5 py-4 flex items-center justify-between"
              style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
            >
              <div>
                <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#64748b' }}>
                  {isIncome ? 'Total Income' : 'Total Spent'}
                </p>
                <CurrencyAmount cents={totalSpent} className="text-lg font-bold" />
              </div>
              <div className="w-px h-8" style={{ backgroundColor: '#334155' }} />
              <div>
                <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#64748b' }}>Total Budget</p>
                <CurrencyAmount cents={totalBudget} className="text-lg font-bold" />
              </div>
              <div className="w-px h-8" style={{ backgroundColor: '#334155' }} />
              <div>
                <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#64748b' }}>Categories</p>
                <p className="text-lg font-bold text-white">{visibleCats.length}</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border p-5 space-y-3 animate-pulse"
                  style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
                >
                  <div className="flex justify-between">
                    <div className="h-4 w-28 rounded-lg bg-slate-700/50" />
                    <div className="h-4 w-12 rounded-full bg-slate-700/50" />
                  </div>
                  <div className="h-2 rounded-full bg-slate-700/50" />
                  <div className="flex justify-between">
                    <div className="h-4 w-20 rounded-lg bg-slate-700/50" />
                    <div className="h-4 w-20 rounded-lg bg-slate-700/50" />
                  </div>
                </div>
              ))}
            </div>
          ) : visibleCats.length === 0 ? (
            <div
              className="rounded-2xl border flex flex-col items-center justify-center py-16"
              style={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#64748b' }}
            >
              <svg className="w-10 h-10 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
              </svg>
              <p className="text-sm font-medium">No {isIncome ? 'income' : 'expense'} categories yet</p>
              <p className="text-xs mt-1" style={{ color: '#475569' }}>Click "Add Category" to get started</p>
            </div>
          ) : (
            visibleCats.map((cat) => (
              <CategoryCard
                key={cat.id}
                cat={cat}
                budgetStatus={budgetStatus}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                canDelete={cat.user_id != null}
              />
            ))
          )}
        </div>

        {/* Donut PieChart — col-span-2 */}
        <div
          className="lg:col-span-2 rounded-2xl border shadow-sm"
          style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
        >
          <div className="px-6 pt-5 pb-4 border-b" style={{ borderColor: '#334155' }}>
            <h2 className="text-base font-semibold text-white">
              {isIncome ? 'Income' : 'Spending'} Distribution
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>By category ({new Date(viewYear, viewMonth - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })})</p>
          </div>
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center h-56">
                <div className="w-36 h-36 rounded-full bg-slate-700/40 animate-pulse" />
              </div>
            ) : pieData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-56" style={{ color: '#64748b' }}>
                <svg className="w-10 h-10 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                </svg>
                <p className="text-sm">No data yet</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {pieData.map((entry) => {
                    const pct = totalSpent > 0 ? ((entry.value / totalSpent) * 100).toFixed(1) : 0
                    return (
                      <div key={entry.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.fill }} />
                          <span className="text-xs" style={{ color: '#94a3b8' }}>{entry.name}</span>
                        </div>
                        <span className="text-xs font-medium" style={{ color: '#64748b' }}>{pct}%</span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
