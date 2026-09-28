# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Spotify Premium listeners who want uninterrupted, continuous music streaming (e.g., ambient background soundscapes, party music, smart speaker automation for Alexa/Echo/Sonos, or workplace audio) without needing to keep a personal computer, laptop, or browser session open.

## Product Purpose

Provide a lightweight, set-it-and-forget-it 24/7 continuous Spotify player and status dashboard. The application eliminates unexpected stream cutoffs by continuously enforcing playback, looping playlists indefinitely, rotating OAuth tokens proactively, and recovering automatically from network drops, server restarts, and Spotify API hiccups.

## Positioning

Unlike native Spotify clients that stop after playlist completion, sleep with the host computer, or require continuous manual input, Spotify Minutes operates as an autonomous cloud-ready autopilot service that orchestrates official Spotify Connect devices and includes a built-in browser player fallback.

## Operating Context

- **Deployment Environment:** Deployed on free cloud containers (Render, Railway, Fly.io) or run locally on a headless home server/PC.
- **Client Access:** Accessed via mobile browsers (smartphones on iOS/Android) and desktop browsers to toggle playback, switch playlists, or monitor stream status.
- **Audio Output:** Streams directly to registered Spotify Connect hardware (smart speakers, receivers, phone, desktop client) or directly into the web browser via the official Spotify Web Playback SDK.

## Capabilities and Constraints

- **Playback Automation:** Autonomous watchdog loop (15s polling) that enforces Spotify `context` repeat mode and auto-resumes paused playback.
- **Resilience Engine:** Proactive token refresh (rotates access tokens 5 minutes prior to 1-hour expiration with exponential backoff).
- **Target Device Binding:** Automatic discovery and selection of Spotify Connect endpoints.
- **Platform Constraints:** Requires Spotify Premium for player control endpoints; official Spotify Web API requires an active Spotify Connect target device.
- **Free-Tier Cloud Sleep Mitigation:** Exposes `/health` keepalive route to prevent free-tier cloud containers (Render) from idling to sleep.

## Brand Commitments

- **Name:** Spotify Minutes • Continuous Autopilot Player
- **Visual Identity:** Curated Spotify dark aesthetic (obsidian `#08090b`, emerald glow `#1db954`, subtle glass cards, Plus Jakarta Sans typography).
- **Control Interface:** Tactile, single-tap master power button (`ON` / `OFF`) with responsive mobile layout and zero-clutter dashboard.

## Evidence on Hand

- Fully operational Node.js backend with official Spotify Web API client and OAuth code exchange ([src/server.js](file:///c:/Users/Creep/Downloads/PROJECTS/spotify%20minutes/src/server.js), [src/spotifyAuth.js](file:///c:/Users/Creep/Downloads/PROJECTS/spotify%20minutes/src/spotifyAuth.js), [src/watchdog.js](file:///c:/Users/Creep/Downloads/PROJECTS/spotify%20minutes/src/watchdog.js)).
- Responsive mobile & desktop interface ([public/index.html](file:///c:/Users/Creep/Downloads/PROJECTS/spotify%20minutes/public/index.html), [public/style.css](file:///c:/Users/Creep/Downloads/PROJECTS/spotify%20minutes/public/style.css)).
- Automated integration test suite passing 15/15 checks ([test/test.js](file:///c:/Users/Creep/Downloads/PROJECTS/spotify%20minutes/test/test.js)).
- Production deployment blueprints ([Dockerfile](file:///c:/Users/Creep/Downloads/PROJECTS/spotify%20minutes/Dockerfile), [render.yaml](file:///c:/Users/Creep/Downloads/PROJECTS/spotify%20minutes/render.yaml)).

## Product Principles

1. **One-Tap Simplicity:** Single master toggle turns continuous playback ON or OFF. No confusing knobs or complex menus.
2. **Zero Babysitting:** The service manages its own authentication lifecycle, retries, and looping. It should never silently die.
3. **Hardware Transparency:** Clearly show which device is receiving audio, with 1-click fallback to play directly in the browser if hardware is asleep.
4. **Resilient Portability:** Minimal footprint, lightweight dependencies, and zero proprietary lock-in.

## Accessibility & Inclusion

- WCAG AAA text contrast (16:1 ratio for white body text on obsidian, 8.4:1 for emerald controls).
- Mobile-first touch targets (minimum 44px–48px) with iOS auto-zoom prevention (`font-size: 16px;` inputs).
- Dynamic safe-area padding for mobile notches and gesture bars.
