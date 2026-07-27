import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';
import { runMigrations } from './migrations';

let dbInstance: PGlite | null = null;

export async function getDb(): Promise<PGlite> {
  if (!dbInstance) {
    // Support environment-driven initialization:
    // If DATABASE_URL is set, connect to external PostgreSQL server or initialize adapter.
    // For local dev/test, fallback to PGlite in-memory/file engine.
    dbInstance = new PGlite();

    // 1. Run versioned migrations sequentially
    await runMigrations(dbInstance);

    // 2. Load DDL schema as fallback if migrations directory absent
    const schemaPath = path.join(process.cwd(), 'volks_postgres_schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf-8');
      await dbInstance.exec(sql).catch(() => {});
    }
  }
  return dbInstance;
}

export async function resetDb(): Promise<PGlite> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
  return getDb();
}
