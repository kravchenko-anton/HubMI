export const API_BASE_URL = 'https://hubmi-production.up.railway.app'

/** Seeded photos are paths like `/media/no-cross-walk.jpg`. External links are already absolute. */
export function issueImageUri(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl
  const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`
  return `${API_BASE_URL}${path}`
}

export const ISSUE_CATEGORIES = [
  'traffic',
  'lighting',
  'noise',
  'cleanliness',
  'infrastructure',
  'safety',
  'other',
] as const

export type IssueCategory = (typeof ISSUE_CATEGORIES)[number]

export type Issue = {
  id: number
  category: IssueCategory
  title: string
  description: string
  lat: number
  lng: number
  image_url: string | null
  upvotes: number
  created_at: string
}

/** Backend `HIDDEN_BELOW`. `GET /issues` keeps a row only when `upvotes` is at least this. */
export const ISSUE_HIDDEN_BELOW = -10

export function isIssueListed(upvotes: number) {
  return upvotes >= ISSUE_HIDDEN_BELOW
}

export type IssueBounds = {
  minLat: number
  minLng: number
  maxLat: number
  maxLng: number
  limit: number
}

export async function queryIssues(bounds: IssueBounds, signal?: AbortSignal): Promise<Issue[]> {
  const params = new URLSearchParams({
    min_lat: String(bounds.minLat),
    min_lng: String(bounds.minLng),
    max_lat: String(bounds.maxLat),
    max_lng: String(bounds.maxLng),
    limit: String(bounds.limit),
  })

  const response = await fetch(`${API_BASE_URL}/issues?${params}`, { signal })
  if (!response.ok) {
    throw new Error(`Issues request failed (${response.status})`)
  }

  return (await response.json()) as Issue[]
}

export async function getIssue(id: number, signal?: AbortSignal): Promise<Issue> {
  const response = await fetch(`${API_BASE_URL}/issues/${id}`, { signal })
  if (!response.ok) {
    throw new Error(`Issue request failed (${response.status})`)
  }

  return (await response.json()) as Issue
}

async function sendIssueVote(id: number, path: 'upvote' | 'downvote', method: 'POST' | 'DELETE') {
  const response = await fetch(`${API_BASE_URL}/issues/${id}/${path}`, { method })
  if (!response.ok) {
    throw new Error(`Vote request failed (${response.status})`)
  }
  return (await response.json()) as Issue
}

export function upvoteIssue(id: number) {
  return sendIssueVote(id, 'upvote', 'POST')
}

export function removeUpvote(id: number) {
  return sendIssueVote(id, 'upvote', 'DELETE')
}

export function downvoteIssue(id: number) {
  return sendIssueVote(id, 'downvote', 'POST')
}
