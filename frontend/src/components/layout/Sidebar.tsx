import { NavLink } from 'react-router-dom'
import {
  Activity, AlertTriangle, FileText, GitBranch, LayoutGrid, Radio, Settings, ShieldCheck, UserRound, X, CalendarClock, Orbit,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/app', label: 'Overview', icon: LayoutGrid, end: true, group: 'WORKSPACE' },
  { to: '/app/live-operations', label: 'Live operations', icon: Radio, group: 'WORKSPACE' },
  { to: '/app/predictions', label: 'Predictions', icon: Activity, group: 'INTELLIGENCE' },
  { to: '/app/future-alertness', label: 'Future alertness', icon: CalendarClock, group: 'INTELLIGENCE' },
  { to: '/app/unprecedented-events', label: 'Unprecedented events', icon: Orbit, group: 'INTELLIGENCE' },
  { to: '/app/what-if', label: 'What-if simulation', icon: GitBranch, group: 'INTELLIGENCE' },
  { to: '/app/alerts', label: 'Alerts & decisions', icon: AlertTriangle, group: 'INTELLIGENCE' },
  { to: '/app/reports', label: 'Reports', icon: FileText, group: 'SYSTEM' },
  { to: '/app/settings', label: 'Settings', icon: Settings, group: 'SYSTEM' },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
  operatorId: string
  onEditProfile: () => void
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'OP'
}

export function Sidebar({ open, onClose, operatorId, onEditProfile }: SidebarProps) {
  let previousGroup = ''
  return (
    <>
      {open && <button className="fixed inset-0 z-30 bg-slate-950/55 backdrop-blur-sm md:hidden" onClick={onClose} aria-label="Close navigation" />}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-40 flex h-screen w-[276px] shrink-0 flex-col border-r border-slate-800/80 bg-slate-950 text-white shadow-2xl shadow-slate-950/20 transition-transform duration-200 ease-out',
        'md:static md:z-auto md:translate-x-0 md:shadow-none', open ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className="px-5 pb-5 pt-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-300/20 bg-gradient-to-br from-amber-300/20 to-amber-300/5 shadow-inner shadow-white/5">
                <ShieldCheck className="h-5 w-5 text-amber-300" strokeWidth={2.1} />
              </div>
              <div>
                <p className="text-[15px] font-bold tracking-tight text-white">CrowdShield AI</p>
                <p className="mt-0.5 text-[9px] font-bold tracking-[.22em] text-slate-500">COMMAND CENTER</p>
              </div>
            </div>
            <button className="rounded-xl p-2 text-slate-500 transition hover:bg-white/10 hover:text-white md:hidden" onClick={onClose} aria-label="Close menu"><X className="h-5 w-5" /></button>
          </div>
          <div className="mt-7 flex items-center gap-2 rounded-xl border border-emerald-400/10 bg-emerald-400/[.06] px-3 py-2.5">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-35" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>
            <span className="text-[11px] font-semibold tracking-wide text-emerald-200">VENUE MONITORING ACTIVE</span>
          </div>
        </div>

        <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-5">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end, group }) => {
            const showGroup = group !== previousGroup
            previousGroup = group
            return <div key={to}>
              {showGroup && <p className="mb-2 mt-5 px-3 text-[9px] font-bold tracking-[.2em] text-slate-600">{group}</p>}
              <NavLink to={to} end={end} onClick={onClose} className={({ isActive }) => cn(
                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-150',
                isActive ? 'bg-white/[.09] text-white shadow-sm shadow-black/10 before:absolute before:inset-y-2.5 before:left-0 before:w-[3px] before:rounded-full before:bg-amber-300' : 'text-slate-400 hover:bg-white/[.05] hover:text-slate-100',
              )}>
                {({ isActive }) => <><span className={cn('flex h-8 w-8 items-center justify-center rounded-lg transition-colors', isActive ? 'bg-amber-300/10 text-amber-300' : 'text-slate-500 group-hover:text-slate-200')}><Icon className="h-[17px] w-[17px]" strokeWidth={1.9} /></span>{label}</>}
              </NavLink>
            </div>
          })}
        </nav>

        <div className="border-t border-white/[.08] p-4">
          <button onClick={onEditProfile} className="group flex w-full items-center gap-3 rounded-2xl border border-white/[.07] bg-white/[.04] p-3 text-left transition hover:border-white/15 hover:bg-white/[.07]" aria-label="View or edit operator profile">
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-200 to-amber-500 text-[11px] font-extrabold text-slate-950 shadow-lg shadow-amber-900/20">
              {initials(operatorId)}
              <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-[3px] border-slate-950 bg-emerald-400" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-semibold text-white">{operatorId}</span>
              <span className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500"><UserRound className="h-3 w-3" />Operator profile</span>
            </span>
            <span className="text-[10px] font-semibold text-slate-600 transition group-hover:text-amber-300">EDIT</span>
          </button>
          <p className="mt-3 px-1 text-[9px] text-slate-600">SISTec Innovation Hackathon · 2026</p>
        </div>
      </aside>
    </>
  )
}
