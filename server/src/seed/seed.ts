import { getDb, type AppDatabase } from '../db/client';
import { monsters, npcs, skills, experience } from '../db/schema';
import { seedMonsters } from './seeders/monsters.seeder';
import { seedNpcs } from './seeders/npcs.seeder';
import { seedSkills } from './seeders/skills.seeder';
import { seedExperience } from './seeders/experience.seeder';
import { FIXTURE_DATA_DIR, resolveDataDir } from './paths';

export interface SeedOptions {
  dataDir?: string;
  dbPath: string;
}

export interface SeedReport {
  monsters: number;
  npcs: number;
  skills: number;
  experience: number;
}

export function runSeed(options: SeedOptions): SeedReport {
  const dataDir = options.dataDir ?? resolveDataDir();
  const db = getDb(options.dbPath);

  return db.transaction((tx) => {
    tx.delete(experience).run();
    tx.delete(skills).run();
    tx.delete(npcs).run();
    tx.delete(monsters).run();

    const report: SeedReport = {
      monsters: seedMonsters(tx as unknown as AppDatabase, dataDir),
      npcs: seedNpcs(tx as unknown as AppDatabase, dataDir),
      skills: seedSkills(tx as unknown as AppDatabase, dataDir),
      experience: seedExperience(tx as unknown as AppDatabase, dataDir),
    };

    return report;
  });
}

export { FIXTURE_DATA_DIR };
