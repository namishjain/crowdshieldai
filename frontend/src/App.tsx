import { Route, Routes } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import Landing from '@/pages/Landing'
import Overview from '@/pages/Overview'
import LiveOperations from '@/pages/LiveOperations'
import Predictions from '@/pages/Predictions'
import WhatIfSimulation from '@/pages/WhatIfSimulation'
import Alerts from '@/pages/Alerts'
import Reports from '@/pages/Reports'
import Settings from '@/pages/Settings'
import FutureAlertness from '@/pages/FutureAlertness'
import UnprecedentedEvents from '@/pages/UnprecedentedEvents'
import { useLiveConnection } from '@/hooks/useLiveConnection'

export default function App() {
  useLiveConnection()
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<DashboardLayout />}>
        <Route index element={<Overview />} />
        <Route path="live-operations" element={<LiveOperations />} />
        <Route path="predictions" element={<Predictions />} />
        <Route path="future-alertness" element={<FutureAlertness />} />
        <Route path="unprecedented-events" element={<UnprecedentedEvents />} />
        <Route path="what-if" element={<WhatIfSimulation />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}
