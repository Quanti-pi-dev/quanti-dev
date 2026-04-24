import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getPostgresPool } from '../../src/lib/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sqlFile1 = path.join(__dirname, '../seeds/001_dev_seed.sql');
const sqlFile2 = path.join(__dirname, '../seeds/002_plans_and_coupons.sql');

const execAsync = promisify(exec);

async function runSQL(filePath: string) {
  const pool = getPostgresPool();
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠ SQL file not found: ${filePath}`);
    return;
  }
  const sql = fs.readFileSync(filePath, 'utf-8');
  console.log(`\n⏳ Running SQL: ${path.basename(filePath)}`);
  try {
    await pool.query(sql);
    console.log(`✅ Success: ${path.basename(filePath)}`);
  } catch (err: any) {
    if (err.code === '23505') {
       console.log(`⚠ Ignored conflict error in ${path.basename(filePath)}: ${err.message}`);
    } else {
       throw err;
    }
  }
}

async function main() {
  console.log('🚀 Starting Master Seed...');

  const pool = getPostgresPool();
  try {
     // 1. PostgreSQL Seeds
     await runSQL(sqlFile1);
     await runSQL(sqlFile2);
     
     // 2. We can also optionally run plans-seed.ts if needed, but 002 sql covers it.
     // Let's run exam-seed.ts
     console.log('\n⏳ Running exam-seed.ts (MongoDB content)...');
     
     const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URL;
     const cmd = 'npx tsx db/seeds/exam-seed.ts';
     
     const { stdout, stderr } = await execAsync(cmd, {
         env: { ...process.env, MONGODB_URI: mongoUri }
     });
     
     console.log(stdout);
     if (stderr) console.error('stderr:', stderr);

     console.log('🎉 All default seeds completed successfully.');
  } finally {
     await pool.end();
  }
}

main().catch(err => {
  console.error("❌ Master seed failed:", err);
  process.exit(1);
});
