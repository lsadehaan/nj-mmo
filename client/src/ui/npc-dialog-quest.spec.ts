import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mountNpcDialog, renderNpcDialog } from './npc-dialog';

describe('npc-dialog quest variant', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders quest body and buttons', () => {
    const sendQuestAction = vi.fn();
    renderNpcDialog({
      npcId: 30004,
      name: 'Katerina',
      variant: 'quest',
      visible: true,
      questBody: 'Accept quest?',
      questButtons: [{ action: 'accept', label: 'Accept' }],
      handlers: { sendNpcAction: vi.fn(), sendQuestAction },
    });
    expect(document.querySelector('[data-role="quest-body"]')?.textContent).toBe('Accept quest?');
    const btn = document.querySelector('[data-action="accept"]') as HTMLButtonElement;
    btn?.click();
    expect(sendQuestAction).toHaveBeenCalledWith({ npcId: 30004, action: 'accept' });
  });
});
