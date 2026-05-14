import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { getCashflow, getBudgetStatus, getTransactions, getTopCategories, getCategories } from '../api/index.js'
import CurrencyAmount from '../components/CurrencyAmount.jsx'
import OnboardingWizard from '../components/OnboardingWizard.jsx'

function SkeletonBlock({ className = '' }) {
  return (
    <div className={`animate-pulse rounded-xl bg-slate-700/40 ${className}`} />
  )
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl px-4 py-3 shadow-2xl border text-sm"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}>
        <p className="font-semibold mb-2 text-white">{label}</p>
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 mb-0.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span style={{ color: '#94a3b8' }}>{entry.name}:</span>
            <span className="font-medium" style={{ color: entry.color }}>
              ${(entry.value / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

function KpiCard({ label, value, accent, icon, trend }) {
  return (
    <div
      className="rounded-2xl border shadow-sm relative overflow-hidden"
      style={{ backgroundColor: '#1e293b', borderColor: '#334155', borderLeft: `4px solid ${accent}` }}
    >
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#94a3b8' }}>{label}</p>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${accent}18` }}
          >
            <span style={{ color: accent }}>{icon}</span>
          </div>
        </div>
        <div className="text-2xl font-bold text-white mb-1">{value}</div>
        {trend && (
          <p className="text-xs flex items-center gap-1" style={{ color: '#64748b' }}>
            {trend}
          </p>
        )}
      </div>
    </div>
  )
}

function CategoryBadge({ color, name }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ backgroundColor: '#0f172a', color: '#94a3b8' }}
    >
      {color && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />}
      {name}
    </span>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [showOnboarding, setShowOnboarding] = useState(!localStorage.getItem('ft_onboarded'))
  const [cashflow, setCashflow] = useState([])
  const [budget, setBudget] = useState([])
  const [transactions, setTransactions] = useState([])
  const [topCats, setTopCats] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Widget A: Upcoming Recurring Bills
  const [upcomingRecurring, setUpcomingRecurring] = useState([])
  const [recurringLoading, setRecurringLoading] = useState(true)

  // Widget B: Budget vs Actual
  const [budgetCategories, setBudgetCategories] = useState([])
  const [catSpending, setCatSpending] = useState({})
  const [budgetVsActualLoading, setBudgetVsActualLoading] = useState(true)

  useEffect(() => {
    const fetchAll = async () => {
      const now = new Date()
      const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0')
      const monthStart = `${y}-${m}-01`
      const lastDay = new Date(y, now.getMonth() + 1, 0).getDate()
      const monthEnd = `${y}-${m}-${lastDay}`
      try {
        const [cfRes, budRes, txRes, topRes] = await Promise.all([
          getCashflow(6),
          getBudgetStatus(),
          getTransactions({ limit: 5, skip: 0 }),
          getTopCategories({ start_date: monthStart, end_date: monthEnd, limit: 5 }),
        ])
        setCashflow(cfRes.data?.data || cfRes.data || [])
        setBudget(budRes.data?.data || budRes.data || [])
        setTransactions(txRes.data?.data || txRes.data || [])
        setTopCats(topRes.data?.data || [])
      } catch {
        setError('Failed to load dashboard data.')
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  // Widget A: fetch recurring transactions
  useEffect(() => {
    const fetchRecurring = async () => {
      try {
        const res = await getTransactions({ limit: 20 })
        const all = res.data?.data || res.data || []
        const recurring = all.filter(t => t.is_recurring || t.recurring_template_id)
        setUpcomingRecurring(recurring.slice(0, 5))
      } catch {
        setUpcomingRecurring([])
      } finally {
        setRecurringLoading(false)
      }
    }
    fetchRecurring()
  }, [])

  // Widget B: fetch categories with budgets + current month transactions for spending
  useEffect(() => {
    const fetchBudgetVsActual = async () => {
      try {
        const now = new Date()
        const [catsRes, txRes] = await Promise.all([
          getCategories(),
          getTransactions({ month: now.getMonth() + 1, year: now.getFullYear(), limit: 500 }),
        ])
        const cats = catsRes.data?.data || catsRes.data || []
        const txList = txRes.data?.data || txRes.data || []

        // Compute spending per category for current month
        const spentByCategory = {}
        txList.forEach(t => {
          if ((t.type === 'expense' || t.is_income === false) && t.category_id) {
            spentByCategory[t.category_id] = (spentByCategory[t.category_id] || 0) + (t.amount_cents || 0)
          }
        })

        // Filter to categories with a budget set
        const withBudget = cats.filter(c => c.budget_cents > 0).slice(0, 6)
        setBudgetCategories(withBudget)
        setCatSpending(spentByCategory)
      } catch {
        setBudgetCategories([])
        setCatSpending({})
      } finally {
        setBudgetVsActualLoading(false)
      }
    }
    fetchBudgetVsActual()
  }, [])

  const now = new Date()
  const curYear = now.getFullYear(), curMon = now.getMonth() + 1
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevYear = prevDate.getFullYear(), prevMon = prevDate.getMonth() + 1

  const curMonthData = cashflow.find(m => m.year === curYear && m.month === curMon) || {}
  const prevMonthData = cashflow.find(m => m.year === prevYear && m.month === prevMon) || {}

  const curIncome = curMonthData.income_cents || 0
  const curExpenses = curMonthData.expense_cents || 0
  const curNet = curIncome - curExpenses
  const prevIncome = prevMonthData.income_cents || 0
  const prevExpenses = prevMonthData.expense_cents || 0
  const prevNet = prevIncome - prevExpenses

  const momPct = (cur, prev) => {
    if (!prev) return null
    return Math.round(((cur - prev) / prev) * 100)
  }

  const totalIncome = cashflow.reduce((s, m) => s + (m.income_cents || 0), 0)
  const totalExpenses = cashflow.reduce((s, m) => s + (m.expense_cents || 0), 0)
  const netSavings = totalIncome - totalExpenses
  const categoryCount = budget.length

  const savingsRate = curIncome > 0 ? Math.round((curNet / curIncome) * 100) : 0
  const savingsRateStr = `${savingsRate > 0 ? '+' : ''}${savingsRate}%`

  // Financial health score out of 100
  let healthScore = 0
  // Up to 40 pts for savings rate
  if (savingsRate >= 30) healthScore += 40
  else if (savingsRate >= 20) healthScore += 30
  else if (savingsRate >= 10) healthScore += 20
  else if (savingsRate >= 0) healthScore += 10
  // Up to 30 pts for budget categories set up
  if (categoryCount >= 5) healthScore += 30
  else if (categoryCount >= 3) healthScore += 20
  else if (categoryCount >= 1) healthScore += 10
  // Up to 30 pts for consistent cashflow data (have at least 3 months of data)
  const monthsWithData = cashflow.filter(m => m.income_cents > 0 || m.expense_cents > 0).length
  if (monthsWithData >= 6) healthScore += 30
  else if (monthsWithData >= 3) healthScore += 20
  else if (monthsWithData >= 1) healthScore += 10

  const healthLabel = healthScore >= 80 ? 'Excellent' : healthScore >= 60 ? 'Good' : healthScore >= 40 ? 'Fair' : 'Needs Work'
  const healthColor = healthScore >= 80 ? '#22c55e' : healthScore >= 60 ? '#3b82f6' : healthScore >= 40 ? '#f59e0b' : '#ef4444'

  const chartData = cashflow.map((m) => ({
    month: m.month ? `${MONTH_NAMES[m.month - 1]} '${String(m.year).slice(2)}` : '',
    Income: m.income_cents || 0,
    Expenses: m.expense_cents || 0
  }))

  const getBudgetBarColor = (spent, limit) => {
    if (!limit) return '#6366f1'
    const pct = (spent / limit) * 100
    if (pct >= 90) return '#ef4444'
    if (pct >= 70) return '#f59e0b'
    return '#22c55e'
  }

  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <SkeletonBlock className="h-8 w-56 mb-2" />
          <SkeletonBlock className="h-4 w-80" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <SkeletonBlock key={i} className="h-28" />)}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <SkeletonBlock key={i} className="h-32" />)}
        </div>
        <SkeletonBlock className="h-80" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3"><SkeletonBlock className="h-72" /></div>
          <div className="lg:col-span-2 flex flex-col gap-6">
            <SkeletonBlock className="h-44" />
            <SkeletonBlock className="h-44" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl p-6 border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {showOnboarding && (
        <OnboardingWizard onComplete={() => setShowOnboarding(false)} />
      )}
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          {greeting} <span>👋</span>
        </h1>
        <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>{todayStr}</p>
      </div>

      {/* This Month summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Income', cents: curIncome, prev: prevIncome, accent: '#22c55e', positive: true },
          { label: 'Expenses', cents: curExpenses, prev: prevExpenses, accent: '#ef4444', positive: false },
          { label: 'Net', cents: curNet, prev: prevNet, accent: curNet >= 0 ? '#6366f1' : '#f59e0b', positive: curNet >= 0 },
        ].map(({ label, cents, prev, accent, positive }) => {
          const pct = momPct(cents, prev)
          const up = cents >= prev
          return (
            <div key={label} className="rounded-2xl border p-5 relative overflow-hidden"
              style={{ backgroundColor:'#1e293b', borderColor:'#334155', borderTop:`3px solid ${accent}` }}>
              <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color:'#64748b' }}>
                {label} · {MONTH_NAMES[curMon-1]}
              </p>
              <div className="text-2xl font-bold mb-2" style={{ color: label === 'Net' ? (cents >= 0 ? '#22c55e' : '#ef4444') : (label === 'Expenses' ? '#ef4444' : '#22c55e') }}>
                <CurrencyAmount cents={label === 'Expenses' ? -cents : cents} />
              </div>
              {pct !== null ? (
                <div className="flex items-center gap-1 text-xs font-medium" style={{ color: up ? '#22c55e' : '#ef4444' }}>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d={up ? 'M5 10l7-7m0 0l7 7m-7-7v18' : 'M19 14l-7 7m0 0l-7-7m7 7V3'} />
                  </svg>
                  {Math.abs(pct)}% vs {MONTH_NAMES[prevMon-1]}
                </div>
              ) : (
                <p className="text-xs" style={{ color:'#475569' }}>No prior month data</p>
              )}
            </div>
          )
        })}
      </div>

      {/* 4 KPI stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Income (6mo)"
          value={<CurrencyAmount cents={totalIncome} />}
          accent="#22c55e"
          trend={
            <span className="flex items-center gap-1" style={{ color: '#22c55e' }}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              Last 6 months
            </span>
          }
          icon={
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: 18, height: 18 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 11l5-5m0 0l5 5m-5-5v12" />
            </svg>
          }
        />
        <KpiCard
          label="Total Expenses (6mo)"
          value={<CurrencyAmount cents={-totalExpenses} />}
          accent="#ef4444"
          trend={
            <span className="flex items-center gap-1" style={{ color: '#ef4444' }}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              Last 6 months
            </span>
          }
          icon={
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: 18, height: 18 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 13l-5 5m0 0l-5-5m5 5V6" />
            </svg>
          }
        />
        <KpiCard
          label="Net Savings (6mo)"
          value={<CurrencyAmount cents={netSavings} />}
          accent="#6366f1"
          trend={
            <span style={{ color: '#64748b' }}>Income minus expenses</span>
          }
          icon={
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: 18, height: 18 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          }
        />
        <KpiCard
          label="Categories"
          value={<span className="text-white">{categoryCount}</span>}
          accent="#64748b"
          trend={
            <span style={{ color: '#64748b' }}>Active budget categories</span>
          }
          icon={
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: 18, height: 18 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          }
        />
        <KpiCard
          label="Savings Rate"
          value={savingsRateStr}
          accent={savingsRate >= 20 ? '#22c55e' : savingsRate >= 10 ? '#f59e0b' : '#ef4444'}
          icon="📈"
          trend={savingsRate >= 20 ? 'On track — great job!' : savingsRate >= 0 ? 'Try to save 20%+' : 'Spending exceeds income'}
        />
      </div>

      {/* Financial Health Score */}
      <div className="rounded-2xl border p-5 mb-6" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#94a3b8' }}>Financial Health Score</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold" style={{ color: healthColor }}>{healthScore}</span>
              <span className="text-sm font-semibold" style={{ color: healthColor }}>{healthLabel}</span>
              <span className="text-sm" style={{ color: '#475569' }}>/ 100</span>
            </div>
          </div>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: `${healthColor}18` }}>
            {healthScore >= 80 ? '🏆' : healthScore >= 60 ? '👍' : healthScore >= 40 ? '📊' : '⚠️'}
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-3 rounded-full" style={{ backgroundColor: '#334155' }}>
          <div
            className="h-3 rounded-full transition-all duration-500"
            style={{ width: `${healthScore}%`, backgroundColor: healthColor }}
          />
        </div>
        {/* Breakdown hints */}
        <div className="flex gap-4 mt-3 text-xs" style={{ color: '#64748b' }}>
          <span>Savings: {savingsRate >= 20 ? '✓' : '○'} {Math.min(savingsRate >= 30 ? 40 : savingsRate >= 20 ? 30 : savingsRate >= 10 ? 20 : 10, 40)}/40 pts</span>
          <span>Budget: {categoryCount >= 3 ? '✓' : '○'} {categoryCount >= 5 ? 30 : categoryCount >= 3 ? 20 : categoryCount >= 1 ? 10 : 0}/30 pts</span>
          <span>History: {monthsWithData >= 3 ? '✓' : '○'} {monthsWithData >= 6 ? 30 : monthsWithData >= 3 ? 20 : monthsWithData >= 1 ? 10 : 0}/30 pts</span>
        </div>
      </div>

      {/* Widget Row: Recurring Bills + Budget vs Actual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Widget A: Recurring Bills */}
        <div className="rounded-2xl border shadow-sm" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <div className="px-6 pt-5 pb-4 border-b flex items-center justify-between" style={{ borderColor: '#334155' }}>
            <div>
              <h2 className="text-base font-semibold text-white">Recurring Bills</h2>
              <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>Recent recurring transactions</p>
            </div>
            <Link
              to="/transactions"
              className="flex items-center gap-1 text-xs font-medium transition-colors"
              style={{ color: '#818cf8' }}
            >
              View all
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          <div className="p-5">
            {recurringLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <div className="flex-1 space-y-1.5">
                      <div className="animate-pulse rounded bg-slate-700/40 h-3.5 w-3/4" />
                      <div className="animate-pulse rounded bg-slate-700/40 h-2.5 w-1/3" />
                    </div>
                    <div className="animate-pulse rounded bg-slate-700/40 h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : upcomingRecurring.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10" style={{ color: '#64748b' }}>
                <svg className="w-9 h-9 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <p className="text-sm mb-2">No recurring transactions set up</p>
                <Link to="/transactions" className="text-xs font-medium" style={{ color: '#818cf8' }}>
                  Add a transaction
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingRecurring.map((t) => {
                  const isExpense = !t.is_income && t.type !== 'income'
                  const amountColor = isExpense ? '#f87171' : '#4ade80'
                  const amountCents = isExpense ? -Math.abs(t.amount_cents || 0) : (t.amount_cents || 0)
                  const freq = t.frequency || t.recurrence_interval || 'monthly'
                  return (
                    <div key={t.id} className="flex items-center justify-between gap-3 py-1.5 border-b last:border-0" style={{ borderColor: '#1e3a5f22' }}>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{t.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {t.category_name && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                              style={{ backgroundColor: '#0f172a', color: '#94a3b8' }}
                            >
                              {t.category_color && (
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.category_color }} />
                              )}
                              {t.category_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-sm font-semibold" style={{ color: amountColor }}>
                          <CurrencyAmount cents={amountCents} />
                        </span>
                        <span
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: '#1e3a5f', color: '#818cf8' }}
                        >
                          {freq}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Widget B: Budget vs Actual (this month) */}
        <div className="rounded-2xl border shadow-sm" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <div className="px-6 pt-5 pb-4 border-b flex items-center justify-between" style={{ borderColor: '#334155' }}>
            <div>
              <h2 className="text-base font-semibold text-white">Budget Status</h2>
              <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>Spending vs. limits this month</p>
            </div>
            <Link
              to="/budget"
              className="flex items-center gap-1 text-xs font-medium transition-colors"
              style={{ color: '#818cf8' }}
            >
              Manage
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          <div className="p-5">
            {budgetVsActualLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between">
                      <div className="animate-pulse rounded bg-slate-700/40 h-3 w-24" />
                      <div className="animate-pulse rounded bg-slate-700/40 h-3 w-16" />
                    </div>
                    <div className="animate-pulse rounded-full bg-slate-700/40 h-1.5 w-full" />
                  </div>
                ))}
              </div>
            ) : budgetCategories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10" style={{ color: '#64748b' }}>
                <svg className="w-9 h-9 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                </svg>
                <p className="text-sm mb-2">No budgets set</p>
                <Link to="/budget" className="text-xs font-medium" style={{ color: '#818cf8' }}>
                  Set spending limits
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {budgetCategories.map((cat) => {
                  const spent = catSpending[cat.id] || 0
                  const pct = (spent / cat.budget_cents) * 100
                  const barColor = pct >= 100 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#10b981'
                  const labelColor = pct >= 100 ? '#f87171' : pct >= 70 ? '#fbbf24' : '#34d399'
                  return (
                    <div key={cat.id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          {cat.color && (
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                          )}
                          <span className="text-sm font-medium text-white">{cat.name}</span>
                        </div>
                        <span className="text-xs font-semibold" style={{ color: labelColor }}>
                          {pct >= 100 ? 'Over budget' : `${Math.round(pct)}%`}
                        </span>
                      </div>
                      <div className="w-full rounded-full h-1.5" style={{ backgroundColor: '#334155' }}>
                        <div
                          className="h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }}
                        />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-xs" style={{ color: '#64748b' }}>
                          <CurrencyAmount cents={spent} className="text-xs" /> spent
                        </span>
                        <span className="text-xs" style={{ color: '#64748b' }}>
                          of <CurrencyAmount cents={cat.budget_cents} className="text-xs" />
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Cash Flow Chart */}
      <div className="rounded-2xl border shadow-sm" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        <div className="px-6 pt-5 pb-4 border-b" style={{ borderColor: '#334155' }}>
          <h2 className="text-base font-semibold text-white">Cash Flow</h2>
          <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>Income vs. expenses over the last 6 months</p>
        </div>
        <div className="p-6">
          {chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16" style={{ color: '#64748b' }}>
              <svg className="w-10 h-10 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-sm">No cash flow data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#64748b', fontSize: 12, fontFamily: 'Inter' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'Inter' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${(v / 100).toLocaleString('en-US', { notation: 'compact' })}`}
                  width={60}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.05)' }} />
                <Bar dataKey="Income" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {/* Legend */}
          {chartData.length > 0 && (
            <div className="flex items-center gap-5 mt-2 justify-center">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#22c55e' }} />
                <span className="text-xs" style={{ color: '#94a3b8' }}>Income</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#ef4444' }} />
                <span className="text-xs" style={{ color: '#94a3b8' }}>Expenses</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Three-column grid: Recent Transactions + Top Categories + Budget Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Recent Transactions — col-span-3 */}
        <div className="lg:col-span-3 rounded-2xl border shadow-sm" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <div className="px-6 pt-5 pb-4 border-b flex items-center justify-between" style={{ borderColor: '#334155' }}>
            <div>
              <h2 className="text-base font-semibold text-white">Recent Transactions</h2>
              <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>Latest activity</p>
            </div>
            <Link
              to="/transactions"
              className="flex items-center gap-1 text-xs font-medium transition-colors"
              style={{ color: '#818cf8' }}
            >
              View all
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          <div className="p-2">
            {transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12" style={{ color: '#64748b' }}>
                <svg className="w-9 h-9 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-sm">No recent transactions</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Date</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Description</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Category</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="border-t transition-colors hover:bg-slate-800/50"
                      style={{ borderColor: '#334155' }}
                    >
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#64748b' }}>
                        {tx.date ? new Date(tx.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                      </td>
                      <td className="px-4 py-3 font-medium text-white max-w-[160px] truncate">
                        {tx.description}
                      </td>
                      <td className="px-4 py-3">
                        {tx.category_name ? (
                          <CategoryBadge color={tx.category_color} name={tx.category_name} />
                        ) : (
                          <span style={{ color: '#64748b' }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <CurrencyAmount
                          cents={tx.is_income ? tx.amount_cents : -Math.abs(tx.amount_cents || 0)}
                          className="text-sm font-semibold"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Top Spending + Budget stacked — col-span-2 */}
        <div className="lg:col-span-2 flex flex-col gap-6">

        {/* Top Spending Categories */}
        <div className="rounded-2xl border shadow-sm" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <div className="px-6 pt-5 pb-4 border-b" style={{ borderColor: '#334155' }}>
            <h2 className="text-base font-semibold text-white">Top Spending</h2>
            <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>By category this month</p>
          </div>
          <div className="p-5">
            {topCats.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: '#64748b' }}>No expenses this month</p>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const max = topCats[0]?.total_cents || 1
                  return topCats.map((cat) => (
                    <div key={cat.id}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color || '#6366f1' }} />
                          <span className="text-sm text-white">{cat.name}</span>
                        </div>
                        <CurrencyAmount cents={-cat.total_cents} className="text-xs font-semibold" />
                      </div>
                      <div className="h-1.5 rounded-full" style={{ backgroundColor: '#0f172a' }}>
                        <div className="h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${(cat.total_cents / max) * 100}%`, backgroundColor: cat.color || '#6366f1' }} />
                      </div>
                    </div>
                  ))
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Budget Overview — col-span-2 */}
        <div className="rounded-2xl border shadow-sm" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <div className="px-6 pt-5 pb-4 border-b" style={{ borderColor: '#334155' }}>
            <h2 className="text-base font-semibold text-white">Budget Overview</h2>
            <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>Monthly spending limits</p>
          </div>
          <div className="p-6">
            {budget.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10" style={{ color: '#64748b' }}>
                <svg className="w-9 h-9 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                </svg>
                <p className="text-sm">No budget data available</p>
              </div>
            ) : (
              <div className="space-y-5">
                {budget.map((cat) => {
                  const spent = cat.spent_cents || 0
                  const limit = cat.budget_cents || 1
                  const pct = Math.min((spent / limit) * 100, 100)
                  const barColor = getBudgetBarColor(spent, limit)
                  return (
                    <div key={cat.category_id || cat.name}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          {cat.color && (
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                          )}
                          <span className="text-sm font-medium text-white">{cat.name}</span>
                        </div>
                        <span className="text-xs font-medium" style={{ color: barColor }}>
                          {pct.toFixed(0)}% used
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ backgroundColor: '#0f172a' }}>
                        <div
                          className="h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: barColor }}
                        />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-xs" style={{ color: '#64748b' }}>
                          <CurrencyAmount cents={spent} className="text-xs" /> spent
                        </span>
                        <span className="text-xs" style={{ color: '#64748b' }}>
                          of <CurrencyAmount cents={cat.budget_cents || 0} className="text-xs" />
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        </div>{/* end right column */}
      </div>
    </div>
  )
}
