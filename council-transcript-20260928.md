# Council of Five Transcript: Spotify Continuous Playback Service

**Date:** 2026-09-28  
**Topic:** Architectural, Technical, and Operational Feasibility of a 24/7 Spotify Continuous Playback Application  
**Context:** User wants a lightweight app to continuously stream a Spotify playlist 24/7 without needing a PC/browser open, on free cloud hosting, using official Spotify Web API, with auto-recovery, uptime display, and a simple ON/OFF interface.

---

## 1. Frame of the Decision

- **Core Problem:** Build a crash-resilient, 24/7 continuous Spotify playback controller and dashboard using official Spotify APIs.
- **Key Constraints:**
  - Official Spotify Web API only (no reverse-engineered private protocols).
  - Must run continuously without computer or browser open on free cloud hosting.
  - Must automatically recover from crashes, restarts, expired tokens, and API errors.
  - Simple, clean ON/OFF interface, playlist paste, current track, artwork, and uptime counter.
- **Key Technical Reality:** Spotify Web API is a *remote control protocol* (Spotify Connect), not a server-side audio player. Audio requires an active playback target. Free hosting tiers (Render, Railway) have sleep timeouts and ephemeral filesystems.

---

## 2. Independent Advisor Perspectives

### Advisor A: The Contrarian (Failure Modes & Hidden Costs)
- **The "No Active Device" Trap:** Spotify Web API (`/v1/me/player/play`) cannot play audio into the cloud void. If the user turns ON the service, closes their laptop, and has no active Spotify Connect hardware (phone, Echo, smart TV), Spotify returns HTTP 404 `NO_ACTIVE_DEVICE`. The system will enter an infinite fail loop unless handled.
- **Free Cloud Tier Hibernation:** Free instances (e.g. Render free tier) sleep after 15 minutes of no inbound HTTP traffic. A purely background worker will be suspended unless an external keep-alive ping or self-cron is configured.
- **Ephemeral Storage Loss:** When free containers restart or redeploy, local files (like token JSON/SQLite) are destroyed. If the refresh token is wiped, the user is logged out and 24/7 playback dies.
- **Rate Limiting & Account Flagging:** Polling `/v1/me/player` every 5 seconds generates ~17,000 requests/day. Spotify's API will throttle with 429 `Retry-After`. Continuous looping without human interaction can trigger anti-stream-farming heuristics.

### Advisor B: The First Principles Thinker (Fundamentals & Constraints)
- **Deconstruct Spotify's Ecosystem:**
  1. Spotify API is an orchestrator, not a player.
  2. Playback state is authoritative on Spotify's cloud, but audio execution is on a device.
  3. Auth requires a rolling OAuth access token (valid 1 hour) backed by an immutable `refresh_token`.
- **Fundamental Solution:**
  - The cloud daemon must manage state, token rotation, and health monitoring.
  - The system must offer dual targeting:
    - *Remote Mode:* Directs playback to an existing Spotify Connect device (e.g., smart speaker, phone, home console).
    - *Local Browser Mode:* Incorporates the official Spotify Web Playback SDK inside the web UI, so whenever the dashboard is open, the browser itself acts as the active player.
  - Token persistence must be resilient across restarts (via persistent volume, environment persistence, or a lightweight free cloud KV/database like Upstash Redis/Supabase if deployed).

### Advisor C: The Expansionist (Upside, Features & Compounding Value)
- **Device Failover:** If the user's primary device (e.g., Desktop) goes offline, allow the daemon to automatically failover to a secondary target (e.g., Amazon Echo or Phone).
- **Listening Metrics ("Spotify Minutes"):** Track and display total hours/minutes streamed, songs completed, and historical uptime graphs right on the dashboard.
- **Smart Scheduling & Volume Normalization:** Add automated quiet hours or auto-shuffle so playback stays organic.
- **Discord/Telegram Webhook Alert:** Notify the user if playback was interrupted and could not be recovered (e.g., account revoked or all devices offline).

### Advisor D: The Outsider (Clarity, Assumptions & Usability)
- **Clarity of Purpose:** The user wants an effortless "ON" switch where music plays, tracks are displayed, and they don't have to babysit it.
- **Eliminate Jargon:** Don't baffle the user with "Spotify Connect endpoints" or "ephemeral container crashes". The UI should simply have:
  - Big toggle: `SERVICE ON` / `SERVICE OFF`
  - Target device selector: `Play on: [ Bedroom Echo / Creep's Phone / This Browser ]`
  - Playlist URL box: `Paste playlist link`
  - Status indicator: `🟢 Streaming • 4h 12m runtime`
- If no device is detected, show a clear human prompt: "Open Spotify on your phone/speaker or click 'Play in this browser'".

### Advisor E: The Executor (Feasibility, Sequencing & First Actions)
- **Tech Stack:** Node.js + Express backend, Vanilla CSS + HTML frontend (Spotify dark theme).
- **Watchdog Architecture:**
  - Check interval: 15–20 seconds (safe from 429 rate limits).
  - Proactive token refresh: refresh access token when expiration < 5 minutes.
  - Backoff algorithm: On 429 or 5xx, back off exponentially (5s -> 15s -> 30s -> 60s).
  - Device fallback: If device is asleep, attempt transfer to selected target device ID.
- **Step 1:** Build the core Node.js server with OAuth 2.0 flow, token storage, and Spotify API client.
- **Step 2:** Build the watchdog loop with automatic token refreshing and error resilience.
- **Step 3:** Build the UI dashboard with live metrics, playlist selector, and device switcher.
- **Step 4:** Provide Dockerfile + deployment configuration for 1-click free hosting.

---

## 3. Blind Peer Review Summary

- **Strongest Insights:**
  - Contrarian's warning about the "No Active Device" constraint and free cloud hibernation. Without addressing this, the app will fail on day one.
  - Executor's pragmatic 15–20s polling with exponential backoff and proactive token rotation.
- **Biggest Blind Spot Identified:**
  - Expecting a cloud backend to play music into thin air. A physical or browser target device *must* be connected to the account.
- **Unanimous Consensus:**
  - The plan is highly viable if designed with device targeting, proactive token rotation, safe polling intervals, and clear UI status messages when devices are offline.

---

## 4. Chairman Synthesis & Final Verdict

1. **Verdict:** **PROCEED WITH ENHANCEMENTS.** The plan is solid and fully achievable within Spotify's official API guidelines.
2. **Key Requirements to Lock In:**
   - Implement device selection in the UI so the user can choose which Spotify device receives the stream when their computer is off.
   - Include the Spotify Web Playback SDK in the web app as a built-in player option.
   - Use safe 15s polling with exponential backoff to ensure 100% compliance with Spotify rate limits.
   - Keep token storage resilient and document how to configure free cloud deployment (Render/Railway).
