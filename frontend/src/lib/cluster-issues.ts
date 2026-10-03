import Supercluster from 'supercluster'

import { ISSUE_CATEGORIES, type Issue, type IssueCategory } from '@/api/issues'
import { ISSUE_CATEGORY_META } from '@/lib/issue-categories'
import type { MapBounds } from '@/stores/map-viewport-store'

export const CLUSTER_RADIUS = 56
export const CLUSTER_MAX_ZOOM = 15
export const MARKER_SIZE = 40

const MAX_FOCUS_ZOOM = 18

type IssuePointProps = {
  issueId: number
}

type CategoryIndex = {
  category: IssueCategory
  index: Supercluster<IssuePointProps, { count: number }>
}

export type IssuePointMarker = {
  kind: 'point'
  id: number
  lng: number
  lat: number
  emoji: string
  color: string
  category: IssueCategory
  offsetX: number
  offsetY: number
}

export type IssueClusterMarker = {
  kind: 'cluster'
  id: string
  lng: number
  lat: number
  count: number
  color: string
  emoji: string
  category: IssueCategory
  expansionZoom: number
  offsetX: number
  offsetY: number
}

export type IssueMapMarker = IssuePointMarker | IssueClusterMarker

function metersPerPixel(lat: number, zoom: number) {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom
}

function pixelsApart(
  aLng: number,
  aLat: number,
  bLng: number,
  bLat: number,
  zoom: number,
) {
  const lat = (aLat + bLat) / 2
  const mpp = metersPerPixel(lat, zoom)
  const dx = ((bLng - aLng) * 111320 * Math.cos((lat * Math.PI) / 180)) / mpp
  const dy = ((bLat - aLat) * 110540) / mpp
  return Math.hypot(dx, dy)
}

const ICON_LIFT = 22

function markerWeight(marker: IssueMapMarker) {
  return marker.kind === 'cluster' ? marker.count : 1
}

// Same icon on top of another is hidden. The rest stay on their coordinate,
// only lifted a few pixels, so a pinch-zoom does not slide them sideways.
function layoutMarkers(markers: IssueMapMarker[], zoom: number) {
  const minGap = MARKER_SIZE * 0.82
  const sorted = [...markers].sort((a, b) => markerWeight(b) - markerWeight(a))
  const kept: IssueMapMarker[] = []
  for (const marker of sorted) {
    const duplicate = kept.some(
      (other) =>
        other.category === marker.category &&
        pixelsApart(other.lng, other.lat, marker.lng, marker.lat, zoom) < minGap,
    )
    if (!duplicate) kept.push({ ...marker, offsetX: 0, offsetY: -ICON_LIFT })
  }
  return kept
}

export function createIssueIndex(issues: Issue[]): CategoryIndex[] {
  const grouped = new Map<IssueCategory, Issue[]>()
  for (const issue of issues) {
    const list = grouped.get(issue.category)
    if (list) list.push(issue)
    else grouped.set(issue.category, [issue])
  }

  const indexes: CategoryIndex[] = []
  for (const category of ISSUE_CATEGORIES) {
    const group = grouped.get(category)
    if (!group?.length) continue

    const index = new Supercluster<IssuePointProps, { count: number }>({
      radius: CLUSTER_RADIUS,
      maxZoom: CLUSTER_MAX_ZOOM,
      map: () => ({ count: 1 }),
      reduce: (accumulated, props) => {
        accumulated.count += props.count
      },
    })

    index.load(
      group.map((issue) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [issue.lng, issue.lat],
        },
        properties: {
          issueId: issue.id,
        },
      })),
    )

    indexes.push({ category, index })
  }

  return indexes
}

export function markersInView(
  indexes: CategoryIndex[],
  bounds: MapBounds,
  zoom: number,
): IssueMapMarker[] {
  const zoomLevel = Math.max(0, Math.floor(zoom))
  const bbox: [number, number, number, number] = [
    bounds.minLng,
    bounds.minLat,
    bounds.maxLng,
    bounds.maxLat,
  ]
  const markers: IssueMapMarker[] = []

  for (const { category, index } of indexes) {
    const meta = ISSUE_CATEGORY_META[category]
    for (const feature of index.getClusters(bbox, zoomLevel)) {
      const [lng, lat] = feature.geometry.coordinates
      const props = feature.properties
      if (!props) continue

      if ('cluster' in props && props.cluster) {
        const expansionZoom = Math.min(
          MAX_FOCUS_ZOOM,
          Math.max(index.getClusterExpansionZoom(props.cluster_id), zoomLevel + 1),
        )
        markers.push({
          kind: 'cluster',
          id: `${category}-${props.cluster_id}`,
          lng,
          lat,
          count: props.point_count,
          color: meta.color,
          emoji: meta.emoji,
          category,
          expansionZoom,
          offsetX: 0,
          offsetY: 0,
        })
        continue
      }

      if (!('issueId' in props)) continue
      markers.push({
        kind: 'point',
        id: props.issueId,
        lng,
        lat,
        emoji: meta.emoji,
        color: meta.color,
        category,
        offsetX: 0,
        offsetY: 0,
      })
    }
  }

  return layoutMarkers(markers, zoom)
}
