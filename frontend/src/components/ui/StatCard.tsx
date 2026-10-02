import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string
  icon: LucideIcon
  iconTone?: 'neutral' | 'warning'
  helperText?: string
  helperTone?: 'neutral' | 'positive' | 'warning' | 'critical'
}

const HELPER_TONE_CLASS: Record<NonNullable<StatCardProps['helperTone']>, string> = {
  neutral: 'text-ink-400',
  positive: 'text-safe-text',
  warning: 'text-watch-text',
  critical: 'text-critical-text',
}

export function StatCard({
  label,
  value,
  icon: Icon,
  iconTone = 'neutral',
  helperText,
  helperTone = 'neutral',
}: StatCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-[20px] border border-slate-200/90 bg-white p-5 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-lift">
      <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-slate-50 transition-transform duration-300 group-hover:scale-125" />
      <div className="flex items-start justify-between">
        <p className="relative text-[11px] font-semibold text-slate-500">{label}</p>
        <span
          className={cn(
            'relative flex h-9 w-9 items-center justify-center rounded-xl',
            iconTone === 'warning' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-700',
          )}
        >
          <Icon className="h-[17px] w-[17px]" strokeWidth={1.9} />
        </span>
      </div>
      <p className="relative mt-4 text-[28px] font-bold tracking-tight text-slate-950">{value}</p>
      {helperText && (
        <p className={cn('relative mt-1.5 text-[10px] font-medium leading-4', HELPER_TONE_CLASS[helperTone])}>
          {helperText}
        </p>
      )}
    </div>
  )
}
