import { File, UploadType } from 'expo-file-system'
import { Platform } from 'react-native'

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
  solved_at?: string | null
  solve_note?: string
  solve_image_url?: string | null
}

export type IssueDraft = {
  category: IssueCategory
  title: string
  description: string
  lat: number
  lng: number
  image_url?: string | null
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

async function sendIssueVote(
  id: number,
  path: 'upvote' | 'downvote',
  method: 'POST' | 'DELETE',
  voterId: string,
) {
  const response = await fetch(`${API_BASE_URL}/issues/${id}/${path}`, {
    method,
    headers: { 'X-Voter-Id': voterId },
  })
  if (!response.ok) {
    throw new Error(`Vote request failed (${response.status})`)
  }
  return (await response.json()) as Issue
}

export function upvoteIssue(id: number, voterId: string) {
  return sendIssueVote(id, 'upvote', 'POST', voterId)
}

export function removeUpvote(id: number, voterId: string) {
  return sendIssueVote(id, 'upvote', 'DELETE', voterId)
}

export function downvoteIssue(id: number, voterId: string) {
  return sendIssueVote(id, 'downvote', 'POST', voterId)
}

export function removeDownvote(id: number, voterId: string) {
  return sendIssueVote(id, 'downvote', 'DELETE', voterId)
}

function imageName(uri: string) {
  const raw = uri.split('/').pop()?.split('?')[0] || 'photo.jpg'
  return raw.includes('.') ? raw : `${raw}.jpg`
}

function imageType(name: string) {
  const lower = name.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic'
  return 'image/jpeg'
}

function isBrowserUri(uri: string) {
  return uri.startsWith('blob:') || uri.startsWith('data:') || /^https?:\/\//i.test(uri)
}

async function uploadIssueImageForm(uri: string): Promise<string> {
  const name = imageName(uri)
  const form = new FormData()
  if (isBrowserUri(uri)) {
    const blob = await (await fetch(uri)).blob()
    form.append('file', blob, name)
  } else {
    form.append('file', { uri, name, type: imageType(name) } as unknown as Blob)
  }

  const response = await fetch(`${API_BASE_URL}/media`, { method: 'POST', body: form })
  if (!response.ok) {
    throw new Error(`Image upload failed (${response.status})`)
  }
  const body = (await response.json()) as { image_url: string }
  return body.image_url
}

export async function uploadIssueImage(uri: string): Promise<string> {
  if (Platform.OS === 'web' || isBrowserUri(uri)) return uploadIssueImageForm(uri)

  const name = imageName(uri)
  const result = await new File(uri).upload(`${API_BASE_URL}/media`, {
    httpMethod: 'POST',
    uploadType: UploadType.MULTIPART,
    fieldName: 'file',
    mimeType: imageType(name),
    sessionType: 'foreground',
  })
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Image upload failed (${result.status})`)
  }
  const body = JSON.parse(result.body) as { image_url: string }
  return body.image_url
}

export async function createIssue(draft: IssueDraft): Promise<Issue> {
  const response = await fetch(`${API_BASE_URL}/issues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category: draft.category,
      title: draft.title,
      description: draft.description,
      lat: draft.lat,
      lng: draft.lng,
      image_url: draft.image_url ?? null,
    }),
  })
  if (!response.ok) {
    throw new Error(`Create issue failed (${response.status})`)
  }
  return (await response.json()) as Issue
}

export async function solveIssue(
  id: number,
  payload: { note: string; image_url: string | null },
): Promise<Issue> {
  const response = await fetch(`${API_BASE_URL}/issues/${id}/solve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    throw new Error(`Solve request failed (${response.status})`)
  }
  return (await response.json()) as Issue
}
