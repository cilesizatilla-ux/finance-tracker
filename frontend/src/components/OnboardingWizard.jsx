import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/index.js'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'TRY', 'JPY', 'CAD', 'AUD', 'CHF', 'INR', 'BRL']

const GOALS = [
  { id: 'save_money', label: 'Save Money', emoji: '💰' },
  { id: 'track_spending', label: 'Track Spending', emoji: '📊' },
  { id: 'manage_budget', label: 'Manage Budget', emoji: '📋' },
  { id: 'grow_wealth', label: 'Grow Wealth', emoji: '📈' },
]

export default function OnboardingWizard({ onComplete }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const TOTAL_STEPS = 4

  // Step 2 state
  const [currency, setCurrency] = useState('USD')
  const [country, setCountry] = useState('')

  // Step 3 state
  const [goal, setGoal] = useState(null)

  function finish() {
    localStorage.setItem('ft_onboarded', '1')
    onComplete()
  }

  function handleSkip() {
    localStorage.setItem('ft_onboarded', '1')
    onComplete()
  }

  async function handleStep2Next() {
    try {
      await api.patch('/users/profile', {
        currency,
        ...(country.trim() ? { country: country.trim() } : {}),
      })
    } catch (err) {
      console.log('Profile update failed (step 2):', err)
    }
    setStep(3)
  }

  async function handleStep3Next() {
    if (goal) {
      try {
        await api.patch('/users/profile', { financial_goal: goal })
      } catch (err) {
        console.log('Profile update failed (step 3):', err)
      }
    }
    setStep(4)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        {/* Progress indicator */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium" style={{ color: '#64748b' }}>
              Step {step} of {TOTAL_STEPS}
            </span>
            <span className="text-xs font-medium" style={{ color: '#64748b' }}>
              {Math.round((step / TOTAL_STEPS) * 100)}%
            </span>
          </div>
          <div className="h-1.5 rounded-full" style={{ backgroundColor: '#0f172a' }}>
            <div
              className="h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%`, backgroundColor: '#6366f1' }}
            />
          </div>
          <div className="flex items-center gap-1.5 mt-3 justify-center">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <span
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i + 1 === step ? 20 : 8,
                  height: 8,
                  backgroundColor: i + 1 <= step ? '#6366f1' : '#334155',
                }}
              />
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="px-6 pb-2">
          {step === 1 && <Step1 onNext={() => setStep(2)} />}
          {step === 2 && (
            <Step2
              currency={currency}
              setCurrency={setCurrency}
              country={country}
              setCountry={setCountry}
              onBack={() => setStep(1)}
              onNext={handleStep2Next}
            />
          )}
          {step === 3 && (
            <Step3
              goal={goal}
              setGoal={setGoal}
              onBack={() => setStep(2)}
              onNext={handleStep3Next}
            />
          )}
          {step === 4 && (
            <Step4
              onComplete={finish}
              onAddTransaction={() => { finish(); navigate('/transactions') }}
            />
          )}
        </div>

        {/* Skip link */}
        <div className="px-6 pb-6 pt-2 text-center">
          <button
            onClick={handleSkip}
            className="text-xs transition-colors hover:underline"
            style={{ color: '#475569' }}
          >
            Skip setup
          </button>
        </div>
      </div>
    </div>
  )
}

function Step1({ onNext }) {
  return (
    <div className="text-center py-4">
      <div className="text-5xl mb-5">💰</div>
      <h2 className="text-xl font-bold text-white mb-2">Welcome to Finance Tracker!</h2>
      <p className="text-sm mb-8" style={{ color: '#94a3b8' }}>
        Let's set up your account in a few quick steps.
      </p>
      <button
        onClick={onNext}
        className="w-full py-3 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-lg shadow-indigo-500/20"
      >
        Get Started →
      </button>
    </div>
  )
}

function Step2({ currency, setCurrency, country, setCountry, onBack, onNext }) {
  return (
    <div className="py-2">
      <h2 className="text-xl font-bold text-white mb-1">What's your primary currency?</h2>
      <p className="text-sm mb-6" style={{ color: '#94a3b8' }}>
        We'll use this to display all your amounts.
      </p>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>Currency</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
            style={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>Country <span style={{ color: '#475569' }}>(optional)</span></label>
          <input
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="e.g. United States"
            className="w-full px-4 py-3 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
            style={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }}
          />
        </div>
      </div>
      <div className="flex gap-3 mt-7">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-xl text-sm font-medium border transition-colors"
          style={{ borderColor: '#334155', color: '#94a3b8', backgroundColor: 'transparent' }}
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          className="flex-1 py-3 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  )
}

function Step3({ goal, setGoal, onBack, onNext }) {
  return (
    <div className="py-2">
      <h2 className="text-xl font-bold text-white mb-1">What's your main financial goal?</h2>
      <p className="text-sm mb-5" style={{ color: '#94a3b8' }}>
        Choose the one that best describes your focus.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {GOALS.map((g) => (
          <button
            key={g.id}
            onClick={() => setGoal(g.id)}
            className="rounded-xl border p-4 text-center transition-all"
            style={{
              backgroundColor: goal === g.id ? '#6366f115' : '#0f172a',
              borderColor: goal === g.id ? '#6366f1' : '#334155',
              borderWidth: goal === g.id ? 2 : 1,
            }}
          >
            <div className="text-2xl mb-2">{g.emoji}</div>
            <div className="text-sm font-medium" style={{ color: goal === g.id ? '#a5b4fc' : '#94a3b8' }}>
              {g.label}
            </div>
          </button>
        ))}
      </div>
      <div className="flex gap-3 mt-6">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-xl text-sm font-medium border transition-colors"
          style={{ borderColor: '#334155', color: '#94a3b8', backgroundColor: 'transparent' }}
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          className="flex-1 py-3 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  )
}

function Step4({ onComplete, onAddTransaction }) {
  return (
    <div className="text-center py-4">
      <div className="text-5xl mb-5">🎉</div>
      <h2 className="text-xl font-bold text-white mb-2">You're all set!</h2>
      <p className="text-sm mb-8" style={{ color: '#94a3b8' }}>
        Start by adding your first transaction, or explore the dashboard to see your financial overview.
      </p>
      <div className="flex gap-3">
        <button
          onClick={onComplete}
          className="flex-1 py-3 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-lg shadow-indigo-500/20"
        >
          Go to Dashboard
        </button>
        <button
          onClick={onAddTransaction}
          className="flex-1 py-3 rounded-xl text-sm font-medium border transition-colors hover:bg-slate-700/40"
          style={{ borderColor: '#334155', color: '#94a3b8', backgroundColor: 'transparent' }}
        >
          Add Transaction
        </button>
      </div>
    </div>
  )
}
