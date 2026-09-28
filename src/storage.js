import fs from 'fs';
import path from 'path';
import { CONFIG } from './config.js';

const DEFAULT_STATE = {
  tokens: {
    accessToken: null,
    refreshToken: null,
    expiresAt: null
  },
  settings: {
    isEnabled: false,
    playlistUri: 'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M', // Default: Today's Top Hits or user's custom
    targetDeviceId: null,
    deviceName: null,
    autoResume: true
  },
  stats: {
    serviceStartedAt: Date.now(),
    sessionStartedAt: null,
    totalRuntimeSeconds: 0,
    songsPlayed: 0,
    errorsCount: 0,
    lastError: null,
    lastActiveAt: Date.now()
  }
};

class Storage {
  constructor() {
    this.state = { ...DEFAULT_STATE };
    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(CONFIG.DATA_DIR)) {
        fs.mkdirSync(CONFIG.DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(CONFIG.STATE_FILE)) {
        const raw = fs.readFileSync(CONFIG.STATE_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        this.state = {
          tokens: { ...DEFAULT_STATE.tokens, ...(parsed.tokens || {}) },
          settings: { ...DEFAULT_STATE.settings, ...(parsed.settings || {}) },
          stats: { ...DEFAULT_STATE.stats, ...(parsed.stats || {}) }
        };
      } else {
        this.save();
      }
    } catch (err) {
      console.warn('[Storage] Error loading state file, resetting to defaults:', err.message);
      this.state = { ...DEFAULT_STATE };
      this.save();
    }
  }

  save() {
    try {
      if (!fs.existsSync(CONFIG.DATA_DIR)) {
        fs.mkdirSync(CONFIG.DATA_DIR, { recursive: true });
      }
      const tempPath = `${CONFIG.STATE_FILE}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.state, null, 2), 'utf8');
      fs.renameSync(tempPath, CONFIG.STATE_FILE);
    } catch (err) {
      console.error('[Storage] Error writing state file:', err.message);
    }
  }

  getTokens() {
    return this.state.tokens;
  }

  setTokens(tokens) {
    this.state.tokens = { ...this.state.tokens, ...tokens };
    this.save();
  }

  clearTokens() {
    this.state.tokens = { accessToken: null, refreshToken: null, expiresAt: null };
    this.save();
  }

  getSettings() {
    return this.state.settings;
  }

  updateSettings(partial) {
    this.state.settings = { ...this.state.settings, ...partial };
    this.save();
    return this.state.settings;
  }

  getStats() {
    return this.state.stats;
  }

  updateStats(partial) {
    this.state.stats = { ...this.state.stats, ...partial };
    this.save();
    return this.state.stats;
  }

  incrementSongs() {
    this.state.stats.songsPlayed = (this.state.stats.songsPlayed || 0) + 1;
    this.save();
  }

  recordError(errorMsg) {
    this.state.stats.errorsCount = (this.state.stats.errorsCount || 0) + 1;
    this.state.stats.lastError = {
      message: errorMsg,
      timestamp: new Date().toISOString()
    };
    this.save();
  }
}

export const storage = new Storage();
