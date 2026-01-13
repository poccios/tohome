/**
 * Reset Database - Truncate all tables
 * This will delete ALL data from the database while preserving table structure
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function resetDatabase() {
  const client = await pool.connect();

  try {
    console.log('🗑️  Resetting database - Deleting all data...\n');

    // Get list of all tables in the database
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tables = result.rows.map(row => row.table_name);

    if (tables.length === 0) {
      console.log('⚠️  No tables found in database. Run migrations first: npm run migrate');
      return;
    }

    console.log('Found tables:', tables.join(', '));
    console.log('');

    // Truncate all tables
    const tableList = tables.join(', ');
    await client.query(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);

    console.log('✅ Database reset complete!');
    console.log('\nAll tables truncated:');
    tables.forEach(table => console.log(`  - ${table}`));
    console.log('\n💡 To add seed data, run: npm run seed');

  } catch (error) {
    console.error('❌ Error resetting database:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

resetDatabase();
