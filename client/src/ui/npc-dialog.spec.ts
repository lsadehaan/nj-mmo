import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ROXXY_NPC_ID,
  WILFORD_NPC_ID,
  BITZ_NPC_ID,
  BAULRO_NPC_ID,
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

  it('shows warehouse title and enabled deposit/withdraw actions (TOWN24-27)', () => {
    mountNpcDialog();
    renderNpcDialog({
      npcId: WILFORD_NPC_ID,
      name: 'Wilford',
      variant: 'warehouse',
      visible: true,
      handlers: { sendNpcAction: vi.fn(), openWarehouse: vi.fn() },
    });

    const dialog = document.getElementById('npc-dialog');
    expect(dialog?.querySelector('[data-role="title"]')?.textContent).toBe(
      'Wilford — Warehouse Keeper'
    );
    const deposit = dialog?.querySelector('[data-action="deposit"]') as HTMLButtonElement | null;
    const withdraw = dialog?.querySelector('[data-action="withdraw"]') as HTMLButtonElement | null;
    expect(deposit?.disabled).toBe(false);
    expect(withdraw?.disabled).toBe(false);
  });

  it('warehouse deposit opens warehouse window handler (TOWN24-27)', () => {
    const openWarehouse = vi.fn();
    mountNpcDialog();
    renderNpcDialog({
      npcId: WILFORD_NPC_ID,
      name: 'Wilford',
      variant: 'warehouse',
      visible: true,
      handlers: { sendNpcAction: vi.fn(), openWarehouse },
    });

    const deposit = document.querySelector(
      '#npc-dialog [data-action="deposit"]'
    ) as HTMLButtonElement;
    deposit?.click();
    expect(openWarehouse).toHaveBeenCalled();
  });

  it('shows trainer learn buttons for Bitz fighter skills (SKILL20-20)', () => {
    const sendLearnSkill = vi.fn();
    mountNpcDialog();
    renderNpcDialog({
      npcId: BITZ_NPC_ID,
      name: 'Bitz',
      variant: 'trainer',
      visible: true,
      learnableSkillIds: [3],
      handlers: { sendNpcAction: vi.fn(), sendLearnSkill },
    });

    const dialog = document.getElementById('npc-dialog');
    expect(dialog?.querySelector('[data-role="title"]')?.textContent).toBe(
      'Bitz — Grand Master'
    );
    const learnBtn = dialog?.querySelector('[data-action="learn-3"]') as HTMLButtonElement | null;
    expect(learnBtn).not.toBeNull();
    expect(learnBtn?.disabled).toBe(false);
    learnBtn?.click();
    expect(sendLearnSkill).toHaveBeenCalledWith({ skillId: 3 });
  });

  it('shows folk trainer learn buttons for Baulro mystic skills (SKILL20-51)', () => {
    const sendLearnSkill = vi.fn();
    mountNpcDialog();
    renderNpcDialog({
      npcId: BAULRO_NPC_ID,
      name: 'Baulro',
      variant: 'folkTrainer',
      visible: true,
      learnableSkillIds: [1068, 1164],
      handlers: { sendNpcAction: vi.fn(), sendLearnSkill },
    });

    const dialog = document.getElementById('npc-dialog');
    expect(dialog?.querySelector('[data-role="title"]')?.textContent).toBe(
      'Baulro — Folk Trainer'
    );
    const mightBtn = dialog?.querySelector('[data-action="learn-1068"]') as HTMLButtonElement | null;
    mightBtn?.click();
    expect(sendLearnSkill).toHaveBeenCalledWith({ skillId: 1068 });
  });

  it('gatekeeper shows teleport destination buttons (TOWN24-34)', () => {
    const sendTeleport = vi.fn();
    mountNpcDialog();
    renderNpcDialog({
      npcId: ROXXY_NPC_ID,
      name: 'Roxxy',
      variant: 'gatekeeper',
      visible: true,
      handlers: { sendNpcAction: vi.fn(), sendTeleport },
    });

    const obelisk = document.querySelector(
      '#npc-dialog [data-action="obelisk"]'
    ) as HTMLButtonElement;
    expect(obelisk).not.toBeNull();
    obelisk.click();
    expect(sendTeleport).toHaveBeenCalledWith({ destinationId: 'obelisk' });
  });

  it('trainer shows class transfer buttons at level 20 (TOWN24-43)', () => {
    const sendClassTransfer = vi.fn();
    mountNpcDialog();
    renderNpcDialog({
      npcId: BITZ_NPC_ID,
      name: 'Bitz',
      variant: 'trainer',
      visible: true,
      classTransferOptions: [
        { targetClassId: 1, label: 'Warrior' },
        { targetClassId: 4, label: 'Knight' },
      ],
      handlers: { sendNpcAction: vi.fn(), sendClassTransfer },
    });

    const warrior = document.querySelector(
      '#npc-dialog [data-action="class-1"]'
    ) as HTMLButtonElement;
    expect(warrior).not.toBeNull();
    warrior.click();
    expect(sendClassTransfer).toHaveBeenCalledWith({ targetClassId: 1 });
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
