// Spotify Continuous Playback Dashboard Logic

let currentStatus = null;
let pollTimer = null;
let progressLocalMs = 0;
let progressDurationMs = 0;
let progressTimer = null;
let webPlayer = null;
let webPlayerDeviceId = null;
let isWebPlayerActive = false;

// DOM Elements
const authStatusBadge = document.getElementById('authStatusBadge');
const authStatusText = document.getElementById('authStatusText');
const authBtn = document.getElementById('authBtn');

const masterToggleBtn = document.getElementById('masterToggleBtn');
const powerStateLabel = document.getElementById('powerStateLabel');
const serviceStateDescription = document.getElementById('serviceStateDescription');

const uptimeDisplay = document.getElementById('uptimeDisplay');
const songsStreamedDisplay = document.getElementById('songsStreamedDisplay');
const activeDeviceDisplay = document.getElementById('activeDeviceDisplay');
const deviceTypeDisplay = document.getElementById('deviceTypeDisplay');

const playbackStateBadge = document.getElementById('playbackStateBadge');
const playbackStateText = document.getElementById('playbackStateText');

const trackArtwork = document.getElementById('trackArtwork');
const artworkVinylRing = document.getElementById('artworkVinylRing');
const trackTitle = document.getElementById('trackTitle');
const trackArtist = document.getElementById('trackArtist');
const trackAlbum = document.getElementById('trackAlbum');
const trackProgressFill = document.getElementById('trackProgressFill');
const timeCurrent = document.getElementById('timeCurrent');
const timeTotal = document.getElementById('timeTotal');

const skipNextBtn = document.getElementById('skipNextBtn');
const webPlayerBtn = document.getElementById('webPlayerBtn');
const webPlayerBtnText = document.getElementById('webPlayerBtnText');

const playlistInput = document.getElementById('playlistInput');
const savePlaylistBtn = document.getElementById('savePlaylistBtn');
const playlistMetaPreview = document.getElementById('playlistMetaPreview');
const playlistPreviewName = document.getElementById('playlistPreviewName');

const deviceSelect = document.getElementById('deviceSelect');
const selectDeviceBtn = document.getElementById('selectDeviceBtn');
const refreshDevicesBtn = document.getElementById('refreshDevicesBtn');
const healthPing = document.getElementById('healthPing');
const toastEl = document.getElementById('toast');

// --- Helper Functions ---
function showToast(message, type = 'info') {
  toastEl.textContent = message;
  toastEl.className = `toast show ${type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : ''}`;
  setTimeout(() => {
    toastEl.className = 'toast';
  }, 4000);
}

function formatTime(ms) {
  if (!ms || isNaN(ms)) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Check URL query for auth redirects
function handleAuthUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('auth_success')) {
    showToast('Successfully connected to Spotify!', 'success');
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  if (urlParams.get('auth_error')) {
    showToast(`Spotify Auth Error: ${urlParams.get('auth_error')}`, 'error');
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

// --- Fetch and Render Status ---
async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    currentStatus = data;
    renderStatus(data);
  } catch (err) {
    console.warn('[Dashboard] Error fetching status:', err);
    healthPing.textContent = 'Health: Offline / Reconnecting...';
    healthPing.style.color = '#ef4444';
  }
}

function renderStatus(data) {
  healthPing.textContent = 'Health: 200 OK • Auto-Recovery Active';
  healthPing.style.color = '#8b949e';

  // 1. Auth Status
  if (data.auth?.isAuthenticated) {
    authStatusBadge.className = 'status-pill status-active';
    authStatusText.textContent = 'Connected';
    authBtn.textContent = 'Disconnect';
    authBtn.onclick = handleLogout;
  } else {
    authStatusBadge.className = 'status-pill status-unauthenticated';
    authStatusText.textContent = 'Disconnected';
    authBtn.textContent = 'Connect Spotify';
    authBtn.onclick = handleLogin;
  }

  // 2. Master Toggle Switch
  if (data.isEnabled) {
    masterToggleBtn.classList.add('is-active');
    powerStateLabel.textContent = 'ON';
    serviceStateDescription.textContent = 'Service is running 24/7 continuous playback';
  } else {
    masterToggleBtn.classList.remove('is-active');
    powerStateLabel.textContent = 'OFF';
    serviceStateDescription.textContent = 'Service is stopped. Click to turn ON continuous playback';
  }

  // 3. Status Badge & Description
  renderPlaybackBadge(data.status, data.statusMessage);

  // 4. Metrics
  uptimeDisplay.textContent = data.stats.uptimeFormatted || '00:00:00';
  songsStreamedDisplay.textContent = (data.stats.songsPlayed || 0).toLocaleString();

  if (data.device) {
    activeDeviceDisplay.textContent = data.device.name;
    deviceTypeDisplay.textContent = `${data.device.type || 'Spotify Connect'} (${data.device.volumePercent !== undefined ? data.device.volumePercent + '%' : 'Active'})`;
  } else if (data.targetDeviceId) {
    activeDeviceDisplay.textContent = 'Pinned Device';
    deviceTypeDisplay.textContent = 'Reconnecting...';
  } else {
    activeDeviceDisplay.textContent = 'Auto-detecting...';
    deviceTypeDisplay.textContent = 'Any available Spotify device';
  }

  // 5. Now Playing Track
  renderTrack(data.currentTrack, data.isEnabled);

  // 6. Playlist Input
  if (!playlistInput.value && data.playlistUri) {
    playlistInput.value = data.playlistUri;
  }

  if (data.playlistMeta) {
    playlistMetaPreview.classList.remove('hidden');
    playlistPreviewName.textContent = `${data.playlistMeta.name} (${data.playlistMeta.totalTracks} songs)`;
  }
}

function renderPlaybackBadge(status, message) {
  playbackStateBadge.className = 'status-pill';
  switch (status) {
    case 'STREAMING':
      playbackStateBadge.classList.add('status-active');
      playbackStateText.textContent = 'Streaming';
      break;
    case 'WAITING_FOR_DEVICE':
      playbackStateBadge.classList.add('status-waiting');
      playbackStateText.textContent = 'Waiting for Device';
      break;
    case 'UNAUTHENTICATED':
      playbackStateBadge.classList.add('status-unauthenticated');
      playbackStateText.textContent = 'Needs Login';
      break;
    case 'ERROR':
      playbackStateBadge.classList.add('status-error');
      playbackStateText.textContent = 'API Error';
      break;
    default:
      playbackStateBadge.classList.add('status-idle');
      playbackStateText.textContent = 'Idle';
      break;
  }
}

function renderTrack(track, isEnabled) {
  const container = trackArtwork.parentElement;

  if (track && track.title) {
    trackTitle.textContent = track.title;
    trackArtist.textContent = track.artist || 'Unknown Artist';
    trackAlbum.textContent = track.album || '';
    if (track.artwork) {
      trackArtwork.src = track.artwork;
    }

    progressLocalMs = track.progressMs || 0;
    progressDurationMs = track.durationMs || 0;

    timeCurrent.textContent = formatTime(progressLocalMs);
    timeTotal.textContent = formatTime(progressDurationMs);

    const percent = progressDurationMs > 0 ? (progressLocalMs / progressDurationMs) * 100 : 0;
    trackProgressFill.style.width = `${Math.min(100, Math.max(0, percent))}%`;

    if (track.isPlaying && isEnabled) {
      container.classList.add('is-spinning');
    } else {
      container.classList.remove('is-spinning');
    }
  } else {
    trackTitle.textContent = isEnabled ? 'Searching playlist...' : 'No Track Active';
    trackArtist.textContent = isEnabled ? 'Connecting to Spotify stream' : 'Turn service ON to begin';
    trackAlbum.textContent = '—';
    container.classList.remove('is-spinning');
    trackProgressFill.style.width = '0%';
    timeCurrent.textContent = '0:00';
    timeTotal.textContent = '0:00';
  }
}

// Local second-by-second progress bar advancement
function startLocalProgressBar() {
  if (progressTimer) clearInterval(progressTimer);
  progressTimer = setInterval(() => {
    if (currentStatus?.currentTrack?.isPlaying && progressDurationMs > 0) {
      progressLocalMs += 1000;
      if (progressLocalMs > progressDurationMs) {
        progressLocalMs = progressDurationMs;
      }
      timeCurrent.textContent = formatTime(progressLocalMs);
      const percent = (progressLocalMs / progressDurationMs) * 100;
      trackProgressFill.style.width = `${percent}%`;
    }
  }, 1000);
}

// --- User Actions ---
async function handleLogin() {
  window.location.href = '/auth/login';
}

async function handleLogout() {
  if (!confirm('Disconnect Spotify account from this service?')) return;
  try {
    await fetch('/auth/logout', { method: 'POST' });
    showToast('Logged out from Spotify', 'info');
    fetchStatus();
  } catch (err) {
    showToast('Failed to log out', 'error');
  }
}

async function handleToggle() {
  if (!currentStatus?.auth?.isAuthenticated) {
    showToast('Please connect your Spotify account first!', 'error');
    handleLogin();
    return;
  }

  // Optimistic UI toggle
  const willBeEnabled = !currentStatus.isEnabled;
  masterToggleBtn.classList.toggle('is-active', willBeEnabled);
  powerStateLabel.textContent = willBeEnabled ? 'ON' : 'OFF';

  try {
    const res = await fetch('/api/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: willBeEnabled })
    });
    const data = await res.json();
    if (data.success) {
      showToast(willBeEnabled ? 'Continuous Playback Turned ON' : 'Service Stopped', 'success');
      fetchStatus();
    }
  } catch (err) {
    showToast('Failed to toggle service', 'error');
    fetchStatus();
  }
}

async function handleSavePlaylist() {
  const playlist = playlistInput.value.trim();
  if (!playlist) {
    showToast('Please enter a Spotify playlist link or URI', 'error');
    return;
  }

  savePlaylistBtn.disabled = true;
  savePlaylistBtn.textContent = 'Saving...';

  try {
    const res = await fetch('/api/playlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlist })
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Playlist updated successfully!', 'success');
      fetchStatus();
    } else {
      showToast(data.error || 'Failed to update playlist', 'error');
    }
  } catch (err) {
    showToast('Network error updating playlist', 'error');
  } finally {
    savePlaylistBtn.disabled = false;
    savePlaylistBtn.textContent = 'Save Playlist';
  }
}

async function handleFetchDevices() {
  refreshDevicesBtn.disabled = true;
  try {
    const res = await fetch('/api/devices');
    const data = await res.json();
    const devices = data.devices || [];

    // Populate select
    deviceSelect.innerHTML = '<option value="">Auto-detect first available device</option>';
    devices.forEach(dev => {
      const opt = document.createElement('option');
      opt.value = dev.id;
      opt.textContent = `${dev.name} (${dev.type}) ${dev.is_active ? '• Active' : ''}`;
      if (currentStatus?.targetDeviceId === dev.id || (dev.is_active && !currentStatus?.targetDeviceId)) {
        opt.selected = true;
      }
      deviceSelect.appendChild(opt);
    });

    if (devices.length === 0) {
      showToast('No active Spotify devices found. Open Spotify on any device.', 'info');
    } else {
      showToast(`Found ${devices.length} Spotify device(s)`, 'success');
    }
  } catch (err) {
    showToast('Failed to scan devices', 'error');
  } finally {
    refreshDevicesBtn.disabled = false;
  }
}

async function handleSelectDevice() {
  const deviceId = deviceSelect.value;
  const deviceName = deviceSelect.selectedOptions[0]?.text || null;

  try {
    const res = await fetch('/api/device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, deviceName })
    });
    if (res.ok) {
      showToast(deviceId ? `Target device set to: ${deviceName}` : 'Set to Auto-detect device', 'success');
      fetchStatus();
    }
  } catch (err) {
    showToast('Failed to set target device', 'error');
  }
}

async function handleSkipNext() {
  try {
    await fetch('/api/next', { method: 'POST' });
    showToast('Skipping to next track...', 'info');
    setTimeout(fetchStatus, 600);
  } catch (err) {
    showToast('Failed to skip track', 'error');
  }
}

// --- Official Spotify Web Playback SDK Integration ---
window.onSpotifyWebPlaybackSDKReady = () => {
  console.log('[WebPlaybackSDK] Spotify SDK Ready.');
};

async function toggleWebPlayer() {
  if (isWebPlayerActive && webPlayer) {
    webPlayer.disconnect();
    isWebPlayerActive = false;
    webPlayerBtnText.textContent = 'Play in This Browser';
    showToast('Browser player disconnected', 'info');
    return;
  }

  if (!window.Spotify) {
    showToast('Spotify Web Playback SDK is loading or not supported in this browser.', 'error');
    return;
  }

  webPlayerBtnText.textContent = 'Connecting Player...';

  try {
    const tokenRes = await fetch('/auth/token');
    if (!tokenRes.ok) throw new Error('Please login to Spotify first');
    const { accessToken } = await tokenRes.json();

    webPlayer = new window.Spotify.Player({
      name: 'Spotify Minutes Web Player',
      getOAuthToken: async cb => {
        const r = await fetch('/auth/token');
        const d = await r.json();
        cb(d.accessToken);
      },
      volume: 0.8
    });

    webPlayer.addListener('ready', async ({ device_id }) => {
      console.log('[WebPlaybackSDK] Ready with Device ID', device_id);
      webPlayerDeviceId = device_id;
      isWebPlayerActive = true;
      webPlayerBtnText.textContent = 'Disconnect Browser Player';
      showToast('Browser Player is Ready! Setting as target device...', 'success');

      // Auto-set as target device
      await fetch('/api/device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: device_id, deviceName: 'Spotify Minutes Web Player' })
      });
      fetchStatus();
      handleFetchDevices();
    });

    webPlayer.addListener('not_ready', ({ device_id }) => {
      console.warn('[WebPlaybackSDK] Device has gone offline', device_id);
    });

    webPlayer.addListener('initialization_error', ({ message }) => {
      showToast(`Web Player error: ${message}`, 'error');
      webPlayerBtnText.textContent = 'Play in This Browser';
    });

    webPlayer.addListener('authentication_error', ({ message }) => {
      showToast(`Web Player auth error: ${message}`, 'error');
      webPlayerBtnText.textContent = 'Play in This Browser';
    });

    webPlayer.connect();
  } catch (err) {
    showToast(err.message, 'error');
    webPlayerBtnText.textContent = 'Play in This Browser';
  }
}

// --- Event Listeners ---
masterToggleBtn.addEventListener('click', handleToggle);
savePlaylistBtn.addEventListener('click', handleSavePlaylist);
refreshDevicesBtn.addEventListener('click', handleFetchDevices);
selectDeviceBtn.addEventListener('click', handleSelectDevice);
skipNextBtn.addEventListener('click', handleSkipNext);
webPlayerBtn.addEventListener('click', toggleWebPlayer);

// Init
handleAuthUrlParams();
fetchStatus();
handleFetchDevices();
startLocalProgressBar();

// Poll every 3 seconds for live dashboard updates
pollTimer = setInterval(fetchStatus, 3000);
