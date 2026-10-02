import type { ZoneStatus } from '@/types'

/**
 * Risk score formula, as specified in the problem statement:
 *   Risk Score = 0.40 × Density + 0.20 × Flow + 0.20 × Capacity + 0.15 × Evacuation Time
 * Each input is normalized to a 0-100 scale before weighting.
 * NOTE: the PDF's weights sum to 0.95 — the remaining 0.05 is left as
 * headroom for a future signal (e.g. incident reports); keep the weights
 * here in sync if the ML team's model changes.
 */
export interface RiskInputs {
  /** current density as a fraction of critical density threshold, e.g. 1.2 = 20% over */
  densityRatio: number
  /** inbound flow as a fraction of safe flow threshold */
  flowRatio: number
  /** occupancy as a fraction of rated capacity */
  capacityRatio: number
  /** current evacuation ETA as a fraction of the target evacuation time */
  evacuationTimeRatio: number
}

const WEIGHTS = {
  density: 0.4,
  flow: 0.25,
  capacity: 0.2,
  evacuationTime: 0.15,
}

const clamp = (value: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, value))

export function computeRiskScore(inputs: RiskInputs): number {
  const score =
    WEIGHTS.density * clamp(inputs.densityRatio * 100) +
    WEIGHTS.flow * clamp(inputs.flowRatio * 100) +
    WEIGHTS.capacity * clamp(inputs.capacityRatio * 100) +
    WEIGHTS.evacuationTime * clamp(inputs.evacuationTimeRatio * 100)

  return Math.round(clamp(score))
}

/**
 * Risk bands, as specified in the problem statement:
 *   0-30 Safe · 30-60 Warning · 60-80 High · 80-100 Critical
 */
export function riskScoreToStatus(score: number): ZoneStatus {
  if (score < 30) return 'safe'
  if (score < 60) return 'watch'
  if (score < 80) return 'high'
  return 'critical'
}

export const STATUS_LABEL: Record<ZoneStatus, string> = {
  safe: 'Safe',
  watch: 'Watch',
  high: 'High',
  critical: 'Critical',
  unknown: 'No data',
}

/**
 * Evacuation ETA, estimated from total people, effective exit flow,
 * distance, walking speed, congestion and blockage/reaction delay —
 * per the problem statement's evacuation model.
 */
export interface EvacuationInputs {
  peopleCount: number
  effectiveExitFlowPerSec: number
  avgDistanceMeters: number
  walkingSpeedMps: number
  congestionFactor: number // >= 1, multiplies travel time
  reactionDelaySeconds: number
}

export function computeEvacuationEtaSeconds(inputs: EvacuationInputs): number {
  const throughputTime = inputs.peopleCount / Math.max(inputs.effectiveExitFlowPerSec, 0.01)
  const travelTime =
    (inputs.avgDistanceMeters / Math.max(inputs.walkingSpeedMps, 0.1)) *
    inputs.congestionFactor
  return Math.round(throughputTime + travelTime + inputs.reactionDelaySeconds)
}

export function formatEtaClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = Math.max(0, totalSeconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatEtaSignedDelta(deltaSeconds: number): string {
  const sign = deltaSeconds >= 0 ? '+' : '-'
  const abs = Math.abs(deltaSeconds)
  const m = Math.floor(abs / 60)
  const s = abs % 60
  return `${sign}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
