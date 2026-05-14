import { useState, useEffect, useCallback } from 'react'
import api from '../api/index.js'
import { useToast } from '../contexts/ToastContext.jsx'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const STATUS_COLORS = {
  scheduled: 'bg-indigo-600 text-white',
  in_progress: 'bg-amber-500 text-white',
  completed: 'bg-emerald-600 text-white',
  cancelled: 'bg-slate-600 text-slate-300',
}

function StatusBadge({ status }) {
  const cls = STATUS_COLORS[status] || 'bg-slate-600 text-slate-300'
  const label = status ? status.replace('_', ' ') : '—'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
      {label}
    </span>
  )
}

function buildAuditsByDay(entries, currentYear, currentMonth) {
  const auditsByDay = {}
  entries.forEach(entry => {
    const start = new Date(entry.audit_date + 'T00:00:00')
    const end = new Date(start)
    end.setDate(end.getDate() + (entry.duration_days || 1) - 1)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
        const day = d.getDate()
        if (!auditsByDay[day]) auditsByDay[day] = []
        if (!auditsByDay[day].find(e => e.id === entry.id)) {
          auditsByDay[day].push(entry)
        }
      }
    }
  })
  return auditsByDay
}

export default function AuditCalendar() {
  const { showToast } = useToast()

  const now = new Date()
  const [currentYear, setCurrentYear] = useState(now.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(now.getMonth())
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEntry, setSelectedEntry] = useState(null)

  const loadEntries = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/audit/entries', {
        params: { year: currentYear, month: currentMonth + 1 }
      })
      setEntries(res.data || [])
    } catch {
      showToast('Failed to load audit entries.', 'error')
    } finally {
      setLoading(false)
    }
  }, [currentYear, currentMonth, showToast])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  function prevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear(y => y - 1)
    } else {
      setCurrentMonth(m => m - 1)
    }
  }

  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear(y => y + 1)
    } else {
      setCurrentMonth(m => m + 1)
    }
  }

  async function downloadFullCalendar() {
    try {
      const res = await api.get('/audit/calendar.ics', { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = 'audit-calendar.ics'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      showToast('Failed to download calendar.', 'error')
    }
  }

  async function downloadEntryIcs(entry) {
    try {
      const res = await api.get(`/audit/entries/${entry.id}/ical`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-${entry.id}.ics`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      showToast('Failed to download .ics file.', 'error')
    }
  }

  // Build calendar grid
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay()
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const todayDate = now.getDate()
  const todayYear = now.getFullYear()
  const todayMonth = now.getMonth()

  const auditsByDay = buildAuditsByDay(entries, currentYear, currentMonth)

  // Total cells: leading empties + days
  const totalCells = firstDayOfWeek + daysInMonth
  const rows = Math.ceil(totalCells / 7)
  const cells = Array.from({ length: rows * 7 }, (_, i) => {
    const dayNum = i - firstDayOfWeek + 1
    return dayNum >= 1 && dayNum <= daysInMonth ? dayNum : null
  })

  const isToday = (day) =>
    day !== null &&
    currentYear === todayYear &&
    currentMonth === todayMonth &&
    day === todayDate

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Audit Calendar</h1>
        <button
          onClick={downloadFullCalendar}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-indigo-500 text-indigo-400 text-sm font-medium hover:bg-indigo-500/10 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download Full Calendar (.ics)
        </button>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between bg-slate-800 rounded-xl px-5 py-3 border border-slate-700">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          aria-label="Previous month"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-base font-semibold text-white tracking-wide">
          {MONTH_NAMES[currentMonth].toUpperCase()} {currentYear}
        </span>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          aria-label="Next month"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Calendar */}
      <div className="rounded-xl border border-slate-700 overflow-hidden bg-slate-800">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-slate-700">
          {DAY_HEADERS.map(day => (
            <div key={day} className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
              {day}
            </div>
          ))}
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
            <svg className="animate-spin w-5 h-5 mr-2 text-indigo-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading...
          </div>
        ) : (
          <>
            {/* Grid cells */}
            <div className="grid grid-cols-7">
              {cells.map((day, idx) => (
                <div
                  key={idx}
                  className={`min-h-[80px] border border-slate-700 p-1 ${
                    day === null ? 'bg-slate-900/40' : isToday(day) ? 'bg-slate-700' : ''
                  }`}
                >
                  {day !== null && (
                    <>
                      <span className={`block text-xs mb-1 font-medium ${
                        isToday(day) ? 'text-indigo-400' : 'text-slate-400'
                      }`}>
                        {day}
                      </span>
                      <div className="space-y-0.5">
                        {(auditsByDay[day] || []).map(entry => {
                          const colorCls = STATUS_COLORS[entry.status] || 'bg-slate-600 text-slate-300'
                          const label = (entry.client_name || '').length > 20
                            ? (entry.client_name || '').slice(0, 20) + '…'
                            : (entry.client_name || '—')
                          return (
                            <button
                              key={entry.id}
                              onClick={() => setSelectedEntry(entry)}
                              className={`w-full text-left text-xs px-1.5 py-0.5 rounded truncate cursor-pointer ${colorCls} hover:opacity-80 transition-opacity`}
                              title={entry.client_name}
                            >
                              {label}
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Empty state */}
            {!loading && entries.length === 0 && (
              <div className="py-16 text-center text-slate-400 text-sm border-t border-slate-700">
                No audits assigned to you this month.
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail modal */}
      {selectedEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedEntry(null) }}
        >
          <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg">
            {/* Modal header */}
            <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-slate-700">
              <div>
                <h2 className="text-lg font-bold text-white leading-snug">
                  {selectedEntry.client_name}
                </h2>
                {selectedEntry.company_name && (
                  <p className="text-sm text-slate-400 mt-0.5">— {selectedEntry.company_name}</p>
                )}
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="ml-4 p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors flex-shrink-0"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4">
              {/* Details grid */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-400 mb-0.5">Audit Date</p>
                  <p className="text-slate-200 font-medium">
                    {selectedEntry.audit_date
                      ? new Date(selectedEntry.audit_date + 'T00:00:00').toLocaleDateString('en-US', {
                          month: 'long', day: 'numeric', year: 'numeric'
                        })
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-400 mb-0.5">Duration</p>
                  <p className="text-slate-200 font-medium">
                    {selectedEntry.duration_days
                      ? `${selectedEntry.duration_days} day${selectedEntry.duration_days !== 1 ? 's' : ''}`
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-400 mb-0.5">Location</p>
                  <p className="text-slate-200 font-medium">{selectedEntry.location || '—'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-400 mb-0.5">Status</p>
                  <StatusBadge status={selectedEntry.status} />
                </div>
              </div>

              {/* Notes */}
              {selectedEntry.notes && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-400 mb-1">Notes</p>
                  <p className="text-sm text-slate-300 bg-slate-900/50 rounded-lg px-3 py-2 leading-relaxed">
                    {selectedEntry.notes}
                  </p>
                </div>
              )}

              {/* Assigned Auditors */}
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 mb-1.5">Assigned Auditors</p>
                {selectedEntry.auditors && selectedEntry.auditors.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedEntry.auditors.map((auditor, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-700 text-slate-200"
                      >
                        {typeof auditor === 'string' ? auditor : auditor.name || auditor.full_name || JSON.stringify(auditor)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 italic">None assigned</p>
                )}
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 pb-5 pt-2 flex items-center justify-end gap-3 border-t border-slate-700 mt-2">
              <button
                onClick={() => setSelectedEntry(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => downloadEntryIcs(selectedEntry)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download .ics
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
