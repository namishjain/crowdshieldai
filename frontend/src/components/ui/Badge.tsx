import type { ZoneStatus } from '@/types'
import { STATUS_STYLES } from '@/lib/utils'
import { STATUS_LABEL } from '@/lib/risk'
import { cn } from '@/lib/utils'

export function StatusBadge({ status, className }: { status: ZoneStatus; className?: string }) {
  const styles = STATUS_STYLES[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold',
        styles.bg,
        styles.text,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', styles.dot)} />
      {STATUS_LABEL[status]}
    </span>
  )
}
