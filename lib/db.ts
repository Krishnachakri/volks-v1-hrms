import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';
import { runMigrations } from './migrations';
import { logger } from './logger';

let dbInstance: any = null;

export async function getDb(): Promise<any> {
  if (!dbInstance) {
    const isProduction = process.env.NODE_ENV === 'production';
    const databaseUrl = process.env.DATABASE_URL;

    // Strict Production Check: Fail startup if DATABASE_URL is missing in production
    if (isProduction && !databaseUrl) {
      const errMsg = 'PRODUCTION FATAL: DATABASE_URL environment variable must be set in production mode.';
      logger.error(errMsg, { level: 'fatal' });
      throw new Error(errMsg);
    }

    // Initialize PGlite engine for dev/test mode or database adapter
    dbInstance = new PGlite();

    // 1. Run versioned sequential migrations
    await runMigrations(dbInstance);

    // 2. Load DDL schema fallback if needed
    const schemaPath = path.join(process.cwd(), 'volks_postgres_schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf-8');
      await dbInstance.exec(sql).catch(() => {});
    }
  }
  return dbInstance;
}

export async function closeDb(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close().catch(() => {});
    dbInstance = null;
  }
}

export async function resetDb(): Promise<any> {
  await closeDb();
  return getDb();
}
