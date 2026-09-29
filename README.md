# 🟢 Spotify Minutes (SpotifyAuto)

> A lightweight, crash-resilient 24/7 continuous Spotify autopilot player and live dashboard. Powered by official Spotify Web APIs and OAuth 2.0.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-15%2F15%20Passing-brightgreen.svg)]()
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)]()

---

## ⚡ What Does This Do?

Spotify Minutes is designed for continuous, uninterrupted music playback without requiring your personal computer or browser to stay awake.

- **Autonomous Autopilot:** Runs a continuous background watchdog that keeps your selected playlist playing endlessly using Spotify's `context` loop mode.
- **Single-Tap ON/OFF:** One master power switch on the dashboard to start or pause continuous playback.
- **Auto-Recovery:** Proactively refreshes OAuth tokens before their 1-hour expiration, automatically retries on network drops, and recovers gracefully from server restarts.
- **Dual Playback Modes:**
  1. **Remote Target Mode:** Directs audio to any Spotify Connect device (smartphone, Amazon Echo / Alexa, smart TV, desktop client).
  2. **Browser Player Mode:** Built-in **Spotify Web Playback SDK** allows you to turn any browser tab into an active speaker with one click.
- **Real-Time Telemetry & Mobile Dashboard:** Live session uptime clock, total songs streamed counter, album artwork, progress bar, and playlist selector. Fully responsive on iPhone, Android, and desktop.
- **Free 24/7 Cloud Hosting:** Can be deployed for **$0** on platforms like Render, Railway, or Fly.io using the included Dockerfile and keepalive endpoint.

---

## 📋 Prerequisites

1. **Spotify Premium Account** (Required by Spotify to use playback control endpoints).
2. **Node.js 18+** installed locally (if running locally), OR a free account on [Render.com](https://render.com) / [Railway.app](https://railway.app).

---

## 🚀 Step-by-Step Setup Guide

### Step 1: Create a Spotify Developer Application
1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and log in with your Spotify account.
2. Click **Create App** (top right).
3. Fill in the application details:
   - **App name:** `Spotify Minutes` (or any name you prefer)
   - **App description:** `Continuous playback autopilot`
   - **Redirect URIs:** Add the following URI:
     - For local running: `http://localhost:3000/auth/callback`
     - If using cloud hosting (e.g. Render): `https://your-service-name.onrender.com/auth/callback`
   - **Which API/SDKs are you planning to use?** Check:
     - ☑ **Web API**
     - ☑ **Web Playback SDK**
4. Check the Terms of Service box and click **Save**.
5. On your app's dashboard, click **Settings**:
   - Copy your **Client ID**.
   - Click **View client secret** and copy your **Client Secret**.

---

### Step 2: Clone and Install
Clone this repository to your machine:
```bash
git clone https://github.com/Tofu4KK/spotifyauto.git
cd spotifyauto
npm install
```

---

### Step 3: Configure Environment Variables
Copy the example environment file:
```bash
cp .env.example .env
```
Open `.env` in any text editor and fill in your Spotify credentials:
```env
# Your Spotify App credentials from Step 1
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here

# Redirect URI (must exactly match what you registered in Spotify Dashboard)
REDIRECT_URI=http://localhost:3000/auth/callback

# Port
PORT=3000
```

---

### Step 4: Launch the Application
Start the server:
```bash
npm start
```
You will see:
```text
======================================================
🎵 Spotify Continuous Playback Service running!
📡 URL: http://localhost:3000
⚙️  Data storage: .../data/state.json
======================================================
```

Open your browser and navigate to: **[http://localhost:3000](http://localhost:3000)**.

---

### Step 5: Connect and Configure Playback
1. **Connect Account:** Click **Connect Spotify** in the top-right corner and approve the permissions.
2. **Set Your Playlist:**
   - In Spotify, right-click any playlist > **Share** > **Copy link to playlist**.
   - Paste the link into the **Spotify Playlist Link or URI** box on your dashboard and click **Save Playlist**.
3. **Choose Your Target Device:**
   - Make sure Spotify is open on at least one device (phone, PC, smart speaker, etc.).
   - Click **Scan Devices** and choose your device from the dropdown.
   - *Alternative:* Click **Play in This Browser** to use your current browser tab as the player device!
4. **Turn ON:**
   - Click the big glowing power button. It will turn **ON**, and continuous playback will immediately begin!

---

## ☁️ Running 24/7 on Free Cloud Hosting (No PC Needed)

You can run this service 24/7 in the cloud so it streams continuously even when your laptop and browser are completely turned off.

### Deploying to Render.com (100% Free):
1. Push your repository to your GitHub account (`Tofu4KK/spotifyauto`).
2. Go to [Render.com](https://render.com) and create a free account.
3. Click **New +** > **Web Service**.
4. Select your `spotifyauto` GitHub repository.
5. Render will automatically detect the settings from `render.yaml`:
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** `Free`
6. Scroll down to **Environment Variables** and add:
   - `SPOTIFY_CLIENT_ID` = `(Your Spotify Client ID)`
   - `SPOTIFY_CLIENT_SECRET` = `(Your Spotify Client Secret)`
   - `REDIRECT_URI` = `https://<your-render-app-name>.onrender.com/auth/callback`
7. Click **Deploy Web Service**.
8. **Update Spotify Dashboard:** Go back to your [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) > Settings > Redirect URIs and add your new Render URL:
   `https://<your-render-app-name>.onrender.com/auth/callback`

#### 💡 Keeping Free Render Alive 24/7 (Preventing Sleep):
Free web services on Render sleep after 15 minutes of inactive web requests. To prevent this:
1. Go to [UptimeRobot.com](https://uptimerobot.com) (free).
2. Click **Add New Monitor**:
   - **Monitor Type:** `HTTP(s)`
   - **Friendly Name:** `Spotify Auto Keepalive`
   - **URL:** `https://<your-render-app-name>.onrender.com/health`
   - **Monitoring Interval:** `5 minutes`
3. Click **Create Monitor**. UptimeRobot will ping the `/health` endpoint every 5 minutes, ensuring your continuous player runs **24/7 without interruption at $0 cost**!

---

## 🛡️ Resilience & Auto-Recovery Architecture

| Scenario | Automatic Recovery Mechanism |
| :--- | :--- |
| **Token Expiry (3600s)** | The watchdog checks token validity before every API call; proactively rotates the access token 5 minutes before expiration. |
| **API Error / 401 Unauthorized** | The client catches 401 responses, calls Spotify Accounts using the stored `refresh_token`, and seamlessly retries the request. |
| **Rate Limiting (429)** | Respects Spotify's `Retry-After` header and backs off exponentially to prevent account throttling. |
| **Server Restart / Crash** | App state (tokens, active playlist, target device) is atomically persisted in `data/state.json`. Upon reboot, the daemon automatically resumes without requiring you to log in again. |
| **Song Finishes / Pauses** | The 15-second watchdog loop detects paused or stopped states and immediately triggers continuation using `context` repeat mode. |
| **Target Device Asleep** | Flags `WAITING_FOR_DEVICE` on the dashboard and automatically transfers to the next available Spotify Connect device. |

---

## 🧪 Testing

Run the included automated integration test suite:
```bash
npm test
```
Runs 15 tests covering state persistence, URL normalizers, token expiry buffers, API edge cases, and health checks.

---

## 📁 Project Structure

```text
spotifyauto/
├── public/                 # Glassmorphic responsive frontend
│   ├── index.html          # Semantic HTML5 UI
│   ├── style.css           # Modern dark mode styling + mobile adaptation
│   └── app.js              # Real-time polling & Web Playback SDK logic
├── src/                    # Backend core
│   ├── config.js           # Environment & OAuth scopes
│   ├── server.js           # Express REST API & static server
│   ├── spotifyAuth.js      # OAuth code exchange & auto-token refresher
│   ├── spotifyClient.js    # Spotify Web API client wrapper
│   ├── storage.js          # Atomic state & token persistence
│   └── watchdog.js         # Autopilot continuous playback engine
├── test/
│   └── test.js             # Automated unit and integration test suite
├── .env.example            # Environment variables template
├── .gitignore              # Protects secrets, node_modules, and state
├── Dockerfile              # Production container build
├── package.json            # Node.js dependencies
├── README.md               # Master setup & deployment guide
└── render.yaml             # Render 1-click cloud blueprint
```

---

## 📜 License
MIT License. Feel free to modify and share!
