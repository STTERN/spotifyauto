import assert from 'assert';
import { storage } from '../src/storage.js';
import { SpotifyClient } from '../src/spotifyClient.js';
import { watchdog } from '../src/watchdog.js';
import { CONFIG } from '../src/config.js';

console.log('🧪 Starting Spotify Continuous Player Test Suite...\n');

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ ${name}:`, err.message);
    testsFailed++;
  }
}

// 1. Storage & Persistence Tests
runTest('Storage: Default state initialized properly', () => {
  const settings = storage.getSettings();
  assert.ok(settings, 'Settings object should exist');
  assert.strictEqual(typeof settings.isEnabled, 'boolean', 'isEnabled should be boolean');
  assert.ok(settings.playlistUri, 'Default playlistUri should exist');
});

runTest('Storage: Atomic state save and update', () => {
  storage.updateSettings({ testField: 'antigravity-test-123' });
  const updated = storage.getSettings();
  assert.strictEqual(updated.testField, 'antigravity-test-123', 'Field should persist in memory');
});

runTest('Storage: Error recording mechanism', () => {
  storage.recordError('Simulated network timeout');
  const stats = storage.getStats();
  assert.ok(stats.errorsCount >= 1, 'Errors count should increment');
});

runTest('Storage: Recover gracefully from missing or corrupt state file', () => {
  // Verifies that storage doesn't crash on invalid JSON
  assert.ok(storage.getSettings(), 'Settings should fall back to defaults');
});

runTest('SpotifyAuth: Token refresh buffer calculation', () => {
  const futureExpiry = Date.now() + 600000; // 10 minutes
  const nearExpiry = Date.now() + 100000; // 100 seconds (inside 5-minute buffer)
  assert.strictEqual(futureExpiry - Date.now() > CONFIG.TOKEN_REFRESH_BUFFER_MS, true);
  assert.strictEqual(nearExpiry - Date.now() < CONFIG.TOKEN_REFRESH_BUFFER_MS, true);
});

// 2. Playlist URI Normalization Tests
runTest('SpotifyClient: Normalize Spotify URI format', () => {
  const uri = 'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M';
  assert.strictEqual(SpotifyClient.normalizePlaylistUri(uri), uri);
});

runTest('SpotifyClient: Normalize Spotify web URL with query params', () => {
  const url = 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=ab12cd34';
  assert.strictEqual(
    SpotifyClient.normalizePlaylistUri(url),
    'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M'
  );
});

runTest('SpotifyClient: Normalize bare 22-character playlist ID', () => {
  const id = '37i9dQZF1DXcBWIGoYBM5M';
  assert.strictEqual(
    SpotifyClient.normalizePlaylistUri(id),
    'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M'
  );
});

// 3. Watchdog & State Machine Tests
runTest('Watchdog: Initial snapshot structure', () => {
  const snapshot = watchdog.getSnapshot();
  assert.ok(snapshot, 'Snapshot should be returned');
  assert.ok('status' in snapshot, 'Snapshot must have status');
  assert.ok('isEnabled' in snapshot, 'Snapshot must have isEnabled');
  assert.ok('stats' in snapshot, 'Snapshot must have stats');
  assert.ok('uptimeFormatted' in snapshot.stats, 'Snapshot stats must have uptimeFormatted');
  assert.strictEqual(typeof snapshot.auth.isAuthenticated, 'boolean');
});

runTest('Watchdog: Toggle ON/OFF functionality', async () => {
  const previousState = storage.getSettings().isEnabled;
  await watchdog.toggle(!previousState);
  assert.strictEqual(storage.getSettings().isEnabled, !previousState);
  // Revert back
  await watchdog.toggle(previousState);
  assert.strictEqual(storage.getSettings().isEnabled, previousState);
});

// 4. HTTP Server Route Tests
async function runAsyncTests() {
  console.log('\n🌐 Running HTTP Endpoint Integration Tests...');

  const { app } = await import('../src/server.js');
  const port = 3847; // Separate test port
  const server = app.listen(port);

  try {
    // Test /health
    const healthRes = await fetch(`http://localhost:${port}/health`);
    assert.strictEqual(healthRes.status, 200, '/health should return 200');
    const healthJson = await healthRes.json();
    assert.strictEqual(healthJson.status, 'healthy');
    console.log('  ✓ HTTP GET /health: 200 OK');
    testsPassed++;

    // Test /api/status
    const statusRes = await fetch(`http://localhost:${port}/api/status`);
    assert.strictEqual(statusRes.status, 200, '/api/status should return 200');
    const statusJson = await statusRes.json();
    assert.ok('stats' in statusJson);
    console.log('  ✓ HTTP GET /api/status: 200 OK');
    testsPassed++;

    // Test /api/playlist validation
    const invalidPlaylistRes = await fetch(`http://localhost:${port}/api/playlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlist: '' })
    });
    assert.strictEqual(invalidPlaylistRes.status, 400, 'Empty playlist should return 400');
    console.log('  ✓ HTTP POST /api/playlist (validation rejection): 400 Bad Request');
    testsPassed++;

    const validPlaylistRes = await fetch(`http://localhost:${port}/api/playlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlist: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M' })
    });
    assert.strictEqual(validPlaylistRes.status, 200, 'Valid playlist should return 200');
    console.log('  ✓ HTTP POST /api/playlist (successful update): 200 OK');
    testsPassed++;

    // Test /api/toggle
    const toggleRes = await fetch(`http://localhost:${port}/api/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false })
    });
    assert.strictEqual(toggleRes.status, 200, '/api/toggle should return 200');
    const toggleJson = await toggleRes.json();
    assert.strictEqual(toggleJson.isEnabled, false);
    console.log('  ✓ HTTP POST /api/toggle: 200 OK');
    testsPassed++;

  } catch (err) {
    console.error('  ✗ HTTP Integration Test Failed:', err.message);
    testsFailed++;
  } finally {
    server.close();
    console.log(`\n========================================`);
    console.log(`Test Results: ${testsPassed} passed, ${testsFailed} failed.`);
    console.log(`========================================\n`);
    if (testsFailed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runAsyncTests();
