import { useMutation, useQuery, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query'
import { useEffect } from 'react'

import { downvoteIssue, getIssue, removeUpvote, upvoteIssue, type Issue } from '@/api/issues'
import { voteAfterOp, voteDelta, voteOperations, type IssueVote, type VoteOp } from '@/lib/issue-votes'
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

function runVoteOp(id: number, op: VoteOp) {
  if (op === 'add-up') return upvoteIssue(id)
  if (op === 'remove-up') return removeUpvote(id)
  return downvoteIssue(id)
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
      const from: IssueVote | null = useIssueVoteStore.getState().votes[issueId] ?? null
      let applied: IssueVote | null = from
      let latest: Issue | null = null
      try {
        for (const op of voteOperations(from, next)) {
          latest = await runVoteOp(issueId, op)
          applied = voteAfterOp(applied, op)
          useIssueVoteStore.getState().setVote(issueId, applied)
        }
      } finally {
        if (latest) syncIssue(queryClient, latest)
      }
    },
    onMutate: async (next) => {
      const from = useIssueVoteStore.getState().votes[issueId] ?? null
      await queryClient.cancelQueries({ queryKey: ['issue', issueId] })
      await queryClient.cancelQueries({ queryKey: ['issues'] })
      const snapshot = takeSnapshot(queryClient, issueId)
      writeIssue(queryClient, issueId, (issue) => ({
        ...issue,
        upvotes: issue.upvotes + voteDelta(from, next),
      }))
      useIssueVoteStore.getState().setPending(issueId, next)
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
