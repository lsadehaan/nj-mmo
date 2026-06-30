import { initGameState, setReady, getGameState, refreshPlayerCooldownRemaining } from './test-hook';
import { connectSafe, wireRoom, getStoredCharacterId } from './net/room';
import { wireCombatControls } from './combat-input';
import { mountHotbar } from './ui/hotbar';
import { mountCastBar } from './ui/cast-bar';
import { mountPlayerVitalsHud } from './hud/player-vitals';
import { mountShopWindow } from './ui/shop-window';
import { mountInventoryWindow } from './ui/inventory-window';
import { mountNpcDialog } from './ui/npc-dialog';
import { mountInteractPrompt } from './npc-interaction';
import { mountCharacterCreation } from './ui/character-creation';
import { mountChatPanel } from './ui/chat-panel';
import { mountPartyPanel } from './ui/party-panel';
import { mountTradeWindow } from './ui/trade-window';
import { mountFriendsPanel } from './ui/friends-panel';
import { createRenderer, startRenderLoop } from './scene/renderer';
import { renderHotbar } from './ui/hotbar';
import { updateCastBar } from './ui/cast-bar';

async function boot(): Promise<void> {
  initGameState();
  mountHotbar();
  mountCastBar();
  mountPlayerVitalsHud();
  mountShopWindow();
  mountInventoryWindow();
  mountNpcDialog();
  mountInteractPrompt();
  mountChatPanel();
  mountPartyPanel();
  mountTradeWindow();
  mountFriendsPanel();

  const startSkillUiLoop = (): (() => void) => {
    const tick = (): void => {
      refreshPlayerCooldownRemaining();
      const { player } = getGameState();
      const nowMs = Date.now();
      renderHotbar({
        knownSkillIds: player.knownSkillIds,
        skillCooldownEndMs: player.skillCooldownEndMs,
        nowMs,
        handlers: { onUseSkill: (skillId) => window.__useSkill__?.(skillId) },
      });
      updateCastBar({
        castingSkillId: player.castingSkillId,
        castEndMs: player.castEndMs,
        nowMs,
      });
      requestAnimationFrame(tick);
    };
    const rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  };
  startSkillUiLoop();

  const canvas = document.getElementById('game') as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error('Canvas #game not found');
  }

  const game = await createRenderer(canvas);
  startRenderLoop(game);

  canvas.addEventListener('click', (ev) =>
    game.handleClick({ clientX: ev.clientX, clientY: ev.clientY })
  );

  window.__handleGroundClick__ = (clientX, clientY) =>
    game.handleClick({ clientX, clientY });

  window.addEventListener('resize', () => {
    game.camera.aspect = window.innerWidth / window.innerHeight;
    game.camera.updateProjectionMatrix();
    game.renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const beginSession = async (create?: { classId: number; sex: 0 | 1 }): Promise<void> => {
    const room = await connectSafe(undefined, create ? { create } : {});
    if (room) {
      wireCombatControls(room, game);
      wireRoom(room, game);
      window.__consentLeave__ = async () => {
        await room.leave(true);
      };
    } else {
      console.warn('Failed to connect to game server');
    }
    setReady(true);
  };

  if (!getStoredCharacterId()) {
    mountCharacterCreation(async (payload) => {
      const overlay = document.getElementById('character-creation');
      overlay?.remove();
      await beginSession(payload);
    });
    return;
  }

  await beginSession();
}

boot();
