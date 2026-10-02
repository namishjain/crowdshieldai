import { clsx, type ClassValue } from 'clsx'
import type { AlertSeverity, ZoneStatus } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatNumber(n: number): string {
  return n.toLocaleString('en-IN')
}

// Status → design tokens. Always route through this map; never hardcode
// a status color inline in a component, so the safe/watch/high/critical
// palette stays the single source of truth for severity.
export const STATUS_STYLES: Record<
  ZoneStatus,
  { bg: string; text: string; dot: string }
> = {
  safe: { bg: 'bg-safe-bg', text: 'text-safe-text', dot: 'bg-safe-dot' },
  watch: { bg: 'bg-watch-bg', text: 'text-watch-text', dot: 'bg-watch-dot' },
  high: { bg: 'bg-high-bg', text: 'text-high-text', dot: 'bg-high-dot' },
  critical: { bg: 'bg-critical-bg', text: 'text-critical-text', dot: 'bg-critical-dot' },
  unknown: { bg: 'bg-ink-50', text: 'text-ink-400', dot: 'bg-ink-300' },
}

export const SEVERITY_TO_STATUS: Record<AlertSeverity, ZoneStatus> = {
  low: 'safe',
  medium: 'watch',
  high: 'high',
  critical: 'critical',
}

export function timeAgo(minutes: number): string {
  if (minutes < 1) return 'just now'
  if (minutes === 1) return '1 min ago'
  return `${minutes} min ago`
}
