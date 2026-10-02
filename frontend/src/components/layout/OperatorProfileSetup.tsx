import { useState, type FormEvent } from 'react'
import { ArrowRight, CheckCircle2, Fingerprint, MapPin, ShieldCheck, X } from 'lucide-react'

interface OperatorProfileSetupProps {
  initialValue?: string
  onSave: (operatorId: string) => void | Promise<void>
  onCancel?: () => void
}

const operatorProfiles = [
  { operatorId: 'Devansh Singh Bais', feed: 'ETH Zurich Courtyard (WILDTRACK)', detail: 'The original Zurich demo videos', tone: 'bg-blue-50 text-blue-700' },
  { operatorId: 'Amrendra Sharma', feed: 'Religious Event Samples', detail: 'Six licensed Indian religious-event clips · public sample footage', tone: 'bg-amber-50 text-amber-800' },
  { operatorId: 'Namish Jain', feed: 'Indian Railway Samples', detail: 'Six licensed Indian railway clips · public sample footage', tone: 'bg-violet-50 text-violet-700' },
]

export function OperatorProfileSetup({ initialValue, onSave, onCancel }: OperatorProfileSetupProps) {
  const startingProfile = operatorProfiles.find((profile) => profile.operatorId.toLowerCase() === initialValue?.trim().toLowerCase()) ?? operatorProfiles[0]
  const [operatorId, setOperatorId] = useState(startingProfile.operatorId)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const selectedProfile = operatorProfiles.find((profile) => profile.operatorId === operatorId) ?? operatorProfiles[0]
  const initials = operatorId.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'OP'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setSubmitError(null)
    try {
      await onSave(operatorId)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not change the active sample feed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="profile-screen fixed inset-0 z-[100] grid min-h-screen overflow-y-auto bg-slate-950 lg:grid-cols-[1.05fr_.95fr]">
      <div className="relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="profile-orb profile-orb-one" />
        <div className="profile-orb profile-orb-two" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-lg shadow-black/10">
            <ShieldCheck className="h-6 w-6 text-amber-300" strokeWidth={2} />
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight">CrowdShield AI</p>
            <p className="text-[10px] font-semibold tracking-[.24em] text-slate-400">OPERATIONS PLATFORM</p>
          </div>
        </div>
        <div className="relative z-10 max-w-xl pb-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.16em] text-emerald-200">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" /> Safety intelligence · live demo
          </span>
          <h1 className="mt-7 text-5xl font-semibold leading-[1.08] tracking-[-.04em] xl:text-6xl">
            A clearer picture.<br /><span className="text-amber-300">A calmer response.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-slate-300">
            Bring camera measurements, route options, and scenario planning into one thoughtful operations workspace.
          </p>
          <div className="mt-9 grid max-w-lg grid-cols-3 gap-3">
            {[
              ['01', 'OBSERVE'], ['02', 'UNDERSTAND'], ['03', 'PLAN'],
            ].map(([number, label]) => (
              <div key={number} className="rounded-2xl border border-white/10 bg-white/[.04] p-4 backdrop-blur-sm">
                <p className="text-xs font-bold text-amber-300">{number}</p>
                <p className="mt-2 text-[10px] font-semibold tracking-[.16em] text-slate-300">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative z-10 text-xs text-slate-500">Decision support for operator review · no physical controls are connected</p>
      </div>

      <div className="relative flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12 sm:px-8">
        {onCancel && (
          <button onClick={onCancel} className="absolute right-5 top-5 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-200 hover:text-slate-800" type="button">
            <X className="h-4 w-4" /> Cancel
          </button>
        )}
        <div className="w-full max-w-md">
          <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-amber-300 shadow-lg shadow-slate-900/15 lg:hidden">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-700">Operator profile</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{initialValue ? 'Update your profile' : 'Welcome to CrowdShield'}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">Choose an operator ID. Each demo profile opens its own six-video feed automatically.</p>
          </div>

          <form onSubmit={handleSubmit} className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_-30px_rgba(15,23,42,.28)] sm:p-8">
            <div className="mb-6 flex items-center gap-3 rounded-2xl bg-slate-50 p-3.5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 text-xs font-extrabold text-amber-300">{initials}</span>
              <span className="min-w-0"><span className="block text-[9px] font-bold uppercase tracking-[.15em] text-slate-400">Profile preview</span><span className="mt-1 block truncate text-sm font-bold text-slate-900">{operatorId}</span><span className="mt-0.5 block text-[10px] text-slate-500">Control room operator</span></span>
            </div>
            <label htmlFor="operator-id" className="block text-sm font-semibold text-slate-800">Operator ID</label>
            <div className="relative mt-2">
              <Fingerprint className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <select
                id="operator-id"
                value={operatorId}
                onChange={(event) => setOperatorId(event.target.value)}
                autoFocus
                className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              >
                {operatorProfiles.map((profile) => <option key={profile.operatorId} value={profile.operatorId}>{profile.operatorId}</option>)}
              </select>
            </div>
            <div className={`mt-3 flex items-start gap-3 rounded-2xl p-3.5 ${selectedProfile.tone}`}>
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <div><p className="text-xs font-bold">{selectedProfile.feed}</p><p className="mt-1 text-[11px] leading-4 opacity-80">{selectedProfile.detail}</p></div>
            </div>
            <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-500">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              Saved in this browser. Changing the profile also switches all six camera sample videos; this is a demo profile, not account authentication.
            </p>
            {submitError && <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{submitError}</p>}
            <button type="submit" disabled={saving} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-500/25 disabled:cursor-wait disabled:opacity-70">
              {saving ? 'Switching six camera feeds…' : initialValue ? 'Save profile and switch feed' : 'Enter command center'} <ArrowRight className="h-4 w-4 text-amber-300" />
            </button>
          </form>
          <p className="mt-5 text-center text-xs text-slate-400">CrowdShield AI · SISTec Innovation Hackathon 2026</p>
        </div>
      </div>
    </div>
  )
}
