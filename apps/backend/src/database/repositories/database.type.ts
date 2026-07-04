import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type { SQLiteTransaction } from "drizzle-orm/sqlite-core";

type Schema = typeof import("@/database/schema");

export type Database = LibSQLDatabase<Schema>;

export type Transaction = SQLiteTransaction<
  "async",
  import("@libsql/client").ResultSet,
  Schema,
  ExtractTablesWithRelations<Schema>
>;

export type DbClient = Database | Transaction;
