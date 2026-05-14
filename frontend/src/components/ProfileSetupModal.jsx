import { useState } from 'react'
import { setupProfile } from '../api/index.js'

const ROLE_OPTIONS = [
  {
    value: 'user',
    label: 'User',
    description: 'Regular user managing personal finances',
    icon: '👤',
    color: '#6366f1',
  },
  {
    value: 'auditor',
    label: 'Auditor',
    description: 'Performs financial audits at client sites',
    icon: '🔍',
    color: '#3b82f6',
  },
  {
    value: 'lead_auditor',
    label: 'Lead Auditor',
    description: 'Leads audit teams and reviews audit results',
    icon: '⭐',
    color: '#f59e0b',
  },
  {
    value: 'observer',
    label: 'Observer',
    description: 'Observes audits without active participation',
    icon: '👁',
    color: '#8b5cf6',
  },
  {
    value: 'admin',
    label: 'Admin',
    description: 'Requires Super Admin approval after selection',
    icon: '🛡',
    color: '#ef4444',
  },
]

export default function ProfileSetupModal({ onComplete }) {
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [pendingAdmin, setPendingAdmin] = useState(false)
  const [error, setError] = useState(null)

  async function handleConfirm() {
    if (!selected) return
    setLoading(true)
    setError(null)
    try {
      const res = await setupProfile({ user_type: selected })
      const data = res.data?.data || res.data
      if (data?.needs_approval) {
        setPendingAdmin(true)
      }
      setDone(true)
    } catch (e) {
      setError(e.response?.data?.detail || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    onComplete(selected)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1e293b] border border-[#334155] rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[#334155]">
          <h2 className="text-xl font-semibold text-white">Welcome! Tell us about yourself</h2>
          <p className="text-sm text-slate-400 mt-1">
            Select your role to personalise your experience.
          </p>
        </div>

        {done ? (
          <div className="px-6 py-8 text-center">
            {pendingAdmin ? (
              <>
                <div className="text-4xl mb-3">⏳</div>
                <h3 className="text-lg font-semibold text-white mb-2">Approval Pending</h3>
                <p className="text-slate-400 text-sm mb-6">
                  Your Admin role request has been sent to a Super Admin for approval. You will be
                  notified once approved.
                </p>
              </>
            ) : (
              <>
                <div className="text-4xl mb-3">✅</div>
                <h3 className="text-lg font-semibold text-white mb-2">Role Set!</h3>
                <p className="text-slate-400 text-sm mb-6">
                  Your profile has been configured. You're all set.
                </p>
              </>
            )}
            <button
              onClick={handleClose}
              className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
            >
              Continue to App
            </button>
          </div>
        ) : (
          <>
            <div className="px-6 py-4 space-y-2">
              {ROLE_OPTIONS.map((opt) => {
                const active = selected === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => setSelected(opt.value)}
                    className={`w-full flex items-start gap-4 p-4 rounded-xl border transition-all text-left ${
                      active
                        ? 'border-indigo-500 bg-indigo-500/10'
                        : 'border-[#334155] bg-[#0f172a] hover:border-slate-500'
                    }`}
                  >
                    <span className="text-2xl mt-0.5">{opt.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white text-sm">{opt.label}</span>
                        {opt.value === 'admin' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                            Needs approval
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{opt.description}</p>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-full border-2 mt-1 flex-shrink-0 flex items-center justify-center transition-colors ${
                        active ? 'border-indigo-400' : 'border-slate-600'
                      }`}
                    >
                      {active && <div className="w-2 h-2 rounded-full bg-indigo-400" />}
                    </div>
                  </button>
                )
              })}
            </div>

            {error && (
              <p className="px-6 text-sm text-red-400">{error}</p>
            )}

            <div className="px-6 py-4 border-t border-[#334155] flex items-center justify-between gap-3">
              <button
                onClick={() => onComplete(null)}
                className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
              >
                Skip for now
              </button>
              <button
                onClick={handleConfirm}
                disabled={!selected || loading}
                className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
              >
                {loading ? 'Saving…' : 'Confirm Role'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
