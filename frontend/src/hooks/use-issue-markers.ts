import { useMemo } from 'react'

import type { Issue } from '@/api/issues'
import { createIssueIndex, markersInView, type IssueMapMarker } from '@/lib/cluster-issues'
import { useMapViewportStore } from '@/stores/map-viewport-store'

const EMPTY_MARKERS: IssueMapMarker[] = []

export function useIssueMarkers(issues: Issue[]) {
  const bounds = useMapViewportStore((state) => state.bounds)
  const zoom = useMapViewportStore((state) => state.zoom)
  const index = useMemo(() => createIssueIndex(issues), [issues])

  return useMemo(() => {
    if (!bounds) return EMPTY_MARKERS
    return markersInView(index, bounds, zoom)
  }, [bounds, index, zoom])
}
