import type { CharacterListRow } from './character-select-types';

const ELEMENT_ID = 'character-select-screen';
export const MAX_CHARACTERS = 3;

export interface CharacterSelectHandlers {
  onSelect: (characterId: string) => void;
  onCreate: () => void;
}

export function mountCharacterSelect(
  accountName: string,
  characters: CharacterListRow[],
  handlers: CharacterSelectHandlers
): HTMLElement {
  const existing = document.getElementById(ELEMENT_ID);
  if (existing) existing.remove();

  const screen = document.createElement('div');
  screen.id = ELEMENT_ID;
  screen.dataset['accountName'] = accountName;
  screen.style.cssText =
    'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#0a0a12;color:#eee;z-index:1999';

  const card = document.createElement('div');
  card.style.cssText = 'padding:24px;background:#1a1a2e;border-radius:8px;min-width:320px';

  const title = document.createElement('h1');
  title.textContent = `Characters — ${accountName}`;
  card.appendChild(title);

  const list = document.createElement('div');
  list.dataset['role'] = 'character-list';
  for (const row of characters) {
    const entry = document.createElement('button');
    entry.type = 'button';
    entry.dataset['role'] = 'character-row';
    entry.dataset['characterId'] = row.id;
    entry.textContent = `${row.name} — Lv.${row.level}`;
    entry.addEventListener('click', () => handlers.onSelect(row.id));
    list.appendChild(entry);
  }
  card.appendChild(list);

  const createBtn = document.createElement('button');
  createBtn.type = 'button';
  createBtn.dataset['role'] = 'create-character';
  createBtn.textContent = 'Create';
  createBtn.disabled = characters.length >= MAX_CHARACTERS;
  if (characters.length >= MAX_CHARACTERS) {
    const cap = document.createElement('p');
    cap.dataset['role'] = 'character-cap';
    cap.textContent = 'Maximum 3 characters per account';
    card.appendChild(cap);
  }
  createBtn.addEventListener('click', () => handlers.onCreate());
  card.appendChild(createBtn);

  screen.appendChild(card);
  document.body.appendChild(screen);
  return screen;
}

export function hideCharacterSelect(): void {
  document.getElementById(ELEMENT_ID)?.remove();
}

export function showCharacterSelect(): void {
  const el = document.getElementById(ELEMENT_ID);
  if (el) el.hidden = false;
}

export async function fetchCharacters(
  accountName: string,
  endpoint: string
): Promise<CharacterListRow[]> {
  const res = await fetch(`${endpoint}/api/characters?accountName=${encodeURIComponent(accountName)}`);
  if (!res.ok) throw new Error('fetch failed');
  return res.json() as Promise<CharacterListRow[]>;
}
