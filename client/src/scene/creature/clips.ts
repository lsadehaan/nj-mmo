import * as THREE from 'three';
import type { AnimationClip } from '@nj/game-core';
import type { Rig } from './rig-contract';

function resetPose(rig: Rig): void {
  for (const socket of Object.values(rig.sockets)) {
    socket.rotation.set(0, 0, 0);
    socket.position.y = socket.userData.baseY ?? socket.position.y;
  }
}

function rememberBaseY(rig: Rig): void {
  for (const socket of Object.values(rig.sockets)) {
    socket.userData.baseY = socket.position.y;
  }
}

function applyIdle(rig: Rig, phase: number): void {
  const bob = Math.sin(phase * Math.PI * 2) * 0.02;
  rig.sockets.spine.position.y = (rig.sockets.spine.userData.baseY as number) + bob;
  rig.sockets.head.rotation.x = Math.sin(phase * Math.PI * 2) * 0.05;
}

function applyMove(rig: Rig, phase: number): void {
  const swing = Math.sin(phase * Math.PI * 2) * 0.55;
  rig.sockets.handL.rotation.x = swing;
  rig.sockets.handR.rotation.x = -swing;
  rig.sockets.footL.rotation.x = -swing * 0.7;
  rig.sockets.footR.rotation.x = swing * 0.7;
  rig.sockets.spine.rotation.y = Math.sin(phase * Math.PI * 2) * 0.08;
}

function applyAttack(rig: Rig, phase: number): void {
  const arc = Math.sin(phase * Math.PI);
  rig.sockets.handR.rotation.x = -arc * 1.4;
  rig.sockets.handR.rotation.z = arc * 0.4;
  rig.sockets.spine.rotation.y = arc * 0.25;
}

function applyCast(rig: Rig, phase: number): void {
  const raise = Math.sin(phase * Math.PI);
  rig.sockets.handR.rotation.x = -raise * 1.2;
  rig.sockets.handL.rotation.x = raise * 0.4;
  rig.sockets.head.rotation.x = -raise * 0.15;
}

function applyDie(rig: Rig, phase: number): void {
  const fall = phase * 1.2;
  rig.sockets.root.rotation.x = fall;
  rig.sockets.spine.rotation.z = phase * 0.2;
}

export function applyClip(rig: Rig, clip: AnimationClip, phase: number): void {
  rememberBaseY(rig);
  resetPose(rig);
  switch (clip) {
    case 'idle':
      applyIdle(rig, phase);
      break;
    case 'move':
      applyMove(rig, phase);
      break;
    case 'attack':
      applyAttack(rig, phase);
      break;
    case 'cast':
      applyCast(rig, phase);
      break;
    case 'die':
      applyDie(rig, phase);
      break;
  }
}

export function captureSocketRotations(rig: Rig): Record<string, THREE.Euler> {
  const out: Record<string, THREE.Euler> = {};
  for (const [name, socket] of Object.entries(rig.sockets)) {
    out[name] = socket.rotation.clone();
  }
  return out;
}
