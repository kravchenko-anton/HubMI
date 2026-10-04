import { useMutation, useQuery, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query'
import { useEffect } from 'react'

import { downvoteIssue, getIssue, removeDownvote, removeUpvote, upvoteIssue, type Issue } from '@/api/issues'
import { previewScore, previewSunk, voteAfterOp, voteOperations, type IssueVote, type VoteOp } from '@/lib/issue-votes'
import { useIssueVoteStore } from '@/stores/issue-vote-store'
import { useMapSheetStore } from '@/stores/map-sheet-store'

function writeIssue(queryClient: QueryClient, id: number, update: (issue: Issue) => Issue) {
  queryClient.setQueryData<Issue>(['issue', id], (current) => (current ? update(current) : current))
  queryClient.setQueriesData<Issue[]>({ queryKey: ['issues'] }, (current) => {
    if (!current) return current
    let changed = false
    const next = current.map((item) => {
      if (item.id !== id) return item
      changed = true
      return update(item)
    })
    return changed ? next : current
  })

  const selected = useMapSheetStore.getState().selectedIssue
  if (selected?.id === id) {
    const next = update(selected)
    if (next !== selected) useMapSheetStore.getState().setSelectedIssue(next)
  }
}

export function syncIssue(queryClient: QueryClient, issue: Issue) {
  writeIssue(queryClient, issue.id, () => issue)
}

export function dropIssue(queryClient: QueryClient, id: number) {
  queryClient.setQueriesData<Issue[]>({ queryKey: ['issues'] }, (current) => {
    if (!current) return current
    const next = current.filter((item) => item.id !== id)
    return next.length === current.length ? current : next
  })
  queryClient.removeQueries({ queryKey: ['issue', id] })
}

type VoteSnapshot = {
  lists: [QueryKey, Issue[] | undefined][]
  detail: Issue | undefined
  selected: Issue | null
}

function takeSnapshot(queryClient: QueryClient, id: number): VoteSnapshot {
  return {
    lists: queryClient.getQueriesData<Issue[]>({ queryKey: ['issues'] }),
    detail: queryClient.getQueryData<Issue>(['issue', id]),
    selected: useMapSheetStore.getState().selectedIssue,
  }
}

function restoreSnapshot(queryClient: QueryClient, id: number, snapshot: VoteSnapshot) {
  for (const [key, data] of snapshot.lists) {
    queryClient.setQueryData(key, data)
  }
  queryClient.setQueryData(['issue', id], snapshot.detail)
  if (useMapSheetStore.getState().selectedIssue?.id === id && snapshot.selected?.id === id) {
    useMapSheetStore.getState().setSelectedIssue(snapshot.selected)
  }
}

function runVoteOp(id: number, op: VoteOp, voterId: string) {
  if (op === 'add-up') return upvoteIssue(id, voterId)
  if (op === 'remove-up') return removeUpvote(id, voterId)
  if (op === 'remove-down') return removeDownvote(id, voterId)
  return downvoteIssue(id, voterId)
}

function scoreOf(snapshot: VoteSnapshot, id: number) {
  if (snapshot.detail) return snapshot.detail.upvotes
  for (const [, list] of snapshot.lists) {
    const found = list?.find((item) => item.id === id)
    if (found) return found.upvotes
  }
  if (snapshot.selected?.id === id) return snapshot.selected.upvotes
  return 0
}

export function useIssueDetails(issue: Issue) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['issue', issue.id],
    queryFn: ({ signal }) => getIssue(issue.id, signal),
    placeholderData: issue,
  })

  useEffect(() => {
    if (!query.data || query.isPlaceholderData) return
    syncIssue(queryClient, query.data)
  }, [query.data, query.isPlaceholderData, queryClient])

  return query
}

export function useCastIssueVote(issueId: number) {
  const queryClient = useQueryClient()
  const vote = useIssueVoteStore((state) => state.votes[issueId] ?? null)
  const pending = useIssueVoteStore((state) => state.pending[issueId])
  const ready = useIssueVoteStore((state) => state.hydrated)
  const mutation = useMutation({
    mutationFn: async (next: IssueVote | null) => {
      const state = useIssueVoteStore.getState()
      const from: IssueVote | null = state.votes[issueId] ?? null
      const voterId = state.voterId
      const nextSunk = state.pending[issueId]?.sunk ?? false
      let applied: IssueVote | null = from
      let latest: Issue | null = null
      try {
        for (const op of voteOperations(from, next)) {
          latest = await runVoteOp(issueId, op, voterId)
          applied = voteAfterOp(applied, op)
        }
        if (latest) state.setVote(issueId, applied, nextSunk)
      } finally {
        if (latest) syncIssue(queryClient, latest)
      }
    },
    onMutate: async (next) => {
      const state = useIssueVoteStore.getState()
      const from = state.votes[issueId] ?? null
      const sunk = state.sunk[issueId] ?? false
      await queryClient.cancelQueries({ queryKey: ['issue', issueId] })
      await queryClient.cancelQueries({ queryKey: ['issues'] })
      const snapshot = takeSnapshot(queryClient, issueId)
      const nextSunk = previewSunk(scoreOf(snapshot, issueId), from, next, sunk)
      writeIssue(queryClient, issueId, (issue) => ({
        ...issue,
        upvotes: previewScore(issue.upvotes, from, next, sunk),
      }))
      useIssueVoteStore.getState().setPending(issueId, next, nextSunk)
      return { snapshot, from }
    },
    onError: (_error, _next, context) => {
      if (!context) return
      const applied = useIssueVoteStore.getState().votes[issueId] ?? null
      if (applied === context.from) restoreSnapshot(queryClient, issueId, context.snapshot)
    },
    onSettled: () => {
      useIssueVoteStore.getState().setPending(issueId, undefined)
    },
  })

  const cast = (direction: IssueVote) => {
    const state = useIssueVoteStore.getState()
    if (!state.hydrated || state.pending[issueId]) return
    const current = state.votes[issueId] ?? null
    const next = current === direction ? null : direction
    state.setPending(issueId, next)
    mutation.mutate(next)
  }

  const displayed = pending ? pending.next : vote
  const spinning = pending == null ? null : (pending.next ?? vote)

  return {
    vote: displayed,
    spinning,
    ready,
    isError: mutation.isError,
    cast,
  }
}
