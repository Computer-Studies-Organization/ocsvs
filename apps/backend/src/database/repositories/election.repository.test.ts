import { beforeEach, describe, expect, it, vi } from 'vitest'

const chain: any = {
  values: vi.fn(() => chain),
  set: vi.fn(() => chain),
  from: vi.fn(() => chain),
  where: vi.fn(() => chain),
  orderBy: vi.fn(() => chain),
  limit: vi.fn(() => chain),
  get: vi.fn(() => undefined),
  all: vi.fn(() => []),
  run: vi.fn(() => ({ rowsAffected: 1 })),
}
const mockDb = { insert: vi.fn(() => chain), update: vi.fn(() => chain), select: vi.fn(() => chain), delete: vi.fn(() => chain) }
vi.mock('@/config/db', () => ({ createDb: () => ({ db: mockDb }) }))
import { electionRepo } from './election.repository'

beforeEach(() => vi.clearAllMocks())

describe('electionRepo', () => {
  it('create returns an id', async () => {
    const id = await electionRepo.create(mockDb as any, { name: 'CSO 2026' })
    expect(typeof id).toBe('string')
  })
  it('findById returns row or null', async () => {
    chain.get.mockReturnValueOnce({ id: 'e1' })
    expect(await electionRepo.findById(mockDb as any, 'e1')).toEqual({ id: 'e1' })
    chain.get.mockReturnValueOnce(undefined)
    expect(await electionRepo.findById(mockDb as any, 'e2')).toBeNull()
  })
  it('list filters by status', async () => {
    chain.all.mockReturnValueOnce([{ id: 'e1' }])
    expect(await electionRepo.list(mockDb as any, { status: 'open' })).toHaveLength(1)
  })
  it('findOpen returns the open row', async () => {
    chain.get.mockReturnValueOnce({ id: 'e1', status: 'open' })
    expect((await electionRepo.findOpen(mockDb as any))?.id).toBe('e1')
  })
  it('updateStatus updates and reports affected', async () => {
    expect(await electionRepo.updateStatus(mockDb as any, 'e1', { status: 'open' })).toBe(true)
  })
  it('updateMetadata updates and reports affected', async () => {
    expect(await electionRepo.updateMetadata(mockDb as any, 'e1', { name: 'New' })).toBe(true)
  })
})
