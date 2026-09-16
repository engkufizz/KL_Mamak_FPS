# GEMINI.md - AI Agent Developer Guide & Architecture Context

Welcome, AI coding assistant (Gemini, Claude, Antigravity, Cursor, etc.) or developer!

This document provides complete architectural context, design invariants, codebase conventions, and technical specifications for **"Underground Neon KL: Mamak Alleyway Siege"**. Read this document before proposing changes, debugging, or adding new features.

---

## 🚫 0. DO NOT START THE DEV SERVER OR THE TUNNEL (READ FIRST)

**The app and its public tunnel are managed externally by an automated watchdog. Never start them yourself.**

| Process | Command you must NOT run | Why |
|---|---|---|
| Dev server | `npm run dev`, `npx vite`, `vite` | The watchdog already runs it on **port 5180**; `vite.config.js` uses `strictPort: true`, so a second instance fails with "Port 5180 is already in use" and makes it look like the app is broken. |
| Public tunnel | `loophole http ...`, any tunnel command | The watchdog owns the tunnel. Extra restarts trigger new Let's Encrypt certificate requests for the hostname; 5 duplicate certs/week causes a lockout and the public URL dies for days. |

### Correct way to work on this project

- **Edit source files only** (`src/**`, `index.html`, `public/**`, `vite.config.js`). The running Vite dev server **hot-reloads instantly** — no restart needed. Save the file, refresh the browser.
- **Test the game at the live URL**: **https://mamakfps.loophole.site** (or `http://localhost:5180` from inside the box).
- **Verify the server is alive** (read-only, always safe): `curl -s -o /dev/null -w "%{http_code}" http://localhost:5180/` → expect `200`.
- **If port 5180 does not answer**: report it to the user and stop. Do not start a server on another port — the tunnel only forwards 5180.
- **Do not run `npm install`** unless explicitly asked; dependencies are already installed.
- If you truly need a server for an isolated test, use a **different port** (e.g. `npx vite --port 5199`), and kill it when done.

> Rationale: the watchdog (Hermes cron, every 5 minutes) restarts the dev server and tunnel automatically if they die. A second manually-started process fights it, wastes Let's Encrypt quota, and can take the public site down.

---

## 📌 1. Project Vision & Identity

- **Title**: *Underground Neon KL: Mamak Alleyway Siege*
- **Genre**: Fast-paced, high-octane 3D First-Person Horde Survival Shooter running entirely client-side in the browser.
- **Atmosphere & Setting**: Nocturnal Kuala Lumpur at 2:00 AM. Rain-slicked back-alley with pre-war colonial shophouses, corrugated zinc awnings, five-foot ways (*kaki lima*), flickering neon signs in Malay, Chinese, and Tamil, a 24-hour stainless steel Mamak stall (*Restoran Maju Tekun*), and destructible red plastic stools.
- **Tech Stack**:
  - **Three.js (r160+)**: Scene graph, camera, lighting, geometries, render passes.
  - **Custom WebGL GLSL Shaders**: Planar floor puddle reflections, dynamic rain ripple rings, holographic parallax optic sight, volumetric bloom, screen-space water runoff droplets.
  - **Web Audio API**: 100% procedural sound synthesis (zero external audio files).
  - **Vanilla JavaScript (ES Modules)**: Object-oriented architecture with modular separation of concerns.
  - **Vite 5+**: Ultra-fast build tool and local development server.

---

## ⚠️ 2. Non-Negotiable Core Invariants & Rules

When maintaining or extending this codebase, adhere strictly to these principles:

### Rule 1: Zero External Assets (100% Procedural)
All 3D meshes, procedural textures, neon materials, animations, and sound effects are generated dynamically in code. **Do not introduce external `.gltf`, `.fbx`, `.obj`, `.png`, `.wav`, or `.mp3` assets** that can cause 404s, CORS errors, or CDN outages. Everything must run offline and self-contained.

### Rule 2: Dual Platform Parity (Desktop & Mobile)
The game must always support both desktop keyboard/mouse and mobile touchscreen controls simultaneously:
- **Desktop**: WASD movement, mouse look via Pointer Lock API, Left Click (Fire), Right Click (ADS), R (Reload), Shift (Sprint), Space (Jump), 1/2/3 (Weapon switch), ESC/P (Pause).
- **Mobile**: Dynamic floating virtual joystick with auto-sprint lock (>82%), drag-to-aim while shooting ("Aim-on-Fire"), secondary claw fire button, smart aim assist (friction, magnetism, snap-on-ADS), top-bar weapon pills, auto-fire toggle, fullscreen toggle, and landscape orientation advisory.
- *Any new weapon, ability, or menu must have both keyboard and touch bindings.*

### Rule 3: Port 5180 Convention
The Vite dev server is configured to run on **port 5180** in `vite.config.js`. Do **not** change the default port back to 3000 or 5173, as other services on the host machine frequently collide with those common ports.

### Rule 4: Mobile Performance Budget
- Keep draw calls consolidated where possible.
- `Engine.js` clamps the WebGL renderer device pixel ratio on touch devices to `Math.min(window.devicePixelRatio, 1.6)` to guarantee a stable 60 FPS on mobile Retina/OLED displays without overheating.

### Rule 5: Security & Git Hygiene
- Never commit `.env`, private keys, authentication tokens, API credentials, or temporary logs.
- Refer to `.gitignore` before committing.

---

## 📂 3. Directory Structure & Codebase Map

```
kl-mamak-fps/
├── index.html                   # HTML entry point, mobile viewport meta, orientation overlay
├── package.json                 # npm scripts & Three.js dependencies
├── vite.config.js               # Vite config (configured to port 5180)
├── .gitignore                   # Ignores node_modules, dist, .env, scratch, agent logs
├── .env.example                 # Environment configuration template
├── README.md                    # Public user & player documentation
├── GEMINI.md                    # AI Developer & Agent Architecture Guide (this file)
├── public/
│   └── manifest.json            # PWA manifest (display: fullscreen, orientation: landscape)
├── docs/
│   └── screenshots/             # Documentation screenshots
└── src/
    ├── main.js                  # Entry point bootstrapping the Game Engine
    ├── core/
    │   ├── Engine.js            # Three.js WebGLRenderer, scene, camera, game loop, DPR clamping
    │   ├── InputManager.js      # Desktop keyboard & mouse input, Pointer Lock, buffered key states
    │   ├── AudioManager.js      # Procedural Web Audio API sound generator (gunshots, rain, thunder)
    │   └── PostProcessing.js    # Multi-pass composer (bloom, raindrops, chromatic aberration)
    ├── environment/
    │   ├── AlleywayBuilder.js   # Pre-war shophouses, zinc awnings, conduits, Malay/Chinese/Tamil neons
    │   ├── MamakStallBuilder.js # Stainless steel Roti Canai cart, food warmer, ceiling fans, streetlamps
    │   ├── WeatherSystem.js     # Tropical monsoon rain particles, directional moonlight, thunder/lightning
    │   └── PuddleReflection.js  # Mirrored reflection camera & WebGLRenderTarget for floor puddles
    ├── game/
    │   ├── PlayerController.js  # First-person character controller, movement physics, arena bounding box
    │   ├── WeaponManager.js     # Dual-spring recoil system, ADS interpolation, weapon switching, sway
    │   ├── Weapon.js            # Weapon definition class (damage, fire rate, magazine, audio profiles)
    │   ├── Enemy.js             # Enemy AI class (Rempit Runner, Enforcer, Bio-Goliath, flocking logic)
    │   ├── HordeManager.js      # Escalating wave director, enemy spawning, intermission timers
    │   ├── BulletManager.js     # Hitscan raycasting, wall spark particles, cyber-blood splatters
    │   ├── PropManager.js       # Destructible plastic Mamak stools and tables with kinetic physics
    │   ├── PickupManager.js     # Health stims and ammo crates spawned on enemy defeat
    │   └── GameState.js         # Player health, shield, score, wave counter, kill statistics
    ├── shaders/
    │   ├── puddleShader.js      # Custom GLSL shader with real-time planar reflections & rain ripple rings
    │   ├── holographicReticle.js# Parallax optical chevron/dot RDS reticle for DMR scope
    │   └── postProcessingShaders.js # Volumetric bloom, screen-space raindrops, vignette, chromatic aberration
    ├── ui/
    │   ├── HUD.js               # Tactical cyber HUD, compass, vitals, hitmarkers, responsive mobile layout
    │   ├── Menu.js              # Start, Pause, and Game Over modals, touch guide, stats display
    │   └── MobileControls.js    # Dynamic virtual joystick, Aim-on-Fire, smart aim assist, top bar
    └── utils/
        └── fullscreen.js        # Cross-browser fullscreen API wrapper with orientation locking
```

---

## 🕹️ 4. Key Systems Deep Dive

### 4.1 Weapon Handling & Recoil Dual-Spring System
- **Weapons** ([`src/game/Weapon.js`](file:///opt/data/kl-mamak-fps/src/game/Weapon.js)):
  1. *Mamak Commando-9*: Bullpup SMG/AR, 750 RPM rapid fire, 30-round mag, snappy iron sights.
  2. *Street Sweeper 12G*: Pump-action combat shotgun, 8 pellets per shell, heavy knockback on mamak stools, manual slide rack animation and procedural audio.
  3. *KL-50 Cyber-DMR*: Semi-auto marksman rifle, 10-round mag, 110 damage, 2.5x ADS zoom with holographic parallax chevron optic.
- **Procedural Springs** ([`src/game/WeaponManager.js`](file:///opt/data/kl-mamak-fps/src/game/WeaponManager.js)):
  - Translational kickback: Weapon moves backwards along $Z$.
  - Rotational kickback: Weapon pitches up along $X$ and rolls along $Y$.
  - Viewmodel Sway: Spring-dampened lag following mouse/touch delta.
  - Figure-8 Lissajous Bobbing: Harmonic curves driven by walking/sprinting speed.
  - Tactical Reload: Switching weapons cleanly cancels reloading without locking firing state.

### 4.2 Horde AI & Flocking
- **Director** ([`src/game/HordeManager.js`](file:///opt/data/kl-mamak-fps/src/game/HordeManager.js)):
  - Wave intervals with 5-second intermissions between waves.
  - Rooftop jump spawns: Enemies spawn atop zinc awnings and leap down with ground impact thuds.
- **Archetypes** ([`src/game/Enemy.js`](file:///opt/data/kl-mamak-fps/src/game/Enemy.js)):
  - *Mat Rempit Runner*: Fast, low HP, zigzag attack vector.
  - *Syndicate Enforcer*: Medium speed, heavy armor, glowing tactical visor.
  - *Bio-Goliath*: Giant brute with ground pound shockwave that launches physical props.
- **Flocking & Separation**:
  - Distance-based separation steering prevents enemies from clumping into single-file lines.

### 4.3 Puddle Reflection & Weather Shaders
- **Floor Puddle Shader** ([`src/shaders/puddleShader.js`](file:///opt/data/kl-mamak-fps/src/shaders/puddleShader.js)):
  - Planar reflection camera (`PuddleReflection.js`) updates each frame, rendering the mirrored world to a `WebGLRenderTarget`.
  - Expanding concentric rings with damped cosine profiles simulate raindrops impacting puddles.
  - Multi-octave simplex noise creates screen-space water distortion.
- **Post-Processing Pipeline** ([`src/core/PostProcessing.js`](file:///opt/data/kl-mamak-fps/src/core/PostProcessing.js)):
  - Bright-pass extraction $\rightarrow$ Horizontal blur $\rightarrow$ Vertical blur $\rightarrow$ Composite shader with film grain, chromatic aberration, and screen-space water droplets dripping down the visor.

### 4.4 Procedural Sound Synthesis
- Handled completely in [`src/core/AudioManager.js`](file:///opt/data/kl-mamak-fps/src/core/AudioManager.js) via the Web Audio API:
  - White noise + bandpass filter + gain envelopes $\rightarrow$ Gunshots, rain roar, footstep splashes.
  - Low-frequency sine sweeps + distortion $\rightarrow$ Heavy thunderclaps, shotgun blast punch.
  - High-frequency resonant oscillators $\rightarrow$ Cyber hitmarkers (1.5 kHz) and headshot chimes (2.2 kHz).
  - Mechanical noise bursts $\rightarrow$ Shotgun pump rack (`CLACK-CHICK`) and reload clicks.

### 4.5 Fullscreen & Mobile Optimization
- Cross-browser utility in [`src/utils/fullscreen.js`](file:///opt/data/kl-mamak-fps/src/utils/fullscreen.js) supports standard and vendor-prefixed APIs (`webkit`, `moz`, `ms`).
- Tapping `START PATROL` or `MAIN SEMULA / RETRY` automatically attempts fullscreen.
- Dedicated `[ ⛶ FULLSCREEN ]` buttons are provided on Start, Pause, and Game Over menus, and in the Mobile Top Bar.
- PWA Manifest (`public/manifest.json`) allows iOS Safari and Android Chrome to install to Home Screen for 100% borderless fullscreen without browser navigation bars.

---

## 🛠️ 5. Development & Testing Commands

```bash
# 1. Install dependencies
npm install

# 2. Run local development server (starts on http://localhost:5180)
npm run dev

# 3. Compile production build
npm run build

# 4. Preview production build locally
npm run preview
```

### Running Automated Playtest Suites
When making significant changes to movement, weapons, or UI, run the automated Playwright validation suites:
```bash
# Full desktop progression & combat playtest
node scratch/full_playtest.cjs

# Deep player edge cases (ammo exhaustion, rapid weapon switch, fatal damage)
node scratch/player_edge_cases.cjs

# Mobile dual-touch controls & orientation playtest (844x390 landscape)
node scratch/mobile_playtest.cjs
```

---

## 🤖 6. Guidelines for AI Agents Making Future Improvements

When an AI agent is asked to add features or fix bugs:
1. **Never break existing controls**: If adding an ability (e.g. grenade throw, slide, melee), add a desktop keyboard key *and* a mobile touch button or gesture.
2. **Preserve atmosphere**: Maintain the "Underground Neon KL" cyber-mamak aesthetic (neon cyan `#00ffcc`, hot pink `#ff0055`, amber `#ffaa00`, rain reflections, Malay/Chinese/Tamil cultural touches).
3. **Verify in headless browser**: Run Playwright tests and check that `total uncaught errors === 0`.
4. **Avoid hardcoding external URLs**: Keep the game completely self-hosted and standalone.
