import { useState, useEffect, useCallback } from 'react'
import api from '../api/index.js'
import { useToast } from '../contexts/ToastContext.jsx'

const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', TRY: '₺' }

const CATEGORY_OPTIONS = [
  { value: 'travel', label: 'Travel' },
  { value: 'accommodation', label: 'Accommodation' },
  { value: 'meals', label: 'Meals & Entertainment' },
  { value: 'transportation', label: 'Local Transportation' },
  { value: 'supplies', label: 'Office Supplies' },
  { value: 'other', label: 'Other' },
]

const FILTER_TABS = ['all', 'pending', 'approved', 'rejected']

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatAmount(amountCents, currency) {
  const symbol = CURRENCY_SYMBOLS[currency] || currency || ''
  const value = (amountCents / 100).toFixed(2)
  return `${symbol}${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

function StatusBadge({ status }) {
  const styles = {
    pending: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    approved: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    rejected: 'bg-red-500/20 text-red-400 border border-red-500/30',
  }
  const cls = styles[status] || 'bg-slate-700 text-slate-400 border border-slate-600'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
      {status || '—'}
    </span>
  )
}

function SkeletonRow() {
  return (
    <tr>
      {[1, 2, 3, 4, 5, 6, 7].map(i => (
        <td key={i} className="px-4 py-3">
          <div className="animate-pulse h-4 rounded bg-slate-700/60" style={{ width: i === 2 ? '80%' : '60%' }} />
        </td>
      ))}
    </tr>
  )
}

export default function AuditExpenses() {
  const { showToast } = useToast()

  const [showForm, setShowForm] = useState(false)
  const [activeFilter, setActiveFilter] = useState('all')
  const [expenses, setExpenses] = useState([])
  const [audits, setAudits] = useState([])
  const [loadingExpenses, setLoadingExpenses] = useState(true)
  const [loadingAudits, setLoadingAudits] = useState(true)
  const [editingId, setEditingId] = useState(null)

  // Form state
  const [selectedAuditId, setSelectedAuditId] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [category, setCategory] = useState('travel')
  const [description, setDescription] = useState('')
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0])
  const [submitting, setSubmitting] = useState(false)

  // Inline edit state
  const [editAmount, setEditAmount] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editCategory, setEditCategory] = useState('travel')
  const [editDate, setEditDate] = useState('')
  const [saving, setSaving] = useState(false)

  const loadExpenses = useCallback(async () => {
    setLoadingExpenses(true)
    try {
      const res = await api.get('/audit/my-expenses', {
        params: { status: activeFilter === 'all' ? undefined : activeFilter }
      })
      setExpenses(res.data || [])
    } catch {
      showToast('Failed to load expenses.', 'error')
    } finally {
      setLoadingExpenses(false)
    }
  }, [activeFilter, showToast])

  const loadAudits = useCallback(async () => {
    setLoadingAudits(true)
    try {
      const res = await api.get('/audit/entries')
      const data = res.data || []
      setAudits(data)
      if (data.length > 0 && !selectedAuditId) {
        setSelectedAuditId(String(data[0].id))
      }
    } catch {
      showToast('Failed to load audits.', 'error')
    } finally {
      setLoadingAudits(false)
    }
  }, [showToast]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadAudits()
  }, [loadAudits])

  useEffect(() => {
    loadExpenses()
  }, [loadExpenses])

  function resetForm() {
    setAmount('')
    setCurrency('USD')
    setCategory('travel')
    setDescription('')
    setExpenseDate(new Date().toISOString().split('T')[0])
    if (audits.length > 0) setSelectedAuditId(String(audits[0].id))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!selectedAuditId) {
      showToast('Please select an audit.', 'error')
      return
    }
    if (!amount || isNaN(parseFloat(amount))) {
      showToast('Please enter a valid amount.', 'error')
      return
    }
    setSubmitting(true)
    try {
      await api.post(`/audit/entries/${selectedAuditId}/expenses`, {
        amount_cents: Math.round(parseFloat(amount) * 100),
        currency,
        description,
        category,
        expense_date: expenseDate,
      })
      showToast('Expense submitted!', 'success')
      setShowForm(false)
      resetForm()
      loadExpenses()
    } catch {
      showToast('Failed to submit expense.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  function startEdit(expense) {
    setEditingId(expense.id)
    setEditAmount((expense.amount_cents / 100).toFixed(2))
    setEditDescription(expense.description || '')
    setEditCategory(expense.category || 'travel')
    setEditDate(expense.expense_date || new Date().toISOString().split('T')[0])
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function saveEdit(expense) {
    if (!editAmount || isNaN(parseFloat(editAmount))) {
      showToast('Please enter a valid amount.', 'error')
      return
    }
    setSaving(true)
    try {
      await api.patch(`/audit/expenses/${expense.id}`, {
        amount_cents: Math.round(parseFloat(editAmount) * 100),
        description: editDescription,
        category: editCategory,
        expense_date: editDate,
      })
      showToast('Expense updated.', 'success')
      setEditingId(null)
      loadExpenses()
    } catch {
      showToast('Failed to update expense.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function deleteExpense(expense) {
    if (!window.confirm('Are you sure you want to delete this expense?')) return
    try {
      await api.delete(`/audit/expenses/${expense.id}`)
      showToast('Expense deleted.', 'success')
      loadExpenses()
    } catch {
      showToast('Failed to delete expense.', 'error')
    }
  }

  const categoryLabel = (val) =>
    CATEGORY_OPTIONS.find(o => o.value === val)?.label || val || '—'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Audit Expenses</h1>
        <button
          onClick={() => { setShowForm(v => !v); if (!showForm) resetForm() }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
        >
          {showForm ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Submit Expense
            </>
          )}
        </button>
      </div>

      {/* Submission form */}
      {showForm && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
          <h2 className="text-base font-semibold text-white mb-5">New Expense</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Audit selector */}
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                  Audit
                </label>
                <select
                  value={selectedAuditId}
                  onChange={e => setSelectedAuditId(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-600 text-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  {loadingAudits ? (
                    <option>Loading audits…</option>
                  ) : audits.length === 0 ? (
                    <option value="">No audits available</option>
                  ) : (
                    audits.map(audit => (
                      <option key={audit.id} value={audit.id}>
                        {audit.client_name} — {audit.company_name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                  Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="125.50"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-600 text-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-slate-600"
                />
              </div>

              {/* Currency */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 text-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  {['USD', 'EUR', 'GBP', 'TRY'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                  Category
                </label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 text-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  {CATEGORY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                  Date
                </label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={e => setExpenseDate(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-600 text-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="Brief description of the expense"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 text-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-slate-600"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
              >
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1 w-fit">
        {FILTER_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveFilter(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              activeFilter === tab
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Expenses table */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {['Date', 'Audit', 'Description', 'Category', 'Amount', 'Status', 'Actions'].map(col => (
                  <th
                    key={col}
                    className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingExpenses ? (
                [1, 2, 3, 4, 5].map(i => <SkeletonRow key={i} />)
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-slate-500 text-sm">
                    No expenses found.
                  </td>
                </tr>
              ) : (
                expenses.map(expense => {
                  if (editingId === expense.id) {
                    // Inline edit row
                    return (
                      <tr key={expense.id} className="border-t border-slate-700 bg-slate-900/40">
                        {/* Date */}
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            value={editDate}
                            onChange={e => setEditDate(e.target.value)}
                            className="bg-slate-800 border border-slate-600 text-slate-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 w-32"
                          />
                        </td>
                        {/* Audit (read-only in edit) */}
                        <td className="px-4 py-2 text-slate-400 text-xs">
                          {expense.audit_client
                            ? `${expense.audit_client} — ${expense.audit_company || ''}`
                            : '—'}
                        </td>
                        {/* Description */}
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={editDescription}
                            onChange={e => setEditDescription(e.target.value)}
                            className="bg-slate-800 border border-slate-600 text-slate-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 w-40"
                          />
                        </td>
                        {/* Category */}
                        <td className="px-3 py-2">
                          <select
                            value={editCategory}
                            onChange={e => setEditCategory(e.target.value)}
                            className="bg-slate-800 border border-slate-600 text-slate-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            {CATEGORY_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </td>
                        {/* Amount */}
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editAmount}
                            onChange={e => setEditAmount(e.target.value)}
                            className="bg-slate-800 border border-slate-600 text-slate-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 w-24"
                          />
                        </td>
                        {/* Status (read-only) */}
                        <td className="px-4 py-2">
                          <StatusBadge status={expense.status} />
                        </td>
                        {/* Actions */}
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => saveEdit(expense)}
                              disabled={saving}
                              className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium transition-colors"
                            >
                              {saving ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="px-3 py-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 text-xs font-medium transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr
                      key={expense.id}
                      className="border-t border-slate-700 hover:bg-slate-800/60 transition-colors"
                    >
                      {/* Date */}
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                        {formatDate(expense.expense_date)}
                      </td>
                      {/* Audit */}
                      <td className="px-4 py-3 text-slate-300 text-sm max-w-[180px]">
                        <span className="truncate block">
                          {expense.audit_client
                            ? `${expense.audit_client} — ${expense.audit_company || ''}`
                            : '—'}
                        </span>
                      </td>
                      {/* Description */}
                      <td className="px-4 py-3 text-slate-200 max-w-[160px]">
                        <span className="truncate block">{expense.description || '—'}</span>
                      </td>
                      {/* Category */}
                      <td className="px-4 py-3 text-slate-300 text-xs whitespace-nowrap">
                        {categoryLabel(expense.category)}
                      </td>
                      {/* Amount */}
                      <td className="px-4 py-3 text-slate-200 font-medium text-sm whitespace-nowrap">
                        {formatAmount(expense.amount_cents || 0, expense.currency)}
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <StatusBadge status={expense.status} />
                          {expense.status === 'rejected' && expense.review_note && (
                            <p className="text-xs italic text-slate-500 leading-snug max-w-[160px]">
                              {expense.review_note}
                            </p>
                          )}
                        </div>
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3">
                        {expense.status === 'pending' && (
                          <div className="flex items-center gap-2">
                            {/* Edit */}
                            <button
                              onClick={() => startEdit(expense)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-700 transition-colors"
                              aria-label="Edit expense"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            {/* Delete */}
                            <button
                              onClick={() => deleteExpense(expense)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors"
                              aria-label="Delete expense"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
