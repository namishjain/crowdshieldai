import { useEffect, useRef, useState } from 'react'
import { Activity, AlertOctagon, ArrowRight, CircleHelp, DoorOpen, Pause, Play, RotateCcw, Sparkles, Users, type LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useOperatorStore } from '@/store/useOperatorStore'

type Agent = { x: number; y: number; vx: number; vy: number; trail: Array<{ x: number; y: number }>; target: number }
type SimProps = { active: boolean; people: number; alternateExit: boolean; resetKey: number; onStats: (stats: Stats) => void }
type Stats = { exited: number; flow: number; density: number }

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

function CrowdCanvas({ active, people, alternateExit, resetKey, onStats }: SimProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const agentsRef = useRef<Agent[]>([])
  const exitedRef = useRef(0)
  const lastStatsRef = useRef(0)

  useEffect(() => {
    agentsRef.current = Array.from({ length: people }, (_, index) => ({
      x: 6 + Math.random() * 24, y: 22 + Math.random() * 62,
      vx: (Math.random() - 0.5) * 0.65, vy: (Math.random() - 0.5) * 0.65,
      trail: [], target: index % 2,
    }))
    exitedRef.current = 0
    onStats({ exited: 0, flow: 0, density: Math.round(people / 4) })
  }, [people, resetKey])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    let frame = 0
    let width = 0
    let height = 0
    const resize = () => {
      const box = canvas.getBoundingClientRect()
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      width = Math.max(320, box.width)
      height = Math.max(250, box.height)
      canvas.width = Math.floor(width * ratio)
      canvas.height = Math.floor(height * ratio)
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    const exits = alternateExit ? [{ x: 95, y: 27 }, { x: 95, y: 73 }] : [{ x: 95, y: 50 }, { x: 95, y: 50 }]

    function render(now: number) {
      if (!ctx) return
      ctx.clearRect(0, 0, width, height)
      const sx = width / 100
      const sy = height / 100
      const px = (x: number) => x * sx
      const py = (y: number) => y * sy

      const base = ctx.createLinearGradient(0, 0, width, height)
      base.addColorStop(0, '#0b1426')
      base.addColorStop(0.52, '#102139')
      base.addColorStop(1, '#0b1725')
      ctx.fillStyle = base
      ctx.fillRect(0, 0, width, height)
      ctx.strokeStyle = 'rgba(148, 163, 184, .075)'
      ctx.lineWidth = 1
      for (let x = 0; x <= 100; x += 5) { ctx.beginPath(); ctx.moveTo(px(x), 0); ctx.lineTo(px(x), height); ctx.stroke() }
      for (let y = 0; y <= 100; y += 5) { ctx.beginPath(); ctx.moveTo(0, py(y)); ctx.lineTo(width, py(y)); ctx.stroke() }

      // Luminous venue lanes and the central convergence zone.
      ctx.lineCap = 'round'
      ctx.lineWidth = Math.max(13, width * 0.026)
      ctx.strokeStyle = 'rgba(56, 189, 248, .09)'
      ctx.beginPath(); ctx.moveTo(px(12), py(50)); ctx.lineTo(px(47), py(50)); ctx.lineTo(px(70), py(27)); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(px(47), py(50)); ctx.lineTo(px(70), py(73)); ctx.stroke()
      ctx.strokeStyle = active ? 'rgba(251, 113, 133, .16)' : 'rgba(52, 211, 153, .14)'
      ctx.beginPath(); ctx.arc(px(49), py(50), Math.min(width, height) * (0.075 + Math.sin(now / 500) * 0.004), 0, Math.PI * 2); ctx.stroke()
      ctx.fillStyle = active ? 'rgba(251,113,133,.12)' : 'rgba(45,212,191,.09)'
      ctx.beginPath(); ctx.arc(px(49), py(50), Math.min(width, height) * 0.12, 0, Math.PI * 2); ctx.fill()

      // Labels and exits.
      ctx.font = `600 ${Math.max(9, Math.min(11, width / 70))}px ui-sans-serif, system-ui`
      ctx.fillStyle = 'rgba(203, 213, 225, .72)'
      ctx.fillText('ENTRY FLOW', px(5), py(13))
      ctx.fillText('CONVERGENCE', px(40), py(32))
      ctx.fillText('SAFE EXIT A', px(78), py(alternateExit ? 23 : 45))
      if (alternateExit) ctx.fillText('SAFE EXIT B', px(78), py(69))
      ctx.lineWidth = 3
      ctx.strokeStyle = '#34d399'
      for (const exit of exits) { ctx.beginPath(); ctx.moveTo(px(94), py(exit.y - 8)); ctx.lineTo(px(94), py(exit.y + 8)); ctx.stroke() }
      if (active && alternateExit) {
        ctx.setLineDash([4, 6]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(52,211,153,.35)'
        ctx.beginPath(); ctx.moveTo(px(55), py(50)); ctx.lineTo(px(92), py(27)); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(px(55), py(50)); ctx.lineTo(px(92), py(73)); ctx.stroke()
        ctx.setLineDash([])
      }

      const agents = agentsRef.current
      for (let i = 0; i < agents.length; i++) {
        const person = agents[i]
        const destination = exits[alternateExit ? person.target : 0]
        let ax = (Math.random() - 0.5) * (active ? 0.8 : 1.2)
        let ay = (Math.random() - 0.5) * (active ? 0.8 : 1.2)
        if (active) {
          const dx = destination.x - person.x
          const dy = destination.y - person.y
          const distance = Math.max(0.01, Math.hypot(dx, dy))
          ax += dx / distance * 0.62
          ay += dy / distance * 0.62
          // Local separation reduces unrealistically overlapping dots.
          for (let j = Math.max(0, i - 5); j < Math.min(agents.length, i + 6); j++) {
            if (i === j) continue
            const other = agents[j]
            const rx = person.x - other.x
            const ry = person.y - other.y
            const gap = Math.hypot(rx, ry)
            if (gap > 0 && gap < 2.2) { ax += rx / gap * 0.12; ay += ry / gap * 0.12 }
          }
        } else {
          ax += (48 - person.x) * 0.002
          ay += (50 - person.y) * 0.002
        }
        person.vx = clamp(person.vx * 0.87 + ax, -2.5, 2.5)
        person.vy = clamp(person.vy * 0.87 + ay, -2.5, 2.5)
        person.x += person.vx * 0.38
        person.y += person.vy * 0.38
        person.x = clamp(person.x, 2, 98)
        person.y = clamp(person.y, 5, 95)
        person.trail.push({ x: person.x, y: person.y })
        if (person.trail.length > 8) person.trail.shift()
        if (active && person.x > 92 && Math.abs(person.y - destination.y) < 9) {
          exitedRef.current += 1
          person.x = 5 + Math.random() * 8
          person.y = 28 + Math.random() * 44
          person.vx = 0.8
          person.vy = (Math.random() - 0.5) * 0.5
          person.trail = []
          person.target = Math.random() > 0.5 ? 1 : 0
        }
      }

      // Glow trails + people. Their short random-walk paths make the stochastic motion visible.
      for (const person of agents) {
        if (person.trail.length > 1) {
          ctx.beginPath()
          person.trail.forEach((point, index) => index ? ctx.lineTo(px(point.x), py(point.y)) : ctx.moveTo(px(point.x), py(point.y)))
          ctx.strokeStyle = active ? 'rgba(251,113,133,.12)' : 'rgba(56,189,248,.13)'
          ctx.lineWidth = 1.15; ctx.stroke()
        }
        const glow = ctx.createRadialGradient(px(person.x), py(person.y), 0, px(person.x), py(person.y), 8)
        glow.addColorStop(0, active ? 'rgba(251,113,133,.9)' : 'rgba(103,232,249,.85)')
        glow.addColorStop(1, active ? 'rgba(251,113,133,0)' : 'rgba(103,232,249,0)')
        ctx.fillStyle = glow
        ctx.beginPath(); ctx.arc(px(person.x), py(person.y), 8, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = active ? '#fda4af' : '#a5f3fc'
        ctx.beginPath(); ctx.arc(px(person.x), py(person.y), 2.1, 0, Math.PI * 2); ctx.fill()
      }

      if (active && now - lastStatsRef.current > 900) {
        lastStatsRef.current = now
        const centerCount = agents.filter((agent) => agent.x > 34 && agent.x < 64 && agent.y > 34 && agent.y < 66).length
        const routeSplit = alternateExit ? 2 : 1
        onStats({ exited: exitedRef.current, flow: Math.round(agents.length / routeSplit), density: centerCount })
      }
      frame = requestAnimationFrame(render)
    }
    frame = requestAnimationFrame(render)
    return () => { cancelAnimationFrame(frame); observer.disconnect() }
  }, [active, alternateExit, people, resetKey, onStats])

  return <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950"><canvas ref={canvasRef} className="block h-[340px] w-full sm:h-[430px]" aria-label="Animated illustrative Brownian crowd movement simulation" /><div className="absolute left-3 top-3 flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/75 px-3 py-1.5 text-[9px] font-semibold tracking-wide text-slate-200 backdrop-blur"><span className={`h-1.5 w-1.5 rounded-full ${active ? 'animate-pulse bg-rose-400' : 'bg-cyan-300'}`} />{active ? 'EMERGENCY SCENARIO' : 'BASELINE BROWNIAN FLOW'}</div><div className="absolute bottom-3 right-3 rounded-lg border border-white/10 bg-slate-950/80 px-2.5 py-1.5 text-[9px] text-slate-300 backdrop-blur">{people} agents · stochastic walk</div><div className="sr-only" aria-live="polite">Simulation running with {people} synthetic agents.</div></div>
}

export default function UnprecedentedEvents() {
  const operatorId = useOperatorStore((store) => store.operatorId || 'Devansh Singh Bais')
  const isRail = operatorId.toLocaleLowerCase().includes('namish')
  const isReligious = operatorId.toLocaleLowerCase().includes('amrendra')
  const [active, setActive] = useState(false)
  const [alternateExit, setAlternateExit] = useState(false)
  const [people, setPeople] = useState(72)
  const [resetKey, setResetKey] = useState(0)
  const [stats, setStats] = useState<Stats>({ exited: 0, flow: 0, density: 18 })
  const venue = isRail ? 'Rail concourse · illustrative' : isReligious ? 'Pilgrim approach · illustrative' : 'Courtyard flow · illustrative'

  return <div className="flex flex-col gap-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[.18em] text-rose-700"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />{operatorId.toLocaleUpperCase()} · STOCHASTIC SCENARIO LAB</p><h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-[28px]">Unprecedented events</h1><p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-500">Watch a crowd evolve from a random walk into an emergency-flow scenario. Try alternate exits and see how the simulated routes redistribute in real time.</p></div><span className="w-fit rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[10px] font-bold text-rose-800">LIVE SIMULATION · {venue}</span></div>

    <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
      <Card title="Crowd movement field" subtitle="Brownian walk at baseline · directed flow and local separation during the scenario" bodyClassName="p-3 sm:p-4">
        <CrowdCanvas active={active} people={people} alternateExit={alternateExit} resetKey={resetKey} onStats={setStats} />
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-[10px] text-slate-500"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-cyan-400" />Routine drift</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-400" />Emergency movement</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" />Open exit</span><span className="ml-auto">Trails show recent paths · dots are synthetic agents</span></div>
      </Card>

      <div className="flex flex-col gap-4">
        <Card title="Scenario controls" subtitle="Change the model input; watch the paths react">
          <div className="space-y-4"><div><div className="flex items-center justify-between"><label htmlFor="crowd-count" className="text-xs font-semibold text-slate-700">People in simulation</label><span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-800">{people}</span></div><input id="crowd-count" type="range" min={24} max={160} step={8} value={people} onChange={(event) => setPeople(Number(event.target.value))} className="mt-3 w-full accent-amber-500" /><div className="flex justify-between text-[9px] text-slate-400"><span>24</span><span>160</span></div></div>
            <button onClick={() => setAlternateExit((value) => !value)} className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition ${alternateExit ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}><span className="flex items-center gap-2.5"><DoorOpen className={`h-4 w-4 ${alternateExit ? 'text-emerald-700' : 'text-slate-500'}`} /><span><span className="block text-xs font-semibold text-slate-800">Alternate exit B</span><span className="mt-0.5 block text-[10px] text-slate-500">{alternateExit ? 'Open · agents split routes' : 'Closed · flow favors exit A'}</span></span></span><span className={`h-5 w-9 rounded-full p-0.5 transition ${alternateExit ? 'bg-emerald-500' : 'bg-slate-300'}`}><span className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${alternateExit ? 'translate-x-4' : ''}`} /></span></button>
            <div className="grid grid-cols-2 gap-2"><button onClick={() => setActive((value) => !value)} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-bold text-white shadow-sm transition ${active ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-950 hover:bg-slate-800'}`}>{active ? <><Pause className="h-3.5 w-3.5" />Pause event</> : <><Play className="h-3.5 w-3.5" />Trigger event</>}</button><button onClick={() => { setActive(false); setResetKey((key) => key + 1) }} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"><RotateCcw className="h-3.5 w-3.5" />Reset</button></div>
          </div>
        </Card>

        <Card title="Live simulation signals" subtitle="Computed from this synthetic run only">
          <div className="grid grid-cols-2 gap-2"><SimStat icon={Users} label="Agent count" value={String(people)} /><SimStat icon={ArrowRight} label="Exit events" value={String(stats.exited)} /><SimStat icon={Activity} label="Center-zone agents" value={String(stats.density)} /><SimStat icon={Sparkles} label="Route load proxy" value={String(stats.flow)} /></div>
          <p className="mt-3 text-[10px] leading-4 text-slate-500">{active ? 'The emergency force guides particles toward an exit with stochastic drift and local spacing.' : 'Press “Trigger event” to introduce directional movement and watch paths reorganize.'}</p>
        </Card>

        <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"><AlertOctagon className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" /><p className="text-[10px] leading-5 text-amber-950/80"><b>Illustrative only.</b> The animated Brownian agents are synthetic, not tracked people or a calibrated evacuation model. This visual is for exploring scenarios; it is not a safety guarantee or a real venue plan.</p></div>
      </div>
    </div>

    <Card title="What changes when the event starts?" subtitle="A transparent, explainable model—not a black-box claim">
      <div className="grid gap-3 md:grid-cols-3"><ModelPill number="01" title="Random movement" text="Small independent direction changes create a Brownian-like baseline drift." /><ModelPill number="02" title="Emergency cue" text="A scenario cue adds a preferred direction toward the available exit." /><ModelPill number="03" title="Route relief" text="Opening exit B divides the simulated flow across two destinations." /></div>
      <p className="mt-4 flex items-start gap-2 text-[10px] leading-5 text-slate-500"><CircleHelp className="mt-0.5 h-3.5 w-3.5 shrink-0" />Use the existing What-if simulation page for count/capacity-based scenario comparison; this new page visualizes individual synthetic paths.</p>
    </Card>
  </div>
}

function SimStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="flex items-center gap-1.5 text-[9px] font-semibold text-slate-500"><Icon className="h-3 w-3" />{label}</p><p className="mt-1.5 text-sm font-bold text-slate-900">{value}</p></div>
}

function ModelPill({ number, title, text }: { number: string; title: string; text: string }) {
  return <div className="flex gap-3 rounded-xl border border-slate-200 p-3.5"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-[9px] font-bold text-amber-300">{number}</span><div><p className="text-xs font-bold text-slate-900">{title}</p><p className="mt-1 text-[10px] leading-4 text-slate-500">{text}</p></div></div>
}
