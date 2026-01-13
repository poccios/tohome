import pg from 'pg';

const testDbUrl = 'postgresql://postgres:Manu0423%40@localhost:5432/tohome_test';

const client = new pg.Client({
  connectionString: testDbUrl,
});

try {
  await client.connect();
  console.log('✓ Connected to test database');

  // Check if table exists
  const tableCheck = await client.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'restaurant_overrides'
  `);

  if (tableCheck.rows.length > 0) {
    console.log('\n✓ Table restaurant_overrides exists');

    // Get column info
    const columns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'restaurant_overrides'
      ORDER BY ordinal_position
    `);

    console.log('\nColumns:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
  } else {
    console.log('\n✗ Table restaurant_overrides does NOT exist');
  }

  // Check schema_migrations
  const migrations = await client.query(`
    SELECT version FROM schema_migrations ORDER BY version
  `);

  console.log('\nExecuted migrations:');
  migrations.rows.forEach(row => {
    console.log(`  - ${row.version}`);
  });

} catch (error) {
  console.error('Error:', error.message);
} finally {
  await client.end();
}
