import { useEffect, useRef, useState } from 'react'
import { Bell, ChevronDown, MapPin, Menu, ShieldAlert, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCrowdStore } from '@/store/useCrowdStore'
import { STATUS_STYLES } from '@/lib/utils'

interface TopBarProps {
  onMenuClick: () => void
  operatorId: string
  onEditProfile: () => void
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'OP'
}

function recommendationTone(priority: string) {
  if (priority === 'CRITICAL') return 'critical'
  if (priority === 'HIGH') return 'high'
  if (priority === 'MEDIUM') return 'watch'
  return 'safe'
}

export function TopBar({ onMenuClick, operatorId, onEditProfile }: TopBarProps) {
  const state = useCrowdStore((store) => store.state)
  const connected = useCrowdStore((store) => store.connected)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const notificationRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)
  const recommendations = state?.recommendations ?? []
  const alertCount = recommendations.length
  const updatedAt = state?.timestamp ? new Date(state.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (!notificationRef.current?.contains(target)) setNotificationsOpen(false)
      if (!profileRef.current?.contains(target)) setProfileMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  return (
    <header className="sticky top-0 z-20 flex min-h-[76px] items-center justify-between border-b border-slate-200/80 bg-white/90 px-3 backdrop-blur-xl md:px-7 xl:px-9">
      <div className="flex min-w-0 items-center gap-3 md:gap-4">
        <button className="shrink-0 rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 md:hidden" onClick={onMenuClick} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
        <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 sm:flex"><MapPin className="h-[18px] w-[18px]" /></span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-bold leading-tight text-slate-900 md:text-sm">{state?.venue.name || 'CrowdShield Operations'}</p>
          <p className="mt-1 truncate text-[10px] text-slate-500 md:text-xs">{updatedAt ? `Updated ${updatedAt} · ${state?.venue.views_with_measurements ?? 0}/${state?.cameras.length ?? 0} views reporting${state?.system.active_feed_id && state.system.active_feed_id !== 'original' ? ' · public sample footage' : ''}` : 'Waiting for backend data'}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3 md:gap-5">
        <span className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold sm:flex ${connected ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'animate-pulse bg-amber-500'}`} />{connected ? 'Live connection' : 'Reconnecting'}
        </span>

        <div className="relative" ref={notificationRef}>
          <button onClick={() => setNotificationsOpen((open) => !open)} className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition ${notificationsOpen ? 'border-slate-300 bg-slate-100 text-slate-900' : 'border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900'}`} aria-label={`Notifications${alertCount ? `, ${alertCount} recommendations` : ''}`} aria-expanded={notificationsOpen}>
            <Bell className="h-[18px] w-[18px]" />
            {alertCount > 0 && <span className="absolute right-1 top-1 flex min-h-[17px] min-w-[17px] items-center justify-center rounded-full border-2 border-white bg-rose-600 px-1 text-[9px] font-bold leading-none text-white">{alertCount > 9 ? '9+' : alertCount}</span>}
          </button>
          {notificationsOpen && <div className="absolute right-0 top-[calc(100%+12px)] z-50 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_22px_70px_-20px_rgba(15,23,42,.3)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
              <div><p className="text-sm font-bold text-slate-900">Recommendations</p><p className="mt-0.5 text-[11px] text-slate-500">Latest operator actions</p></div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{alertCount} active</span>
            </div>
            {recommendations.length ? <ul className="max-h-[340px] divide-y divide-slate-100 overflow-y-auto px-4">
              {recommendations.slice(0, 5).map((item) => {
                const tone = recommendationTone(item.priority)
                const styles = STATUS_STYLES[tone]
                return <li key={item.action_id} className="flex gap-3 py-3.5">
                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${styles.bg} ${styles.text}`}><ShieldAlert className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2"><p className="text-xs font-bold capitalize leading-5 text-slate-800">{item.action_type.replaceAll('_', ' ')}</p><span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold ${styles.bg} ${styles.text}`}>{item.priority}</span></div>
                    <p className="mt-1 text-[11px] leading-4 text-slate-500">{item.target} · {item.reason}</p>
                  </div>
                </li>
              })}
            </ul> : <div className="px-5 py-9 text-center"><span className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">✓</span><p className="mt-3 text-sm font-semibold text-slate-800">You’re all caught up</p><p className="mt-1 text-xs text-slate-500">New recommendations appear here as the venue state updates.</p></div>}
            <Link to="/app/alerts" onClick={() => setNotificationsOpen(false)} className="flex items-center justify-center border-t border-slate-100 bg-slate-50/80 px-4 py-3 text-xs font-bold text-slate-700 transition hover:bg-slate-100">View all alerts and decisions</Link>
          </div>}
        </div>

        <div className="relative" ref={profileRef}>
          <button onClick={() => setProfileMenuOpen((open) => !open)} className="flex items-center gap-2 rounded-xl p-1.5 pr-2 transition hover:bg-slate-50" aria-label="Open operator profile menu" aria-expanded={profileMenuOpen}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-950 text-[10px] font-extrabold text-amber-300 shadow-md shadow-slate-900/15">{initials(operatorId)}</span>
            <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 sm:block" />
          </button>
          {profileMenuOpen && <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_60px_-20px_rgba(15,23,42,.28)]">
            <div className="px-3 py-2"><p className="truncate text-xs font-bold text-slate-900">{operatorId}</p><p className="mt-0.5 text-[10px] text-slate-500">{state?.system.active_feed_label || 'Control room operator'}</p></div>
            <button onClick={() => { setProfileMenuOpen(false); onEditProfile() }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-50"><UserRound className="h-4 w-4 text-slate-500" />View / edit profile</button>
          </div>}
        </div>
      </div>
    </header>
  )
}
