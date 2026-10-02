import { Activity, AlertTriangle, BellRing, Clock3, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCrowdStore } from '@/store/useCrowdStore'
import { Card } from '@/components/ui/Card'
import { STATUS_STYLES } from '@/lib/utils'
import { statusFromRisk } from '@/lib/adapters'

export default function Alerts() {
  const state = useCrowdStore((store) => store.state)
  const events = state?.events ?? []
  const recommendations = state?.recommendations ?? []
  const highestPriority = recommendations.some((item) => item.priority === 'CRITICAL') ? 'Immediate attention' : recommendations.some((item) => item.priority === 'HIGH') ? 'High priority active' : 'Monitoring'

  return (
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-7 text-white shadow-xl shadow-slate-900/10 sm:px-8">
        <div className="pointer-events-none absolute -right-10 -top-24 h-64 w-64 rounded-full border border-white/[.06]" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div><span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-amber-200"><BellRing className="h-3.5 w-3.5" /> Operator decision feed</span><h1 className="mt-3 text-3xl font-bold tracking-tight">Alerts & decisions</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Current recommendations and recent changes from the live venue state.</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[.06] px-4 py-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Current priority</p><p className="mt-1 text-sm font-bold text-white">{highestPriority}</p><p className="mt-1 text-[10px] text-slate-400">{recommendations.length} active recommendation{recommendations.length === 1 ? '' : 's'}</p></div>
        </div>
      </section>

      <Card title="Current recommendations" subtitle="Rule-based suggestions for an operator to review" action={<span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{recommendations.length} ACTIVE</span>}>
        {!recommendations.length ? <EmptyState text="No active recommendation is currently triggered. New items appear here as camera measurements update." /> : <ul className="grid gap-3 lg:grid-cols-2">{recommendations.map((item) => {
          const status = item.priority === 'CRITICAL' ? 'critical' : item.priority === 'HIGH' ? 'high' : item.priority === 'MEDIUM' ? 'watch' : 'safe'
          const styles = STATUS_STYLES[status]
          return <li key={item.action_id} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-card">
            <div className="flex items-start gap-3"><span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${styles.bg} ${styles.text}`}><AlertTriangle className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold capitalize text-slate-900">{item.action_type.replaceAll('_', ' ')}</p><span className={`rounded-md px-2 py-1 text-[9px] font-bold ${styles.bg} ${styles.text}`}>{item.priority}</span></div><p className="mt-2 text-[11px] leading-5 text-slate-600">{item.reason}</p><p className="mt-2 text-[10px] font-medium text-slate-500">Target: {item.target}</p><p className="mt-1 text-[10px] text-slate-500">Expected effect: {item.expected_effect}</p></div></div>
          </li>
        })}</ul>}
      </Card>

      <Card title="Recent venue events" subtitle={`Changes in this live session · ${events.length} event${events.length === 1 ? '' : 's'}`}>
        {!events.length ? <EmptyState text="Risk, route and simulation changes appear here as the system runs." /> : <ol className="relative ml-2 border-l border-slate-200 pl-6">{events.map((event) => {
          const score = event.risk_score ?? null
          const status = statusFromRisk(score === null ? undefined : score >= 80 ? 'CRITICAL' : score >= 60 ? 'HIGH' : score >= 30 ? 'WARNING' : 'SAFE')
          const styles = STATUS_STYLES[status]
          return <li key={event.event_id} className="relative pb-5 last:pb-0"><span className={`absolute -left-[31px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border-4 border-white ${styles.dot}`} /><div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-bold text-slate-900">{event.action}</p><p className="mt-1 text-[10px] text-slate-500">{event.reason}</p></div><span className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-bold capitalize text-slate-600">{event.type.replaceAll('_', ' ')}</span></div><div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-slate-500"><span>{event.zone_id ? `${event.zone_id} · ` : ''}{score === null ? 'Risk —' : `Risk ${score.toFixed(1)}`}</span><span className="flex items-center gap-1"><Clock3 className="h-3 w-3" />{new Date(event.timestamp).toLocaleString()}</span></div></div></li>
        })}</ol>}
      </Card>

      <p className="flex items-center gap-2 px-1 text-[10px] text-slate-500"><Activity className="h-4 w-4" />These events are available for the current session. PostgreSQL history can be connected in <Link to="/app/settings" className="font-semibold text-slate-700 underline decoration-slate-300 underline-offset-2">Settings</Link>.</p>
      <p className="flex items-start gap-2 px-1 text-[10px] leading-4 text-slate-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />Recommendations are decision support for operator review. No physical control commands are sent.</p>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="flex flex-col items-center gap-2 py-10 text-center"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><AlertTriangle className="h-5 w-5" /></span><p className="max-w-md text-xs leading-5 text-slate-500">{text}</p></div>
}
