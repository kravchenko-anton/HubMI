import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { isIssueListed, queryIssues, type Issue, type IssueBounds } from '@/api/issues'
import { useIssueVoteStore } from '@/stores/issue-vote-store'
import { useMapViewportStore } from '@/stores/map-viewport-store'

function issueLimit(zoom: number) {
  if (zoom < 12) return 40
  if (zoom < 14) return 80
  if (zoom < 16) return 150
  return 300
}

function quantize(value: number) {
  return Math.round(value * 10_000) / 10_000
}

function listedIssues(issues: Issue[]) {
  const listed = issues.filter((issue) => isIssueListed(issue.upvotes))
  return listed.length === issues.length ? issues : listed
}

export function useMapIssues() {
  const bounds = useMapViewportStore((state) => state.bounds)
  const zoom = useMapViewportStore((state) => state.zoom)
  const limit = issueLimit(zoom)
  const area: IssueBounds | null = bounds
    ? {
        minLat: quantize(bounds.minLat),
        minLng: quantize(bounds.minLng),
        maxLat: quantize(bounds.maxLat),
        maxLng: quantize(bounds.maxLng),
        limit,
      }
    : null

  const voting = useIssueVoteStore((state) => Object.keys(state.pending).length > 0)

  return useQuery({
    queryKey: ['issues', area],
    queryFn: ({ signal }) => {
      if (!area) throw new Error('Map bounds are not ready')
      return queryIssues(area, signal)
    },
    enabled: area != null,
    placeholderData: keepPreviousData,
    select: listedIssues,
    refetchInterval: voting ? false : 15_000,
  })
}
