import { Activity, AlertTriangle, ArrowUpRight, Camera, Route, ShieldCheck, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCrowdStore } from '@/store/useCrowdStore'
import { StatCard } from '@/components/ui/StatCard'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LiveCrowdMap } from '@/components/map/LiveCrowdMap'
import { CrowdTrendChart } from '@/components/charts/CrowdTrendChart'
import { ZoneStatusList } from '@/components/ui/ZoneStatusList'
import { displayZones, highestMeasuredCount, statusFromRisk } from '@/lib/adapters'
import { STATUS_STYLES } from '@/lib/utils'
import { STATUS_LABEL } from '@/lib/risk'
import { useOperatorStore } from '@/store/useOperatorStore'

function displayRisk(score: number | null | undefined) {
  return score === null || score === undefined ? '—' : `${Math.round(score)} / 100`
}

export default function Overview() {
  const state = useCrowdStore((store) => store.state)
  const connected = useCrowdStore((store) => store.connected)
  const trend = useCrowdStore((store) => store.trend)
  const error = useCrowdStore((store) => store.error)
  const zones = displayZones(state)
  const recommendations = state?.recommendations ?? []
  const operatorId = useOperatorStore((store) => store.operatorId) || 'Devansh Singh Bais'
  const firstName = operatorId.trim().split(/\s+/)[0] || 'Operator'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const riskStatus = statusFromRisk(state?.global_risk_state)
  const reported = state?.venue.views_with_measurements ?? 0
  const cameraTotal = state?.cameras.length ?? 0
  const count = highestMeasuredCount(state)
  const evacuationMinutes = state?.route.estimated_evacuation_minutes
  const evacuation = evacuationMinutes == null ? '—' : `${evacuationMinutes.toFixed(1)} min`

  return (
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-6 text-white shadow-xl shadow-slate-900/10 sm:px-8 sm:py-7">
        <div className="pointer-events-none absolute -right-12 -top-28 h-72 w-72 rounded-full border border-white/[.06]" />
        <div className="pointer-events-none absolute right-20 -top-16 h-52 w-52 rounded-full border border-amber-200/[.08]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.19em] text-amber-200"><ShieldCheck className="h-3.5 w-3.5" /> CrowdShield operations</span>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{greeting}, {firstName}</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Here’s your live venue picture: measured crowd movement, current risk, and the next actions for operator review.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.06] px-3 py-2 text-[10px] font-semibold text-slate-200"><span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-400' : 'animate-pulse bg-amber-400'}`} />{connected ? 'Live data connected' : 'Connecting to live data'}</span>
            <Link to="/app/reports"><Button variant="secondary" className="border-white/15 bg-white/[.08] text-white hover:border-white/20 hover:bg-white/[.14]">Export report</Button></Link>
            <Link to="/app/live-operations"><Button variant="primary" className="bg-amber-300 text-slate-950 hover:bg-amber-200">Live operations <ArrowUpRight className="ml-1.5 h-4 w-4" /></Button></Link>
          </div>
        </div>
        <div className="relative mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-4 text-[10px] text-slate-400">
          <span><strong className="font-bold text-white">{reported}/{cameraTotal || 6}</strong> camera views reporting</span>
          <span><strong className="font-bold text-white">{recommendations.length}</strong> current recommendations</span>
          <span><strong className="font-bold text-white">{state?.venue.name || 'Venue status loading'}</strong></span>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-watch-dot/30 bg-watch-bg px-4 py-3 text-sm text-watch-text">
          Backend connection issue: {error}. The dashboard will reconnect automatically.
        </div>
      )}

      {state?.system.active_feed_id && state.system.active_feed_id !== 'original' && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-amber-950">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <p className="text-xs leading-5"><strong>{state.system.active_feed_label}:</strong> {state.system.footage_notice} The six clips are short public samples, not live CCTV feeds; venue map and capacities remain illustrative.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Highest view count"
          value={count === null ? '—' : count.toLocaleString('en-IN')}
          icon={Users}
          helperText="Per camera view; overlapping views are not added"
        />
        <StatCard
          label="Camera views reporting"
          value={`${reported} / ${cameraTotal || 6}`}
          icon={Camera}
          helperText={reported ? 'Measured frames received' : 'Waiting for first processed frame'}
          helperTone={reported ? 'positive' : 'neutral'}
        />
        <StatCard
          label="Highest view risk"
          value={displayRisk(state?.global_risk_score)}
          icon={AlertTriangle}
          iconTone={riskStatus === 'critical' || riskStatus === 'high' ? 'warning' : 'neutral'}
          helperText={state?.global_risk_state?.replace('_', ' ') ?? 'No camera measurements yet'}
          helperTone={riskStatus === 'critical' ? 'critical' : riskStatus === 'high' ? 'warning' : 'neutral'}
        />
        <StatCard
          label="Route evacuation estimate"
          value={evacuation}
          icon={Route}
          helperText="Illustrative graph estimate"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Live crowd movement" subtitle="Illustrative venue graph · view-level readings" className="lg:col-span-2">
          {zones.length ? <LiveCrowdMap zones={zones} /> : <EmptyState text="Connect to the backend to load the configured camera views." />}
        </Card>
        <Card title="Operator recommendations" subtitle="Rules based on the latest measured state">
          {recommendations.length ? (
            <ul className="flex flex-col gap-3">
              {recommendations.map((item) => {
                const status = item.priority === 'CRITICAL' ? 'critical' : item.priority === 'HIGH' ? 'high' : item.priority === 'MEDIUM' ? 'watch' : 'safe'
                const styles = STATUS_STYLES[status]
                return (
                  <li key={item.action_id} className="rounded-lg border border-ink-100 px-3 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-ink-800">{item.action_type.replaceAll('_', ' ')}</p>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${styles.bg} ${styles.text}`}>{item.priority}</span>
                    </div>
                    <p className="mt-1 text-xs text-ink-500">{item.reason}</p>
                    <p className="mt-1 text-xs text-ink-400">Target: {item.target} · {item.expected_effect}</p>
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyState text={reported ? 'No action is currently triggered by the configured rules.' : 'Recommendations appear after camera measurements arrive.'} />
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Highest camera-view count · this session" subtitle="Short rolling history collected while this dashboard is open" className="lg:col-span-2">
          {trend.length > 1 ? <CrowdTrendChart data={trend} /> : <EmptyState text="The chart fills as live measurements arrive. Historical records are available in Reports when PostgreSQL is connected." />}
        </Card>
        <Card title="Camera-view status" action={<span className={`rounded-md px-2 py-1 text-xs font-semibold ${STATUS_STYLES[riskStatus].bg} ${STATUS_STYLES[riskStatus].text}`}>{STATUS_LABEL[riskStatus]}</span>}>
          {zones.length ? <ZoneStatusList zones={zones} /> : <EmptyState text="No camera state received yet." />}
        </Card>
      </div>

      <Card title="How to read the dashboard" bodyClassName="flex flex-wrap items-center gap-x-8 gap-y-2 text-xs text-ink-500">
        <span className="flex items-center gap-2"><Activity className="h-4 w-4 text-brass-600" />View count is not a unique venue total.</span>
        <span>Video tracks are temporary and are not written to PostgreSQL.</span>
        <span>Routes and recommendations are for operator review; no physical controls are connected.</span>
      </Card>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-ink-400">{text}</p>
}
