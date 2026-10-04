import { Platform } from 'react-native'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import type { IssueVote } from '@/lib/issue-votes'

type PendingVote = {
  next: IssueVote | null
  sunk: boolean
}

type IssueVoteState = {
  voterId: string
  votes: Record<number, IssueVote>
  sunk: Record<number, true>
  pending: Partial<Record<number, PendingVote>>
  hydrated: boolean
  setVote: (id: number, vote: IssueVote | null, sunk?: boolean) => void
  setPending: (id: number, next: IssueVote | null | undefined, sunk?: boolean) => void
}

function createVoterId() {
  const cryptoApi = globalThis.crypto
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID()
  return `voter-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

function sanitizeSunk(value: unknown): Record<number, true> {
  if (!value || typeof value !== 'object') return {}
  const sunk: Record<number, true> = {}
  for (const [id, flagged] of Object.entries(value as Record<string, unknown>)) {
    const numeric = Number(id)
    if (!Number.isInteger(numeric) || flagged !== true) continue
    sunk[numeric] = true
  }
  return sunk
}

function sanitizeVoterId(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback
  const voterId = value.trim()
  if (!voterId || voterId.length > 80) return fallback
  return voterId
}

const VOTE_FILE = 'issue-votes.json'

function sanitizeVotes(value: unknown): Record<number, IssueVote> {
  if (!value || typeof value !== 'object') return {}
  const votes: Record<number, IssueVote> = {}
  for (const [id, vote] of Object.entries(value as Record<string, unknown>)) {
    const numeric = Number(id)
    if (!Number.isInteger(numeric)) continue
    if (vote === 'up' || vote === 'down') votes[numeric] = vote
  }
  return votes
}

const voteStorage = {
  async getItem(name: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        return localStorage.getItem(name)
      } catch {
        return null
      }
    }
    try {
      const { File, Paths } = await import('expo-file-system')
      const file = new File(Paths.document, VOTE_FILE)
      if (!file.exists) return null
      return file.text()
    } catch {
      return null
    }
  },
  async setItem(name: string, value: string) {
    if (Platform.OS === 'web') {
      try {
        localStorage.setItem(name, value)
      } catch {
        // The choice still sticks for this session when the browser blocks storage.
      }
      return
    }
    try {
      const { File, Paths } = await import('expo-file-system')
      const file = new File(Paths.document, VOTE_FILE)
      if (!file.exists) file.create()
      file.write(value)
    } catch {
      // The choice still sticks for this session when the disk write fails.
    }
  },
  async removeItem(name: string) {
    if (Platform.OS === 'web') {
      try {
        localStorage.removeItem(name)
      } catch {
        // Nothing else can clear a browser store the page cannot touch.
      }
      return
    }
    try {
      const { File, Paths } = await import('expo-file-system')
      const file = new File(Paths.document, VOTE_FILE)
      if (file.exists) file.delete()
    } catch {
      // Nothing else can clear a file the app cannot touch.
    }
  },
}

export const useIssueVoteStore = create<IssueVoteState>()(
  persist(
    (set) => ({
      voterId: createVoterId(),
      votes: {},
      sunk: {},
      pending: {},
      hydrated: false,
      setVote: (id, vote, sunk = false) =>
        set((state) => {
          const votes = { ...state.votes }
          const nextSunk = { ...state.sunk }
          if (vote == null) delete votes[id]
          else votes[id] = vote
          if (vote === 'down' && sunk) nextSunk[id] = true
          else delete nextSunk[id]
          return { votes, sunk: nextSunk }
        }),
      setPending: (id, next, sunk = false) =>
        set((state) => {
          const pending = { ...state.pending }
          if (next === undefined) delete pending[id]
          else pending[id] = { next, sunk }
          return { pending }
        }),
    }),
    {
      name: 'issue-votes',
      storage: createJSONStorage(() => voteStorage),
      partialize: (state) => ({ votes: state.votes, voterId: state.voterId, sunk: state.sunk }),
      merge: (persisted, current) => {
        const saved = persisted as { votes?: unknown; voterId?: unknown; sunk?: unknown } | undefined
        return {
          ...current,
          voterId: sanitizeVoterId(saved?.voterId, current.voterId),
          votes: sanitizeVotes(saved?.votes),
          sunk: sanitizeSunk(saved?.sunk),
        }
      },
      onRehydrateStorage: () => () => {
        queueMicrotask(() => {
          useIssueVoteStore.setState({ hydrated: true })
        })
      },
    },
  ),
)
