import { runSeed, FIXTURE_DATA_DIR } from './seed';

const dbPath = process.env['NJ_DB_PATH'] ?? 'data/game.db';
const report = runSeed({ dbPath, dataDir: FIXTURE_DATA_DIR });
console.log(`Seeded ${dbPath}:`, report);
