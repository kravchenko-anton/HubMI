import { useEffect, useState } from 'react'

import {
  isViewportHydrated,
  subscribeViewportHydrated,
  useMapViewportStore,
  type LngLat,
} from '@/stores/map-viewport-store'

export type SavedMapView = {
  center: LngLat
  zoom: number
}

export function useSavedMapView() {
  const [view, setView] = useState<SavedMapView | null>(null)

  useEffect(() => {
    const apply = () => {
      const { center, zoom } = useMapViewportStore.getState()
      setView((current) => current ?? { center: [center[0], center[1]], zoom })
    }

    if (isViewportHydrated()) {
      apply()
      return
    }

    const unsubscribeStore = subscribeViewportHydrated(apply)
    const unsubscribePersist = useMapViewportStore.persist?.onFinishHydration(apply)
    if (isViewportHydrated()) apply()

    return () => {
      unsubscribeStore()
      unsubscribePersist?.()
    }
  }, [])

  return view
}
