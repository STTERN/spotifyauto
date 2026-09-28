import { CONFIG } from './config.js';
import { SpotifyAuth } from './spotifyAuth.js';
import { storage } from './storage.js';

export class SpotifyClient {
  /**
   * Helper to perform authenticated requests to Spotify Web API
   * with automatic 401 token refresh retry and 429 rate limit backoff.
   */
  static async request(endpoint, options = {}, retryOn401 = true) {
    const token = await SpotifyAuth.getValidAccessToken();
    if (!token) {
      throw new Error('Not authenticated with Spotify');
    }

    const url = endpoint.startsWith('http') ? endpoint : `${CONFIG.SPOTIFY_API_BASE}${endpoint}`;
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    let res = await fetch(url, { ...options, headers });

    // Handle Rate Limit (429)
    if (res.status === 429) {
      const retryAfterSec = parseInt(res.headers.get('Retry-After') || '5', 10);
      console.warn(`[SpotifyClient] Rate limited (429). Retrying after ${retryAfterSec}s...`);
      await new Promise(r => setTimeout(r, retryAfterSec * 1000));
      return this.request(endpoint, options, retryOn401);
    }

    // Handle Expired Token (401)
    if (res.status === 401 && retryOn401) {
      console.warn('[SpotifyClient] Received 401 Unauthorized. Refreshing token...');
      await SpotifyAuth.refreshAccessToken();
      return this.request(endpoint, options, false);
    }

    // 204 No Content (common in player endpoints like play, pause, transfer)
    if (res.status === 204) {
      return null;
    }

    if (!res.ok) {
      const text = await res.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch (_) { parsed = { error: { message: text } }; }
      const err = new Error(parsed?.error?.message || `Spotify API Error (${res.status})`);
      err.status = res.status;
      err.data = parsed;
      throw err;
    }

    return await res.json();
  }

  /**
   * Parse various playlist URL/URI formats into spotify:playlist:ID
   */
  static normalizePlaylistUri(input) {
    if (!input || typeof input !== 'string') return null;
    const trimmed = input.trim();

    if (trimmed.startsWith('spotify:playlist:')) {
      return trimmed;
    }

    const urlMatch = trimmed.match(/playlist\/([a-zA-Z0-9]+)/);
    if (urlMatch && urlMatch[1]) {
      return `spotify:playlist:${urlMatch[1]}`;
    }

    // If bare ID
    if (/^[a-zA-Z0-9]{22}$/.test(trimmed)) {
      return `spotify:playlist:${trimmed}`;
    }

    return trimmed;
  }

  /**
   * Fetch current playback state (now playing, progress, device)
   */
  static async getPlaybackState() {
    try {
      return await this.request('/me/player');
    } catch (err) {
      // 204 or empty is null
      return null;
    }
  }

  /**
   * Fetch list of available Spotify Connect devices
   */
  static async getDevices() {
    try {
      const data = await this.request('/me/player/devices');
      return data?.devices || [];
    } catch (err) {
      console.warn('[SpotifyClient] Failed to fetch devices:', err.message);
      return [];
    }
  }

  /**
   * Start or resume playback of a playlist context
   */
  static async startPlayback({ contextUri, deviceId } = {}) {
    const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
    const body = {};

    if (contextUri) {
      body.context_uri = this.normalizePlaylistUri(contextUri);
    }

    return await this.request(`/me/player/play${query}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  }

  /**
   * Pause current playback
   */
  static async pausePlayback({ deviceId } = {}) {
    const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
    return await this.request(`/me/player/pause${query}`, {
      method: 'PUT'
    });
  }

  /**
   * Skip to next track
   */
  static async nextTrack({ deviceId } = {}) {
    const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
    return await this.request(`/me/player/next${query}`, {
      method: 'POST'
    });
  }

  /**
   * Set repeat mode to 'context' so playlist repeats indefinitely
   */
  static async setRepeatMode(state = 'context', deviceId = null) {
    const params = new URLSearchParams({ state });
    if (deviceId) params.append('device_id', deviceId);
    return await this.request(`/me/player/repeat?${params.toString()}`, {
      method: 'PUT'
    });
  }

  /**
   * Transfer playback to a specific device
   */
  static async transferPlayback(deviceId, play = true) {
    return await this.request('/me/player', {
      method: 'PUT',
      body: JSON.stringify({
        device_ids: [deviceId],
        play: play
      })
    });
  }

  /**
   * Fetch playlist metadata (name, image, track count)
   */
  static async getPlaylist(playlistUri) {
    const normalized = this.normalizePlaylistUri(playlistUri);
    if (!normalized) return null;
    const playlistId = normalized.replace('spotify:playlist:', '');
    try {
      return await this.request(`/playlists/${playlistId}?fields=id,name,description,images,tracks.total`);
    } catch (err) {
      return null;
    }
  }

  /**
   * Fetch user profile
   */
  static async getCurrentUser() {
    try {
      return await this.request('/me');
    } catch (err) {
      return null;
    }
  }
}
