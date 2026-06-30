import type { Request, Response } from 'express';
import { getDb } from './client';
import { listCharactersByAccount } from './character-repository';

const DEFAULT_DB_PATH = process.env['NJ_DB_PATH'] ?? 'data/game.db';

export function handleListCharacters(req: Request, res: Response): void {
  const accountName = typeof req.query['accountName'] === 'string' ? req.query['accountName'] : '';
  if (!accountName.trim()) {
    res.status(400).json({ error: 'accountName required' });
    return;
  }
  const db = getDb(DEFAULT_DB_PATH);
  const rows = listCharactersByAccount(db, accountName);
  res.status(200).json(rows);
}
