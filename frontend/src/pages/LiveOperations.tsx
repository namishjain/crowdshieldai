import { useState } from 'react'
import { Activity, AlertTriangle, Camera, RefreshCw, Route, Users, Waves } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCrowdStore } from '@/store/useCrowdStore'
import { useOperatorStore } from '@/store/useOperatorStore'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LiveCrowdMap } from '@/components/map/LiveCrowdMap'
import { API_BASE } from '@/lib/api'
import { displayCameras, displayZones, highestMeasuredCount, statusFromRisk } from '@/lib/adapters'
import { STATUS_STYLES } from '@/lib/utils'

type VvipPosition = { left: number; top: number }

// Timestamped head points for the longest-visible person in the Zurich CAM 02 sample.
const VVIP_TRACK = [
  [0, 59.8, 5.0], [0.5, 59.7, 5.7], [1, 59.2, 5.5], [1.5, 59.3, 6.3],
  [2, 59.5, 6.8], [2.5, 60.1, 7.6], [3, 59.9, 8.7], [3.5, 59.1, 8.5],
  [4, 58.3, 9.8], [4.5, 55.8, 11.2], [5, 53.9, 12.1], [5.5, 50.4, 14.7],
  [6, 45.9, 17.1], [6.5, 41.8, 17.6], [7, 34.3, 20.5], [7.5, 26.3, 23.8],
  [8, 16.6, 31.2], [8.5, 8.4, 36.4], [8.6, 7.6, 39.4],
] as const

function vvipPositionAt(time: number): VvipPosition | null {
  const last = VVIP_TRACK[VVIP_TRACK.length - 1]
  if (time > last[0] + 0.12) return null
  const nextIndex = VVIP_TRACK.findIndex(([pointTime]) => pointTime >= time)
  if (nextIndex === -1) return { left: last[1], top: last[2] }
  if (nextIndex <= 0) return { left: VVIP_TRACK[0][1], top: VVIP_TRACK[0][2] }
  const before = VVIP_TRACK[nextIndex - 1]
  const after = VVIP_TRACK[nextIndex]
  const ratio = (time - before[0]) / (after[0] - before[0])
  return {
    left: before[1] + (after[1] - before[1]) * ratio,
    top: before[2] + (after[2] - before[2]) * ratio,
  }
}

function valueOrDash(value: number | null | undefined, digits = 0) {
  return value === null || value === undefined ? '—' : value.toFixed(digits)
}

export default function LiveOperations() {
  const state = useCrowdStore((store) => store.state)
  const refresh = useCrowdStore((store) => store.refresh)
  const connected = useCrowdStore((store) => store.connected)
  const operatorId = useOperatorStore((store) => store.operatorId)
  const [refreshing, setRefreshing] = useState(false)
  const [vvipPosition, setVvipPosition] = useState<VvipPosition | null>(() => vvipPositionAt(0))
  const cameras = displayCameras(state)
  const zones = displayZones(state)
  const recommendations = state?.recommendations ?? []
  const highestCount = highestMeasuredCount(state)
  const reporting = cameras.filter((camera) => camera.count !== null).length
  const gates = Object.entries(state?.gates ?? {})
  const gatesOpen = gates.filter(([, status]) => status === 'OPEN').length
  const highestFlow = Math.max(0, ...(state?.cameras.map((camera) => camera.flow_rate_per_minute ?? 0) ?? []))
  const showZurichVvip = operatorId?.trim().toLowerCase() === 'devansh singh bais' && state?.system.active_feed_id === 'original'

  async function handleRefresh() {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-800">Live operations</h1>
          <p className="mt-1 text-sm text-ink-400">Six synchronized sample views, tracked counts, view risk and software route state.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => void handleRefresh()} disabled={refreshing}>
            <RefreshCw className={`mr-1.5 inline h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />Refresh
          </Button>
          <Link to="/app/what-if"><Button variant="primary">Run what-if simulation</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title={`${state?.venue.name || 'Configured venue'} · illustrative view map`} subtitle="View placements and route graph are not a surveyed venue plan" className="lg:col-span-2">
          {zones.length ? <LiveCrowdMap zones={zones} variant="detailed" /> : <EmptyState text="Waiting for the backend's camera and venue configuration." />}
        </Card>
        <Card title="Operator recommendations" action={<span className={`flex items-center gap-1.5 text-xs font-semibold ${connected ? 'text-safe-text' : 'text-watch-text'}`}><span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-safe-dot' : 'bg-watch-dot'}`} />{connected ? 'Connected' : 'Reconnecting'}</span>}>
          {recommendations.length ? (
            <ul className="flex flex-col gap-3">
              {recommendations.map((item) => {
                const status = item.priority === 'CRITICAL' ? 'critical' : item.priority === 'HIGH' ? 'high' : item.priority === 'MEDIUM' ? 'watch' : 'safe'
                const styles = STATUS_STYLES[status]
                return <li key={item.action_id} className="rounded-lg border border-ink-100 p-3">
                  <div className="flex items-start justify-between gap-2"><p className="text-sm font-medium text-ink-800">{item.action_type.replaceAll('_', ' ')}</p><span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${styles.bg} ${styles.text}`}>{item.priority}</span></div>
                  <p className="mt-1 text-xs text-ink-400">{item.target} · {item.reason}</p>
                  <p className="mt-1 text-xs text-ink-500">Expected: {item.expected_effect}</p>
                </li>
              })}
            </ul>
          ) : <EmptyState text={reporting ? 'No current rule-based intervention.' : 'Actions appear when measurements meet configured conditions.'} />}
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Highest view count" value={highestCount?.toLocaleString('en-IN') ?? '—'} note="Per camera view" icon={Users} />
        <MetricCard label="Highest view flow" value={`${valueOrDash(highestFlow)} /min`} note="Rolling crossings" icon={Waves} />
        <MetricCard label="Open software gates" value={`${gatesOpen} / ${gates.length || '—'}`} note="Graph state only" icon={Route} />
        <MetricCard label="Views reporting" value={`${reporting} / ${cameras.length || 6}`} note="Measured count received" icon={Camera} />
      </div>

      <Card title="Live camera feeds" subtitle="Short local video excerpts · YOLO person detection · independent per-view tracking">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cameras.map((camera) => {
            const status = statusFromRisk(camera.riskState)
            const badge = STATUS_STYLES[status]
            return <article key={camera.id} className="overflow-hidden rounded-xl border border-ink-100 bg-white">
              <div className="relative aspect-video bg-ink-900">
                {camera.videoUrl ? (
                  <video
                    className="h-full w-full object-contain"
                    src={`${API_BASE}${camera.videoUrl}`}
                    autoPlay muted loop playsInline controls preload="metadata"
                    onTimeUpdate={showZurichVvip && camera.cameraId === 'camera_02' ? (event) => setVvipPosition(vvipPositionAt(event.currentTarget.currentTime)) : undefined}
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 px-5 text-center text-ink-200"><Camera className="h-7 w-7 text-brass-400" /><span className="text-xs">{camera.message || 'Video asset unavailable'}</span></div>
                )}
                <span className="absolute left-2 top-2 rounded bg-ink-900/80 px-2 py-1 text-[10px] font-semibold text-white">{camera.status.replaceAll('_', ' ')}</span>
                <span className={`absolute right-2 top-2 rounded px-2 py-1 text-[10px] font-semibold ${badge.bg} ${badge.text}`}>{camera.riskState?.replace('_', ' ') || 'NO DATA'}</span>
                {showZurichVvip && camera.cameraId === 'camera_02' && vvipPosition && <>
                  <span className="pointer-events-none absolute z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-red-600 shadow-[0_0_0_3px_rgba(220,38,38,0.4)]" style={{ left: `${vvipPosition.left}%`, top: `${vvipPosition.top}%` }} aria-label="VVIP focus marker" />
                  <span className="pointer-events-none absolute left-[30%] top-[7%] z-10 inline-flex items-center gap-1.5 rounded-md bg-red-800/95 px-2 py-1 text-[9px] font-bold tracking-wide text-white shadow-md">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-300" />VVIP · SPECIAL ATTENTION
                  </span>
                </>}
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold text-ink-800">{camera.cameraId.replace('camera_', 'CAM ')}</p><p className="text-xs text-ink-400">{camera.label}</p></div><span className="text-sm font-semibold text-ink-800">{camera.count ?? '—'} <span className="text-xs font-normal text-ink-400">people tracked</span></span></div>
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-ink-100 pt-3">
                  <CameraMetric label="View capacity" value={camera.count === null ? '—' : `${valueOrDash((camera.count / Math.max(camera.capacity, 1)) * 100)}%`} />
                  <CameraMetric label="Flow / min" value={valueOrDash(camera.flowPerMin)} />
                  <CameraMetric label="Speed" value={`${valueOrDash(camera.speedPixelsPerSecond, 1)} px/s`} />
                </div>
              </div>
            </article>
          })}
        </div>
        {!cameras.length && <EmptyState text="Camera feeds will appear when the backend is running." />}
      </Card>

      <p className="flex items-start gap-2 text-xs text-ink-400"><Activity className="mt-0.5 h-4 w-4 shrink-0" />Camera views overlap. Counts are per view and are not added into a unique-person venue total. Pixel speed is not calibrated to metres per second.</p>
    </div>
  )
}

function MetricCard({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: typeof Users }) {
  return <Card><div className="flex items-start justify-between"><div><p className="text-sm text-ink-400">{label}</p><p className="mt-2 text-2xl font-semibold text-ink-800">{value}</p><p className="mt-1 text-xs text-ink-400">{note}</p></div><Icon className="h-5 w-5 text-ink-500" /></div></Card>
}

function CameraMetric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] text-ink-400">{label}</p><p className="mt-0.5 text-xs font-semibold text-ink-700">{value}</p></div>
}

function EmptyState({ text }: { text: string }) {
  return <div className="flex items-center justify-center py-10 text-center text-sm text-ink-400"><AlertTriangle className="mr-2 h-4 w-4" />{text}</div>
}
