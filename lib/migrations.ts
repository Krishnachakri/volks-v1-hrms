import * as fs from 'fs';
import * as path from 'path';
import { PGlite } from '@electric-sql/pglite';

export async function runMigrations(db: PGlite): Promise<{ applied: string[]; total: number }> {
  // 1. Create schema_migrations tracking table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_id SERIAL PRIMARY KEY,
      name         TEXT UNIQUE NOT NULL,
      executed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // 2. Discover migration files
  const migrationsDir = path.join(process.cwd(), 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    return { applied: [], total: 0 };
  }

  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const applied: string[] = [];

  for (const file of files) {
    const existing = await db.query<{ name: string }>(
      `SELECT name FROM schema_migrations WHERE name = $1;`,
      [file]
    );

    if (existing.rows.length === 0) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      await db.exec('BEGIN;');
      try {
        await db.exec(sql);
        await db.query(`INSERT INTO schema_migrations (name) VALUES ($1);`, [file]);
        await db.exec('COMMIT;');
        applied.push(file);
      } catch (err) {
        await db.exec('ROLLBACK;');
        throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
      }
    }
  }

  return { applied, total: files.length };
}
