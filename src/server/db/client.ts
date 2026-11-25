import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

let pool: Pool | null = null;
let dbInstance: NodePgDatabase<typeof schema> | null = null;

export function isPostgresDriver(): boolean {
  return (process.env.DATA_DRIVER || 'firebase').toLowerCase() === 'postgres';
}

export function getPgPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL não configurada para o driver PostgreSQL. Defina DATABASE_URL no ambiente (ex.: postgres://aprovafoco:aprovafoco@localhost:5432/aprovafoco).'
      );
    }
    pool = new Pool({
      connectionString,
      max: 15,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

export function getPgDb(): NodePgDatabase<typeof schema> {
  if (!dbInstance) {
    dbInstance = drizzle(getPgPool(), { schema });
  }
  return dbInstance;
}
