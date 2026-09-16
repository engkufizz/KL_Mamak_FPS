import { requestFullScreen, toggleFullScreen, isFullScreen, onFullScreenChange } from '../utils/fullscreen.js';

export class Menu {
  constructor(onStartGame, onRestartGame, onQualityChange = null) {
    this.onStartGame = onStartGame;
    this.onRestartGame = onRestartGame;
    this.onQualityChange = onQualityChange;
    this.quality = 'balanced';

    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    this.container = document.createElement('div');
    this.container.id = 'game-menus';
    this.container.innerHTML = `
      <style>
        #game-menus {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          font-family: 'Rajdhani', 'Segoe UI', 'Impact', sans-serif;
          color: #ffffff;
          z-index: 100;
          user-select: none;
          pointer-events: none;
        }

        .menu-modal {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: radial-gradient(circle at 50% 50%, rgba(10, 15, 25, 0.90), rgba(4, 6, 10, 0.97));
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          transition: opacity 0.25s ease;
          padding: 16px;
          pointer-events: auto;
        }

        .menu-modal.hidden {
          display: none;
        }

        .cyber-title {
          font-size: clamp(28px, 6.2vw, 56px);
          font-weight: 900;
          letter-spacing: 5px;
          text-align: center;
          color: #00ffcc;
          text-shadow: 0 0 25px rgba(0, 255, 204, 0.8), 0 0 50px rgba(0, 255, 204, 0.4);
          line-height: 1.1;
          margin-bottom: 4px;
        }

        .cyber-subtitle {
          font-size: clamp(12px, 2.6vw, 18px);
          letter-spacing: 3px;
          color: #ffaa00;
          text-shadow: 0 0 10px rgba(255, 170, 0, 0.6);
          margin-bottom: clamp(16px, 3.5vh, 28px);
          text-align: center;
        }

        .btn-play {
          padding: clamp(12px, 2.5vw, 16px) clamp(24px, 5vw, 48px);
          font-size: clamp(16px, 3.6vw, 24px);
          font-weight: 900;
          letter-spacing: 3px;
          color: #0d1117;
          background: #00ffcc;
          border: none;
          cursor: pointer;
          transform: skewX(-14deg);
          box-shadow: 0 0 25px rgba(0, 255, 204, 0.6);
          transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
          margin-bottom: clamp(16px, 3.5vh, 30px);
          touch-action: manipulation;
        }

        .btn-play:hover, .btn-play:active {
          background: #ffffff;
          box-shadow: 0 0 35px rgba(255, 255, 255, 0.9);
          transform: skewX(-14deg) scale(1.04);
        }

        .controls-card {
          background: rgba(14, 20, 30, 0.88);
          border: 1px solid rgba(0, 255, 204, 0.35);
          border-radius: 6px;
          padding: clamp(12px, 2.5vw, 20px) clamp(16px, 3.5vw, 28px);
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px 24px;
          font-size: clamp(12px, 2.4vw, 15px);
          letter-spacing: 1px;
          max-width: min(92vw, 640px);
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6);
        }

        .control-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .ctrl-key {
          display: inline-block;
          min-width: 72px;
          padding: 3px 8px;
          background: rgba(0, 255, 204, 0.15);
          border: 1px solid rgba(0, 255, 204, 0.4);
          border-radius: 4px;
          font-weight: bold;
          font-size: 12px;
          color: #00ffcc;
          text-align: center;
          box-shadow: 0 0 8px rgba(0, 255, 204, 0.2);
          white-space: nowrap;
        }

        .ctrl-desc {
          color: #d0e0f0;
          font-weight: 500;
        }

        /* Game Over Stats */
        .stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px clamp(20px, 5vw, 40px);
          margin: clamp(14px, 2.5vh, 25px) 0 clamp(20px, 3.5vh, 35px) 0;
          background: rgba(25, 12, 15, 0.85);
          border: 1px solid rgba(255, 34, 68, 0.4);
          padding: 16px clamp(20px, 4vw, 40px);
          border-radius: 4px;
        }

        .stat-item {
          text-align: center;
        }
        .stat-label {
          font-size: 12px;
          color: #8899aa;
          letter-spacing: 2px;
        }
        .stat-value {
          font-size: clamp(24px, 5vw, 34px);
          font-weight: 900;
          color: #ff3344;
          text-shadow: 0 0 12px rgba(255, 51, 68, 0.6);
        }

        .btn-group {
          display: flex;
          gap: 12px;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: clamp(14px, 3vh, 26px);
        }

        .btn-secondary {
          padding: clamp(10px, 2.2vw, 14px) clamp(18px, 3.8vw, 32px);
          font-size: clamp(14px, 3vw, 18px);
          font-weight: 700;
          letter-spacing: 2px;
          color: #00ffcc;
          background: rgba(0, 255, 204, 0.12);
          border: 1px solid rgba(0, 255, 204, 0.5);
          border-radius: 4px;
          cursor: pointer;
          transform: skewX(-12deg);
          box-shadow: 0 0 15px rgba(0, 255, 204, 0.25);
          transition: all 0.15s ease;
          touch-action: manipulation;
          font-family: inherit;
        }

        .btn-secondary:hover, .btn-secondary:active {
          background: rgba(0, 255, 204, 0.3);
          border-color: #00ffcc;
          box-shadow: 0 0 25px rgba(0, 255, 204, 0.6);
          color: #ffffff;
        }

        .ios-tip {
          font-size: clamp(11px, 2.2vw, 13px);
          color: #88aacc;
          background: rgba(0, 20, 40, 0.6);
          border: 1px dashed rgba(0, 255, 204, 0.3);
          border-radius: 6px;
          padding: 6px 14px;
          margin-top: 10px;
          text-align: center;
          max-width: 90vw;
          letter-spacing: 0.5px;
        }

        @media (max-width: 600px) {
          .controls-card {
            grid-template-columns: 1fr;
            gap: 8px;
          }
        }
      </style>

      <!-- Start Screen -->
      <div id="start-modal" class="menu-modal">
        <div class="cyber-title">KL UNDERGROUND<br><span style="color: #ff0055; text-shadow: 0 0 25px rgba(255, 0, 85, 0.8);">MAMAK ALLEYWAY SIEGE</span></div>
        <div class="cyber-subtitle">KUALA LUMPUR 2:00 AM · MONSOON RAIN · HIGH-OCTANE SURVIVAL</div>

        <div class="btn-group">
          <button id="btn-start" class="btn-play" style="margin-bottom: 0;">${this.isTouchDevice ? 'START PATROL (TAP TO PLAY)' : 'START PATROL (LOCK MOUSE)'}</button>
          <button id="btn-start-fs" class="btn-secondary" title="Toggle Fullscreen">⛶ FULLSCREEN</button>
          <button id="btn-start-quality" class="btn-secondary" title="Toggle Graphics Quality">⚡ PERF: BALANCED</button>
        </div>

        <div class="controls-card" id="controls-container">
          ${this.isTouchDevice ? `
            <div class="control-row"><span class="ctrl-key">LEFT THUMB</span><span class="ctrl-desc">Virtual Joystick (Move & Auto-Sprint)</span></div>
            <div class="control-row"><span class="ctrl-key">RIGHT THUMB</span><span class="ctrl-desc">Swipe to Aim (Fast 180° Turns)</span></div>
            <div class="control-row"><span class="ctrl-key">FIRE BUTTON</span><span class="ctrl-desc">Hold to Shoot + Drag to Aim</span></div>
            <div class="control-row"><span class="ctrl-key">ADS BUTTON</span><span class="ctrl-desc">Aim Down Sights (Target Snap)</span></div>
            <div class="control-row"><span class="ctrl-key">WEAPON PILLS</span><span class="ctrl-desc">1: SMG · 2: Shotgun · 3: DMR</span></div>
            <div class="control-row"><span class="ctrl-key">AUTO-FIRE</span><span class="ctrl-desc">Toggle Simple Shoot Mode</span></div>
          ` : `
            <div class="control-row"><span class="ctrl-key">WASD</span><span class="ctrl-desc">Walk & Strafe</span></div>
            <div class="control-row"><span class="ctrl-key">SHIFT</span><span class="ctrl-desc">Tactical Sprint</span></div>
            <div class="control-row"><span class="ctrl-key">SPACE</span><span class="ctrl-desc">Jump / Vault</span></div>
            <div class="control-row"><span class="ctrl-key">R-CLICK</span><span class="ctrl-desc">Aim Down Sights</span></div>
            <div class="control-row"><span class="ctrl-key">L-CLICK</span><span class="ctrl-desc">Fire Weapon</span></div>
            <div class="control-row"><span class="ctrl-key">R</span><span class="ctrl-desc">Reload Magazine</span></div>
            <div class="control-row"><span class="ctrl-key">1 · 2 · 3</span><span class="ctrl-desc">Bullpup / Shotgun / DMR</span></div>
            <div class="control-row"><span class="ctrl-key">ESC / P</span><span class="ctrl-desc">Pause Mission</span></div>
          `}
        </div>
        <div style="margin-top: 12px; font-size: 12px; color: #88aacc; letter-spacing: 1.5px; text-align: center;">
          ✦ TOUCH CONTROLS & VIRTUAL STICK ENABLED ON MOBILE · HEADPHONES RECOMMENDED ✦
        </div>
        <div class="ios-tip">💡 Tip for iPhone / iPad: Tap Share ⎋ ➔ 'Add to Home Screen' or in address bar tap 'aA' ➔ 'Hide Toolbar' for borderless full screen!</div>
      </div>

      <!-- Pause Screen -->
      <div id="pause-modal" class="menu-modal hidden">
        <div class="cyber-title" style="font-size: clamp(32px, 6vw, 46px); color: #ffaa00; text-shadow: 0 0 20px #ffaa00;">MISSION PAUSED</div>
        <div class="cyber-subtitle">TACTICAL COMMS ACTIVE</div>
        <div class="btn-group">
          <button id="btn-resume" class="btn-play" style="margin-bottom: 0;">RESUME COMBAT</button>
          <button id="btn-pause-fs" class="btn-secondary">⛶ FULLSCREEN</button>
          <button id="btn-pause-quality" class="btn-secondary" title="Toggle Graphics Quality">⚡ PERF: BALANCED</button>
        </div>
        <button id="btn-pause-restart" class="btn-play" style="background: #2a3544; color: #00ffcc; box-shadow: 0 0 15px rgba(0,255,204,0.3); font-size: clamp(14px, 3vw, 18px); padding: 10px 28px;">RESTART MISSION</button>
      </div>

      <!-- Game Over Screen -->
      <div id="gameover-modal" class="menu-modal hidden">
        <div class="cyber-title" style="color: #ff2233; text-shadow: 0 0 30px #ff2233;">ANDA TELAH TUMBANG</div>
        <div class="cyber-subtitle" style="color: #ff99aa;">YOU HAVE FALLEN IN THE ALLEY</div>

        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-label">FINAL SKOR</div>
            <div class="stat-value" id="go-score">000000</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">GELOMBANG DICAPAI</div>
            <div class="stat-value" id="go-wave">1</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">SYNDICATE KILLS</div>
            <div class="stat-value" id="go-kills">0</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">HEADSHOT KILLS</div>
            <div class="stat-value" id="go-headshots">0</div>
          </div>
        </div>

        <div class="btn-group">
          <button id="btn-restart" class="btn-play" style="background: #ff2244; box-shadow: 0 0 25px rgba(255, 34, 68, 0.7); color: #fff; margin-bottom: 0;">MAIN SEMULA / RETRY</button>
          <button id="btn-go-fs" class="btn-secondary" style="border-color: rgba(255, 34, 68, 0.6); color: #ff6688; box-shadow: 0 0 15px rgba(255, 34, 68, 0.3);">⛶ FULLSCREEN</button>
          <button id="btn-go-quality" class="btn-secondary" style="border-color: rgba(255, 34, 68, 0.6); color: #ff6688; box-shadow: 0 0 15px rgba(255, 34, 68, 0.3);" title="Toggle Graphics Quality">⚡ PERF: BALANCED</button>
        </div>
        <div class="ios-tip">💡 Tip: Tap <b>⛶ FULLSCREEN</b> for full screen. (On iPhone Safari: Tap Share ➔ 'Add to Home Screen' or 'aA' ➔ 'Hide Toolbar')</div>
      </div>
    `;

    document.body.appendChild(this.container);

    this.startModal = this.container.querySelector('#start-modal');
    this.pauseModal = this.container.querySelector('#pause-modal');
    this.gameOverModal = this.container.querySelector('#gameover-modal');

    this.btnStart = this.container.querySelector('#btn-start');
    this.btnResume = this.container.querySelector('#btn-resume');
    this.btnRestart = this.container.querySelector('#btn-restart');
    this.btnPauseRestart = this.container.querySelector('#btn-pause-restart');

    this.btnStartFs = this.container.querySelector('#btn-start-fs');
    this.btnPauseFs = this.container.querySelector('#btn-pause-fs');
    this.btnGoFs = this.container.querySelector('#btn-go-fs');

    this.btnStartQuality = this.container.querySelector('#btn-start-quality');
    this.btnPauseQuality = this.container.querySelector('#btn-pause-quality');
    this.btnGoQuality = this.container.querySelector('#btn-go-quality');

    this.goScore = this.container.querySelector('#go-score');
    this.goWave = this.container.querySelector('#go-wave');
    this.goKills = this.container.querySelector('#go-kills');
    this.goHeadshots = this.container.querySelector('#go-headshots');

    this.setupListeners();
    this.setQuality(this.quality);
  }

  setQuality(quality) {
    this.quality = quality;
    const labelMap = {
      performance: '⚡ PERF: FAST (ORANGE PI)',
      balanced: '⚡ PERF: BALANCED (60 FPS)',
      high: '⚡ PERF: ULTRA (MAX EFFECTS)'
    };
    const label = labelMap[quality] || '⚡ PERF: BALANCED';
    if (this.btnStartQuality) this.btnStartQuality.textContent = label;
    if (this.btnPauseQuality) this.btnPauseQuality.textContent = label;
    if (this.btnGoQuality) this.btnGoQuality.textContent = label;
  }

  cycleQuality() {
    const qualities = ['performance', 'balanced', 'high'];
    const nextIdx = (qualities.indexOf(this.quality) + 1) % qualities.length;
    const nextQuality = qualities[nextIdx];
    this.setQuality(nextQuality);
    if (typeof this.onQualityChange === 'function') {
      this.onQualityChange(nextQuality);
    }
  }

  setupListeners() {
    const handleToggleFs = (e) => {
      if (e && e.cancelable) e.preventDefault();
      toggleFullScreen();
    };

    [this.btnStartFs, this.btnPauseFs, this.btnGoFs].forEach((btn) => {
      if (btn) {
        btn.addEventListener('touchstart', handleToggleFs, { passive: false });
        btn.addEventListener('click', handleToggleFs);
      }
    });

    const handleCycleQuality = (e) => {
      if (e && e.cancelable) e.preventDefault();
      this.cycleQuality();
    };

    [this.btnStartQuality, this.btnPauseQuality, this.btnGoQuality].forEach((btn) => {
      if (btn) {
        btn.addEventListener('touchstart', handleCycleQuality, { passive: false });
        btn.addEventListener('click', handleCycleQuality);
      }
    });

    onFullScreenChange((isFs) => {
      const label = isFs ? '✖ EXIT FULLSCREEN' : '⛶ FULLSCREEN';
      if (this.btnStartFs) this.btnStartFs.textContent = label;
      if (this.btnPauseFs) this.btnPauseFs.textContent = label;
      if (this.btnGoFs) this.btnGoFs.textContent = label;
    });

    this.btnStart.addEventListener('click', () => {
      if (this.isTouchDevice) requestFullScreen();
      this.hideAll();
      if (this.onStartGame) this.onStartGame();
    });

    this.btnResume.addEventListener('click', () => {
      this.hideAll();
      if (this.onStartGame) this.onStartGame();
    });

    this.btnRestart.addEventListener('click', () => {
      if (this.isTouchDevice) requestFullScreen();
      this.hideAll();
      if (this.onRestartGame) this.onRestartGame();
    });

    if (this.btnPauseRestart) {
      this.btnPauseRestart.addEventListener('click', () => {
        this.hideAll();
        if (this.onRestartGame) this.onRestartGame();
      });
    }
  }

  hideAll() {
    this.startModal.classList.add('hidden');
    this.pauseModal.classList.add('hidden');
    this.gameOverModal.classList.add('hidden');
  }

  showPause() {
    this.hideAll();
    this.pauseModal.classList.remove('hidden');
  }

  showGameOver(gameState) {
    this.hideAll();
    if (gameState) {
      this.goScore.textContent = gameState.score.toString().padStart(6, '0');
      this.goWave.textContent = gameState.wave;
      this.goKills.textContent = gameState.kills;
      this.goHeadshots.textContent = gameState.headshots;
    }
    this.gameOverModal.classList.remove('hidden');
  }
}
