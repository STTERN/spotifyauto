import { CONFIG } from './config.js';
import { storage } from './storage.js';
import { SpotifyAuth } from './spotifyAuth.js';
import { SpotifyClient } from './spotifyClient.js';

export class Watchdog {
  constructor() {
    this.timer = null;
    this.isRunning = false;
    this.consecutiveErrors = 0;
    this.lastTrackUri = null;
    this.currentTrackInfo = null;
    this.currentDeviceInfo = null;
    this.playlistMeta = null;
    this.status = 'INITIALIZING'; // 'IDLE' | 'STREAMING' | 'WAITING_FOR_DEVICE' | 'UNAUTHENTICATED' | 'ERROR'
    this.statusMessage = 'System starting up...';
    this.uptimeInterval = null;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[Watchdog] Engine started. Monitoring loop interval:', CONFIG.POLL_INTERVAL_MS, 'ms');

    // Run first loop immediately
    this.tick();

    // Loop interval
    this.timer = setInterval(() => this.tick(), CONFIG.POLL_INTERVAL_MS);

    // Second-by-second uptime updater for live clock
    this.uptimeInterval = setInterval(() => this.updateUptime(), 1000);
  }

  stop() {
    this.isRunning = false;
    if (this.timer) clearInterval(this.timer);
    if (this.uptimeInterval) clearInterval(this.uptimeInterval);
    console.log('[Watchdog] Engine stopped.');
  }

  updateUptime() {
    const settings = storage.getSettings();
    const stats = storage.getStats();

    if (settings.isEnabled) {
      if (!stats.sessionStartedAt) {
        stats.sessionStartedAt = Date.now();
      }
      stats.totalRuntimeSeconds = (stats.totalRuntimeSeconds || 0) + 1;
      stats.lastActiveAt = Date.now();
      // Persist every 10 seconds to reduce disk I/O
      if (stats.totalRuntimeSeconds % 10 === 0) {
        storage.save();
      }
    } else {
      if (stats.sessionStartedAt) {
        stats.sessionStartedAt = null;
        storage.save();
      }
    }
  }

  async tick() {
    const settings = storage.getSettings();

    // Check Authentication
    if (!SpotifyAuth.isAuthenticated()) {
      this.status = 'UNAUTHENTICATED';
      this.statusMessage = 'Please connect your Spotify account to begin.';
      this.currentTrackInfo = null;
      return;
    }

    // If disabled (OFF)
    if (!settings.isEnabled) {
      this.status = 'IDLE';
      this.statusMessage = 'Service is turned OFF. Turn ON to begin continuous playback.';
      // Try fetching current track passively so dashboard still looks nice if user plays manually
      await this.refreshCurrentTrackSilently();
      return;
    }

    // Service is ON
    try {
      await this.enforcePlayback(settings);
      this.consecutiveErrors = 0;
    } catch (err) {
      this.handleTickError(err);
    }
  }

  async refreshCurrentTrackSilently() {
    try {
      const state = await SpotifyClient.getPlaybackState();
      if (state && state.item) {
        this.cacheTrackInfo(state.item, state.is_playing, state.progress_ms);
        if (state.device) {
          this.currentDeviceInfo = {
            id: state.device.id,
            name: state.device.name,
            type: state.device.type,
            volumePercent: state.device.volume_percent
          };
        }
      }
    } catch (_) {
      // Ignore background errors when idle
    }
  }

  async enforcePlayback(settings) {
    const state = await SpotifyClient.getPlaybackState();

    if (state && state.is_playing) {
      // Currently playing
      this.status = 'STREAMING';
      this.statusMessage = `Playing on ${state.device?.name || 'device'}`;
      this.consecutiveErrors = 0;

      if (state.device) {
        this.currentDeviceInfo = {
          id: state.device.id,
          name: state.device.name,
          type: state.device.type,
          volumePercent: state.device.volume_percent
        };
      }

      if (state.item) {
        // Track song completions/changes
        if (this.lastTrackUri && this.lastTrackUri !== state.item.uri) {
          storage.incrementSongs();
          console.log(`[Watchdog] Song transitioned to: ${state.item.name} by ${state.item.artists?.[0]?.name}`);
        }
        this.lastTrackUri = state.item.uri;
        this.cacheTrackInfo(state.item, true, state.progress_ms);
      }

      // Ensure repeat mode is set to 'context' so playlist never stops
      if (state.repeat_state !== 'context') {
        try {
          await SpotifyClient.setRepeatMode('context', state.device?.id);
        } catch (_) {}
      }

      return;
    }

    // If state exists but is paused, resume it!
    if (state && !state.is_playing) {
      console.log('[Watchdog] Playback is paused. Resuming...');
      try {
        await SpotifyClient.startPlayback({
          contextUri: settings.playlistUri,
          deviceId: state.device?.id || settings.targetDeviceId
        });
        this.status = 'STREAMING';
        this.statusMessage = 'Resuming playback...';
        return;
      } catch (err) {
        console.warn('[Watchdog] Failed to resume on current device:', err.message);
      }
    }

    // If no active playback session, attempt to start on preferred or available device
    const devices = await SpotifyClient.getDevices();
    if (!devices || devices.length === 0) {
      this.status = 'WAITING_FOR_DEVICE';
      this.statusMessage = 'No active Spotify Connect device found. Open Spotify on any device or click "Play in Browser".';
      this.currentDeviceInfo = null;
      return;
    }

    // Find target device (either configured one or first available active/inactive device)
    let target = null;
    if (settings.targetDeviceId) {
      target = devices.find(d => d.id === settings.targetDeviceId);
    }
    if (!target) {
      target = devices.find(d => d.is_active) || devices[0];
    }

    if (target) {
      console.log(`[Watchdog] Triggering playback on device: ${target.name} (${target.id}) with playlist: ${settings.playlistUri}`);
      try {
        await SpotifyClient.startPlayback({
          contextUri: settings.playlistUri,
          deviceId: target.id
        });
        await SpotifyClient.setRepeatMode('context', target.id);
        this.status = 'STREAMING';
        this.statusMessage = `Started playback on ${target.name}`;
        this.currentDeviceInfo = {
          id: target.id,
          name: target.name,
          type: target.type
        };
      } catch (err) {
        console.warn('[Watchdog] Failed to trigger startPlayback on target device:', err.message);
        throw err;
      }
    }
  }

  cacheTrackInfo(item, isPlaying, progressMs = 0) {
    if (!item) return;
    this.currentTrackInfo = {
      title: item.name,
      artist: item.artists?.map(a => a.name).join(', ') || 'Unknown Artist',
      album: item.album?.name || '',
      artwork: item.album?.images?.[0]?.url || item.album?.images?.[1]?.url || null,
      durationMs: item.duration_ms || 0,
      progressMs: progressMs,
      uri: item.uri,
      isPlaying: isPlaying
    };
  }

  handleTickError(err) {
    this.consecutiveErrors++;
    const errMsg = err?.message || String(err);
    console.warn(`[Watchdog] Error during tick (#${this.consecutiveErrors}):`, errMsg);

    storage.recordError(errMsg);

    if (errMsg.includes('NO_ACTIVE_DEVICE') || err.status === 404) {
      this.status = 'WAITING_FOR_DEVICE';
      this.statusMessage = 'Spotify device is asleep or offline. Open Spotify on your phone/speaker or use Web Player.';
      return;
    }

    if (err.status === 403) {
      this.status = 'ERROR';
      this.statusMessage = 'Spotify Premium is required to control playback via the Web API.';
      return;
    }

    this.status = 'ERROR';
    this.statusMessage = `Temporary Spotify connection issue (${errMsg}). Auto-retrying...`;
  }

  async toggle(enabled) {
    const current = storage.getSettings();
    const isEnabled = typeof enabled === 'boolean' ? enabled : !current.isEnabled;
    storage.updateSettings({ isEnabled });

    if (!isEnabled) {
      // User turned service OFF -> pause playback
      this.status = 'IDLE';
      this.statusMessage = 'Service turned OFF.';
      try {
        await SpotifyClient.pausePlayback({ deviceId: current.targetDeviceId });
      } catch (_) {}
    } else {
      // User turned service ON -> trigger tick immediately
      this.status = 'STREAMING';
      this.statusMessage = 'Starting continuous playback...';
      this.tick();
    }

    return isEnabled;
  }

  async setPlaylist(playlistInput) {
    const normalized = SpotifyClient.normalizePlaylistUri(playlistInput);
    if (!normalized) {
      throw new Error('Invalid playlist URL or URI. Example: https://open.spotify.com/playlist/...');
    }

    storage.updateSettings({ playlistUri: normalized });

    // Preload playlist metadata
    try {
      const meta = await SpotifyClient.getPlaylist(normalized);
      if (meta) {
        this.playlistMeta = {
          id: meta.id,
          name: meta.name,
          description: meta.description,
          artwork: meta.images?.[0]?.url || null,
          totalTracks: meta.tracks?.total || 0
        };
      }
    } catch (_) {}

    // If currently ON, switch playback to new playlist
    const settings = storage.getSettings();
    if (settings.isEnabled) {
      try {
        await SpotifyClient.startPlayback({
          contextUri: normalized,
          deviceId: settings.targetDeviceId || this.currentDeviceInfo?.id
        });
      } catch (_) {}
    }

    return { playlistUri: normalized, meta: this.playlistMeta };
  }

  async setTargetDevice(deviceId, deviceName = null) {
    storage.updateSettings({ targetDeviceId: deviceId, deviceName });
    const settings = storage.getSettings();
    if (settings.isEnabled && deviceId) {
      try {
        await SpotifyClient.transferPlayback(deviceId, true);
      } catch (_) {}
    }
  }

  getSnapshot() {
    const settings = storage.getSettings();
    const stats = storage.getStats();
    const tokens = storage.getTokens();

    const totalSeconds = stats.totalRuntimeSeconds || 0;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const uptimeFormatted = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    return {
      status: this.status,
      statusMessage: this.statusMessage,
      isEnabled: settings.isEnabled,
      playlistUri: settings.playlistUri,
      playlistMeta: this.playlistMeta,
      currentTrack: this.currentTrackInfo,
      device: this.currentDeviceInfo,
      targetDeviceId: settings.targetDeviceId,
      stats: {
        totalRuntimeSeconds: totalSeconds,
        uptimeFormatted: uptimeFormatted,
        totalMinutesStreamed: Math.round(totalSeconds / 60),
        songsPlayed: stats.songsPlayed || 0,
        errorsCount: stats.errorsCount || 0,
        lastError: stats.lastError
      },
      auth: {
        isAuthenticated: SpotifyAuth.isAuthenticated(),
        hasCredentials: Boolean(CONFIG.SPOTIFY_CLIENT_ID && CONFIG.SPOTIFY_CLIENT_SECRET)
      }
    };
  }
}

export const watchdog = new Watchdog();
