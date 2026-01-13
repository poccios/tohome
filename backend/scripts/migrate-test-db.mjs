import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { Pool } from 'pg';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_URL = 'postgresql://postgres:Manu0423%40@localhost:5432/tohome_test';

const pool = new Pool({
  connectionString: DATABASE_URL,
});

async function createMigrationsTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;
  await pool.query(query);
  console.log('✓ schema_migrations table ready');
}

async function getExecutedMigrations() {
  const result = await pool.query(
    'SELECT filename FROM schema_migrations ORDER BY filename'
  );
  return new Set(result.rows.map((row) => row.filename));
}

async function executeMigration(filename, sql) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log(`Executing migration: ${filename}`);
    await client.query(sql);

    await client.query(
      'INSERT INTO schema_migrations (filename) VALUES ($1)',
      [filename]
    );

    await client.query('COMMIT');
    console.log(`✓ Migration completed: ${filename}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`✗ Migration failed: ${filename}`);
    throw error;
  } finally {
    client.release();
  }
}

async function runMigrations() {
  try {
    console.log('Starting migrations on TEST database...\n');

    await createMigrationsTable();

    const migrationsDir = join(__dirname, '..', 'migrations');
    const files = await readdir(migrationsDir);

    const sqlFiles = files
      .filter((f) => f.endsWith('.sql'))
      .sort();

    if (sqlFiles.length === 0) {
      console.log('No migration files found');
      return;
    }

    const executedMigrations = await getExecutedMigrations();
    const pendingMigrations = sqlFiles.filter(
      (f) => !executedMigrations.has(f)
    );

    if (pendingMigrations.length === 0) {
      console.log('✓ All migrations are up to date');
      return;
    }

    console.log(`Found ${pendingMigrations.length} pending migration(s)\n`);

    for (const filename of pendingMigrations) {
      const filepath = join(migrationsDir, filename);
      const sql = await readFile(filepath, 'utf-8');
      await executeMigration(filename, sql);
    }

    console.log('\n✓ All migrations completed successfully on TEST database');
  } catch (error) {
    console.error('\n✗ Migration error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
