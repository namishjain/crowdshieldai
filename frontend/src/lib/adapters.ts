import type { CrowdState } from '@/types/backend'
import type { Camera, Zone, ZoneStatus } from '@/types'

export function statusFromRisk(state: string | null | undefined): ZoneStatus {
  switch (state) {
    case 'SAFE': return 'safe'
    case 'WARNING': return 'watch'
    case 'HIGH': return 'high'
    case 'CRITICAL': return 'critical'
    default: return 'unknown'
  }
}

export function displayZones(state: CrowdState | null): Zone[] {
  if (!state) return []
  return state.zones.map((zone) => ({
    id: zone.zone_id,
    name: zone.name,
    occupancyPct: zone.count === null ? null : Math.min(100, Math.round((zone.count / Math.max(1, zone.capacity)) * 100)),
    count: zone.count,
    capacity: zone.capacity,
    status: statusFromRisk(zone.risk_state),
    updatedAt: state.timestamp,
  }))
}

export function displayCameras(state: CrowdState | null): Camera[] {
  if (!state) return []
  return state.cameras.map((camera) => ({
    id: camera.camera_id,
    cameraId: camera.camera_id,
    label: camera.zone_name,
    status: camera.status,
    lastSeenAt: state.timestamp,
    count: camera.count,
    capacity: camera.capacity,
    videoUrl: camera.video_url,
    message: camera.message,
    riskScore: camera.risk_score,
    riskState: camera.risk_state,
    flowPerMin: camera.flow_rate_per_minute,
    speedPixelsPerSecond: camera.average_speed_pixels_per_second,
  }))
}

export function highestMeasuredCount(state: CrowdState | null): number | null {
  const counts = state?.zones.map((zone) => zone.count).filter((count): count is number => count !== null) ?? []
  return counts.length ? Math.max(...counts) : null
}

export function highestProjectedRisk(state: CrowdState | null): number | null {
  const scores = state?.predictions.map((point) => point.projected_risk_score).filter((score): score is number => score !== null) ?? []
  return scores.length ? Math.max(...scores) : null
}
