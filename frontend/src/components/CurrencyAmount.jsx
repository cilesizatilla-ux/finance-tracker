export default function CurrencyAmount({ cents, className = '' }) {
  const dollars = cents / 100
  const isNegative = cents < 0
  const isPositive = cents > 0

  const colorClass = isNegative
    ? 'text-red-400'
    : isPositive
    ? 'text-emerald-400'
    : 'text-slate-400'

  const formatted = `$${Math.abs(dollars).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`

  const displayValue = isNegative ? `-${formatted}` : formatted

  return (
    <span className={`font-mono ${colorClass} ${className}`}>
      {displayValue}
    </span>
  )
}
