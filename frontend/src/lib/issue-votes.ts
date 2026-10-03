export type IssueVote = 'up' | 'down'

export type VoteOp = 'add-up' | 'remove-up' | 'add-down'

function weight(vote: IssueVote | null) {
  if (vote === 'up') return 1
  if (vote === 'down') return -1
  return 0
}

// POST /upvote adds one. DELETE /upvote takes back that like.
// POST /downvote subtracts one; there is no delete, so clearing it sends an upvote.
// Crossing below ISSUE_HIDDEN_BELOW drops the issue from the map list.
export function voteOperations(from: IssueVote | null, to: IssueVote | null): VoteOp[] {
  if (from === to) return []
  const ops: VoteOp[] = []
  if (from === 'up') ops.push('remove-up')
  if (from === 'down') ops.push('add-up')
  if (to === 'up') ops.push('add-up')
  if (to === 'down') ops.push('add-down')
  return ops
}

export function voteAfterOp(from: IssueVote | null, op: VoteOp): IssueVote | null {
  if (op === 'remove-up') return null
  if (op === 'add-down') return 'down'
  return from === 'down' ? null : 'up'
}

export function voteDelta(from: IssueVote | null, to: IssueVote | null) {
  return weight(to) - weight(from)
}
