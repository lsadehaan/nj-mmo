import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  FALLBACK_ICON,
  getItemIconPath,
  getSkillIconPath,
  P1_ICON_PATHS,
} from './icon-manifest';

const PUBLIC_ROOT = path.resolve(__dirname, '../../public');

describe('icon-manifest', () => {
  it('maps Power Strike skill id 3 to power-strike.png', () => {
    expect(getSkillIconPath(3)).toMatch(/\/icons\/skills\/power-strike\.png$/);
  });

  it('maps P1 item ids to expected icon paths', () => {
    expect(getItemIconPath(1060)).toMatch(/healing-potion\.png$/);
    expect(getItemIconPath(1835)).toMatch(/soulshot\.png$/);
    expect(getItemIconPath(17)).toMatch(/wooden-arrow\.png$/);
    expect(getItemIconPath(2369)).toMatch(/squires-sword\.png$/);
    expect(getItemIconPath(57)).toMatch(/adena\.png$/);
  });

  it('returns FALLBACK_ICON for unmapped item ids', () => {
    expect(getItemIconPath(99999)).toBe(FALLBACK_ICON);
    expect(getSkillIconPath(99999)).toBe(FALLBACK_ICON);
  });

  it('has a PNG file on disk for every P1 manifest path', () => {
    for (const iconPath of P1_ICON_PATHS) {
      const diskPath = path.join(PUBLIC_ROOT, iconPath.replace(/^\//, ''));
      expect(existsSync(diskPath), `missing ${diskPath}`).toBe(true);
    }
  });
});
