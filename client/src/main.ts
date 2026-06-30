import { initGameState, setReady, getGameState, refreshPlayerCooldownRemaining } from './test-hook';
import {
  connectSafe,
  wireRoom,
  storeCharacterId,
  DEFAULT_COLYSEUS_ENDPOINT,
} from './net/room';
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
import { mountPvpToggle, wirePvpToggle } from './ui/pvp-toggle';
import { mountStatAllocate, wireStatAllocate } from './ui/stat-allocate';
import { createRenderer, startRenderLoop } from './scene/renderer';
import { renderHotbar } from './ui/hotbar';
import { updateCastBar } from './ui/cast-bar';
import { loadGltfTemplate } from './scene/creature/mesh-character';
import { getPlayerManifestEntry } from './scene/creature/player-manifest';
import { mountLoginScreen, hideLoginScreen, ACCOUNT_NAME_STORAGE_KEY } from './ui/login-screen';
import {
  mountCharacterSelect,
  hideCharacterSelect,
  fetchCharacters,
} from './ui/character-select';
import { mountSkillWindow } from './ui/skill-window';
import { mountQuestLog } from './ui/quest-log';
import { mountQuestTracker } from './ui/quest-tracker';
import { mountMinimap } from './ui/minimap';
import { mountWorldMap, renderWorldMap } from './ui/world-map';
import { mountTargetFrame } from './ui/target-frame';
import { mountSystemMenu } from './ui/system-menu';
import {
  initWindowManagerRegistry,
  registerPanel,
  bindGlobalHotkeys,
  openPanel,
  publishUiState,
  setUiAudioHooks,
} from './ui/window-manager';
import { createAudioManager, type AudioManager } from './audio/audio-manager';
import { createDomAudioBackend } from './audio/audio-backend';
import { loadAudioSettings, type AudioSettings } from './audio/audio-settings';

let gameUiMounted = false;
let activeAudioManager: AudioManager | null = null;

function mountGameUi(audioSettings: AudioSettings): void {
  if (gameUiMounted) return;
  gameUiMounted = true;

  initWindowManagerRegistry();
  mountHotbar();
  mountCastBar();
  mountPlayerVitalsHud();
  mountShopWindow();
  mountInventoryWindow();
  mountSkillWindow();
  mountQuestLog();
  mountQuestTracker();
  mountMinimap();
  mountWorldMap();
  mountTargetFrame();
  mountNpcDialog();
  mountInteractPrompt();
  mountChatPanel();
  mountPartyPanel();
  mountTradeWindow();
  mountFriendsPanel();
  mountPvpToggle();
  mountStatAllocate();

  registerPanel('inventory-window', { mount: mountInventoryWindow, hotkey: 'I' });
  registerPanel('skill-window', { mount: mountSkillWindow, hotkey: 'K' });
  registerPanel('quest-log', { mount: mountQuestLog, hotkey: 'L', aliasHotkeys: ['Q'] });
  registerPanel('world-map', {
    mount: mountWorldMap,
    hotkey: 'M',
    title: 'World Map',
    chromeHost: (root) =>
      (root.querySelector('[data-role="world-map-card"]') as HTMLElement | null) ?? root,
    onOpen: () => renderWorldMap(true),
  });

  mountSystemMenu({
    onInventory: () => openPanel('inventory-window'),
    onSkills: () => openPanel('skill-window'),
    onQuestLog: () => openPanel('quest-log'),
    onWorldMap: () => openPanel('world-map'),
    onLogout: () => void handleLogout(),
    initialAudioSettings: audioSettings,
    onAudioSettingsChange: (settings) => activeAudioManager?.applySettings(settings),
    onUiClick: () => activeAudioManager?.playUiClick(),
  });
  bindGlobalHotkeys();
  publishUiState();

  wirePvpToggle({ togglePvp: () => window.__togglePvp__?.() });
  wireStatAllocate({
    allocateStat: (stat) => window.__allocateStat__?.(stat),
    resetStats: () => window.__resetStats__?.(),
  });
}

async function handleLogout(): Promise<void> {
  await window.__consentLeave__?.();
  activeRenderer?.dispose();
  activeRenderer = null;
  activeAudioManager = null;
  gameUiMounted = false;
  const canvas = document.getElementById('game') as HTMLCanvasElement | null;
  if (canvas) canvas.hidden = true;
  const accountName = localStorage.getItem(ACCOUNT_NAME_STORAGE_KEY) ?? '';
  if (accountName) await showCharacterSelect(accountName);
}

async function showCharacterSelect(accountName: string): Promise<void> {
  try {
    const characters = await fetchCharacters(accountName, DEFAULT_COLYSEUS_ENDPOINT);
    mountCharacterSelect(accountName, characters, {
      onSelect: (characterId) => void enterWorld(accountName, characterId),
      onCreate: () => openCharacterCreation(accountName),
    });
  } catch {
    mountCharacterSelect(accountName, [], {
      onSelect: (characterId) => void enterWorld(accountName, characterId),
      onCreate: () => openCharacterCreation(accountName),
    });
    const err = document.querySelector('[data-role="select-error"]');
    if (!err) {
      const msg = document.createElement('p');
      msg.dataset['role'] = 'select-error';
      msg.textContent = 'Could not load characters';
      document.getElementById('character-select-screen')?.appendChild(msg);
    }
  }
}

function openCharacterCreation(accountName: string): void {
  hideCharacterSelect();
  mountCharacterCreation(async (payload) => {
    document.getElementById('character-creation')?.remove();
    const room = await connectSafe(DEFAULT_COLYSEUS_ENDPOINT, {
      create: {
        classId: payload.classId,
        sex: payload.sex,
        accountName: payload.accountName ?? accountName,
        name: payload.name,
      },
      accountName,
    });
    if (room) {
      const canvas = document.getElementById('game') as HTMLCanvasElement | null;
      if (canvas) canvas.hidden = false;
      await finishWorldEntry(room);
      return;
    }
    await showCharacterSelect(accountName);
  }, { accountName });
}

async function enterWorld(accountName: string, characterId: string): Promise<void> {
  storeCharacterId(characterId);
  hideCharacterSelect();
  const canvas = document.getElementById('game') as HTMLCanvasElement | null;
  if (canvas) canvas.hidden = false;
  const room = await connectSafe(DEFAULT_COLYSEUS_ENDPOINT, { characterId, accountName });
  if (room) {
    await finishWorldEntry(room);
    return;
  }
  if (canvas) canvas.hidden = true;
  await showCharacterSelect(accountName);
}

let activeRenderer: Awaited<ReturnType<typeof createRenderer>> | null = null;

async function finishWorldEntry(room: NonNullable<Awaited<ReturnType<typeof connectSafe>>>): Promise<void> {
  const players = (room.state as { players?: Map<string, { classId?: number }> }).players;
  const classId = players?.get(room.sessionId)?.classId ?? 0;
  void loadGltfTemplate(getPlayerManifestEntry(classId).model);
  const canvas = document.getElementById('game') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('Canvas #game not found');
  const game = await createRenderer(canvas);
  const audioSettings = loadAudioSettings();
  activeAudioManager = createAudioManager({
    backend: createDomAudioBackend(),
    settings: audioSettings,
  });
  game.setAudioManager(activeAudioManager);
  setUiAudioHooks({
    onOpen: () => activeAudioManager?.playUiOpen(),
    onClose: () => activeAudioManager?.playUiClose(),
  });
  activeRenderer = game;
  startRenderLoop(game);
  mountGameUi(audioSettings);
  wireCombatControls(room, game);
  wireRoom(room, game, { audioManager: activeAudioManager });
  window.__consentLeave__ = async () => {
    await room.leave(true);
  };
  setReady(true);
}

async function boot(): Promise<void> {
  initGameState();

  const canvas = document.getElementById('game') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('Canvas #game not found');
  canvas.hidden = true;

  canvas.addEventListener('click', (ev) => {
    activeRenderer?.handleClick({ clientX: ev.clientX, clientY: ev.clientY });
  });

  // Right-drag orbits the camera around the player so mobs on any side can be
  // brought into view and clicked. (Left-click stays reserved for move/target.)
  const CAMERA_ROTATE_SENSITIVITY = 0.006;
  let rotating = false;
  let lastPointerX = 0;
  canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
  canvas.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 2) return;
    rotating = true;
    lastPointerX = ev.clientX;
    canvas.setPointerCapture?.(ev.pointerId);
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (!rotating) return;
    const dx = ev.clientX - lastPointerX;
    lastPointerX = ev.clientX;
    activeRenderer?.rotateCamera(-dx * CAMERA_ROTATE_SENSITIVITY);
  });
  const stopRotating = (ev: PointerEvent): void => {
    if (ev.button !== 2 && ev.type === 'pointerup') return;
    rotating = false;
  };
  canvas.addEventListener('pointerup', stopRotating);
  canvas.addEventListener('pointercancel', () => {
    rotating = false;
  });
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowLeft') activeRenderer?.rotateCamera(-0.12);
    else if (ev.key === 'ArrowRight') activeRenderer?.rotateCamera(0.12);
  });

  window.addEventListener('resize', () => {
    if (!activeRenderer) return;
    activeRenderer.camera.aspect = window.innerWidth / window.innerHeight;
    activeRenderer.camera.updateProjectionMatrix();
    activeRenderer.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    activeRenderer.renderer.setSize(window.innerWidth, window.innerHeight);
  });

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
    return () => cancelAnimationFrame(requestAnimationFrame(tick));
  };
  startSkillUiLoop();

  const accountName = localStorage.getItem(ACCOUNT_NAME_STORAGE_KEY);
  if (!accountName) {
    mountLoginScreen((name) => {
      localStorage.setItem(ACCOUNT_NAME_STORAGE_KEY, name);
      hideLoginScreen();
      void showCharacterSelect(name);
    });
    return;
  }

  await showCharacterSelect(accountName);
}

boot();
