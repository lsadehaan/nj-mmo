import { getDb, type AppDatabase } from '../db/client';
import {
  classLevelVitals,
  classTemplates,
  classSkillTree,
  monsters,
  npcs,
  skills,
  experience,
  experienceLoss,
  items,
  recipes,
  armorSets,
  mobDrops,
  mobSpawns,
  merchantItems,
  npcSpawns,
  questObjectives,
  questRewards,
  quests,
  warehouseItems,
  teleportDestinations,
} from '../db/schema';
import { seedClassTemplates } from './seeders/class-templates.seeder';
import { seedMonsters } from './seeders/monsters.seeder';
import { seedNpcs } from './seeders/npcs.seeder';
import { seedSkills } from './seeders/skills.seeder';
import { seedClassSkillTree } from './seeders/class-skill-tree.seeder';
import { seedExperience } from './seeders/experience.seeder';
import { seedExperienceLoss } from './seeders/experience-loss.seeder';
import { seedMobDrops } from './seeders/drops.seeder';
import { seedMobSpawns } from './seeders/spawns.seeder';
import { seedMerchantItems } from './seeders/merchant-items.seeder';
import { seedNpcSpawns } from './seeders/npc-spawns.seeder';
import { seedItems } from './seeders/items.seeder';
import { seedRecipes } from './seeders/recipes.seeder';
import { seedArmorSets } from './seeders/armor-sets.seeder';
import { seedQuests } from './seeders/quests.seeder';
import { seedTeleportDestinations } from './seeders/teleport-destinations.seeder';
import { FIXTURE_DATA_DIR, resolveDataDir } from './paths';

export interface SeedOptions {
  dataDir?: string;
  dbPath: string;
}

export interface SeedReport {
  classTemplates: number;
  monsters: number;
  npcs: number;
  skills: number;
  classSkillTree: number;
  experience: number;
  experienceLoss: number;
  items: number;
  recipes: number;
  armorSets: number;
  mobDrops: number;
  mobSpawns: number;
  merchantItems: number;
  npcSpawns: number;
  quests: number;
  teleportDestinations: number;
}

export function runSeed(options: SeedOptions): SeedReport {
  const dataDir = options.dataDir ?? resolveDataDir();
  const db = getDb(options.dbPath);

  return db.transaction((tx) => {
    tx.delete(classLevelVitals).run();
    tx.delete(classTemplates).run();
    tx.delete(classSkillTree).run();
    tx.delete(questObjectives).run();
    tx.delete(questRewards).run();
    tx.delete(quests).run();
    tx.delete(mobSpawns).run();
    tx.delete(mobDrops).run();
    tx.delete(merchantItems).run();
    tx.delete(npcSpawns).run();
    tx.delete(warehouseItems).run();
    tx.delete(teleportDestinations).run();
    tx.delete(experienceLoss).run();
    tx.delete(experience).run();
    tx.delete(skills).run();
    tx.delete(npcs).run();
    tx.delete(monsters).run();
    tx.delete(items).run();
    tx.delete(recipes).run();
    tx.delete(armorSets).run();

    const report: SeedReport = {
      classTemplates: seedClassTemplates(tx as unknown as AppDatabase, dataDir),
      monsters: seedMonsters(tx as unknown as AppDatabase, dataDir),
      mobDrops: seedMobDrops(tx as unknown as AppDatabase, dataDir),
      mobSpawns: seedMobSpawns(tx as unknown as AppDatabase, dataDir),
      npcs: seedNpcs(tx as unknown as AppDatabase, dataDir),
      merchantItems: seedMerchantItems(tx as unknown as AppDatabase, dataDir),
      npcSpawns: seedNpcSpawns(tx as unknown as AppDatabase, dataDir),
      skills: seedSkills(tx as unknown as AppDatabase, dataDir),
      classSkillTree: seedClassSkillTree(tx as unknown as AppDatabase, dataDir),
      experience: seedExperience(tx as unknown as AppDatabase, dataDir),
      experienceLoss: seedExperienceLoss(tx as unknown as AppDatabase, dataDir),
      items: seedItems(tx as unknown as AppDatabase, dataDir),
      recipes: seedRecipes(tx as unknown as AppDatabase, dataDir),
      armorSets: seedArmorSets(tx as unknown as AppDatabase),
      quests: seedQuests(tx as unknown as AppDatabase, dataDir),
      teleportDestinations: seedTeleportDestinations(tx as unknown as AppDatabase),
    };

    return report;
  });
}

export { FIXTURE_DATA_DIR };
