import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CONFIG = {
  PORT: process.env.PORT || 3000,
  SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID || '',
  SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET || '',
  REDIRECT_URI: process.env.REDIRECT_URI || 'http://localhost:3000/auth/callback',
  SPOTIFY_AUTH_URL: 'https://accounts.spotify.com/authorize',
  SPOTIFY_TOKEN_URL: 'https://accounts.spotify.com/api/token',
  SPOTIFY_API_BASE: 'https://api.spotify.com/v1',
  SCOPES: [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'streaming',
    'playlist-read-private',
    'playlist-read-collaborative',
    'user-read-email',
    'user-read-private'
  ].join(' '),
  DATA_DIR: path.join(__dirname, '..', 'data'),
  STATE_FILE: path.join(__dirname, '..', 'data', 'state.json'),
  // Watchdog check interval: 15 seconds to be safe from rate-limits (429)
  POLL_INTERVAL_MS: 15000,
  // Minimum buffer before token expiry to trigger proactive refresh (5 minutes)
  TOKEN_REFRESH_BUFFER_MS: 5 * 60 * 1000
};
