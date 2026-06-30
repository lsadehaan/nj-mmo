import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createNameplate } from './nameplate';

describe('createNameplate', () => {
  it('creates a camera-facing sprite positioned above the head', () => {
    const plate = createNameplate('Hero');
    expect(plate.sprite).toBeInstanceOf(THREE.Sprite);
    expect(plate.sprite.name).toBe('nameplate');
    expect(plate.sprite.position.y).toBeGreaterThan(1.5);
    // Wider than tall so the label reads horizontally.
    expect(plate.sprite.scale.x).toBeGreaterThan(plate.sprite.scale.y);
  });

  it('renders above other geometry (no depth clipping by the body mesh)', () => {
    const plate = createNameplate('Hero');
    const material = plate.sprite.material as THREE.SpriteMaterial;
    expect(material.depthTest).toBe(false);
    expect(material.transparent).toBe(true);
  });

  it('setText and dispose do not throw', () => {
    const plate = createNameplate('Hero');
    expect(() => plate.setText('A Much Longer Name')).not.toThrow();
    expect(() => plate.dispose()).not.toThrow();
  });
});
