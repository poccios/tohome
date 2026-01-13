import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkTables() {
  try {
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE 'order%'
      ORDER BY table_name
    `);

    console.log('Tables with "order" in name:');
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

    if (result.rows.length === 0) {
      console.log('  (none found)');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkTables();
