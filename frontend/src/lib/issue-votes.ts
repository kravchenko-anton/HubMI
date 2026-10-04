export type IssueVote = 'up' | 'down'

export type VoteOp = 'add-up' | 'remove-up' | 'add-down' | 'remove-down'

function weight(vote: IssueVote | null) {
  if (vote === 'up') return 1
  if (vote === 'down') return -1
  return 0
}

function appliedWeight(vote: IssueVote | null, sunk: boolean) {
  if (vote === 'down' && sunk) return 0
  return weight(vote)
}

// One voter replaces their row: upvote sets +1, downvote sets -1, delete clears it.
// The public count never goes below 0. A downvote that does not move that count is sunk,
// so taking it back does not add a vote.
export function voteOperations(from: IssueVote | null, to: IssueVote | null): VoteOp[] {
  if (from === to) return []
  if (to === 'up') return ['add-up']
  if (to === 'down') return ['add-down']
  if (from === 'up') return ['remove-up']
  if (from === 'down') return ['remove-down']
  return []
}

export function voteAfterOp(_from: IssueVote | null, op: VoteOp): IssueVote | null {
  if (op === 'add-up') return 'up'
  if (op === 'add-down') return 'down'
  return null
}

export function previewScore(score: number, from: IssueVote | null, to: IssueVote | null, sunk: boolean) {
  const base = score - appliedWeight(from, sunk)
  return Math.max(0, base + weight(to))
}

export function previewSunk(score: number, from: IssueVote | null, to: IssueVote | null, sunk: boolean) {
  if (to !== 'down') return false
  const base = score - appliedWeight(from, sunk)
  return base - 1 < 0
}
