import config from '@colyseus/tools';
import type { Request, Response } from 'express';
import { TownRoom } from './rooms/TownRoom';

export default config({
  options: {
    devMode: true,
  },
  initializeGameServer: (gameServer) => {
    // `instanceKey` lets clients opt into an isolated room instance (used by e2e
    // tests for per-test isolation). Production clients pass no key and therefore
    // all share the single default `town` world.
    gameServer.define('town', TownRoom).filterBy(['instanceKey']);
  },
  initializeExpress: (app) => {
    app.get('/health', (_req: Request, res: Response) => {
      res.status(200).send('ok');
    });
  },
});
