import { describe, expect, it } from 'vitest'
import { assertTransition, canTransition, TransitionError } from './election-lifecycle'
import { ERROR_MESSAGES } from './constants/error-messages'

describe('canTransition', () => {
  it.each([
    ['draft', 'open'], ['open', 'closed'], ['closed', 'archived'], ['closed', 'draft'],
  ] as const)('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true)
  })

  it.each([
    ['draft', 'closed'], ['draft', 'archived'], ['open', 'draft'], ['open', 'archived'],
    ['closed', 'open'], ['archived', 'draft'], ['archived', 'open'], ['archived', 'closed'],
  ] as const)('rejects %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false)
  })
})

describe('assertTransition', () => {
  const now = 1_700_000_000
  const later = now + 3600

  it('passes for valid transitions', () => {
    expect(() => assertTransition('draft', 'open', { opensAt: now, closesAt: later }, 1)).not.toThrow()
    expect(() => assertTransition('open', 'closed', {}, 1)).not.toThrow()
    expect(() => assertTransition('closed', 'archived', {}, 0)).not.toThrow()
    expect(() => assertTransition('closed', 'draft', {}, 0)).not.toThrow()
  })

  it('throws INVALID_TRANSITION for invalid transitions', () => {
    expect(() => assertTransition('open', 'draft', {}, 1)).toThrow(
      expect.objectContaining({ code: 'INVALID_TRANSITION' }),
    )
  })

  it('throws ELECTION_HAS_NO_POSITIONS for draft -> open with zero positions', () => {
    expect(() => assertTransition('draft', 'open', { opensAt: now, closesAt: later }, 0)).toThrow(
      expect.objectContaining({ code: 'ELECTION_HAS_NO_POSITIONS' }),
    )
  })

  it('throws INVALID_TRANSITION_BODY when opening without opensAt/closesAt', () => {
    expect(() => assertTransition('draft', 'open', {}, 1)).toThrow(
      expect.objectContaining({ code: 'INVALID_TRANSITION_BODY' }),
    )
  })

  it('throws INVALID_TRANSITION_BODY when closesAt <= opensAt', () => {
    expect(() => assertTransition('draft', 'open', { opensAt: later, closesAt: now }, 1)).toThrow(
      expect.objectContaining({ code: 'INVALID_TRANSITION_BODY' }),
    )
  })

  it('uses the same messages as ERROR_MESSAGES', () => {
    try { assertTransition('open', 'draft', {}, 1) } catch (err) {
      const e = err as TransitionError
      expect(e.message).toBe(ERROR_MESSAGES[e.code])
    }
  })
})
