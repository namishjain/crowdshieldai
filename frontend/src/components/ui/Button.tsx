import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md'
}

const VARIANT_CLASS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-slate-900 text-white shadow-sm shadow-slate-900/10 hover:bg-slate-800 active:scale-[.98]',
  secondary: 'border border-slate-200 bg-white text-slate-700 shadow-sm shadow-slate-900/[.02] hover:border-slate-300 hover:bg-slate-50 active:scale-[.98]',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
}

const SIZE_CLASS: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center rounded-xl font-semibold transition duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        className,
      )}
      {...props}
    />
  )
}
