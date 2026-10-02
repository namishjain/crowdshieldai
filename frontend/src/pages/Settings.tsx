import { useEffect, useState } from 'react'
import { CheckCircle2, Database, ExternalLink, ShieldCheck, Terminal } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { fetchConfig, fetchDatabaseStatus, type DatabaseStatus, type RiskConfig } from '@/lib/api'
import { useCrowdStore } from '@/store/useCrowdStore'

export default function Settings() {
  const liveState = useCrowdStore((store) => store.state)
  const [config, setConfig] = useState<RiskConfig | null>(null)
  const [database, setDatabase] = useState<DatabaseStatus | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)

  useEffect(() => {
    void Promise.all([fetchConfig(), fetchDatabaseStatus()]).then(([nextConfig, nextDatabase]) => {
      setConfig(nextConfig)
      setDatabase(nextDatabase)
    }).catch((error: unknown) => setConfigError(error instanceof Error ? error.message : 'Settings unavailable'))
    const interval = setInterval(() => { void fetchDatabaseStatus().then(setDatabase).catch(() => undefined) }, 10_000)
    return () => clearInterval(interval)
  }, [])

  const thresholds = Object.entries(config?.risk_thresholds ?? {})
  const weights = Object.entries(config?.risk_weights ?? {})
  const databaseTone = database?.connected ? 'connected' : database?.enabled ? 'warning' : 'idle'

  return (
    <div className="flex flex-col gap-6">
      <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-7 text-white shadow-xl shadow-slate-900/10 sm:px-8">
        <div className="pointer-events-none absolute -right-10 -top-24 h-64 w-64 rounded-full border border-white/[.06]" />
        <div className="relative max-w-2xl"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-amber-200">System controls</p><h1 className="mt-3 text-3xl font-bold tracking-tight">Settings & system status</h1><p className="mt-2 text-sm leading-6 text-slate-300">See which services are available, how the risk model is configured, and whether PostgreSQL history is saving.</p></div>
      </div>

      {configError && <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Could not load backend settings: {configError}</p>}

      <Card title="PostgreSQL history" subtitle="Camera aggregates, decision events and what-if results; no videos, tracks or bounding boxes" action={<span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${databaseTone === 'connected' ? 'bg-emerald-50 text-emerald-800' : databaseTone === 'warning' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{database?.connected ? 'CONNECTED' : database?.enabled ? 'RECONNECTING' : 'NOT LINKED'}</span>}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${database?.connected ? 'bg-emerald-50 text-emerald-700' : database?.enabled ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}><Database className="h-5 w-5" /></span>
            <div><p className="text-sm font-bold text-slate-900">{database?.connected ? 'History is saving' : database?.enabled ? 'Connection needs attention' : 'PostgreSQL is not linked to CrowdShield'}</p><p className="mt-1 text-xs text-slate-500">{database?.status ?? 'Checking status…'} · {database?.queued_records ?? 0} queued records</p></div>
          </div>
          {database?.connected && <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" />Connected and writing history</span>}
        </div>
        {database?.last_error && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-900">{database.last_error}</p>}
        {!database?.enabled && <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
          <div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm"><Terminal className="h-4 w-4" /></span><div><p className="text-sm font-bold text-slate-900">One-time link on this computer</p><p className="mt-1 text-xs leading-5 text-slate-600">Installing PostgreSQL starts the database service, but the app also needs its own connection settings. CrowdShield has not been given those settings yet.</p></div></div>
          <ol className="mt-4 space-y-2.5 pl-1 text-xs leading-5 text-slate-600">
            <li className="flex gap-2.5"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold text-slate-700 shadow-sm">1</span><span>Open the <strong className="text-slate-800">project folder</strong> in VS Code and open its PowerShell terminal.</span></li>
            <li className="flex gap-2.5"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold text-slate-700 shadow-sm">2</span><span>Run <code className="rounded-md bg-white px-1.5 py-1 font-semibold text-slate-800">.\scripts\configure_postgres.ps1</code>. It asks for your PostgreSQL password, checks the server, creates the <code className="rounded bg-white px-1 text-slate-800">crowdshield</code> database if needed, and writes your private local <code className="rounded bg-white px-1 text-slate-800">.env</code>.</span></li>
            <li className="flex gap-2.5"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold text-slate-700 shadow-sm">3</span><span>Restart CrowdShield with <code className="rounded-md bg-white px-1.5 py-1 font-semibold text-slate-800">.\stop_demo.ps1</code>, then <code className="rounded-md bg-white px-1.5 py-1 font-semibold text-slate-800">.\start_demo.ps1</code>.</span></li>
          </ol>
          <p className="mt-4 border-t border-slate-200 pt-3 text-[10px] leading-4 text-slate-500">Your password stays in the local <code>.env</code> file and is never included in the shareable ZIP.</p>
        </div>}
        <p className="mt-4 text-[10px] text-slate-500">Current API state: {liveState?.system.backend_status || 'Waiting for backend'} · session records queued: {database?.queued_records ?? 0} · dropped records: {database?.dropped_records ?? 0}.</p>
      </Card>

      <Card title="Risk model" subtitle="Values loaded directly from the Python backend configuration">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{thresholds.map(([band, value]) => <div key={band} className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold capitalize text-slate-800">{band.replaceAll('_', ' ')}</p><p className="mt-2 text-lg font-bold text-slate-900">{String(value)}</p><p className="mt-0.5 text-[10px] text-slate-500">risk score threshold</p></div>)}</div>
        <div className="mt-6"><p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-700">Risk score weights</p><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{weights.map(([factor, value]) => <div key={factor} className="rounded-2xl border border-slate-200 p-4"><p className="text-[10px] capitalize text-slate-500">{factor.replaceAll('_', ' ')}</p><p className="mt-2 text-xl font-bold text-slate-900">{(Number(value) * 100).toFixed(0)}<span className="ml-0.5 text-xs font-semibold text-slate-500">%</span></p></div>)}</div></div>
      </Card>

      <Card title="Venue & camera setup" subtitle="Loaded from the project’s YAML configuration files" action={<span className="flex items-center gap-1 text-[10px] font-semibold text-slate-500"><ExternalLink className="h-3 w-3" />LOCAL CONFIG</span>}>
        <div className="grid gap-3 sm:grid-cols-2"><Info label="Venue" value={liveState?.venue.name || 'Loading…'} /><Info label="Configured camera views" value={`${config?.configured_cameras.length ?? liveState?.cameras.length ?? 0}`} /><Info label="Inference interval" value={config ? `${config.camera_interval_seconds} sec` : '—'} /><Info label="Venue graph" value={config?.topology_status?.replaceAll('_', ' ') || '—'} /></div>
      </Card>

      <p className="flex items-start gap-2 px-1 text-[10px] leading-5 text-slate-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />Recommendation and gate updates change software state only. This prototype has no physical gate, public-address or emergency-service integration.</p>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-sm font-bold capitalize text-slate-900">{value}</p></div>
}
