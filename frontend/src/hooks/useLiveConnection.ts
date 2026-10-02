import { useEffect } from 'react'
import { fetchState, liveWebSocketUrl } from '@/lib/api'
import { useCrowdStore } from '@/store/useCrowdStore'

/** Connects the dashboard to FastAPI's real-time canonical state feed. */
export function useLiveConnection() {
  const setState = useCrowdStore((store) => store.setState)
  const setConnected = useCrowdStore((store) => store.setConnected)
  const setError = useCrowdStore((store) => store.setError)

  useEffect(() => {
    let socket: WebSocket | undefined
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let pollTimer: ReturnType<typeof setInterval> | undefined
    let disposed = false
    let retryDelay = 1_000

    const refresh = async () => {
      try {
        setState(await fetchState())
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Backend unavailable')
      }
    }

    const connect = () => {
      if (disposed) return
      void refresh()
      try {
        socket = new WebSocket(liveWebSocketUrl())
      } catch {
        setConnected(false)
        retryTimer = setTimeout(connect, retryDelay)
        retryDelay = Math.min(8_000, Math.round(retryDelay * 1.7))
        return
      }
      socket.onopen = () => {
        setConnected(true)
        setError(null)
        retryDelay = 1_000
        if (pollTimer) clearInterval(pollTimer)
        pollTimer = undefined
      }
      socket.onmessage = (event) => {
        try {
          setState(JSON.parse(event.data))
        } catch {
          // Ignore a malformed transient frame and keep the socket alive.
        }
      }
      socket.onclose = () => {
        setConnected(false)
        if (disposed) return
        pollTimer = setInterval(() => void refresh(), 5_000)
        retryTimer = setTimeout(connect, retryDelay)
        retryDelay = Math.min(8_000, Math.round(retryDelay * 1.7))
      }
      socket.onerror = () => socket?.close()
    }

    connect()
    return () => {
      disposed = true
      if (retryTimer) clearTimeout(retryTimer)
      if (pollTimer) clearInterval(pollTimer)
      socket?.close()
    }
  }, [setConnected, setError, setState])
}
