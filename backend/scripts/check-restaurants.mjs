import { query } from '../src/db/index.js';

async function checkRestaurants() {
  try {
    const result = await query('SELECT id, slug, name, is_active FROM restaurants ORDER BY name');

    console.log('\nRistoranti esistenti:');
    console.log('='.repeat(80));
    result.rows.forEach((r, i) => {
      console.log(`${i+1}. ${r.name} (slug: ${r.slug}, active: ${r.is_active}, id: ${r.id})`);
    });
    console.log('='.repeat(80));
    console.log(`Totale: ${result.rows.length} ristoranti\n`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkRestaurants();
