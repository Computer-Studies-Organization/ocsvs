import { describe, expect, it } from 'vitest'
import { createTestApp } from '@/lib/create-app'
import router from '@/routes/items/items.index'
import { NO_CONTENT, OK } from '../openapi/http-status-codes'

describe('items API', () => {
  it('should get a list of items', async () => {
    const testRouter = createTestApp(router)
    const response = await testRouter.request('/items')
    expect(response.status).toBe(OK)
    const body = await response.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThan(0)
  })

  let itemId: number

  it('should create an item', async () => {
    const testRouter = createTestApp(router)
    const response = await testRouter.request('/items', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Test Item',
        description: 'This is a test item',
        available: true,
      }),
    })

    expect(response.status).toBe(OK)
    const body = await response.json()
    expect(body).toHaveProperty('id')
    itemId = body.id
  })

  it('should get an item by id', async () => {
    const testRouter = createTestApp(router)
    const response = await testRouter.request(`/items/${itemId}`)
    expect(response.status).toBe(OK)
    const body = await response.json()
    expect(body).toHaveProperty('id', itemId)
  })

  it('should patch an item', async () => {
    const testRouter = createTestApp(router)
    const response = await testRouter.request(`/items/${itemId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Updated Test Item',
      }),
    })

    expect(response.status).toBe(OK)
    const body = await response.json()
    expect(body).toHaveProperty('name', 'Updated Test Item')
  })

  it('should delete an item', async () => {
    const testRouter = createTestApp(router)
    const response = await testRouter.request(`/items/${itemId}`, {
      method: 'DELETE',
    })
    expect(response.status).toBe(NO_CONTENT)
  })
})
