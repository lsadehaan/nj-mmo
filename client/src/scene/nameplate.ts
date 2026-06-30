import * as THREE from 'three';

/**
 * A floating name label that hovers above a character's head. Implemented as a
 * {@link THREE.Sprite} so it always faces the camera, with the text rendered to
 * a canvas texture. Used for both the local player and remote players.
 */
export interface Nameplate {
  sprite: THREE.Sprite;
  setText: (text: string) => void;
  dispose: () => void;
}

const CANVAS_W = 256;
const CANVAS_H = 64;
/** Sprite height in world units; width is derived from the canvas aspect. */
const WORLD_HEIGHT = 0.5;
const DEFAULT_Y = 2.1;

export interface NameplateOptions {
  /** Local-space height above the avatar group origin. */
  y?: number;
  /** Text fill color. */
  color?: string;
}

export function createNameplate(text: string, options: NameplateOptions = {}): Nameplate {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    // Draw on top of avatars so the label is never clipped by the body mesh.
    depthTest: false,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(material);
  sprite.name = 'nameplate';
  sprite.position.y = options.y ?? DEFAULT_Y;
  sprite.renderOrder = 10;
  const aspect = CANVAS_W / CANVAS_H;
  sprite.scale.set(WORLD_HEIGHT * aspect, WORLD_HEIGHT, 1);

  const draw = (value: string): void => {
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Dark outline keeps the name legible over any terrain/sky color.
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(value, CANVAS_W / 2, CANVAS_H / 2);
    ctx.fillStyle = options.color ?? '#ffffff';
    ctx.fillText(value, CANVAS_W / 2, CANVAS_H / 2);
    texture.needsUpdate = true;
  };

  draw(text);

  return {
    sprite,
    setText: (value: string) => draw(value),
    dispose: () => {
      texture.dispose();
      material.dispose();
    },
  };
}
