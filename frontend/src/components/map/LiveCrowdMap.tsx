import type { Zone } from '@/types'
import { STATUS_STYLES } from '@/lib/utils'

// Fixed layout positions on a 0-100 viewBox grid. In a real integration,
// these would come from the venue's digital-twin coordinates (see the
// "Digital Twin" module in the problem statement) instead of being fixed.
const LAYOUT: Record<string, { x: number; y: number; label: string }> = {
  VIEW_01: { x: 18, y: 62, label: 'View 01 · West' },
  VIEW_02: { x: 47, y: 44, label: 'View 02 · Centre' },
  VIEW_03: { x: 78, y: 56, label: 'View 03 · East' },
  VIEW_04: { x: 62, y: 78, label: 'View 04 · South' },
  VIEW_05: { x: 57, y: 19, label: 'View 05 · North' },
  VIEW_06: { x: 23, y: 29, label: 'View 06 · West' },
}

const DOT_HEX: Record<Zone['status'], string> = {
  safe: '#16a34a',
  watch: '#f59e0b',
  high: '#ea580c',
  critical: '#dc2626',
  unknown: '#7b8490',
}

interface LiveCrowdMapProps {
  zones: Zone[]
  variant?: 'compact' | 'detailed'
}

export function LiveCrowdMap({ zones, variant = 'compact' }: LiveCrowdMapProps) {
  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl2 bg-ink-900">
      <svg viewBox="0 0 100 56.25" className="absolute inset-0 h-full w-full" aria-hidden>
        {/* Road / path network */}
        <g stroke="#4a525c" strokeWidth="0.6" opacity="0.6">
          <line x1="0" y1="50" x2="100" y2="10" />
          <line x1="0" y1="10" x2="100" y2="45" />
          <line x1="30" y1="0" x2="55" y2="56" />
          <line x1="70" y1="0" x2="90" y2="56" />
        </g>
      </svg>

      {zones.map((zone) => {
        const pos = LAYOUT[zone.id]
        if (!pos) return null
        const size = 34 + (zone.occupancyPct ?? 0) * 0.35
        return (
          <div
            key={zone.id}
            className="absolute flex flex-col items-center transition-all duration-700 ease-out"
            style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)' }}
          >
            <div
              className="rounded-full opacity-80 transition-all duration-700 ease-out"
              style={{
                width: size,
                height: size,
                backgroundColor: DOT_HEX[zone.status],
                opacity: zone.occupancyPct === null ? 0.35 : 0.8,
              }}
            />
            <span className="mt-1 whitespace-nowrap rounded bg-ink-900/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
              {pos.label}{zone.count === null ? '' : ` · ${zone.count}`}
            </span>
          </div>
        )
      })}

      {variant === 'detailed' && (
        <div className="absolute right-3 top-3 rounded-md bg-ink-900/80 px-2 py-1 text-[10px] text-ink-100">
          Updated just now
        </div>
      )}

      <div className="absolute bottom-3 left-3 flex items-center gap-4 rounded-md bg-ink-900/70 px-3 py-1.5 text-[11px] text-white">
        {(['safe', 'watch', 'high', 'critical'] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${STATUS_STYLES[s].dot}`} />
            {s === 'safe' ? 'Safe' : s === 'watch' ? 'Watch' : s === 'high' ? 'High' : 'Critical'}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-ink-300" />No data
        </span>
      </div>
    </div>
  )
}
