import { useEffect, useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { fetchHistory } from '@/lib/api'
import { useCrowdStore } from '@/store/useCrowdStore'

type HistoryItem = { recorded_at?: string; event_type?: string; scenario_label?: string; action?: string; payload?: Record<string, unknown> }

export default function Reports() {
  const state = useCrowdStore((store) => store.state)
  const [events, setEvents] = useState<HistoryItem[]>([])
  const [simulations, setSimulations] = useState<HistoryItem[]>([])
  const [historyMessage, setHistoryMessage] = useState('Loading stored PostgreSQL history…')

  useEffect(() => {
    Promise.all([fetchHistory<HistoryItem>('events', 20), fetchHistory<HistoryItem>('simulations', 20)])
      .then(([eventRows, simulationRows]) => {
        setEvents(eventRows)
        setSimulations(simulationRows)
        setHistoryMessage('Loaded from PostgreSQL')
      })
      .catch((error: unknown) => setHistoryMessage(error instanceof Error ? error.message : 'PostgreSQL history is unavailable'))
  }, [])

  function exportReport() {
    const report = {
      generated_at: new Date().toISOString(),
      venue: state?.venue ?? null,
      state_snapshot: state,
      persisted_history: { recent_events: events, recent_simulations: simulations },
      notes: [
        'Camera views can overlap; per-view counts are not a unique-person venue total.',
        'The venue map, capacities and evacuation graph are illustrative demo configuration.',
        'All recommendations are for human operator review; no physical controls are connected.',
      ],
    }
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `crowdshield-report-${new Date().toISOString().replaceAll(':', '-')}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-2xl font-semibold text-ink-800">Reports & history</h1><p className="mt-1 text-sm text-ink-400">Export the current measured snapshot and inspect persisted decision history.</p></div><Button variant="primary" onClick={exportReport} disabled={!state}><Download className="mr-1.5 inline h-4 w-4" />Export current report</Button></div>

      <Card title="Current snapshot" subtitle="Values are taken from the live backend state"><div className="grid grid-cols-2 gap-4 sm:grid-cols-4"><Summary label="Venue" value={state?.venue.name || 'Waiting for backend'} /><Summary label="Current risk" value={state?.global_risk_score == null ? '—' : `${state.global_risk_score.toFixed(1)} · ${state.global_risk_state}`} /><Summary label="Camera views" value={`${state?.venue.views_with_measurements ?? 0} / ${state?.cameras.length ?? 6}`} /><Summary label="Current session" value={state?.timestamp ? new Date(state.timestamp).toLocaleString() : '—'} /></div></Card>

      <Card title="PostgreSQL decision history" subtitle={historyMessage}><div className="grid grid-cols-1 gap-6 md:grid-cols-2"><HistoryList title="Saved events" rows={events} empty="No event history found. Connect PostgreSQL and run the demo to record events." /><HistoryList title="Saved what-if runs" rows={simulations} empty="No simulation history found yet." /></div></Card>

      <p className="text-xs text-ink-400">The JSON export contains operational state and optional stored history. It does not contain video, temporary track IDs or bounding boxes.</p>
    </div>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-ink-100 p-3"><p className="text-xs text-ink-400">{label}</p><p className="mt-1 text-sm font-semibold text-ink-800">{value}</p></div>
}

function HistoryList({ title, rows, empty }: { title: string; rows: HistoryItem[]; empty: string }) {
  return <div><p className="mb-2 text-sm font-semibold text-ink-700">{title} <span className="font-normal text-ink-400">({rows.length})</span></p>{rows.length ? <ul className="flex flex-col divide-y divide-ink-100">{rows.slice(-8).reverse().map((row, index) => <li key={`${row.recorded_at}-${index}`} className="flex items-start gap-2 py-2"><FileText className="mt-0.5 h-4 w-4 shrink-0 text-brass-600" /><div><p className="text-xs font-medium text-ink-700">{row.action || row.scenario_label || row.event_type || 'Saved record'}</p><p className="text-[11px] text-ink-400">{row.recorded_at ? new Date(row.recorded_at).toLocaleString() : 'Timestamp unavailable'}</p></div></li>)}</ul> : <p className="rounded-lg bg-ink-50 px-3 py-4 text-xs text-ink-400">{empty}</p>}</div>
}
