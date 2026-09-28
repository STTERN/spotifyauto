# 🟢 Spotify Minutes — Continuous Autopilot Player

A lightweight, crash-resilient application connected to your Spotify account using official Spotify Web API and OAuth. It provides a simple **ON/OFF** toggle to continuously stream your selected playlist 24/7, auto-advances tracks, auto-recovers from crashes/restarts and expired tokens, and displays live playback metrics and uptime.

---

## ✨ Features

- **Official Spotify Web API & OAuth 2.0:** Uses official endpoints with full token auto-refresh rotation (refreshes 5 minutes before expiration).
- **Master ON / OFF Control:** A tactile glowing power button. When ON, it keeps music playing indefinitely. When OFF, it pauses playback.
- **Continuous Background Playback (Autopilot):**
  - Background watchdog loop monitors playback every 15 seconds.
  - Automatically loops playlists endlessly using Spotify's `context` repeat mode.
  - Automatically recovers and resumes if music pauses or finishes.
- **Live Now Streaming Card:**
  - Real-time current song title, artist, album, and animated vinyl artwork.
  - Live progress bar with local second-by-second interpolation.
  - Quick skip track button.
- **24/7 Service Runtime & Metrics:**
  - Live session and cumulative uptime counters (`HH:MM:SS`).
  - Total songs streamed counter.
  - Target device indicator.
- **Playlist & Target Device Selector:**
  - Paste any Spotify playlist URL or URI (`https://open.spotify.com/playlist/...` or `spotify:playlist:...`).
  - Scan and target any Spotify Connect device (phone, smart speaker, PC, smart TV).
  - Includes **Spotify Web Playback SDK** — click *"Play in This Browser"* to turn your current browser tab into the active player instantly.
- **24/7 Headless Cloud Ready:**
  - Fully deployable to free cloud platforms (Render, Railway, Fly.io).
  - `/health` endpoint for free uptime monitors (e.g. UptimeRobot) to keep free instances awake 24/7.

---

## 🚀 Quick Setup Guide

### Step 1: Create a Spotify Developer App
1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and log in with your Spotify account.
2. Click **Create App**.
3. Fill in:
   - **App Name:** `Spotify Minutes` (or any name you choose)
   - **App Description:** `Continuous playback manager`
   - **Redirect URI:** Add:
     - `http://localhost:3000/auth/callback` (for local use)
     - `https://your-cloud-url.onrender.com/auth/callback` (if deploying to cloud)
   - **APIs Used:** Select **Web API** and **Web Playback SDK**.
4. Click **Save**.
5. In your App settings, copy your **Client ID** and click **View client secret** to copy your **Client Secret**.

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Edit `.env` with your values:
```env
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
REDIRECT_URI=http://localhost:3000/auth/callback
PORT=3000
```

### Step 3: Run Locally
```bash
# Install dependencies
npm install

# Start the application
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser:
1. Click **Connect Spotify** to authorize the app.
2. Paste your preferred playlist URL and click **Save Playlist**.
3. Select your preferred playback device (or click **Play in This Browser**).
4. Click the large **Power Button** to turn the service **ON**.

---

## ☁️ Free 24/7 Cloud Hosting (No Computer / Browser Needed)

To run continuously without keeping your computer or browser open:

### Option A: Render (Free Web Service)
1. Push this project to your GitHub repository.
2. Go to [Render.com](https://render.com) and create a **New Web Service**.
3. Connect your repository.
4. Set:
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Under **Environment Variables**, add:
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
   - `REDIRECT_URI` = `https://<your-service-name>.onrender.com/auth/callback`
6. Once deployed, add your Render redirect URI into your Spotify Developer App settings.
7. **Preventing Free-Tier Sleep:**
   - Free Render instances sleep after 15 minutes of inactive HTTP traffic.
   - Go to [UptimeRobot.com](https://uptimerobot.com) (free) and add an HTTP monitor pointing to `https://<your-service-name>.onrender.com/health` checked every 5 or 10 minutes.
   - This keeps your cloud player awake 24/7 at $0 cost!

### Option B: Railway or Fly.io
You can also use the included `Dockerfile` to deploy directly to Railway or Fly.io with a single command:
```bash
fly launch
```

---

## 🛡️ Resilience & Auto-Recovery Architecture

| Failure Scenario | Built-in Auto-Recovery |
| :--- | :--- |
| **Token Expired (3600s)** | Watchdog checks token validity before every API call; proactively rotates access token 5 minutes before expiration. |
| **API Error / 401 Unauthorized** | Client intercepts 401, requests fresh access token using `refresh_token`, and retries the request automatically. |
| **Rate Limiting (429)** | Respects Spotify's `Retry-After` header and backs off exponentially to prevent account throttling. |
| **Container Restart / Crash** | Persistent JSON state file (`data/state.json`) atomically records settings and tokens. Upon restart, daemon reloads state and resumes session without requiring re-login. |
| **Track Finishes / Pauses** | Watchdog monitors playback every 15s; sets repeat mode to `context` and immediately triggers resumption if playback stops while ON. |
| **Target Device Asleep** | Displays clear `WAITING_FOR_DEVICE` status and attempts auto-transfer to available devices. |

---

## 🛠️ API Endpoints

- `GET /api/status` — Live watchdog snapshot (track info, status, uptime, auth state).
- `POST /api/toggle` — Turn service ON or OFF (`{ enabled?: boolean }`).
- `GET /api/devices` — List available Spotify Connect devices.
- `POST /api/device` — Set target device (`{ deviceId, deviceName }`).
- `POST /api/playlist` — Set playlist link or URI (`{ playlist }`).
- `POST /api/next` — Skip to next song.
- `GET /health` — Health check endpoint for monitoring & keepalive.
- `GET /auth/login` — Initiates Spotify OAuth flow.
- `GET /auth/callback` — Handles OAuth redirect code exchange.
- `POST /auth/logout` — Revokes stored session.

---

## 📜 License
MIT
