import type { Context } from 'hono'
import type { AppBindings } from '@/lib/types/app-types'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from '@/database/schema'

export function createDb(c: Context<AppBindings>) {
  if (!c.env.DB)
    throw new Error('Database binding is required')

  // Use the D1 binding directly
  const db = drizzle(c.env.DB, {
    schema,
  })

  return { db }
}
