import type { Context } from 'hono'
import type { AppBindings } from '@/lib/types/app-types'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from '@/database/schema'

let client: ReturnType<typeof createClient> | null = null
let db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function createDb(c: Context<AppBindings>) {
  const url = c.env.TURSO_DATABASE_URL
  const authToken = c.env.TURSO_AUTH_TOKEN

  if (!url)
    throw new Error('TURSO_DATABASE_URL is required')

  if (!db) {
    client = createClient({ url, authToken })
    db = drizzle(client, { schema })
  }

  return { db }
}
