import { useEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { OperatorProfileSetup } from './OperatorProfileSetup'
import { useOperatorStore } from '@/store/useOperatorStore'
import { selectOperator } from '@/lib/api'

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const operatorId = useOperatorStore((store) => store.operatorId)
  const setOperatorId = useOperatorStore((store) => store.setOperatorId)
  const appliedOperator = useRef<string | null>(null)

  useEffect(() => {
    if (!operatorId || appliedOperator.current === operatorId) return
    const value = operatorId
    appliedOperator.current = value
    void selectOperator(value).catch((error) => {
      appliedOperator.current = null
      console.error('Could not restore operator feed:', error)
    })
  }, [operatorId])

  async function saveOperator(value: string) {
    await selectOperator(value)
    appliedOperator.current = value
    setOperatorId(value)
    setEditingProfile(false)
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-paper">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        operatorId={operatorId || 'Devansh Singh Bais'}
        onEditProfile={() => setEditingProfile(true)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenuClick={() => setSidebarOpen(true)} operatorId={operatorId || 'Devansh Singh Bais'} onEditProfile={() => setEditingProfile(true)} />
        <main className="flex-1 overflow-y-auto scrollbar-thin px-4 py-5 md:px-7 md:py-7 xl:px-9">
          <Outlet />
        </main>
      </div>
      {(!operatorId || editingProfile) && (
        <OperatorProfileSetup
          initialValue={operatorId || undefined}
          onSave={saveOperator}
          onCancel={operatorId ? () => setEditingProfile(false) : undefined}
        />
      )}
    </div>
  )
}
