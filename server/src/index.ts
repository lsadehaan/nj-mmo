import { Encoder } from '@colyseus/schema';
import { listen } from '@colyseus/tools';
import app from './app.config';

// Expanded TI room state (600+ mob spawns) exceeds the default 8 KB schema buffer.
Encoder.BUFFER_SIZE = 128 * 1024;

listen(app);
