import { useState, useEffect, useCallback } from 'react'
import api from '../api/index.js'
import { useToast } from '../contexts/ToastContext.jsx'

const STATUS_BADGE = {
  active: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30',
  completed: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  paused: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  cancelled: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
}

function fmt(cents) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function fmtDate(iso) {
  if (!iso) return 'No deadline'
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function ProgressRing({ pct, color }) {
  const radius = 30
  const circ = 2 * Math.PI * radius
  const offset = circ * (1 - pct / 100)
  return (
    <svg width="80" height="80" viewBox="0 0 80 80">
      <circle cx="40" cy="40" r={radius} fill="none" stroke="#334155" strokeWidth="8" />
      <circle
        cx="40" cy="40" r={radius}
        fill="none"
        stroke={color || '#6366f1'}
        strokeWidth="8"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 40 40)"
      />
      <text x="40" y="44" textAnchor="middle" fontSize="12" fontWeight="700" fill="#f1f5f9">
        {pct}%
      </text>
    </svg>
  )
}

function GoalCard({ goal, onContribute, onEdit, onDelete }) {
  return (
    <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5 flex flex-col gap-4">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-3xl leading-none flex-shrink-0">{goal.icon}</span>
          <div className="min-w-0">
            <h3 className="font-semibold text-white text-base leading-tight truncate">{goal.name}</h3>
            {goal.description && (
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{goal.description}</p>
            )}
          </div>
        </div>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_BADGE[goal.status] || STATUS_BADGE.active}`}>
          {goal.status}
        </span>
      </div>

      {/* Progress ring + amounts */}
      <div className="flex items-center gap-4">
        <ProgressRing pct={goal.pct} color={goal.color} />
        <div>
          <p className="text-lg font-bold text-white">{fmt(goal.current_amount_cents)}</p>
          <p className="text-xs text-slate-400">of {fmt(goal.target_amount_cents)}</p>
          <p className="text-xs text-slate-500 mt-1">Due: {fmtDate(goal.deadline)}</p>
          <p className="text-xs text-slate-500">{goal.contributions_count} contribution{goal.contributions_count !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1 border-t border-slate-700">
        <button
          onClick={() => onContribute(goal)}
          disabled={goal.status === 'completed' || goal.status === 'cancelled'}
          className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
        >
          Contribute
        </button>
        <button
          onClick={() => onEdit(goal)}
          className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(goal)}
          className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
          title="Delete goal"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  )
}

const EMPTY_FORM = { name: '', target: '', deadline: '', icon: '🎯', color: '#6366f1', desc: '' }

export default function Goals() {
  const { showToast } = useToast()

  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)

  // Add/Edit modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingGoal, setEditingGoal] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Contribute modal
  const [showContributeModal, setShowContributeModal] = useState(false)
  const [contributingGoal, setContributingGoal] = useState(null)
  const [contribAmount, setContribAmount] = useState('')
  const [contribNote, setContribNote] = useState('')
  const [contribLoading, setContribLoading] = useState(false)

  const loadGoals = useCallback(() => {
    setLoading(true)
    api.get('/goals')
      .then(r => setGoals(r.data))
      .catch(() => showToast('Failed to load goals', 'error'))
      .finally(() => setLoading(false))
  }, [showToast])

  useEffect(() => { loadGoals() }, [loadGoals])

  // Open add modal
  function openAdd() {
    setEditingGoal(null)
    setForm(EMPTY_FORM)
    setShowAddModal(true)
  }

  // Open edit modal
  function openEdit(goal) {
    setEditingGoal(goal)
    setForm({
      name: goal.name,
      target: (goal.target_amount_cents / 100).toFixed(2),
      deadline: goal.deadline || '',
      icon: goal.icon,
      color: goal.color,
      desc: goal.description || '',
    })
    setShowAddModal(true)
  }

  function closeAddModal() {
    setShowAddModal(false)
    setEditingGoal(null)
    setForm(EMPTY_FORM)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim()) return showToast('Goal name is required', 'error')
    const targetCents = Math.round(parseFloat(form.target) * 100)
    if (!targetCents || targetCents <= 0) return showToast('Enter a valid target amount', 'error')

    const payload = {
      name: form.name.trim(),
      description: form.desc.trim() || null,
      target_amount_cents: targetCents,
      deadline: form.deadline || null,
      icon: form.icon || '🎯',
      color: form.color || '#6366f1',
    }

    setSaving(true)
    try {
      if (editingGoal) {
        await api.put(`/goals/${editingGoal.id}`, payload)
        showToast('Goal updated', 'success')
      } else {
        await api.post('/goals', payload)
        showToast('Goal created', 'success')
      }
      closeAddModal()
      loadGoals()
    } catch {
      showToast('Failed to save goal', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(goal) {
    if (!window.confirm(`Delete "${goal.name}"? This cannot be undone.`)) return
    try {
      await api.delete(`/goals/${goal.id}`)
      showToast('Goal deleted', 'success')
      loadGoals()
    } catch {
      showToast('Failed to delete goal', 'error')
    }
  }

  function openContribute(goal) {
    setContributingGoal(goal)
    setContribAmount('')
    setContribNote('')
    setShowContributeModal(true)
  }

  function closeContributeModal() {
    setShowContributeModal(false)
    setContributingGoal(null)
    setContribAmount('')
    setContribNote('')
  }

  async function handleContribute(e) {
    e.preventDefault()
    const cents = Math.round(parseFloat(contribAmount) * 100)
    if (!cents || cents <= 0) return showToast('Enter a valid amount', 'error')
    setContribLoading(true)
    try {
      await api.post(`/goals/${contributingGoal.id}/contribute`, {
        amount_cents: cents,
        note: contribNote.trim() || null,
      })
      showToast('Contribution added!', 'success')
      closeContributeModal()
      loadGoals()
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Failed to add contribution', 'error')
    } finally {
      setContribLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Savings Goals</h1>
          <p className="text-sm text-slate-400 mt-1">Track your progress toward financial milestones</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Goal
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="text-6xl mb-4">🎯</span>
          <h2 className="text-xl font-semibold text-white mb-2">No savings goals yet</h2>
          <p className="text-slate-400 mb-6 max-w-sm">Create your first savings goal to start tracking your progress toward financial milestones.</p>
          <button
            onClick={openAdd}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors"
          >
            Create First Goal
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {goals.map(goal => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onContribute={openContribute}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">{editingGoal ? 'Edit Goal' : 'New Savings Goal'}</h2>
              <button onClick={closeAddModal} className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Goal Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Emergency Fund"
                  required
                  className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Target Amount */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Target Amount ($) *</label>
                <input
                  type="number"
                  value={form.target}
                  onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
                  placeholder="0.00"
                  step="0.01"
                  min="0.01"
                  required
                  className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Deadline */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Deadline (optional)</label>
                <input
                  type="date"
                  value={form.deadline}
                  onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Icon + Color row */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Icon (emoji)</label>
                  <input
                    type="text"
                    value={form.icon}
                    onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                    placeholder="🎯"
                    className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Color</label>
                  <input
                    type="color"
                    value={form.color}
                    onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                    className="h-10 w-16 bg-slate-900 border border-slate-600 rounded-xl cursor-pointer p-1"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Description (optional)</label>
                <textarea
                  value={form.desc}
                  onChange={e => setForm(f => ({ ...f, desc: e.target.value }))}
                  placeholder="What is this goal for?"
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeAddModal}
                  className="flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
                >
                  {saving ? 'Saving…' : editingGoal ? 'Save Changes' : 'Create Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contribute Modal */}
      {showContributeModal && contributingGoal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-sm shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">Add Contribution</h2>
                <p className="text-xs text-slate-400 mt-0.5">{contributingGoal.icon} {contributingGoal.name}</p>
              </div>
              <button onClick={closeContributeModal} className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleContribute} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Amount ($) *</label>
                <input
                  type="number"
                  value={contribAmount}
                  onChange={e => setContribAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0.01"
                  required
                  autoFocus
                  className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Note (optional)</label>
                <input
                  type="text"
                  value={contribNote}
                  onChange={e => setContribNote(e.target.value)}
                  placeholder="e.g. Monthly savings"
                  className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div className="bg-slate-900/50 rounded-xl p-3 text-xs text-slate-400">
                Current: {fmt(contributingGoal.current_amount_cents)} / {fmt(contributingGoal.target_amount_cents)}
                <span className="ml-2 text-slate-500">({contributingGoal.pct}%)</span>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeContributeModal}
                  className="flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={contribLoading}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
                >
                  {contribLoading ? 'Saving…' : 'Add Contribution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
