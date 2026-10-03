import type { CircleLayerSpecification } from '@maplibre/maplibre-gl-style-spec'

import type { Issue, IssueCategory } from '@/api/issues'

export type IssueFeatureCollection = {
  type: 'FeatureCollection'
  features: {
    type: 'Feature'
    id: number
    geometry: { type: 'Point'; coordinates: [number, number] }
    properties: {
      id: number
      category: IssueCategory
      upvotes: number
      title: string
    }
  }[]
}

export function issuesToFeatureCollection(issues: Issue[]): IssueFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: issues.map((issue) => ({
      type: 'Feature',
      id: issue.id,
      geometry: {
        type: 'Point',
        coordinates: [issue.lng, issue.lat],
      },
      properties: {
        id: issue.id,
        category: issue.category,
        upvotes: issue.upvotes,
        title: issue.title,
      },
    })),
  }
}

// Radius grows with the square root of upvotes and caps at 28px so a heavily
// upvoted issue stays a marker instead of covering the block.
export const ISSUE_CIRCLE_PAINT = {
  'circle-radius': [
    'min',
    28,
    ['+', 8, ['*', 1.4, ['sqrt', ['max', 0, ['coalesce', ['get', 'upvotes'], 0]]]]],
  ],
  'circle-color': [
    'match',
    ['get', 'category'],
    'traffic',
    '#E67E22',
    'lighting',
    '#F5C518',
    'noise',
    '#8E44AD',
    'cleanliness',
    '#27AE60',
    'infrastructure',
    '#2F80ED',
    'safety',
    '#E74C3C',
    '#78716C',
  ],
  'circle-stroke-width': 2,
  'circle-stroke-color': '#FFFFFF',
  'circle-opacity': 0.92,
} as const satisfies CircleLayerSpecification['paint']
