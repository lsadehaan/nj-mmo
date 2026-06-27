import config from '@colyseus/tools';
import type { Request, Response } from 'express';

export default config({
  options: {
    devMode: true,
  },
  initializeGameServer: (_gameServer) => {
    // TownRoom registered in T5.
  },
  initializeExpress: (app) => {
    app.get('/health', (_req: Request, res: Response) => {
      res.status(200).send('ok');
    });
  },
});
