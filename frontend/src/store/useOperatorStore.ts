import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface OperatorStore {
  operatorId: string | null
  setOperatorId: (operatorId: string) => void
}

export const useOperatorStore = create<OperatorStore>()(persist(
  (set) => ({
    operatorId: null,
    setOperatorId: (operatorId) => set({ operatorId: operatorId.trim() }),
  }),
  { name: 'crowdshield.operator-profile.v2' },
))
