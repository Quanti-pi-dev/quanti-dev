import 'dotenv/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getPostgresPool } from '../../src/lib/database.js';

const execAsync = promisify(exec);

async function main() {
  console.log('🚀 Starting Master Seed...');

  const pool = getPostgresPool();
  try {
     // 1. PostgreSQL Seeds (Plans & Hierarchy)
     console.log('\n⏳ Running plans-seed.ts (PostgreSQL)...');
     const { stdout: pStdout } = await execAsync('npx tsx db/seeds/plans-seed.ts');
     console.log(pStdout);
     
     // 2. MongoDB Content (Exams, Subjects, Decks, Flashcards)
     console.log('\n⏳ Running jee-neet/seed.ts (MongoDB content)...');
     
     const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URL;
     const { stdout, stderr } = await execAsync('npx tsx db/seeds/jee-neet/seed.ts', {
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
