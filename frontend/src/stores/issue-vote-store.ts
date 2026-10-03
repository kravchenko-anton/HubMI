import { Platform } from 'react-native'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import type { IssueVote } from '@/lib/issue-votes'

type PendingVote = {
  next: IssueVote | null
}

type IssueVoteState = {
  votes: Record<number, IssueVote>
  pending: Partial<Record<number, PendingVote>>
  hydrated: boolean
  setVote: (id: number, vote: IssueVote | null) => void
  setPending: (id: number, next: IssueVote | null | undefined) => void
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
      votes: {},
      pending: {},
      hydrated: false,
      setVote: (id, vote) =>
        set((state) => {
          const votes = { ...state.votes }
          if (vote == null) delete votes[id]
          else votes[id] = vote
          return { votes }
        }),
      setPending: (id, next) =>
        set((state) => {
          const pending = { ...state.pending }
          if (next === undefined) delete pending[id]
          else pending[id] = { next }
          return { pending }
        }),
    }),
    {
      name: 'issue-votes',
      storage: createJSONStorage(() => voteStorage),
      partialize: (state) => ({ votes: state.votes }),
      merge: (persisted, current) => ({
        ...current,
        votes: sanitizeVotes((persisted as { votes?: unknown } | undefined)?.votes),
      }),
      onRehydrateStorage: () => () => {
        queueMicrotask(() => {
          useIssueVoteStore.setState({ hydrated: true })
        })
      },
    },
  ),
)
