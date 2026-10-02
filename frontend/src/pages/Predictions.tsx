import { useMemo, useState } from 'react'
import { GitCompare } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import { CongestionForecastChart } from '@/components/charts/CongestionForecastChart'
import { useCrowdStore } from '@/store/useCrowdStore'
import { highestMeasuredCount, highestProjectedRisk, statusFromRisk } from '@/lib/adapters'
import { cn } from '@/lib/utils'

const HORIZONS = ['10 min', '20 min', '30 min'] as const

export default function Predictions() {
  const [horizon, setHorizon] = useState<(typeof HORIZONS)[number]>('30 min')
  const state = useCrowdStore((store) => store.state)
  const score = state?.global_risk_score ?? null
  const maxProjected = highestProjectedRisk(state)
  const peakPoint = state?.predictions.reduce((best, point) =>
    point.projected_risk_score !== null && (!best || point.projected_risk_score > (best.projected_risk_score ?? -1)) ? point : best, undefined as (typeof state.predictions)[number] | undefined)
  const viewCount = highestMeasuredCount(state)
  const forecasts = state?.predictions ?? []
  const forecast = useMemo(() => [
    ...(score === null ? [] : [{ time: 'Now', current: score, forecast: score }]),
    ...forecasts.map((point) => ({ time: `+${point.horizon_minutes} min`, forecast: point.projected_risk_score ?? undefined })),
  ], [forecasts, score])
  const horizons = new Map(forecasts.map((point) => [point.horizon_minutes, point]))
  const plus10 = horizons.get(10)?.projected_risk_score ?? null
  const plus20 = horizons.get(20)?.projected_risk_score ?? null
  const plus30 = horizons.get(30)?.projected_risk_score ?? null
  const reported = state?.venue.views_with_measurements ?? 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><h1 className="text-2xl font-semibold text-ink-800">Risk predictions</h1><p className="mt-1 text-sm text-ink-400">Short-term trend estimates from observed camera-view counts.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-ink-100 bg-white p-1">{HORIZONS.map((item) => <button key={item} onClick={() => setHorizon(item)} className={cn('rounded-md px-3 py-1.5 text-xs font-semibold transition-colors', horizon === item ? 'bg-ink-700 text-white' : 'text-ink-500 hover:bg-ink-50')}>{item}</button>)}</div>
          <Link to="/app/live-operations"><Button variant="secondary"><GitCompare className="mr-1.5 inline h-3.5 w-3.5" />Compare views</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard label="Current venue risk" value={score === null ? '—' : `${score.toFixed(1)} / 100`} detail={state?.global_risk_state?.replace('_', ' ') || 'Waiting for measurements'} />
        <SummaryCard label="Highest projected risk" value={maxProjected === null ? '—' : `${maxProjected.toFixed(1)} / 100`} detail={peakPoint ? `At +${peakPoint.horizon_minutes} minutes · ${peakPoint.projected_risk_state}` : 'No projection available'} />
        <SummaryCard label="Highest measured view" value={viewCount === null ? '—' : viewCount.toLocaleString('en-IN')} detail={`${reported} camera views reporting`} />
        <SummaryCard label="Projection horizon" value="10–30 min" detail="Bounded linear count-trend heuristic" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Projected risk trend" subtitle="Risk score · 0 to 100" className="lg:col-span-2">
          <div className="mb-2 flex items-center gap-4 text-xs text-ink-400"><span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-ink-700" />Measured now</span><span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-watch-dot" style={{ borderTop: '2px dashed #f59e0b' }} />Trend projection</span><span>Critical threshold: 80</span></div>
          {forecast.length ? <CongestionForecastChart data={forecast} /> : <EmptyState text="Forecast appears after camera counts are available." />}
          <div className="mt-2 flex justify-between text-xs text-ink-400"><span>Risk score (0–100)</span><span>Selected window: {horizon}</span></div>
        </Card>

        <Card title="Current view risk" subtitle="Measured camera views; highest first">
          {state?.zones.length ? <ul className="flex flex-col divide-y divide-ink-100">{[...state.zones].sort((a, b) => (b.risk_score ?? -1) - (a.risk_score ?? -1)).map((zone) => <li key={zone.zone_id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div><p className="text-sm font-medium text-ink-800">{zone.name}</p><p className="text-xs text-ink-400">{zone.count === null ? 'No measurement' : `${zone.count} of ${zone.capacity} reference capacity`}</p></div><div className="text-right"><StatusBadge status={statusFromRisk(zone.risk_state)} /><p className="mt-1 text-xs font-semibold text-ink-500">{zone.risk_score === null ? '—' : `${zone.risk_score.toFixed(1)} / 100`}</p></div></li>)}</ul> : <EmptyState text="Waiting for configured camera views." />}
        </Card>
      </div>

      <Card title="Projection details" subtitle="Current and projected values from the backend's configured trend model">
        <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b border-ink-100 text-xs text-ink-400"><th className="pb-3 font-medium">Metric</th><th className="pb-3 font-medium">Current</th><th className="pb-3 font-medium">+10 min</th><th className="pb-3 font-medium">+20 min</th><th className="pb-3 font-medium">+30 min</th></tr></thead><tbody>
          <tr className="border-b border-ink-50"><td className="py-3 font-medium text-ink-800">Highest view count</td><td>{viewCount ?? '—'}</td><td>{projectedCount(horizons.get(10)?.projected_count)}</td><td>{projectedCount(horizons.get(20)?.projected_count)}</td><td>{projectedCount(horizons.get(30)?.projected_count)}</td></tr>
          <tr><td className="py-3 font-medium text-ink-800">Venue risk score</td><td>{score === null ? '—' : score.toFixed(1)}</td><td>{formatScore(plus10)}</td><td>{formatScore(plus20)}</td><td>{formatScore(plus30)}</td></tr>
        </tbody></table></div>
      </Card>

      <div className="flex flex-col gap-3 rounded-xl2 border border-watch-dot/30 bg-watch-bg px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-medium text-watch-text">These projections are heuristic trend estimates, not a trained model or guaranteed prediction.</p><Link to="/app/what-if"><Button variant="primary" className="bg-watch-dot hover:bg-watch-text">Run simulation</Button></Link></div>
    </div>
  )
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <Card><p className="text-sm text-ink-400">{label}</p><p className="mt-2 text-xl font-semibold text-ink-800">{value}</p><p className="mt-1 text-xs font-medium text-ink-400">{detail}</p></Card>
}

function projectedCount(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : Math.round(value).toLocaleString('en-IN')
}

function formatScore(value: number | null) {
  return value === null ? '—' : value.toFixed(1)
}

function EmptyState({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-ink-400">{text}</p>
}
