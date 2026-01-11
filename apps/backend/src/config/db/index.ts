import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from '@/database/schema'
import { Context } from 'hono'

export function createDb(c: Context) {
  if (!c.env.DATABASE_URL)
    throw new Error('Database URL is required')

  const client = createClient({
    url: c.env.DATABASE_URL,
    // authToken: env.DATABASE_AUTH_TOKEN,
  })

  const db = drizzle(client, {
    schema,
  })
  return { db, client }
}

