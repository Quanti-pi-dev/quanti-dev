import { getPostgresPool } from './src/lib/database.js';

async function updatePlans() {
  const pool = getPostgresPool();
  
  // Basic: advanced_analytics=true, deep_insights=false, mastery_radar=false
  await pool.query(`
    UPDATE plans
    SET features = features || '{"advanced_analytics": true, "deep_insights": false, "mastery_radar": false}'::jsonb
    WHERE tier = 1;
  `);

  // Pro: advanced_analytics=true, deep_insights=true, mastery_radar=false
  await pool.query(`
    UPDATE plans
    SET features = features || '{"advanced_analytics": true, "deep_insights": true, "mastery_radar": false}'::jsonb
    WHERE tier = 2;
  `);

  // Master: advanced_analytics=true, deep_insights=true, mastery_radar=true
  await pool.query(`
    UPDATE plans
    SET features = features || '{"advanced_analytics": true, "deep_insights": true, "mastery_radar": true}'::jsonb
    WHERE tier = 3;
  `);

  console.log('Plans updated successfully!');
  process.exit(0);
}

updatePlans().catch(console.error);
