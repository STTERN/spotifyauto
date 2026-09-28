import { CONFIG } from './config.js';
import { storage } from './storage.js';

export class SpotifyAuth {
  static getAuthUrl(state = '') {
    if (!CONFIG.SPOTIFY_CLIENT_ID) {
      throw new Error('SPOTIFY_CLIENT_ID is not configured in .env');
    }
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: CONFIG.SPOTIFY_CLIENT_ID,
      scope: CONFIG.SCOPES,
      redirect_uri: CONFIG.REDIRECT_URI,
      show_dialog: 'true',
      state: state || Math.random().toString(36).substring(7)
    });
    return `${CONFIG.SPOTIFY_AUTH_URL}?${params.toString()}`;
  }

  static async exchangeCodeForToken(code) {
    if (!CONFIG.SPOTIFY_CLIENT_ID || !CONFIG.SPOTIFY_CLIENT_SECRET) {
      throw new Error('Spotify Client ID or Secret missing in .env');
    }

    const authHeader = Buffer.from(
      `${CONFIG.SPOTIFY_CLIENT_ID}:${CONFIG.SPOTIFY_CLIENT_SECRET}`
    ).toString('base64');

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: CONFIG.REDIRECT_URI
    });

    const res = await fetch(CONFIG.SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${authHeader}`
      },
      body: params.toString()
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Token exchange failed (${res.status}): ${errBody}`);
    }

    const data = await res.json();
    const expiresAt = Date.now() + (data.expires_in * 1000);

    storage.setTokens({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: expiresAt
    });

    console.log('[SpotifyAuth] Successfully acquired and persisted OAuth tokens');
    return storage.getTokens();
  }

  static async refreshAccessToken(retries = 3) {
    const tokens = storage.getTokens();
    if (!tokens.refreshToken) {
      throw new Error('No refresh_token found. Please authorize with Spotify first.');
    }

    const authHeader = Buffer.from(
      `${CONFIG.SPOTIFY_CLIENT_ID}:${CONFIG.SPOTIFY_CLIENT_SECRET}`
    ).toString('base64');

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken
    });

    let attempt = 0;
    while (attempt < retries) {
      try {
        const res = await fetch(CONFIG.SPOTIFY_TOKEN_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${authHeader}`
          },
          body: params.toString()
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Token refresh HTTP ${res.status}: ${errText}`);
        }

        const data = await res.json();
        const expiresAt = Date.now() + (data.expires_in * 1000);

        const updated = {
          accessToken: data.access_token,
          expiresAt: expiresAt
        };
        // Spotify may occasionally return a new refresh token
        if (data.refresh_token) {
          updated.refreshToken = data.refresh_token;
        }

        storage.setTokens(updated);
        console.log('[SpotifyAuth] Proactively refreshed access token. Valid until:', new Date(expiresAt).toLocaleTimeString());
        return data.access_token;
      } catch (err) {
        attempt++;
        console.warn(`[SpotifyAuth] Token refresh attempt ${attempt}/${retries} failed:`, err.message);
        if (attempt >= retries) {
          storage.recordError(`Token refresh failed after ${retries} attempts: ${err.message}`);
          throw err;
        }
        // Exponential backoff wait (1s, 2s, 4s)
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
  }

  static async getValidAccessToken() {
    const tokens = storage.getTokens();
    if (!tokens.accessToken || !tokens.refreshToken) {
      return null;
    }

    // Refresh if within 5-minute buffer before expiry or already expired
    const isExpiringSoon = !tokens.expiresAt || (tokens.expiresAt - Date.now() < CONFIG.TOKEN_REFRESH_BUFFER_MS);
    if (isExpiringSoon) {
      return await this.refreshAccessToken();
    }

    return tokens.accessToken;
  }

  static isAuthenticated() {
    const tokens = storage.getTokens();
    return Boolean(tokens.refreshToken);
  }
}
