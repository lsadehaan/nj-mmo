export interface GameStatePlayer {
  x: number;
  y: number;
  z: number;
}

export interface GameState {
  connected: boolean;
  ready: boolean;
  player: GameStatePlayer;
  target: { x: number | null; z: number | null };
}

declare global {
  interface Window {
    __GAME_STATE__: GameState;
    __handleGroundClick__?: (clientX: number, clientY: number) => void;
  }
}

const initialState: GameState = {
  connected: false,
  ready: false,
  player: { x: 0, y: 0, z: 0 },
  target: { x: null, z: null },
};

export function initGameState(): GameState {
  window.__GAME_STATE__ = {
    ...initialState,
    player: { ...initialState.player },
    target: { ...initialState.target },
  };
  return window.__GAME_STATE__;
}

export function getGameState(): GameState {
  if (!window.__GAME_STATE__) {
    return initGameState();
  }
  return window.__GAME_STATE__;
}

export function setConnected(connected: boolean): void {
  getGameState().connected = connected;
}

export function setReady(ready: boolean): void {
  getGameState().ready = ready;
}

export function setTarget(x: number | null, z: number | null): void {
  const state = getGameState();
  state.target.x = x;
  state.target.z = z;
}

export function setPlayer(player: GameStatePlayer): void {
  const state = getGameState();
  state.player.x = player.x;
  state.player.y = player.y;
  state.player.z = player.z;
}
