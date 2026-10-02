import type { CrowdState } from '@/types/backend'

export const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')

export interface DatabaseStatus {
  enabled: boolean
  connected: boolean
  status: string
  queued_records: number
  dropped_records: number
  last_error: string | null
}

export interface RiskConfig {
  risk_weights: Record<string, number>
  risk_thresholds: Record<string, number>
  camera_interval_seconds: number
  configured_cameras: string[]
  topology_status: string
  scenarios: Array<{ id: string; label: string; type: string; target: string }>
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { cache: 'no-store', ...init })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = body && typeof body.detail === 'string' ? body.detail : `Request failed (${response.status})`
    throw new Error(detail)
  }
  return body as T
}

export const fetchState = () => request<CrowdState>('/api/state')
export const fetchHealth = () => request<{ ok: boolean; status: string; cameras_with_measurements: number }>('/health')
export const fetchDatabaseStatus = () => request<DatabaseStatus>('/api/database/status')
export const fetchConfig = () => request<RiskConfig>('/api/config')

export function selectOperator(operatorId: string) {
  return request<{ operator_id: string; feed_id: string; feed_label: string; changed: boolean; footage_notice: string }>('/api/operator', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operator_id: operatorId }),
  })
}

export function liveWebSocketUrl(): string {
  const base = new URL(API_BASE || window.location.origin, window.location.href)
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:'
  base.pathname = '/ws/live'
  base.search = ''
  base.hash = ''
  return base.toString()
}

export async function runScenario(scenarioId: string, steps = 10, target?: string) {
  return request<CrowdState['simulation']>('/api/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario_id: scenarioId, steps, ...(target ? { target } : {}) }),
  })
}

export const clearSimulation = () => request<{ ok: boolean }>('/api/simulation/clear', { method: 'POST' })

export function fetchHistory<T>(kind: 'measurements' | 'events' | 'simulations', limit = 50): Promise<T[]> {
  return request<T[]>(`/api/history/${kind}?limit=${limit}`)
}
