import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  mountCharacterCreation,
  resolveClassId,
  isCharacterCreationMounted,
} from './character-creation';

const storage: Record<string, string> = {};

vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => {
    storage[key] = value;
  },
  removeItem: (key: string) => {
    delete storage[key];
  },
});

const { mockJoinOrCreate } = vi.hoisted(() => ({
  mockJoinOrCreate: vi.fn(),
}));

vi.mock('@colyseus/sdk', () => ({
  Client: class MockClient {
    joinOrCreate = mockJoinOrCreate;
    constructor(_endpoint: string) {
      void _endpoint;
    }
  },
}));

vi.mock('../test-hook', () => ({
  initGameState: vi.fn(),
  setConnected: vi.fn(),
  setCharacterId: vi.fn(),
  setReady: vi.fn(),
}));

describe('character-creation', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    for (const key of Object.keys(storage)) delete storage[key];
    mockJoinOrCreate.mockReset();
    vi.resetModules();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('CHAR19-23: boots without stored characterId show creation overlay', async () => {
    const { getStoredCharacterId } = await import('../net/room');
    expect(getStoredCharacterId()).toBeNull();

    mountCharacterCreation(vi.fn());
    expect(document.getElementById('character-creation')).not.toBeNull();
    expect(isCharacterCreationMounted()).toBe(true);
  });

  it('CHAR19-24: Dwarf selection hides Mystic archetype', () => {
    mountCharacterCreation(vi.fn());
    const panel = document.getElementById('character-creation')!;
    const dwarfBtn = panel.querySelector('[data-race="dwarf"]') as HTMLButtonElement;
    dwarfBtn.click();
    const mysticBtn = panel.querySelector('[data-archetype="mystic"]') as HTMLButtonElement;
    expect(mysticBtn.hidden).toBe(true);
  });

  it('CHAR19-25: Human Mystic Female resolves create join options', async () => {
    const onCreate = vi.fn();
    mountCharacterCreation(onCreate);
    const panel = document.getElementById('character-creation')!;
    (panel.querySelector('[data-race="human"]') as HTMLButtonElement).click();
    (panel.querySelector('[data-archetype="mystic"]') as HTMLButtonElement).click();
    (panel.querySelector('[data-sex="1"]') as HTMLButtonElement).click();
    (panel.querySelector('[data-role="create"]') as HTMLButtonElement).click();

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ classId: 10, sex: 1, name: 'Adventurer' })
    );
    expect(resolveClassId('human', 'mystic')).toBe(10);
  });

  it('CHAR19-26: stored characterId skips creation overlay on boot path', async () => {
    storage['nj.characterId'] = 'existing-id';
    const mockRoom = { onMessage: vi.fn() };
    mockJoinOrCreate.mockResolvedValue(mockRoom);

    const { getStoredCharacterId, connect } = await import('../net/room');
    expect(getStoredCharacterId()).toBe('existing-id');
    expect(isCharacterCreationMounted()).toBe(false);

    await connect('http://test');
    expect(mockJoinOrCreate).toHaveBeenCalledWith('town', { characterId: 'existing-id' });
    expect(document.getElementById('character-creation')).toBeNull();
  });
});
