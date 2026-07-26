import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';

let dbInstance: PGlite | null = null;

export async function getDb(): Promise<PGlite> {
  if (!dbInstance) {
    dbInstance = new PGlite();
    // Load PostgreSQL schema
    const schemaPath = path.join(process.cwd(), 'volks_postgres_schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf-8');
      await dbInstance.exec(sql);
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
