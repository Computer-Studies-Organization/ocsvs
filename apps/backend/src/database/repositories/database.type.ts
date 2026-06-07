import type { LibSQLDatabase } from 'drizzle-orm/libsql'

export type Database = LibSQLDatabase<typeof import('@/database/schema')>
