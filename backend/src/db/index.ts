import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: result.rowCount });
    return result;
  } catch (error) {
    console.error('Query error', { text, error });
    throw error;
  }
}

export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Transaction started');

    const result = await callback(client);

    await client.query('COMMIT');
    console.log('Transaction committed');

    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Transaction rolled back', { error });
    throw error;
  } finally {
    client.release();
  }
}

export async function getClient(): Promise<PoolClient> {
  return await pool.connect();
}

export async function closePool(): Promise<void> {
  await pool.end();
  console.log('Database pool closed');
}

export { pool };
