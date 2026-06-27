import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ROXXY_NPC_ID,
  mountNpcDialog,
  renderNpcDialog,
} from './npc-dialog';

describe('npc-dialog DOM', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('exposes Heal and Starter Kit buttons for Roxxy helper dialog', () => {
    mountNpcDialog();
    renderNpcDialog({
      npcId: ROXXY_NPC_ID,
      name: 'Roxxy',
      visible: true,
      handlers: { sendNpcAction: vi.fn() },
    });

    const dialog = document.getElementById('npc-dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.hidden).toBe(false);
    expect(dialog?.querySelector('[data-action="heal"]')).not.toBeNull();
    expect(dialog?.querySelector('[data-action="starterKit"]')).not.toBeNull();
  });

  it('heal button sends npcAction heal intent', () => {
    const sendNpcAction = vi.fn();
    mountNpcDialog();
    renderNpcDialog({
      npcId: ROXXY_NPC_ID,
      name: 'Roxxy',
      visible: true,
      handlers: { sendNpcAction },
    });

    const healBtn = document.querySelector('#npc-dialog [data-action="heal"]') as HTMLButtonElement;
    healBtn.click();

    expect(sendNpcAction).toHaveBeenCalledWith({
      npcId: ROXXY_NPC_ID,
      action: 'heal',
    });
  });

  it('starter kit button sends npcAction starterKit intent', () => {
    const sendNpcAction = vi.fn();
    mountNpcDialog();
    renderNpcDialog({
      npcId: ROXXY_NPC_ID,
      name: 'Roxxy',
      visible: true,
      handlers: { sendNpcAction },
    });

    const kitBtn = document.querySelector(
      '#npc-dialog [data-action="starterKit"]'
    ) as HTMLButtonElement;
    kitBtn.click();

    expect(sendNpcAction).toHaveBeenCalledWith({
      npcId: ROXXY_NPC_ID,
      action: 'starterKit',
    });
  });
});
