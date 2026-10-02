import { create } from 'zustand'
import type { CrowdState } from '@/types/backend'
import { fetchState } from '@/lib/api'

export interface TrendPoint {
  time: string
  value: number
}

interface CrowdStore {
  state: CrowdState | null
  connected: boolean
  error: string | null
  trend: TrendPoint[]
  lastTrendSampleMs: number
  setState: (state: CrowdState) => void
  setConnected: (connected: boolean) => void
  setError: (error: string | null) => void
  setSimulation: (simulation: CrowdState['simulation']) => void
  refresh: () => Promise<void>
}

function highestViewCount(state: CrowdState): number | null {
  const counts = state.zones.map((zone) => zone.count).filter((count): count is number => count !== null)
  return counts.length ? Math.max(...counts) : null
}

export const useCrowdStore = create<CrowdStore>((set, get) => ({
  state: null,
  connected: false,
  error: null,
  trend: [],
  lastTrendSampleMs: 0,
  setState: (next) => {
    const value = highestViewCount(next)
    set((previous) => {
      const now = Date.now()
      const shouldSample = value !== null && now - previous.lastTrendSampleMs >= 8_000
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      return {
        state: next,
        error: null,
        trend: shouldSample ? [...previous.trend, { time, value }].slice(-36) : previous.trend,
        lastTrendSampleMs: shouldSample ? now : previous.lastTrendSampleMs,
      }
    })
  },
  setConnected: (connected) => set({ connected }),
  setError: (error) => set({ error }),
  setSimulation: (simulation) => set((current) => ({
    state: current.state ? { ...current.state, simulation } : current.state,
  })),
  refresh: async () => {
    try {
      get().setState(await fetchState())
    } catch (error) {
      get().setError(error instanceof Error ? error.message : 'Could not refresh dashboard data')
    }
  },
}))
