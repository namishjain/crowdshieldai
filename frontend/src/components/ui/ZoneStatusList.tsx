import type { Zone } from '@/types'
import { STATUS_STYLES } from '@/lib/utils'
import { STATUS_LABEL } from '@/lib/risk'

export function ZoneStatusList({ zones }: { zones: Zone[] }) {
  return (
    <ul className="divide-y divide-ink-100">
      {zones.map((zone) => {
        const styles = STATUS_STYLES[zone.status]
        return (
          <li key={zone.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
            <span className="flex items-center gap-2.5 text-sm text-ink-700">
              <span className={`h-2 w-2 rounded-full ${styles.dot}`} />
              {zone.name}
            </span>
            <span className="flex items-center gap-3">
              <span className={`text-xs font-semibold ${styles.text}`}>
                {STATUS_LABEL[zone.status]}
              </span>
              <span className="w-10 text-right text-sm font-semibold text-ink-800">
                {zone.count === null ? '—' : `${zone.count} / ${zone.capacity}`}
              </span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
