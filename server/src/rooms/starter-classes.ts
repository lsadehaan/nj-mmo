/** L2J Classic starter classIds allowed at character creation. */
export const STARTER_CLASS_IDS = [0, 10, 18, 25, 31, 38, 44, 49, 53] as const;

export type StarterClassId = (typeof STARTER_CLASS_IDS)[number];

export function isStarterClassId(classId: number): classId is StarterClassId {
  return (STARTER_CLASS_IDS as readonly number[]).includes(classId);
}

export function isValidSex(sex: number): sex is 0 | 1 {
  return sex === 0 || sex === 1;
}
