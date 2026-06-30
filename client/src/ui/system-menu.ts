import type { AudioSettings } from '../audio/audio-settings';

export interface SystemMenuHandlers {
  onInventory?: () => void;
  onSkills?: () => void;
  onQuestLog?: () => void;
  onWorldMap?: () => void;
  onLogout?: () => void;
  onAudioSettingsChange?: (settings: AudioSettings) => void;
  onUiClick?: () => void;
  initialAudioSettings?: AudioSettings;
}

export function mountSystemMenu(handlers: SystemMenuHandlers): HTMLElement {
  const existing = document.getElementById('system-menu');
  if (existing) return existing;

  const settings: AudioSettings = {
    musicVolume: handlers.initialAudioSettings?.musicVolume ?? 0.7,
    sfxVolume: handlers.initialAudioSettings?.sfxVolume ?? 0.8,
    muted: handlers.initialAudioSettings?.muted ?? false,
  };

  const menu = document.createElement('div');
  menu.id = 'system-menu';
  menu.hidden = true;
  menu.style.cssText =
    'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);padding:16px;background:rgba(0,0,0,0.85);color:#fff;border:1px solid #666;border-radius:8px;z-index:100;pointer-events:auto';

  const audioSection = document.createElement('div');
  audioSection.dataset['role'] = 'audio-settings';

  const musicLabel = document.createElement('label');
  musicLabel.textContent = 'Music';
  const musicSlider = document.createElement('input');
  musicSlider.type = 'range';
  musicSlider.min = '0';
  musicSlider.max = '100';
  musicSlider.dataset['role'] = 'music-volume';
  musicSlider.value = String(Math.round(settings.musicVolume * 100));
  musicSlider.addEventListener('input', () => {
    settings.musicVolume = Number(musicSlider.value) / 100;
    handlers.onAudioSettingsChange?.({ ...settings });
  });
  musicLabel.appendChild(musicSlider);
  audioSection.appendChild(musicLabel);

  const sfxLabel = document.createElement('label');
  sfxLabel.textContent = 'SFX';
  const sfxSlider = document.createElement('input');
  sfxSlider.type = 'range';
  sfxSlider.min = '0';
  sfxSlider.max = '100';
  sfxSlider.dataset['role'] = 'sfx-volume';
  sfxSlider.value = String(Math.round(settings.sfxVolume * 100));
  sfxSlider.addEventListener('input', () => {
    settings.sfxVolume = Number(sfxSlider.value) / 100;
    handlers.onAudioSettingsChange?.({ ...settings });
  });
  sfxLabel.appendChild(sfxSlider);
  audioSection.appendChild(sfxLabel);

  const muteLabel = document.createElement('label');
  const muteCheckbox = document.createElement('input');
  muteCheckbox.type = 'checkbox';
  muteCheckbox.dataset['role'] = 'audio-mute';
  muteCheckbox.checked = settings.muted;
  muteCheckbox.addEventListener('change', () => {
    settings.muted = muteCheckbox.checked;
    handlers.onAudioSettingsChange?.({ ...settings });
  });
  muteLabel.appendChild(muteCheckbox);
  muteLabel.append(' Mute');
  audioSection.appendChild(muteLabel);
  menu.appendChild(audioSection);

  const actions: { action: string; label: string; fn?: () => void }[] = [
    { action: 'inventory', label: 'Inventory', fn: handlers.onInventory },
    { action: 'skills', label: 'Skills', fn: handlers.onSkills },
    { action: 'quest-log', label: 'Quest Log', fn: handlers.onQuestLog },
    { action: 'world-map', label: 'World Map', fn: handlers.onWorldMap },
    { action: 'logout', label: 'Logout', fn: handlers.onLogout },
  ];

  for (const { action, label, fn } of actions) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset['action'] = action;
    btn.textContent = label;
    btn.style.display = 'block';
    btn.style.margin = '6px 0';
    btn.addEventListener('click', () => {
      handlers.onUiClick?.();
      fn?.();
    });
    menu.appendChild(btn);
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.dataset['role'] = 'panel-close';
  close.textContent = 'Close';
  close.addEventListener('click', () => {
    menu.hidden = true;
  });
  menu.appendChild(close);

  document.body.appendChild(menu);
  return menu;
}
