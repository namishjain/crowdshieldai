import { Activity, ArrowUpRight, CalendarDays, Clock3, Database, ExternalLink, MapPin, Sparkles, Train, Users, Waves, type LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useCrowdStore } from '@/store/useCrowdStore'
import { useOperatorStore } from '@/store/useOperatorStore'

const SOURCES = {
  mahakumbh: 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2100656&lang=2&reg=48',
  simhastha: 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2148431&lang=2&reg=48',
  ndls: 'https://nr.indianrailways.gov.in/uploads/files/1754029376136-16-CP-05-WS-25-26%20-Reassessing%20of%20manpower%20yard%20stick%20for%20opting%20deptt.%20part-1.pdf',
  pibRail: 'https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=2181360&lang=2&reg=48',
  holding: 'https://www.pib.gov.in/PressNoteDetails.aspx?ModuleId=2&NoteId=155631&lang=1&reg=3',
  shatabdi: 'https://www.indianrail.gov.in/shatabdi_trn_list.html',
  rajdhani: 'https://indianrail.gov.in/rajdhani_trn_list.html',
}

function SourceLink({ href, children }: { href: string; children: string }) {
  return <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 underline decoration-emerald-200 underline-offset-4 hover:text-emerald-950">{children}<ExternalLink className="h-3 w-3" /></a>
}

function Metric({ icon: Icon, label, value, detail, tone = 'slate' }: { icon: LucideIcon; label: string; value: string; detail: string; tone?: 'slate' | 'amber' | 'blue' | 'emerald' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700', amber: 'bg-amber-50 text-amber-700', blue: 'bg-sky-50 text-sky-700', emerald: 'bg-emerald-50 text-emerald-700',
  }
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/[.025] sm:p-5"><div className="flex items-start justify-between gap-3"><span className="text-xs font-medium text-slate-500">{label}</span><span className={`flex h-8 w-8 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-4 w-4" /></span></div><p className="mt-3 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{value}</p><p className="mt-1 text-[11px] leading-4 text-slate-500">{detail}</p></div>
}

function ForecastHeader({ eyebrow, title, copy, tag }: { eyebrow: string; title: string; copy: string; tag: string }) {
  return <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[.18em] text-emerald-800"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />{eyebrow}</p><h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-[28px]">{title}</h1><p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-500">{copy}</p></div><span className="w-fit rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-600">{tag}</span></div>
}

function ModelNote() {
  return <div className="flex gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/75 p-4 sm:p-5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-700 shadow-sm"><Sparkles className="h-4 w-4" /></span><div><p className="text-xs font-bold text-indigo-950">AI signal, with the data boundary made clear</p><p className="mt-1 text-[11px] leading-5 text-indigo-900/75">The live camera pipeline uses a vision model for sample-video counts. Future-event and train-specific ML/DL forecasts need years of hourly attendance or booking/load history; that data is not in this demo, so these pages use published anchors plus an explicit planning scenario instead of inventing model accuracy.</p></div></div>
}

function ReligiousForecast() {
  const events = [
    { name: 'Mauni Amavasya', date: '29 Jan 2025', count: '8 crore+', width: '100%', tone: 'bg-amber-400', badge: 'Highest reported day' },
    { name: 'Makar Sankranti', date: '14 Jan 2025', count: '3.5 crore', width: '44%', tone: 'bg-orange-300', badge: 'Amrit Snan' },
    { name: 'Basant Panchami', date: '3 Feb 2025', count: '2.33 crore', width: '29%', tone: 'bg-sky-400', badge: 'Amrit Snan' },
  ]
  return <>
    <ForecastHeader eyebrow="AMRENDRA SHARMA · RELIGIOUS EVENT PROFILE" title="Kumbh future alertness" copy="A tithi-aware planning view for major bathing days, built from published Maha Kumbh counts and the announced 2027 Simhastha rail-planning scale." tag="PROFILE · RELIGIOUS EVENTS" />

    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Metric icon={Users} label="2025 peak-day report" value="8 crore+" detail="Holy dips reported on Mauni Amavasya" tone="amber" />
      <Metric icon={CalendarDays} label="Peak tithi analogue" value="Amavasya" detail="Mauni Amavasya was the largest reported snan day" tone="amber" />
      <Metric icon={MapPin} label="Next major event" value="Simhastha 2027" detail="Nashik–Trimbakeshwar" tone="blue" />
      <Metric icon={Train} label="Railway planning scale" value="3 crore+" detail="Anticipated pilgrims across the 2027 event; not a daily count" tone="emerald" />
    </section>

    <section className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
      <Card title="The tithi signal" subtitle="Published 2025 Maha Kumbh day totals · reported bathing counts">
        <div className="space-y-5">{events.map((event, index) => <div key={event.name}><div className="mb-2 flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-slate-900">{event.name}</p><p className="mt-0.5 text-[11px] text-slate-500">{event.date} · {event.badge}</p></div><p className="whitespace-nowrap text-sm font-bold text-slate-800">{event.count}</p></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${event.tone} ${index === 0 ? 'animate-pulse' : ''}`} style={{ width: event.width }} /></div></div>)}</div>
        <p className="mt-5 rounded-xl bg-slate-50 px-3.5 py-3 text-[11px] leading-5 text-slate-600">This is a comparison of official event-day reports, not a daily capacity measurement or a count of unique people. The 2025 release identifies Mauni Amavasya as the peak day. <SourceLink href={SOURCES.mahakumbh}>PIB · Maha Kumbh 2025 attendance</SourceLink></p>
      </Card>

      <Card title="Next-event watch window" subtitle="Nashik–Trimbakeshwar Simhastha · 2027">
        <div className="relative overflow-hidden rounded-2xl bg-slate-950 p-5 text-white"><div className="absolute -right-8 -top-12 h-48 w-48 rounded-full bg-amber-300/10 blur-2xl" /><div className="relative"><div className="flex items-center gap-2 text-[10px] font-bold tracking-[.16em] text-amber-200"><Waves className="h-4 w-4" />TITHI-LED PLANNING SCENARIO</div><p className="mt-4 text-2xl font-bold">Amavasya / principal Snan day</p><p className="mt-2 max-w-md text-xs leading-5 text-slate-300">Highest-attention tithi class, using the 2025 Mauni Amavasya peak as the historical analogue. The official 2027 bathing calendar must confirm the actual tithi and date.</p><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl border border-white/10 bg-white/[.06] p-3"><p className="text-[10px] text-slate-400">Estimated high-flow window</p><p className="mt-1 text-lg font-bold">04:00–09:00</p><p className="text-[10px] text-slate-400">IST · planning assumption</p></div><div className="rounded-xl border border-white/10 bg-white/[.06] p-3"><p className="text-[10px] text-slate-400">Event-wide planning scale</p><p className="mt-1 text-lg font-bold">3 crore+</p><p className="text-[10px] text-slate-400">Railway estimate, whole event</p></div></div></div></div>
        <div className="mt-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" /><p className="text-[11px] leading-5 text-amber-950/80"><b>Timing confidence: provisional.</b> The 04:00–09:00 window is a pre-dawn-to-morning operations scenario, not a learned hourly forecast. Configure staffing and transport against the final official snan calendar and local telemetry.</p></div>
        <div className="mt-4"><SourceLink href={SOURCES.simhastha}>PIB · Simhastha 2027 rail plans and anticipated footfall</SourceLink></div>
      </Card>
    </section>

    <Card title="When to raise readiness" subtitle="A clean operational timeline for the next event · scenario bands, not predicted counts">
      <div className="grid gap-3 md:grid-cols-3"><ReadinessStep step="01" time="T−24 to T−6 hours" title="Arrival build-up" detail="Increase transport, queue, and approach-road monitoring before the snan window." tone="blue" /><ReadinessStep step="02" time="04:00–09:00 IST" title="Highest alertness" detail="Prioritize entry convergence, bathing access, crossings, and exit flow on principal Snan days." tone="amber" /><ReadinessStep step="03" time="09:00 onward" title="Dispersal watch" detail="Keep downstream routes staffed as people leave ghats and move toward transport." tone="emerald" /></div>
    </Card>
    <ModelNote />
  </>
}

function ReadinessStep({ step, time, title, detail, tone }: { step: string; time: string; title: string; detail: string; tone: 'blue' | 'amber' | 'emerald' }) {
  const styles = { blue: 'border-sky-200 bg-sky-50 text-sky-800', amber: 'border-amber-200 bg-amber-50 text-amber-800', emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800' }
  return <div className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between"><span className={`rounded-lg border px-2 py-1 text-[10px] font-bold ${styles[tone]}`}>{step} · {time}</span><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /></div><p className="mt-4 text-sm font-bold text-slate-900">{title}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">{detail}</p></div>
}

const TRAINS = [
  { number: '12004', name: 'Lucknow Swarn Shatabdi', movement: 'Departs NDLS · 06:10', band: 'AM cluster', color: 'amber' },
  { number: '12011', name: 'Kalka Shatabdi', movement: 'Departs NDLS · 07:40', band: 'AM cluster', color: 'amber' },
  { number: '12002', name: 'Bhopal Shatabdi', movement: 'Arrives NDLS · 14:25', band: 'Arrival flow', color: 'sky' },
  { number: '12424', name: 'Dibrugarh Rajdhani', movement: 'Departs NDLS · 16:10', band: 'PM cluster', color: 'rose' },
  { number: '12302', name: 'Howrah Rajdhani', movement: 'Departs NDLS · 16:55', band: 'PM cluster', color: 'rose' },
  { number: '12310', name: 'Rajendra Nagar Rajdhani', movement: 'Departs NDLS · 17:15', band: 'PM cluster', color: 'rose' },
]

function RailwayForecast() {
  return <>
    <ForecastHeader eyebrow="NAMISH JAIN · NEW DELHI RAILWAY PROFILE" title="Station future alertness" copy="Station-scale passenger anchors and a train-number watchlist for New Delhi. The alert windows come from published timetable clusters; they are not a live seat-demand ranking." tag="PROFILE · RAILWAY" />

    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Metric icon={Activity} label="Platforms" value="16" detail="New Delhi Railway Station (NDLS)" tone="blue" />
      <Metric icon={Train} label="Daily train movements" value="250+" detail="Originating, terminating, or passing" tone="blue" />
      <Metric icon={Users} label="Typical daily footfall" value="~5 lakh" detail="Reported station estimate; season varies" tone="amber" />
      <Metric icon={MapPin} label="Holding area" value="~7,000" detail="Yatri Suvidha Kendra, simultaneous capacity" tone="emerald" />
    </section>

    <section className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
      <Card title="Train movement watchlist" subtitle="Official timetable snapshot · services with New Delhi movement times">
        <div className="overflow-x-auto"><table className="w-full min-w-[590px] text-left"><thead><tr className="border-b border-slate-100 text-[10px] font-semibold uppercase tracking-wide text-slate-400"><th className="pb-3 pr-3">Train no.</th><th className="pb-3 pr-3">Train name</th><th className="pb-3 pr-3">NDLS movement</th><th className="pb-3">Watch window</th></tr></thead><tbody>{TRAINS.map((train) => <tr key={train.number} className="border-b border-slate-50 last:border-0"><td className="py-3 pr-3 font-mono text-xs font-bold text-slate-800">{train.number}</td><td className="py-3 pr-3 text-xs font-semibold text-slate-800">{train.name}</td><td className="py-3 pr-3 text-[11px] text-slate-500">{train.movement}</td><td className="py-3"><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${train.color === 'rose' ? 'bg-rose-50 text-rose-700' : train.color === 'amber' ? 'bg-amber-50 text-amber-800' : 'bg-sky-50 text-sky-700'}`}>{train.band}</span></td></tr>)}</tbody></table></div>
        <p className="mt-4 rounded-xl bg-slate-50 px-3.5 py-3 text-[11px] leading-5 text-slate-600">Timings are a published schedule snapshot and may change. Confirm on the official live timetable before operational use. <SourceLink href={SOURCES.shatabdi}>Shatabdi list</SourceLink> · <SourceLink href={SOURCES.rajdhani}>Rajdhani list</SourceLink></p>
      </Card>

      <Card title="Forecasted pressure windows" subtitle="Schedule-cluster signal · verify against live platform and ticketing feeds">
        <div className="space-y-3"><PressureWindow time="06:00–08:00" title="Morning departure build-up" note="12004 and 12011 departures are listed in this window." level="Elevated" fill="64%" /><PressureWindow time="16:00–17:30" title="Evening Rajdhani cluster" note="12424, 12302, and 12310 departures appear in this cluster." level="High watch" fill="88%" /><PressureWindow time="14:00–15:00" title="Arrival flow" note="12002 Bhopal Shatabdi is listed arriving at 14:25." level="Monitor" fill="43%" /></div>
        <div className="mt-4 flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5"><Database className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" /><p className="text-[11px] leading-5 text-rose-950/80"><b>Train capacity / most-demanded service:</b> coach-by-coach rake capacity and live reservation load are not in the published station data used here. This ranks timetable pressure windows only; it does not claim which train sells the most seats.</p></div>
      </Card>
    </section>

    <Card title="Station-scale readiness forecast" subtitle="Official planning anchors for crowd-management teams">
      <div className="grid gap-4 md:grid-cols-3"><div className="rounded-2xl bg-slate-950 p-4 text-white"><p className="text-[10px] font-bold tracking-[.15em] text-slate-400">FESTIVAL-DAY PLANNING LEVEL</p><p className="mt-2 text-2xl font-bold">~6 lakh / day</p><p className="mt-1 text-[11px] leading-5 text-slate-300">NR work-study estimate: daily footfall can rise from around 5 lakh to 6 lakh in peak festival season.</p></div><div className="rounded-2xl border border-slate-200 p-4"><p className="text-[10px] font-bold tracking-[.15em] text-slate-400">RECENT DELHI-AREA SIGNAL</p><p className="mt-2 text-2xl font-bold text-slate-900">21.04 lakh</p><p className="mt-1 text-[11px] leading-5 text-slate-500">Passengers facilitated across the Delhi area, 16–20 Oct 2025; not NDLS-only.</p></div><div className="rounded-2xl border border-slate-200 p-4"><p className="text-[10px] font-bold tracking-[.15em] text-slate-400">HOLDING CAPACITY</p><p className="mt-2 text-2xl font-bold text-slate-900">~7,000 at once</p><p className="mt-1 text-[11px] leading-5 text-slate-500">New Delhi Yatri Suvidha Kendra published design capacity.</p></div></div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2"><SourceLink href={SOURCES.ndls}>Northern Railway · NDLS work-study report</SourceLink><SourceLink href={SOURCES.pibRail}>PIB · 2025 festival passenger movement</SourceLink><SourceLink href={SOURCES.holding}>PIB · Yatri Suvidha Kendra capacity</SourceLink></div>
    </Card>
    <ModelNote />
  </>
}

function PressureWindow({ time, title, note, level, fill }: { time: string; title: string; note: string; level: string; fill: string }) {
  return <div className="rounded-xl border border-slate-200 p-3.5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-slate-900">{title}</p><p className="mt-1 text-[10px] text-slate-500">{time} · {note}</p></div><span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[9px] font-bold text-amber-800">{level}</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-rose-500" style={{ width: fill }} /></div></div>
}

function DevanshForecast() {
  const state = useCrowdStore((store) => store.state)
  const liveMax = state?.predictions.reduce((max, point) => Math.max(max, point.projected_risk_score ?? 0), 0) ?? null
  const highest = state?.zones.reduce((best, zone) => (zone.count ?? 0) > (best?.count ?? -1) ? zone : best, undefined as (typeof state.zones)[number] | undefined)
  return <>
    <ForecastHeader eyebrow="DEVANSH SINGH BAIS · ZURICH LIVE-DEMO PROFILE" title="Future alertness" copy="A forward-looking operations view for the current Zurich sample feed. Current and short-horizon signals update from the running demo API." tag="PROFILE · ZURICH" />
    <section className="grid gap-4 sm:grid-cols-3"><Metric icon={Activity} label="Current venue risk" value={state?.global_risk_score == null ? 'Waiting' : `${state.global_risk_score.toFixed(1)} / 100`} detail={state?.global_risk_state ?? 'No live state received'} tone="blue" /><Metric icon={ArrowUpRight} label="Peak projected risk" value={liveMax == null ? '—' : `${liveMax.toFixed(1)} / 100`} detail="Highest configured 10–30 minute horizon" tone="amber" /><Metric icon={MapPin} label="View needing attention" value={highest?.name ?? 'Waiting for views'} detail={highest?.count == null ? 'No current person count' : `${highest.count} detections · ${highest.trend || 'trend unavailable'}`} tone="emerald" /></section>
    <Card title="Next 30 minutes · operational watch" subtitle={state?.prediction_method || 'Updates from the live sample feed'}>
      <div className="grid gap-3 md:grid-cols-3">{(state?.predictions ?? []).map((point) => <div key={point.horizon_minutes} className="relative overflow-hidden rounded-2xl border border-slate-200 p-4"><div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-emerald-400 to-amber-400" style={{ width: `${Math.max(8, Math.min(100, point.projected_risk_score ?? 8))}%` }} /><p className="text-xs font-semibold text-slate-500">+{point.horizon_minutes} minutes</p><p className="mt-2 text-2xl font-bold text-slate-900">{point.projected_risk_score == null ? '—' : `${point.projected_risk_score.toFixed(1)} / 100`}</p><p className="mt-1 text-[10px] font-semibold text-slate-500">{point.projected_risk_state.replace('_', ' ')}</p></div>)}</div>
      {!state?.predictions.length && <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-600">Waiting for sample-video measurements. Start the demo API to populate the live forecast.</p>}
      <p className="mt-4 text-[11px] leading-5 text-slate-500">Counts in this profile are detections from short sample clips, not live CCTV or unique attendance. The existing configured trend model is an operational heuristic, as shown by its backend metadata.</p>
    </Card>
    <ModelNote />
  </>
}

export default function FutureAlertness() {
  const operatorId = useOperatorStore((store) => store.operatorId || 'Devansh Singh Bais').toLocaleLowerCase()
  return <div className="flex flex-col gap-5">{operatorId.includes('amrendra') ? <ReligiousForecast /> : operatorId.includes('namish') ? <RailwayForecast /> : <DevanshForecast />}</div>
}
