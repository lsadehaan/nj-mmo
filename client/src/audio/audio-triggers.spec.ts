import { describe, it, expect } from 'vitest';
import {
  FOOTSTEP_MIN_DISTANCE_M,
  FOOTSTEP_MIN_INTERVAL_MS,
  shouldPlayFootstep,
} from './audio-triggers';

describe('audio-triggers footstep helper', () => {
  it('AUD29-40: plays when distance and zone qualify', () => {
    expect(shouldPlayFootstep(FOOTSTEP_MIN_DISTANCE_M, FOOTSTEP_MIN_INTERVAL_MS, 'peace')).toBe(
      true
    );
  });

  it('AUD29-41: rejects second step inside throttle window', () => {
    expect(shouldPlayFootstep(FOOTSTEP_MIN_DISTANCE_M, FOOTSTEP_MIN_INTERVAL_MS - 1, 'peace')).toBe(
      false
    );
  });

  it('rejects water zone footsteps', () => {
    expect(shouldPlayFootstep(FOOTSTEP_MIN_DISTANCE_M, FOOTSTEP_MIN_INTERVAL_MS, 'water')).toBe(
      false
    );
  });
});
