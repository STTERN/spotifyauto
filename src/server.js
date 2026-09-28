import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG } from './config.js';
import { storage } from './storage.js';
import { SpotifyAuth } from './spotifyAuth.js';
import { SpotifyClient } from './spotifyClient.js';
import { watchdog } from './watchdog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// CORS headers for local/cross-origin development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// --- Auth Routes ---
app.get('/auth/login', (req, res) => {
  try {
    const authUrl = SpotifyAuth.getAuthUrl();
    res.redirect(authUrl);
  } catch (err) {
    res.status(500).send(`Configuration Error: ${err.message}. Please configure your .env file.`);
  }
});

app.get('/auth/callback', async (req, res) => {
  const code = req.query.code;
  const error = req.query.error;

  if (error) {
    return res.redirect(`/?auth_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.redirect('/?auth_error=no_code_provided');
  }

  try {
    await SpotifyAuth.exchangeCodeForToken(code);
    // Trigger immediate watchdog tick after successful auth
    watchdog.tick();
    res.redirect('/?auth_success=true');
  } catch (err) {
    console.error('[Server] OAuth callback failed:', err.message);
    res.redirect(`/?auth_error=${encodeURIComponent(err.message)}`);
  }
});

app.post('/auth/logout', (req, res) => {
  storage.clearTokens();
  watchdog.status = 'UNAUTHENTICATED';
  watchdog.statusMessage = 'Logged out from Spotify.';
  res.json({ success: true });
});

// Endpoint for frontend Spotify Web Playback SDK to get active token
app.get('/auth/token', async (req, res) => {
  try {
    const token = await SpotifyAuth.getValidAccessToken();
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    res.json({ accessToken: token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Dashboard & Control API Routes ---

// Status snapshot: current track, runtime, status, playlist, stats
app.get('/api/status', (req, res) => {
  res.json(watchdog.getSnapshot());
});

// Toggle ON / OFF
app.post('/api/toggle', async (req, res) => {
  try {
    const { enabled } = req.body;
    const isNowEnabled = await watchdog.toggle(enabled);
    res.json({
      success: true,
      isEnabled: isNowEnabled,
      snapshot: watchdog.getSnapshot()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get available Spotify Connect devices
app.get('/api/devices', async (req, res) => {
  try {
    const devices = await SpotifyClient.getDevices();
    res.json({ devices });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Select target device
app.post('/api/device', async (req, res) => {
  try {
    const { deviceId, deviceName } = req.body;
    await watchdog.setTargetDevice(deviceId, deviceName);
    res.json({ success: true, targetDeviceId: deviceId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Set playlist URI or URL
app.post('/api/playlist', async (req, res) => {
  try {
    const { playlist } = req.body;
    const result = await watchdog.setPlaylist(playlist);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Next track
app.post('/api/next', async (req, res) => {
  try {
    const settings = storage.getSettings();
    await SpotifyClient.nextTrack({ deviceId: settings.targetDeviceId });
    setTimeout(() => watchdog.tick(), 800);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Keepalive / Healthcheck route for cloud hosts (e.g., Render, Railway, UptimeRobot)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    serviceUptime: storage.getStats().totalRuntimeSeconds
  });
});

// Only auto-listen if run directly (node src/server.js)
let server = null;
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  server = app.listen(CONFIG.PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🎵 Spotify Continuous Playback Service running!`);
    console.log(`📡 URL: http://localhost:${CONFIG.PORT}`);
    console.log(`⚙️  Data storage: ${CONFIG.STATE_FILE}`);
    console.log(`======================================================\n`);
    watchdog.start();
  });
}

export { app, server };

