import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CardProps {
  title?: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}

export function Card({ title, subtitle, action, children, className, bodyClassName }: CardProps) {
  return (
    <div className={cn('overflow-hidden rounded-[20px] border border-slate-200/90 bg-white shadow-card transition-shadow duration-200 hover:shadow-lift', className)}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6 sm:py-5">
          <div>
            {title && <h3 className="text-[14px] font-bold tracking-[-.01em] text-slate-900">{title}</h3>}
            {subtitle && <p className="mt-1 max-w-2xl text-[11px] leading-5 text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={cn('p-5 sm:p-6', bodyClassName)}>{children}</div>
    </div>
  )
}
