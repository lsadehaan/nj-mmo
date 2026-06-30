import { boot, type ColyseusTestServer } from '@colyseus/testing';
import app from '../app.config';

let server: ColyseusTestServer | undefined;
let bootPromise: Promise<ColyseusTestServer> | undefined;
let refCount = 0;

/** Single Colyseus boot shared across TownRoom integration spec files (AD-014). */
export async function acquireTownRoomTestServer(): Promise<ColyseusTestServer> {
  refCount += 1;
  if (server) return server;
  if (!bootPromise) {
    bootPromise = boot(app).then((s) => {
      server = s;
      return s;
    });
  }
  return bootPromise;
}

export async function releaseTownRoomTestServer(): Promise<void> {
  refCount = Math.max(0, refCount - 1);
  if (refCount === 0 && server) {
    await server.shutdown();
    server = undefined;
    bootPromise = undefined;
  }
}
