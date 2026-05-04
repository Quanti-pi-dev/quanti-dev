import { buildLearningProfile } from '../../src/services/learning-intelligence.service.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  try {
    const profile = await buildLearningProfile('V6FzsQyRQOXsa0z72sxw6gGkSsc2');
    console.log(JSON.stringify(profile, null, 2));
  } catch (err) {
    console.error('Error building profile:', err);
  }
  process.exit(0);
}

run();
