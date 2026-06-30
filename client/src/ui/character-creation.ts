export type CreationRace = 'human' | 'elf' | 'dark_elf' | 'orc' | 'dwarf';
export type CreationArchetype = 'fighter' | 'mystic';
export type CreationSex = 0 | 1;

export interface CharacterCreatePayload {
  classId: number;
  sex: CreationSex;
  name?: string;
  accountName?: string;
}

const CLASS_ID_BY_RACE: Record<
  CreationRace,
  { fighter: number; mystic?: number }
> = {
  human: { fighter: 0, mystic: 10 },
  elf: { fighter: 18, mystic: 25 },
  dark_elf: { fighter: 31, mystic: 38 },
  orc: { fighter: 44, mystic: 49 },
  dwarf: { fighter: 53 },
};

export function resolveClassId(race: CreationRace, archetype: CreationArchetype): number {
  const entry = CLASS_ID_BY_RACE[race];
  if (archetype === 'mystic') {
    if (entry.mystic === undefined) {
      throw new Error(`Mystic not available for ${race}`);
    }
    return entry.mystic;
  }
  return entry.fighter;
}

const ELEMENT_ID = 'character-creation';

export function mountCharacterCreation(
  onCreate: (payload: CharacterCreatePayload) => void | Promise<void>,
  options: { accountName?: string } = {}
): HTMLElement {
  const existing = document.getElementById(ELEMENT_ID);
  if (existing) return existing;

  let race: CreationRace = 'human';
  let archetype: CreationArchetype = 'fighter';
  let sex: CreationSex = 0;

  const panel = document.createElement('div');
  panel.id = ELEMENT_ID;
  panel.style.cssText = [
    'position:fixed',
    'inset:0',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'background:rgba(0,0,0,0.75)',
    'color:#f5f5f5',
    'font-family:system-ui,sans-serif',
    'z-index:1000',
  ].join(';');

  const card = document.createElement('div');
  card.style.cssText = [
    'background:#1a1a2e',
    'border:1px solid #444',
    'border-radius:8px',
    'padding:24px',
    'min-width:320px',
  ].join(';');

  const title = document.createElement('h1');
  title.textContent = 'Create Character';
  title.style.margin = '0 0 16px';
  card.appendChild(title);

  const raceGroup = document.createElement('fieldset');
  raceGroup.innerHTML = '<legend>Race</legend>';
  const raceButtons: Partial<Record<CreationRace, HTMLButtonElement>> = {};
  for (const value of ['human', 'elf', 'dark_elf', 'orc', 'dwarf'] as CreationRace[]) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = value.replace('_', ' ');
    btn.dataset.race = value;
    btn.style.margin = '4px';
    raceButtons[value] = btn;
    raceGroup.appendChild(btn);
  }
  card.appendChild(raceGroup);

  const archetypeGroup = document.createElement('fieldset');
  archetypeGroup.innerHTML = '<legend>Archetype</legend>';
  const fighterBtn = document.createElement('button');
  fighterBtn.type = 'button';
  fighterBtn.textContent = 'Fighter';
  fighterBtn.dataset.archetype = 'fighter';
  fighterBtn.style.margin = '4px';
  const mysticBtn = document.createElement('button');
  mysticBtn.type = 'button';
  mysticBtn.textContent = 'Mystic';
  mysticBtn.dataset.archetype = 'mystic';
  mysticBtn.style.margin = '4px';
  archetypeGroup.append(fighterBtn, mysticBtn);
  card.appendChild(archetypeGroup);

  const genderGroup = document.createElement('fieldset');
  genderGroup.innerHTML = '<legend>Gender</legend>';
  const maleBtn = document.createElement('button');
  maleBtn.type = 'button';
  maleBtn.textContent = 'Male';
  maleBtn.dataset.sex = '0';
  maleBtn.style.margin = '4px';
  const femaleBtn = document.createElement('button');
  femaleBtn.type = 'button';
  femaleBtn.textContent = 'Female';
  femaleBtn.dataset.sex = '1';
  femaleBtn.style.margin = '4px';
  genderGroup.append(maleBtn, femaleBtn);
  card.appendChild(genderGroup);

  const nameGroup = document.createElement('label');
  nameGroup.textContent = 'Name ';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.dataset['role'] = 'character-name';
  nameInput.maxLength = 16;
  nameInput.value = 'Adventurer';
  nameGroup.appendChild(nameInput);
  card.appendChild(nameGroup);

  const createBtn = document.createElement('button');
  createBtn.type = 'button';
  createBtn.textContent = 'Enter World';
  createBtn.dataset.role = 'create';
  createBtn.style.marginTop = '16px';
  card.appendChild(createBtn);

  const refreshUi = (): void => {
    for (const [value, btn] of Object.entries(raceButtons) as [CreationRace, HTMLButtonElement][]) {
      btn.disabled = false;
      btn.style.opacity = value === race ? '1' : '0.6';
    }
    fighterBtn.style.opacity = archetype === 'fighter' ? '1' : '0.6';
    const mysticHidden = race === 'dwarf';
    mysticBtn.hidden = mysticHidden;
    mysticBtn.disabled = mysticHidden;
    if (mysticHidden && archetype === 'mystic') {
      archetype = 'fighter';
    }
    mysticBtn.style.opacity = archetype === 'mystic' ? '1' : '0.6';
    maleBtn.style.opacity = sex === 0 ? '1' : '0.6';
    femaleBtn.style.opacity = sex === 1 ? '1' : '0.6';
  };

  raceGroup.addEventListener('click', (ev) => {
    const target = (ev.target as HTMLElement).closest('[data-race]') as HTMLElement | null;
    if (!target?.dataset.race) return;
    race = target.dataset.race as CreationRace;
    refreshUi();
  });

  archetypeGroup.addEventListener('click', (ev) => {
    const target = (ev.target as HTMLElement).closest('[data-archetype]') as HTMLElement | null;
    if (!target?.dataset.archetype || target.hidden) return;
    archetype = target.dataset.archetype as CreationArchetype;
    refreshUi();
  });

  genderGroup.addEventListener('click', (ev) => {
    const target = (ev.target as HTMLElement).closest('[data-sex]') as HTMLElement | null;
    if (!target?.dataset.sex) return;
    sex = Number(target.dataset.sex) as CreationSex;
    refreshUi();
  });

  createBtn.addEventListener('click', () => {
    const classId = resolveClassId(race, archetype);
    void onCreate({
      classId,
      sex,
      name: nameInput.value.trim(),
      accountName: options.accountName,
    });
  });

  panel.appendChild(card);
  document.body.appendChild(panel);
  refreshUi();
  return panel;
}

export function isCharacterCreationMounted(): boolean {
  return document.getElementById(ELEMENT_ID) !== null;
}
