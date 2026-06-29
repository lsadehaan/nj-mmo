import type { NewClassSkillTreeRow } from '../../db/schema';
import { xmlParser, parseNumber, parseString } from './xml-utils';

interface SkillTreeSkillNode {
  '@_skillId': string;
  '@_skillLevel'?: string;
  '@_getLevel'?: string;
  '@_levelUpSp'?: string;
  '@_autoGet'?: string;
}

interface SkillTreeNode {
  '@_classId': string;
  skill?: SkillTreeSkillNode | SkillTreeSkillNode[];
}

export function parseClassSkillTreeXml(xml: string): NewClassSkillTreeRow[] {
  const doc = xmlParser.parse(xml) as { list?: { skillTree?: SkillTreeNode | SkillTreeNode[] } };
  const trees = doc.list?.skillTree;
  if (!trees) return [];

  const treeList = Array.isArray(trees) ? trees : [trees];
  const rows: NewClassSkillTreeRow[] = [];

  for (const tree of treeList) {
    const classId = parseNumber(tree['@_classId'], 'classId', tree['@_classId']);
    const skills = tree.skill;
    if (!skills) continue;
    const skillList = Array.isArray(skills) ? skills : [skills];

    for (const skill of skillList) {
      const skillId = parseNumber(skill['@_skillId'], 'skillId', skill['@_skillId']);
      const skillLevel = parseNumber(
        skillId,
        'skillLevel',
        skill['@_skillLevel'] ?? '1'
      );
      const getLevel = parseNumber(skillId, 'getLevel', skill['@_getLevel'] ?? '1');
      const levelUpSp = parseNumber(skillId, 'levelUpSp', skill['@_levelUpSp'] ?? '0');
      const autoGet = skill['@_autoGet'] === 'true';

      rows.push({
        classId,
        skillId,
        skillLevel,
        getLevel,
        levelUpSp,
        autoGet,
      });
    }
  }

  return rows;
}

export function parseClassSkillTreeFile(xml: string, fileName: string): NewClassSkillTreeRow[] {
  void fileName;
  return parseClassSkillTreeXml(xml);
}
