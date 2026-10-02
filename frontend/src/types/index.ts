// Central data contract for CrowdShield AI.
// Backend/ML team: match this shape and swap src/data/mockData.ts + hooks
// for real API/WebSocket calls without touching any component.

export type ZoneStatus = 'safe' | 'watch' | 'high' | 'critical' | 'unknown'

export interface Zone {
  id: string
  name: string
  /** 0-100, percentage of safe operating capacity */
  occupancyPct: number | null
  status: ZoneStatus
  count: number | null
  capacity: number
  /** Physical density is unavailable until a camera view is calibrated. */
  density?: number | null
  updatedAt: string
}

export interface Gate {
  id: string
  name: string
  kind: 'entry' | 'exit'
  status: 'open' | 'restricted' | 'closed'
  flowPerMin: number
}

export interface Camera {
  id: string
  label: string
  cameraId: string
  status: string
  lastSeenAt: string
  count: number | null
  capacity: number
  videoUrl: string | null
  message: string | null
  riskScore: number | null
  riskState: string | null
  flowPerMin: number | null
  speedPixelsPerSecond: number | null
}

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface PriorityAction {
  id: string
  title: string
  severity: AlertSeverity
  detectedMinutesAgo: number
  actionLabel: string
}

export interface LiveAlert {
  id: string
  title: string
  description: string
  severity: AlertSeverity
  detectedMinutesAgo: number
}

export interface CrowdMetrics {
  peopleCount: number
  peopleCountDeltaPct: number
  avgDensity: number // people/m^2
  flowSpeed: number // m/s
  riskScore: number // 0-100, see lib/risk.ts
  evacuationEtaSeconds: number
  camerasOnline: number
  camerasTotal: number
  gatesOpen: number
  gatesTotal: number
}

export interface TrendPoint {
  time: string
  value: number
}

export interface PredictionPoint {
  time: string
  current?: number
  forecast?: number
}

export interface HotspotPrediction {
  zoneName: string
  atTime: string
  status: ZoneStatus
  confidencePct: number
}

export interface PredictionSummary {
  nextCriticalZone: string
  nextCriticalEtaMinutes: number
  predictedPeakDensity: number
  modelConfidencePct: number
  recommendedLeadTimeMinutes: number
}

export interface PredictionMetricRow {
  metric: string
  unit: string
  current: number
  plus10: number
  plus20: number
  plus30: number
}

export interface ScenarioInputs {
  name: string
  eventIntensityPct: number
  gateBStatus: 'open' | 'close_partially' | 'closed'
  gateACapacityPct: number
  deployMedicalTeam: boolean
  heavyRain: boolean
  durationMinutes: number
}

export interface SimulationResult {
  peakDensityBefore: number
  peakDensityAfter: number
  riskScoreBefore: number
  riskScoreAfter: number
  evacuationEtaBeforeSeconds: number
  evacuationEtaAfterSeconds: number
  routeEfficiencyGainPct: number
  recommendationText: string
}

export interface Venue {
  id: string
  name: string
  dateLabel: string
  timeLabel: string
}
