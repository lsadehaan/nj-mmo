import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ROXXY_NPC_ID,
  WILFORD_NPC_ID,
  BITZ_NPC_ID,
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
      variant: 'helper',
      visible: true,
      handlers: { sendNpcAction: vi.fn() },
    });

    const dialog = document.getElementById('npc-dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.hidden).toBe(false);
    expect(dialog?.querySelector('[data-action="heal"]')).not.toBeNull();
    expect(dialog?.querySelector('[data-action="starterKit"]')).not.toBeNull();
  });

  it('shows warehouse title and disabled deposit/withdraw actions (TINPC-26)', () => {
    mountNpcDialog();
    renderNpcDialog({
      npcId: WILFORD_NPC_ID,
      name: 'Wilford',
      variant: 'warehouse',
      visible: true,
      handlers: { sendNpcAction: vi.fn() },
    });

    const dialog = document.getElementById('npc-dialog');
    expect(dialog?.querySelector('[data-role="title"]')?.textContent).toBe(
      'Wilford — Warehouse Keeper'
    );
    const deposit = dialog?.querySelector('[data-action="deposit"]') as HTMLButtonElement | null;
    const withdraw = dialog?.querySelector('[data-action="withdraw"]') as HTMLButtonElement | null;
    expect(deposit?.disabled).toBe(true);
    expect(withdraw?.disabled).toBe(true);
    expect(deposit?.textContent).toContain('Coming soon');
    expect(withdraw?.textContent).toContain('Coming soon');
  });

  it('disabled warehouse buttons do not wire click handlers (TINPC-27)', () => {
    const sendNpcAction = vi.fn();
    mountNpcDialog();
    renderNpcDialog({
      npcId: WILFORD_NPC_ID,
      name: 'Wilford',
      variant: 'warehouse',
      visible: true,
      handlers: { sendNpcAction },
    });

    const deposit = document.querySelector(
      '#npc-dialog [data-action="deposit"]'
    ) as HTMLButtonElement;
    deposit?.click();
    expect(sendNpcAction).not.toHaveBeenCalled();
  });

  it('shows trainer title and disabled class-change action (TINPC-28)', () => {
    mountNpcDialog();
    renderNpcDialog({
      npcId: BITZ_NPC_ID,
      name: 'Bitz',
      variant: 'trainer',
      visible: true,
      handlers: { sendNpcAction: vi.fn() },
    });

    const dialog = document.getElementById('npc-dialog');
    expect(dialog?.querySelector('[data-role="title"]')?.textContent).toBe(
      'Bitz — Grand Master'
    );
    const changeClass = dialog?.querySelector(
      '[data-action="changeClass"]'
    ) as HTMLButtonElement | null;
    expect(changeClass?.disabled).toBe(true);
    expect(changeClass?.textContent).toContain('Coming soon');
  });

  it('heal button sends npcAction heal intent', () => {
    const sendNpcAction = vi.fn();
    mountNpcDialog();
    renderNpcDialog({
      npcId: ROXXY_NPC_ID,
      name: 'Roxxy',
      variant: 'helper',
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
      variant: 'helper',
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
