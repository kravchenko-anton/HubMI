import { ISSUE_CATEGORIES, type IssueCategory } from '@/api/issues'

export type IssueCategoryMeta = {
  emoji: string
  label: string
  color: string
}

export const ISSUE_CATEGORY_META: Record<IssueCategory, IssueCategoryMeta> = {
  traffic: { emoji: '🚧', label: 'Traffic', color: '#E67E22' },
  lighting: { emoji: '💡', label: 'Lighting', color: '#F5C518' },
  noise: { emoji: '📢', label: 'Noise', color: '#8E44AD' },
  cleanliness: { emoji: '🗑️', label: 'Trash', color: '#27AE60' },
  infrastructure: { emoji: '🏗️', label: 'Infrastructure', color: '#2F80ED' },
  safety: { emoji: '⚠️', label: 'Safety', color: '#E74C3C' },
  other: { emoji: '❓', label: 'Other', color: '#78716C' },
}

export function issueCategoryMeta(category: string): IssueCategoryMeta {
  if ((ISSUE_CATEGORIES as readonly string[]).includes(category)) {
    return ISSUE_CATEGORY_META[category as IssueCategory]
  }
  return ISSUE_CATEGORY_META.other
}

export function isSameLocalDay(iso: string, now = new Date()) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return false
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

export function areaProblemLabel(count: number) {
  return count === 1 ? '1 problem' : `${count} problems`
}

export function voteLabel(count: number) {
  const noun = Math.abs(count) === 1 ? 'vote' : 'votes'
  return `${count} ${noun}`
}

export function formatRelativeTime(iso: string, now = Date.now()) {
  const time = new Date(iso).getTime()
  if (Number.isNaN(time)) return ''
  const minutes = Math.floor(Math.max(0, now - time) / 60_000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(time).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}

export function formatDistanceKm(km: number) {
  if (km < 1) return `${Math.max(1, Math.round(km * 1000))} m`
  return `${km.toFixed(1)} km`
}

export function distanceKm(fromLng: number, fromLat: number, lng: number, lat: number) {
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(lat - fromLat)
  const dLng = toRad(lng - fromLng)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(fromLat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(a))
}
