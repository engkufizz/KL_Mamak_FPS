export class HUD {
  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'game-hud';
    this.container.innerHTML = `
      <style>
        #game-hud {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          pointer-events: none;
          user-select: none;
          font-family: 'Rajdhani', 'Segoe UI', 'Impact', sans-serif;
          color: #ffffff;
          overflow: hidden;
          z-index: 10;
        }

        /* High-Contrast Center Crosshair */
        #crosshair-container {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.15s ease;
        }

        .ch-line {
          position: absolute;
          background: #00ffff;
          border: 1px solid rgba(0, 0, 0, 0.95);
          box-shadow: 0 0 6px #00ffff, 0 0 2px #000000;
        }
        .ch-top { width: 3px; height: 11px; top: 2px; }
        .ch-bottom { width: 3px; height: 11px; bottom: 2px; }
        .ch-left { height: 3px; width: 11px; left: 2px; }
        .ch-right { height: 3px; width: 11px; right: 2px; }
        .ch-dot { 
          width: 4px; 
          height: 4px; 
          background: #ffffff; 
          border: 1px solid #000000; 
          box-shadow: 0 0 6px #00ffcc; 
          border-radius: 50%; 
        }

        /* Directional Damage Ring */
        #damage-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 220px;
          height: 220px;
          border-radius: 50%;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.15s ease-out;
        }
        #damage-arc {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 4px solid transparent;
          border-top: 6px solid #ff2233;
          filter: drop-shadow(0 0 8px #ff0022);
        }

        /* Hitmarker */
        #hitmarker {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(45deg);
          width: 32px;
          height: 32px;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.08s ease-out, transform 0.08s ease-out;
        }
        .hm-tick {
          position: absolute;
          background: #ffffff;
          border: 1px solid rgba(0,0,0,0.8);
          box-shadow: 0 0 8px #ffffff;
        }
        .hm-top { width: 3px; height: 10px; top: 0; left: 14.5px; }
        .hm-bottom { width: 3px; height: 10px; bottom: 0; left: 14.5px; }
        .hm-left { height: 3px; width: 10px; left: 0; top: 14.5px; }
        .hm-right { height: 3px; width: 10px; right: 0; top: 14.5px; }

        #hitmarker.active {
          opacity: 1;
          transform: translate(-50%, -50%) rotate(45deg) scale(1.25);
        }
        #hitmarker.headshot .hm-tick {
          background: #ff1133;
          box-shadow: 0 0 12px #ff0022;
        }

        /* Floating Pickup Notification */
        #pickup-notify {
          position: absolute;
          top: 42%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 20px;
          font-weight: 800;
          letter-spacing: 2px;
          opacity: 0;
          text-shadow: 0 0 10px rgba(0,0,0,0.9);
          transition: opacity 0.2s ease, transform 0.2s ease;
          pointer-events: none;
        }
        #pickup-notify.show {
          opacity: 1;
          transform: translate(-50%, -60%);
        }

        /* Bottom Left: Health & Shield */
        #player-vitals {
          position: absolute;
          bottom: 25px;
          left: 25px;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .bar-wrap {
          width: min(280px, 45vw);
          height: 14px;
          background: rgba(10, 15, 20, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.3);
          transform: skewX(-16deg);
          overflow: hidden;
          position: relative;
        }
        #shield-bar {
          height: 100%;
          width: 100%;
          background: linear-gradient(90deg, #0099ff, #00e1ff);
          box-shadow: 0 0 12px #00e1ff;
          transition: width 0.15s ease;
        }
        #health-bar {
          height: 100%;
          width: 100%;
          background: linear-gradient(90deg, #cc1122, #ff3344);
          box-shadow: 0 0 12px #ff2233;
          transition: width 0.15s ease;
        }
        #stamina-bar {
          width: min(180px, 35vw);
          height: 6px;
          background: linear-gradient(90deg, #ffaa00, #ffee55);
          box-shadow: 0 0 8px #ffaa00;
          transition: width 0.1s linear;
        }
        .vitals-text {
          font-size: 16px;
          font-weight: bold;
          letter-spacing: 2px;
          text-shadow: 0 0 8px rgba(0,0,0,0.9);
        }

        /* Bottom Right: Ammo & Weapon Select */
        #weapon-hud {
          position: absolute;
          bottom: 25px;
          right: 25px;
          text-align: right;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
        }
        #ammo-counter {
          display: flex;
          align-items: baseline;
          gap: 8px;
        }
        #current-ammo {
          font-size: min(54px, 12vw);
          font-weight: 900;
          color: #ffffff;
          line-height: 1;
          text-shadow: 0 0 12px #00ffff;
        }
        #reserve-ammo {
          font-size: min(24px, 6vw);
          font-weight: bold;
          color: #88aacc;
        }
        #weapon-name {
          font-size: min(18px, 4.5vw);
          font-weight: 800;
          letter-spacing: 2px;
          color: #00ffcc;
          text-shadow: 0 0 8px #00ffcc;
        }
        #weapon-slots {
          display: flex;
          gap: 6px;
          margin-top: 4px;
        }
        .w-slot {
          padding: 4px 8px;
          background: rgba(15, 20, 30, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.25);
          font-size: 12px;
          font-weight: bold;
          letter-spacing: 1px;
          transform: skewX(-12deg);
          color: #8899aa;
        }
        .w-slot.active {
          border-color: #00ffcc;
          background: rgba(0, 255, 204, 0.25);
          color: #ffffff;
          box-shadow: 0 0 10px rgba(0, 255, 204, 0.4);
        }
        #reload-prompt {
          font-size: 16px;
          font-weight: bold;
          color: #ff3344;
          letter-spacing: 2px;
          text-shadow: 0 0 8px #ff2233;
          animation: blink 0.8s infinite alternate;
          display: none;
        }

        /* Top Center: Wave Banner & Radar */
        #top-hud {
          position: absolute;
          top: 18px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
        }
        #wave-title {
          font-size: min(26px, 6vw);
          font-weight: 900;
          letter-spacing: 4px;
          color: #ffcc00;
          text-shadow: 0 0 15px rgba(255, 204, 0, 0.8);
        }
        #enemy-count {
          font-size: 14px;
          letter-spacing: 2px;
          color: #aabbcc;
        }

        /* Tactical Threat Compass Bar */
        #threat-compass {
          width: 220px;
          height: 18px;
          background: rgba(10, 16, 26, 0.65);
          border: 1px solid rgba(0, 255, 204, 0.35);
          border-radius: 10px;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 2px;
        }
        #compass-center-mark {
          width: 2px;
          height: 100%;
          background: #00ffcc;
          box-shadow: 0 0 4px #00ffcc;
        }
        .compass-blip {
          position: absolute;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #ff2244;
          box-shadow: 0 0 6px #ff2244;
          top: 6px;
        }

        /* Top Left: Score & Combo */
        #score-hud {
          position: absolute;
          top: 18px;
          left: 25px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        #score-val {
          font-size: min(28px, 6.5vw);
          font-weight: 900;
          letter-spacing: 2px;
          color: #ffffff;
          text-shadow: 0 0 10px rgba(0, 255, 255, 0.6);
        }
        #combo-badge {
          font-size: 16px;
          font-weight: bold;
          letter-spacing: 2px;
          color: #ff0055;
          text-shadow: 0 0 10px #ff0055;
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        /* Big Wave Notification Banner */
        #announcement-banner {
          position: absolute;
          top: 35%;
          left: 50%;
          transform: translate(-50%, -50%) scale(0.9);
          text-align: center;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s ease, transform 0.3s ease;
        }
        #announcement-banner.show {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1.05);
        }
        #announce-main {
          font-size: min(52px, 11vw);
          font-weight: 900;
          letter-spacing: 5px;
          color: #00ffcc;
          text-shadow: 0 0 25px rgba(0, 255, 204, 0.9);
        }
        #announce-sub {
          font-size: min(20px, 4.5vw);
          letter-spacing: 3px;
          color: #ffea79;
          margin-top: 4px;
        }

        @keyframes blink {
          0% { opacity: 0.3; }
          100% { opacity: 1.0; }
        }

        /* Mobile Touch Layout Adaptations */
        @media (max-width: 900px), (pointer: coarse) {
          #player-vitals {
            bottom: auto;
            top: 60px;
            left: 14px;
            gap: 3px;
          }
          .bar-wrap {
            width: 155px;
            height: 10px;
          }
          #stamina-bar {
            width: 110px;
            height: 4px;
          }
          .vitals-text {
            font-size: 11px;
            letter-spacing: 1px;
          }

          #score-hud {
            top: 12px;
            left: 66px; /* Positioned adjacent to mobile pause/fullscreen buttons */
          }
          #score-val {
            font-size: 19px;
          }
          .score-label {
            font-size: 9px;
          }

          #weapon-hud {
            bottom: 140px; /* Comfortably above action buttons */
            right: 16px;
            gap: 2px;
          }
          #current-ammo {
            font-size: 38px;
          }
          #reserve-ammo {
            font-size: 18px;
          }
          #weapon-name {
            font-size: 13px;
          }
          #weapon-slots {
            display: none !important; /* Mobile top bar pills used instead */
          }

          #threat-compass {
            width: 160px;
            height: 14px;
          }
          #wave-title {
            font-size: 18px;
            letter-spacing: 2px;
          }
          #enemy-count {
            font-size: 11px;
          }
        }
      </style>

      <!-- Center Reticle & Hitmarker -->
      <div id="crosshair-container">
        <div class="ch-line ch-top"></div>
        <div class="ch-line ch-bottom"></div>
        <div class="ch-line ch-left"></div>
        <div class="ch-line ch-right"></div>
        <div class="ch-dot"></div>
      </div>

      <div id="damage-ring">
        <div id="damage-arc"></div>
      </div>

      <div id="hitmarker">
        <div class="hm-tick hm-top"></div>
        <div class="hm-tick hm-bottom"></div>
        <div class="hm-tick hm-left"></div>
        <div class="hm-tick hm-right"></div>
      </div>

      <div id="pickup-notify"></div>

      <!-- Top Center Wave & Threat Compass -->
      <div id="top-hud">
        <div id="wave-title">GELOMBANG 1</div>
        <div id="enemy-count">MUSUH TINGGAL: 8</div>
        <div id="threat-compass">
          <div id="compass-center-mark"></div>
        </div>
      </div>

      <!-- Top Left Score -->
      <div id="score-hud">
        <div style="font-size: 11px; letter-spacing: 2px; color: #88aacc;">SKOR SIBER</div>
        <div id="score-val">000000</div>
        <div id="combo-badge">KOMBO x2 · MAMAK RAMPAGE!</div>
      </div>

      <!-- Bottom Left Vitals -->
      <div id="player-vitals">
        <div class="vitals-text" id="hp-label">HP: 100 | SHD: 50</div>
        <div class="bar-wrap">
          <div id="shield-bar"></div>
        </div>
        <div class="bar-wrap">
          <div id="health-bar"></div>
        </div>
        <div class="bar-wrap" style="height: 6px; width: min(180px, 35vw);">
          <div id="stamina-bar"></div>
        </div>
      </div>

      <!-- Bottom Right Weapon -->
      <div id="weapon-hud">
        <div id="reload-prompt">PRESS [R] TO RELOAD</div>
        <div id="ammo-counter">
          <span id="current-ammo">30</span>
          <span id="reserve-ammo">/ 180</span>
        </div>
        <div id="weapon-name">MAMAK COMMANDO-9</div>
        <div id="weapon-slots">
          <div class="w-slot active" id="slot-0">[1] BULLPUP</div>
          <div class="w-slot" id="slot-1">[2] SHOTGUN</div>
          <div class="w-slot" id="slot-2">[3] DMR</div>
        </div>
      </div>

      <!-- Wave Announcement -->
      <div id="announcement-banner">
        <div id="announce-main">GELOMBANG 1</div>
        <div id="announce-sub">KL SYNDICATE INCOMING</div>
      </div>
    `;

    document.body.appendChild(this.container);

    this.hitmarkerEl = this.container.querySelector('#hitmarker');
    this.crosshairEl = this.container.querySelector('#crosshair-container');
    this.shieldBarEl = this.container.querySelector('#shield-bar');
    this.healthBarEl = this.container.querySelector('#health-bar');
    this.staminaBarEl = this.container.querySelector('#stamina-bar');
    this.vitalsTextEl = this.container.querySelector('#hp-label');
    this.currentAmmoEl = this.container.querySelector('#current-ammo');
    this.reserveAmmoEl = this.container.querySelector('#reserve-ammo');
    this.weaponNameEl = this.container.querySelector('#weapon-name');
    this.reloadPromptEl = this.container.querySelector('#reload-prompt');
    this.waveTitleEl = this.container.querySelector('#wave-title');
    this.enemyCountEl = this.container.querySelector('#enemy-count');
    this.scoreValEl = this.container.querySelector('#score-val');
    this.comboBadgeEl = this.container.querySelector('#combo-badge');
    this.announceBannerEl = this.container.querySelector('#announcement-banner');
    this.announceMainEl = this.container.querySelector('#announce-main');
    this.announceSubEl = this.container.querySelector('#announce-sub');
    this.damageRingEl = this.container.querySelector('#damage-ring');
    this.damageArcEl = this.container.querySelector('#damage-arc');
    this.pickupNotifyEl = this.container.querySelector('#pickup-notify');
    this.threatCompassEl = this.container.querySelector('#threat-compass');

    this.slotEls = [
      this.container.querySelector('#slot-0'),
      this.container.querySelector('#slot-1'),
      this.container.querySelector('#slot-2')
    ];

    this.hitmarkerTimeout = null;
    this.bannerTimeout = null;
    this.pickupTimeout = null;
    this.damageTimeout = null;
  }

  triggerHitmarker(isHeadshot = false) {
    if (this.hitmarkerTimeout) clearTimeout(this.hitmarkerTimeout);

    this.hitmarkerEl.className = isHeadshot ? 'active headshot' : 'active';
    this.hitmarkerTimeout = setTimeout(() => {
      this.hitmarkerEl.className = '';
    }, 110);
  }

  showDamageDirection(angleRad) {
    if (this.damageTimeout) clearTimeout(this.damageTimeout);

    // Rotate arc to attacker's relative direction
    const deg = (angleRad * 180) / Math.PI;
    this.damageArcEl.style.transform = `rotate(${deg}deg)`;
    this.damageRingEl.style.opacity = '1';

    this.damageTimeout = setTimeout(() => {
      this.damageRingEl.style.opacity = '0';
    }, 450);
  }

  showPickupNotification(text, color = '#00ffcc') {
    if (this.pickupTimeout) clearTimeout(this.pickupTimeout);

    this.pickupNotifyEl.textContent = text;
    this.pickupNotifyEl.style.color = color;
    this.pickupNotifyEl.style.textShadow = `0 0 12px ${color}`;
    this.pickupNotifyEl.classList.add('show');

    this.pickupTimeout = setTimeout(() => {
      this.pickupNotifyEl.classList.remove('show');
    }, 1600);
  }

  showWaveBanner(waveNum) {
    if (this.bannerTimeout) clearTimeout(this.bannerTimeout);

    this.announceMainEl.textContent = `GELOMBANG ${waveNum}`;
    this.announceSubEl.textContent = 'KL UNDERGROUND SYNDICATE INCOMING';
    this.announceBannerEl.classList.add('show');

    this.bannerTimeout = setTimeout(() => {
      this.announceBannerEl.classList.remove('show');
    }, 2800);
  }

  showWaveClearedBanner(waveNum) {
    if (this.bannerTimeout) clearTimeout(this.bannerTimeout);

    this.announceMainEl.textContent = `GELOMBANG ${waveNum} SELESAI!`;
    this.announceSubEl.textContent = 'SECTOR SECURED · BONUS +500 PTS';
    this.announceBannerEl.classList.add('show');

    this.bannerTimeout = setTimeout(() => {
      this.announceBannerEl.classList.remove('show');
    }, 2600);
  }

  update(gameState, weaponManager, playerController, enemies = []) {
    if (!gameState || !weaponManager) return;

    // Vitals
    const hpPct = Math.max(0, Math.min(100, (gameState.health / gameState.maxHealth) * 100));
    const shdPct = Math.max(0, Math.min(100, (gameState.shield / gameState.maxShield) * 100));
    this.healthBarEl.style.width = `${hpPct}%`;
    this.shieldBarEl.style.width = `${shdPct}%`;
    this.vitalsTextEl.textContent = `HP: ${Math.round(gameState.health)} | SHD: ${Math.round(gameState.shield)}`;

    // Stamina
    if (playerController) {
      const stamPct = Math.max(0, Math.min(100, (playerController.stamina / playerController.maxStamina) * 100));
      this.staminaBarEl.style.width = `${stamPct}%`;
    }

    // Active Weapon Info
    const active = weaponManager.getActiveWeapon();
    if (active) {
      this.currentAmmoEl.textContent = active.currentAmmo;
      this.reserveAmmoEl.textContent = `/ ${active.reserveAmmo}`;
      this.weaponNameEl.textContent = active.name;

      if (active.currentAmmo <= 0 || (active.currentAmmo <= active.magSize * 0.25 && !active.isReloading)) {
        this.reloadPromptEl.style.display = 'block';
        this.reloadPromptEl.textContent = active.isReloading ? 'RELOADING...' : 'PRESS [R] TO RELOAD';
      } else {
        this.reloadPromptEl.style.display = 'none';
      }

      // Sockets highlight
      this.slotEls.forEach((el, idx) => {
        if (idx === weaponManager.currentSlot) el.classList.add('active');
        else el.classList.remove('active');
      });

      // Hide center crosshair during ADS for clean sights / optics
      this.crosshairEl.style.opacity = weaponManager.isADS ? '0' : '1';
    }

    // Wave & Enemies
    this.waveTitleEl.textContent = `GELOMBANG ${gameState.wave}`;
    this.enemyCountEl.textContent = `MUSUH TINGGAL: ${gameState.enemiesRemaining}`;

    // Score & Combo
    this.scoreValEl.textContent = gameState.score.toString().padStart(6, '0');
    if (gameState.comboCount >= 2) {
      this.comboBadgeEl.style.opacity = '1';
      this.comboBadgeEl.textContent = `KOMBO x${gameState.comboMultiplier} · ${gameState.comboCount >= 6 ? 'MAMAK RAMPAGE!' : 'STREET CARNAGE!'}`;
    } else {
      this.comboBadgeEl.style.opacity = '0';
    }

    // Update Threat Compass Blips
    if (playerController && enemies && enemies.length > 0) {
      // Clear old blips
      const oldBlips = this.threatCompassEl.querySelectorAll('.compass-blip');
      oldBlips.forEach(b => b.remove());

      const playerYaw = playerController.yaw;
      const compassWidth = 220;

      for (let i = 0; i < Math.min(enemies.length, 8); i++) {
        const e = enemies[i];
        if (!e.isAlive()) continue;

        // Angle from player to enemy
        const dx = e.position.x - playerController.position.x;
        const dz = e.position.z - playerController.position.z;
        const enemyAngle = Math.atan2(dx, -dz);

        // Relative to player yaw
        let diff = enemyAngle - playerYaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        // Map to [-PI/2, PI/2] compass range
        if (Math.abs(diff) < Math.PI * 0.5) {
          const normX = diff / (Math.PI * 0.5); // [-1, 1]
          const pixelX = (compassWidth / 2) + normX * (compassWidth / 2 - 8);

          const blip = document.createElement('div');
          blip.className = 'compass-blip';
          blip.style.left = `${pixelX}px`;
          this.threatCompassEl.appendChild(blip);
        }
      }
    }
  }
}
