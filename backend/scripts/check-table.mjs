import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkTable() {
  try {
    const result = await pool.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'restaurant_overrides'`
    );
    console.log('Table exists:', result.rows.length > 0 ? 'YES' : 'NO');
    if (result.rows.length > 0) {
      console.log(result.rows[0]);
    }

    // Also check table structure
    if (result.rows.length > 0) {
      const columns = await pool.query(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'restaurant_overrides' ORDER BY ordinal_position`
      );
      console.log('\nColumns:');
      columns.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkTable();
