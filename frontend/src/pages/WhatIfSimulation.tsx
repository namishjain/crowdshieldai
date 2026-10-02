import { useState } from 'react'
import { Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Check, Clock3, DoorOpen, GitBranch, Loader2, Radio, Route, Siren, Users, Zap } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { clearSimulation, fetchState, runScenario } from '@/lib/api'
import { useCrowdStore } from '@/store/useCrowdStore'
import type { SimulationResult } from '@/types/backend'

const SCENARIOS = [
  { id: 'close_gate_a', label: 'Close Gate A', description: 'Model a temporary closure and its route impact.', kind: 'gate' },
  { id: 'open_gate_d', label: 'Open alternate D', description: 'Test how an extra exit changes crowd movement.', kind: 'gate' },
  { id: 'block_exit_b', label: 'Block Exit B', description: 'Reroute flow when a primary exit is unavailable.', kind: 'route' },
  { id: 'emergency_zone_c', label: 'Emergency · centre', description: 'Evaluate a response around the central zone.', kind: 'emergency' },
  { id: 'medical_zone_d', label: 'Medical · east', description: 'Check access and flow around a medical incident.', kind: 'medical' },
  { id: 'power_failure', label: 'Power failure', description: 'Explore movement under reduced lighting conditions.', kind: 'utilities' },
  { id: 'heavy_crowd', label: 'Crowd buildup', description: 'Stress test the plan with higher crowd density.', kind: 'crowd' },
  { id: 'heavy_rain', label: 'Heavy rain', description: 'Model weather-driven movement changes.', kind: 'weather' },
] as const

export default function WhatIfSimulation() {
  const latestState = useCrowdStore((store) => store.state)
  const setState = useCrowdStore((store) => store.setState)
  const setSimulation = useCrowdStore((store) => store.setSimulation)
  const [scenarioId, setScenarioId] = useState<string>(SCENARIOS[0].id)
  const [steps, setSteps] = useState(15)
  const [result, setResult] = useState<SimulationResult | null>(latestState?.simulation ?? null)
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recommendations = result?.recommendations ?? []
  const selectedScenario = SCENARIOS.find((scenario) => scenario.id === scenarioId) ?? SCENARIOS[0]

  async function handleRun() {
    setIsRunning(true)
    setError(null)
    setProgress('Refreshing the latest camera measurements…')
    try {
      // The ordinary REST API is enough to run this scenario; a WebSocket is not required.
      const baseline = await fetchState()
      setState(baseline)
      const measuredViews = baseline.cameras.filter((camera) => camera.count !== null).length
      if (!measuredViews) {
        throw new Error('No camera measurements have arrived yet. Wait for at least one camera view to report, then run the simulation again.')
      }
      setProgress(`Running ${selectedScenario.label} against ${measuredViews} measured view${measuredViews === 1 ? '' : 's'}…`)
      const simulation = await runScenario(scenarioId, steps)
      if (!simulation) throw new Error('The backend returned no simulation result. Try again in a moment.')
      setResult(simulation)
      setSimulation(simulation)
      setProgress('Scenario complete')
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Simulation could not run. Check that the CrowdShield backend is running.')
      setProgress('')
    } finally {
      setIsRunning(false)
    }
  }

  async function handleClear() {
    try {
      await clearSimulation()
      setResult(null)
      setSimulation(null)
      setError(null)
      setProgress('')
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Could not clear the displayed result')
    }
  }

  const iconFor = (kind: string) => kind === 'gate' ? DoorOpen : kind === 'route' ? Route : kind === 'emergency' || kind === 'medical' ? Siren : kind === 'crowd' ? Users : kind === 'weather' ? Radio : Zap
  const viewsReporting = latestState?.venue.views_with_measurements ?? 0

  return (
    <div className="flex flex-col gap-6">
      <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-7 text-white shadow-xl shadow-slate-900/10 sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-14 -top-24 h-72 w-72 rounded-full border border-white/[.06]" />
        <div className="pointer-events-none absolute -right-2 -top-12 h-48 w-48 rounded-full border border-amber-300/10" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-200/15 bg-amber-200/[.08] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-amber-200"><GitBranch className="h-3.5 w-3.5" /> Safe planning workspace</span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">What-if simulation</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Explore how an operational change may affect route risk and crowd movement. Each run uses the latest camera counts and the Mesa agent model.</p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.06] px-4 py-3 backdrop-blur">
            <span className={`h-2.5 w-2.5 rounded-full ${viewsReporting ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <div><p className="text-xs font-bold">{viewsReporting} views reporting</p><p className="mt-0.5 text-[10px] text-slate-400">Live measurements refresh on run</p></div>
          </div>
        </div>
      </div>

      {error && <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm text-rose-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-semibold">Simulation did not run</p><p className="mt-1 leading-5">{error}</p></div></div>}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[.9fr_1.35fr]">
        <Card title="Choose a scenario" subtitle="Select a change to explore">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {SCENARIOS.map((scenario) => {
              const Icon = iconFor(scenario.kind)
              const selected = scenarioId === scenario.id
              return <button key={scenario.id} type="button" onClick={() => setScenarioId(scenario.id)} className={`group flex min-h-[68px] items-center gap-3 rounded-2xl border p-3.5 text-left transition duration-150 ${selected ? 'border-slate-800 bg-slate-900 text-white shadow-lg shadow-slate-900/10' : 'border-slate-200 bg-white text-slate-800 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md'}`}>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selected ? 'bg-amber-300/15 text-amber-300' : 'bg-slate-100 text-slate-600 group-hover:bg-amber-50 group-hover:text-amber-700'}`}><Icon className="h-[18px] w-[18px]" /></span>
                <span className="min-w-0 flex-1"><span className={`block text-[12px] font-bold ${selected ? 'text-white' : 'text-slate-800'}`}>{scenario.label}</span><span className={`mt-1 block text-[10px] leading-4 ${selected ? 'text-slate-300' : 'text-slate-500'}`}>{scenario.description}</span></span>
                {selected && <Check className="h-4 w-4 shrink-0 text-amber-300" />}
              </button>
            })}
          </div>
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3"><label htmlFor="simulation-steps" className="text-xs font-bold text-slate-800">Simulation length</label><span className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-slate-800 shadow-sm">{steps} steps</span></div>
            <input id="simulation-steps" type="range" min="5" max="30" step="5" value={steps} onChange={(event) => setSteps(Number(event.target.value))} className="mt-4 w-full accent-amber-500" />
            <div className="flex justify-between text-[10px] text-slate-500"><span>5 · quick check</span><span>30 · extended</span></div>
          </div>
          <p className="mt-4 flex items-start gap-2 text-[10px] leading-4 text-slate-500"><ShieldNotice />This is a software-only model. A simulation never changes live gates or sends physical control commands.</p>
        </Card>

        <div className="flex flex-col gap-6">
          <Card title="Scenario impact" subtitle={result?.scenario_label || `${selectedScenario.label} · ready to run`} action={result ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800">SIMULATION COMPLETE</span> : <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{isRunning ? 'IN PROGRESS' : 'READY'}</span>}>
            {result ? <>
              <div className="relative overflow-hidden rounded-2xl bg-slate-950 p-5 text-white sm:p-6">
                <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full border border-white/[.06]" />
                <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-5">
                  <RiskResult title="Measured baseline" score={result.before?.risk_score} state={result.before?.risk_state} route={result.before?.route?.destination} />
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-200/20 bg-amber-200/10"><ArrowRight className="h-4 w-4 text-amber-300" /></div>
                  <RiskResult title="After simulation" score={result.after?.risk_score} state={result.after?.risk_state} route={result.after?.route?.destination} />
                </div>
                {result.before?.risk_score != null && result.after?.risk_score != null && <div className="relative mt-5 flex items-center gap-2 border-t border-white/10 pt-4 text-xs"><RiskDelta before={result.before.risk_score} after={result.after.risk_score} /><span className="text-slate-400">risk score change in this model</span></div>}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <ImpactStat label="People moved" value={fmt(result.after?.agents_evacuated_in_steps)} icon={Users} />
                <ImpactStat label="Model steps" value={fmt(result.after?.steps)} icon={Activity} />
                <ImpactStat label="People modeled" value={fmt(result.after?.people_in_simulation)} icon={Users} />
                <ImpactStat label="Evacuation estimate" value={result.after?.estimated_remaining_evacuation_minutes == null ? '—' : `${fmt(result.after.estimated_remaining_evacuation_minutes, 1)} min`} icon={Clock3} />
              </div>
              <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0"><p className="text-xs font-bold text-slate-800">Route outcome</p><p className="mt-1 text-xs leading-5 text-slate-600">{result.after?.route?.reason || result.limitations}</p><p className="mt-1 text-[10px] text-slate-500">Exit: {result.after?.route?.destination || 'Unavailable'} · {result.after?.route?.estimated_travel_seconds == null ? 'Travel time unavailable' : `${fmt(result.after.route.estimated_travel_seconds, 0)} sec estimated travel`}</p></div>
                <Button variant="secondary" size="sm" onClick={() => void handleClear()}>Clear result</Button>
              </div>
              <p className="mt-3 text-[10px] leading-4 text-slate-500">{result.limitations}</p>
            </> : <div className="flex min-h-[280px] flex-col items-center justify-center px-5 py-8 text-center">
              {isRunning ? <><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><Loader2 className="h-6 w-6 animate-spin" /></span><p className="mt-4 text-sm font-bold text-slate-900">Working through the scenario</p><p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{progress || 'The agent model is evaluating movement and routes…'}</p></> : <><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><GitBranch className="h-6 w-6" /></span><p className="mt-4 text-sm font-bold text-slate-900">See the likely impact before acting</p><p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">The model will compare current measured risk with the scenario result, route, people moved, and recommendations.</p></>}
            </div>}
            <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2 text-[10px] text-slate-500"><span className={`h-2 w-2 rounded-full ${viewsReporting ? 'bg-emerald-500' : 'bg-amber-500'}`} />{viewsReporting ? `${viewsReporting} camera view${viewsReporting === 1 ? '' : 's'} reporting` : 'Waiting for camera measurements'}</p>
              <Button variant="primary" onClick={() => void handleRun()} disabled={isRunning} className="min-w-40 justify-center rounded-xl bg-slate-900 py-2.5 shadow-lg shadow-slate-900/10 hover:bg-slate-800">{isRunning ? <><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Running model…</> : 'Run simulation'}</Button>
            </div>
          </Card>

          {recommendations.length > 0 && <Card title="Scenario recommendations" subtitle="Generated from this simulated result only">
            <ul className="flex flex-col gap-2.5">{recommendations.map((item) => <li key={item.action_id} className="flex items-start gap-3 rounded-2xl border border-slate-200 p-3.5"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><AlertTriangle className="h-4 w-4" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-bold capitalize text-slate-800">{item.action_type.replaceAll('_', ' ')}</p><span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">{item.priority}</span></div><p className="mt-1 text-[11px] leading-5 text-slate-600">{item.target} · {item.reason}</p><p className="mt-1 text-[10px] text-slate-500">Expected effect: {item.expected_effect}</p></div></li>)}</ul>
          </Card>}
        </div>
      </div>
    </div>
  )
}

function RiskResult({ title, score, state, route }: { title: string; score?: number | null; state?: string; route?: string | null }) {
  const numeric = score == null ? 0 : Math.max(0, Math.min(100, score))
  const color = numeric >= 80 ? 'bg-rose-400' : numeric >= 60 ? 'bg-orange-400' : numeric >= 30 ? 'bg-amber-300' : 'bg-emerald-400'
  return <div className="relative min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-400">{title}</p><p className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{score == null ? '—' : Number(score).toFixed(1)}<span className="ml-1 text-xs font-medium text-slate-400">/100</span></p><span className="mt-2 inline-flex rounded-md bg-white/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-amber-200">{state || 'No data'}</span><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${color}`} style={{ width: `${numeric}%` }} /></div><p className="mt-2 truncate text-[10px] text-slate-400">Route: {route || 'Unavailable'}</p></div>
}

function RiskDelta({ before, after }: { before: number; after: number }) {
  const delta = after - before
  if (Math.abs(delta) < 0.05) return <span className="rounded-lg bg-white/10 px-2 py-1 font-bold text-slate-200">No change · {delta.toFixed(1)}</span>
  const better = delta < 0
  const Icon = better ? ArrowDownRight : ArrowUpRight
  return <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 font-bold ${better ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300'}`}><Icon className="h-3.5 w-3.5" />{delta > 0 ? '+' : ''}{delta.toFixed(1)}</span>
}

function ImpactStat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Users }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-3.5"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Icon className="h-4 w-4" /></span><p className="mt-3 text-[10px] text-slate-500">{label}</p><p className="mt-1 text-[14px] font-bold text-slate-900">{value}</p></div>
}

function fmt(value: number | null | undefined, digits = 0) {
  return value == null || Number.isNaN(Number(value)) ? '—' : Number(value).toFixed(digits)
}

function ShieldNotice() {
  return <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-300 text-[9px] font-bold">i</span>
}
