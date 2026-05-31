import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { extractErrorMessage } from './mutation-feedback-utils'

test('extractErrorMessage returns API message when response has data.message', () => {
  const error = { response: { data: { message: 'Username already exists' } } }
  assert.equal(extractErrorMessage(error, 'Fallback'), 'Username already exists')
})

test('extractErrorMessage returns fallback when response has no message', () => {
  const error = { response: { data: {} } }
  assert.equal(extractErrorMessage(error, 'Fallback'), 'Fallback')
})

test('extractErrorMessage returns Error.message for plain errors', () => {
  const error = new Error('Network failure')
  assert.equal(extractErrorMessage(error, 'Fallback'), 'Network failure')
})

test('extractErrorMessage returns fallback for unknown error types', () => {
  assert.equal(extractErrorMessage('string error', 'Fallback'), 'Fallback')
  assert.equal(extractErrorMessage(null, 'Fallback'), 'Fallback')
  assert.equal(extractErrorMessage(undefined, 'Fallback'), 'Fallback')
})

test('extractErrorMessage returns fallback when response.data.message is not a string', () => {
  const error = { response: { data: { message: 123 } } }
  assert.equal(extractErrorMessage(error, 'Fallback'), 'Fallback')
})

// --- setTimeout cleanup tests ---

const stateSlots: unknown[] = []
const refSlots: Array<{ current: unknown }> = []
const effectSlots: Array<() => (() => void) | void> = []
const cleanupEffects: Array<() => void> = []

function createHooks() {
  let callIndex = 0
  return {
    useState<T>(initial: T): [T, (v: T) => void] {
      const i = callIndex++
      if (stateSlots[i] === undefined)
        stateSlots[i] = initial
      return [stateSlots[i] as T, (v: T) => { stateSlots[i] = v }]
    },
    useRef<T>(initial: T): { current: T } {
      const i = callIndex++
      if (!refSlots[i])
        refSlots[i] = { current: initial }
      return refSlots[i] as { current: T }
    },
    useCallback<T extends (...args: unknown[]) => unknown>(fn: T): T {
      return fn
    },
    useEffect(fn: () => (() => void) | void): void {
      effectSlots.push(fn)
    },
  }
}

// @ts-expect-error — @types/node@20 uses `namedExports` but runtime (Node 24+) prefers `exports`
mock.module('react', { exports: createHooks() })
mock.module('@/lib/toast', {
  // @ts-expect-error — @types/node@20 uses `namedExports` but runtime (Node 24+) prefers `exports`
  exports: {
    useToast: () => ({ showToast: () => {} }),
    default: { useToast: () => ({ showToast: () => {} }) },
  },
})

function resetSlots() {
  stateSlots.length = 0
  refSlots.length = 0
  effectSlots.length = 0
  cleanupEffects.length = 0
}

function runEffectsAndCollectCleanups() {
  for (const fn of effectSlots) {
    const cleanup = fn()
    if (typeof cleanup === 'function')
      cleanupEffects.push(cleanup)
  }
}

test('setTimeout cleanup — timeout cleared on unmount', async () => {
  resetSlots()

  mock.timers.enable({ apis: ['setTimeout'] })

  const { useMutationWithFeedback } = await import('./useMutationWithFeedback')

  const onSuccess = mock.fn()
  const result = useMutationWithFeedback(
    { mutateAsync: () => Promise.resolve() } as any,
    { successMessage: 'done', autoCloseMs: 100, onSuccess },
  )

  runEffectsAndCollectCleanups()

  // Trigger mutate — schedules setTimeout(100)
  await result.mutateWithFeedback(undefined as any)

  // Simulate unmount: run cleanup effects (should clear the timer)
  for (const cleanup of cleanupEffects)
    cleanup()

  // Advance past the timeout
  mock.timers.tick(200)

  // onSuccess should NOT have been called — timer was cleared
  assert.equal(onSuccess.mock.callCount(), 0)
  mock.timers.reset()
})

test('setTimeout cleanup — no autoCloseMs calls onSuccess immediately', async () => {
  resetSlots()

  const { useMutationWithFeedback } = await import('./useMutationWithFeedback')

  const onSuccess = mock.fn()
  const result = useMutationWithFeedback(
    { mutateAsync: () => Promise.resolve() } as any,
    { successMessage: 'done', onSuccess },
  )

  runEffectsAndCollectCleanups()

  await result.mutateWithFeedback(undefined as any)

  // onSuccess should be called immediately (no timeout)
  assert.equal(onSuccess.mock.callCount(), 1)
})
