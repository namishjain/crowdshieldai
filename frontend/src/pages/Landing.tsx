import { Link } from 'react-router-dom'
import { Activity, Radio, ShieldCheck, Layers, Users, Building2, Siren, MapPinned } from 'lucide-react'
import { LiveCrowdMap } from '@/components/map/LiveCrowdMap'
import { useCrowdStore } from '@/store/useCrowdStore'
import { displayZones, highestMeasuredCount } from '@/lib/adapters'
import { STATUS_STYLES } from '@/lib/utils'

export default function Landing() {
  const state = useCrowdStore((store) => store.state)
  const connected = useCrowdStore((store) => store.connected)
  const zones = displayZones(state)
  const count = highestMeasuredCount(state)
  const recs = state?.recommendations ?? []
  const evacuation = state?.route.estimated_evacuation_minutes
  return (
    <div className="min-h-screen bg-white text-ink-800">
      <header className="flex items-center justify-between border-b border-ink-100 px-4 py-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-700">
            <ShieldCheck className="h-4 w-4 text-brass-400" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">CrowdShield AI</p>
            <p className="hidden truncate text-[10px] tracking-wide text-ink-400 sm:block">
              SAFETY INTELLIGENCE PLATFORM
            </p>
          </div>
        </div>
        <nav className="hidden items-center gap-6 text-sm text-ink-500 md:flex">
          <a href="#platform">Platform</a>
          <a href="#how-it-works">How it works</a>
          <a href="#use-cases">Use cases</a>
          <a href="#resources">Resources</a>
        </nav>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <span className={`hidden items-center gap-1.5 text-xs font-medium sm:flex ${connected ? 'text-safe-text' : 'text-watch-text'}`}><span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-safe-dot' : 'bg-watch-dot'}`} />{connected ? 'Backend connected' : 'Connecting'}</span>
          <Link
            to="/app"
            className="rounded-lg bg-ink-700 px-3 py-2 text-xs font-semibold text-white hover:bg-ink-800 sm:px-4 sm:text-sm"
          >
            Request a demo
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="grid grid-cols-1 items-center gap-10 bg-paper px-4 py-10 sm:px-8 md:px-16 lg:grid-cols-2 lg:gap-12 lg:py-16">
        <div>
          <span className="inline-block rounded-full bg-brass-100 px-3 py-1 text-xs font-semibold text-brass-600">
            LIVE CROWD SAFETY INTELLIGENCE
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-tight text-ink-800">
            Crowd safety, before it becomes a crisis.
          </h1>
          <p className="mt-4 max-w-md text-ink-500">
            CrowdShield AI helps cities, venues and event teams predict crowd risk, coordinate
            response, and keep every movement safer — in real time.
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              to="/app"
              className="rounded-lg bg-ink-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink-800"
            >
              Request a demo
            </Link>
            <Link
              to="/app"
              className="rounded-lg border border-ink-200 px-5 py-2.5 text-sm font-semibold text-ink-700 hover:bg-white"
            >
              Explore the platform
            </Link>
          </div>
          <p className="mt-4 text-xs text-ink-400">
            Built for control rooms, event operators, and public safety teams.
          </p>
        </div>

        <div className="rounded-xl2 border border-ink-100 bg-white p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-ink-700">
                <ShieldCheck className="h-3.5 w-3.5 text-brass-400" />
              </div>
              <div>
                <p className="text-xs font-semibold">CrowdShield AI</p>
                <p className="text-[10px] text-ink-400">{state?.venue.name || 'Live system preview'}</p>
              </div>
            </div>
            <span className={`flex items-center gap-1 text-[10px] font-medium ${connected ? 'text-safe-text' : 'text-watch-text'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-safe-dot' : 'bg-watch-dot'}`} /> {connected ? 'Live backend' : 'Waiting for backend'}
            </span>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['Highest view count', count === null ? '—' : count.toLocaleString('en-IN')],
              ['Views reporting', `${state?.venue.views_with_measurements ?? 0}/${state?.cameras.length ?? 6}`],
              ['Venue risk', state?.global_risk_score == null ? '—' : `${state.global_risk_score.toFixed(0)}/100`],
              ['Evacuation estimate', evacuation == null ? '—' : `${evacuation.toFixed(1)} min`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-ink-100 p-2">
                <p className="text-[9px] text-ink-400">{label}</p>
                <p className="text-xs font-semibold text-ink-800">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="sm:col-span-2">
              {zones.length ? <LiveCrowdMap zones={zones} /> : <div className="flex aspect-[16/9] items-center justify-center rounded-xl2 bg-ink-900 px-4 text-center text-xs text-ink-200">Camera view map loads when the backend is available.</div>}
            </div>
            <div className="rounded-lg border border-ink-100 p-2">
              <p className="mb-1.5 text-[10px] font-semibold text-ink-600">Priority actions</p>
              <ul className="flex flex-col gap-1.5">
                {recs.slice(0, 4).map((a) => {
                  const status = a.priority === 'CRITICAL' ? 'critical' : a.priority === 'HIGH' ? 'high' : a.priority === 'MEDIUM' ? 'watch' : 'safe'
                  const styles = STATUS_STYLES[status]
                  return (
                    <li key={a.action_id} className="flex items-start gap-1.5">
                      <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${styles.dot}`} />
                      <span className="text-[9px] leading-tight text-ink-600">{a.action_type.replaceAll('_', ' ')} · {a.target}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section id="how-it-works" className="px-4 py-12 text-center sm:px-8 md:px-16 md:py-16">
        <p className="text-xs font-semibold tracking-wide text-brass-600">WHY CROWDSHIELD</p>
        <h2 className="mx-auto mt-3 max-w-xl text-3xl font-bold text-ink-800">
          From reactive response to proactive safety
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-ink-500">
          One connected view for the decisions that matter most when people, time, and safety
          are on the line.
        </p>

        <div className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-6 text-left sm:grid-cols-3">
          {[
            {
              icon: Activity,
              title: 'Predict risk earlier',
              body: 'Forecast congestion and identify critical zones before thresholds are breached.',
            },
            {
              icon: Radio,
              title: 'Coordinate every response',
              body: 'Give field teams one live operational picture, from gates to exits.',
            },
            {
              icon: Layers,
              title: 'Test decisions safely',
              body: 'Simulate interventions before applying them to the real world.',
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl2 border border-ink-100 p-5">
              <Icon className="h-5 w-5 text-brass-600" />
              <p className="mt-3 text-sm font-semibold text-ink-800">{title}</p>
              <p className="mt-1 text-xs text-ink-500">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats band */}
      <section className="bg-ink-800 px-4 py-12 text-white sm:px-8 md:px-16 md:py-14">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-sm">
            <h3 className="text-2xl font-bold">Trusted when every second counts</h3>
            <p className="mt-2 text-sm text-ink-100">
              CrowdShield turns complex crowd movement into clear, actionable decisions.
            </p>
          </div>
          <div className="flex flex-wrap gap-6 sm:gap-10">
            {[
              ['6 views', 'Configured camera streams'],
              ['4 factors', 'Risk scoring model'],
              ['10–30 min', 'Trend projection horizon'],
            ].map(([value, label]) => (
              <div key={label}>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-ink-200">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section id="use-cases" className="px-4 py-12 sm:px-8 md:px-16 md:py-16">
        <h3 className="text-2xl font-bold text-ink-800">Designed for high-stakes environments.</h3>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [Users, 'Large public events', 'Festivals, stadiums, parades'],
            [Building2, 'Smart cities', 'Transit hubs and civic spaces'],
            [Siren, 'Emergency response', 'Faster coordination and evacuation'],
            [MapPinned, 'Venue operations', 'Safer everyday flow'],
          ].map(([Icon, title, body]) => {
            const IconComp = Icon as typeof Users
            return (
              <div key={title as string} className="rounded-xl2 border border-ink-100 p-4">
                <IconComp className="h-4 w-4 text-ink-600" />
                <p className="mt-2 text-sm font-semibold text-ink-800">{title as string}</p>
                <p className="text-xs text-ink-400">{body as string}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* CTA */}
      <section id="resources" className="mx-4 mb-16 rounded-xl2 bg-brass-50 px-5 py-8 sm:mx-8 sm:px-10 sm:py-10 md:mx-16">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="text-xl font-bold text-ink-800">Make every event safer by design.</h4>
            <p className="mt-1 text-sm text-ink-500">
              See how CrowdShield AI can fit into your venue, city, or response workflow.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="rounded-lg bg-ink-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink-800">
              Talk to our team
            </button>
            <Link
              to="/app"
              className="rounded-lg border border-ink-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink-700"
            >
              View the platform
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-100 px-4 py-8 text-xs text-ink-400 sm:px-8 md:px-16">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 CrowdShield AI · AI-powered crowd safety intelligence</p>
          <div className="flex gap-4">
            <a href="#privacy">Privacy</a>
            <a href="#security">Security</a>
            <a href="#terms">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
