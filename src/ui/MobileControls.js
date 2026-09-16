import * as THREE from 'three';
import { toggleFullScreen, onFullScreenChange } from '../utils/fullscreen.js';

/**
 * MobileControls - AAA Touch Controls for Mobile / Tablet WebGL FPS.
 * Features:
 * - Dynamic Floating Joystick with Auto-Sprint zone (>82% forward)
 * - Drag-to-Aim on Fire Buttons (Aim-on-Fire recoil compensation)
 * - Non-linear touch look sensitivity with velocity flick acceleration
 * - Precision ADS sensitivity scaling
 * - Mobile Smart Aim Assist (Aim Friction, Target Magnetism, Snap-on-ADS)
 * - Toggleable Auto-Fire ("Simple Mode" for one-thumb / casual play)
 * - Secondary Left Fire button for Claw / 3-finger grip
 * - Mobile Top Bar: Pause button, Fullscreen button, Auto-Fire pill, Weapon selector
 * - Responsive Orientation Advisory Overlay (portrait to landscape prompt)
 */
export class MobileControls {
  constructor(playerController, weaponManager, inputManager, onPauseCallback = null, onQualityChange = null) {
    this.player = playerController;
    this.weapons = weaponManager;
    this.input = inputManager;
    this.onPause = onPauseCallback;
    this.onQualityChange = onQualityChange;
    this.quality = 'balanced';

    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.enabled = this.isTouchDevice;

    // Movement vector output
    this.moveVector = { forward: 0, right: 0 };
    this.isSprinting = false;

    // Joystick state
    this.joystickTouchId = null;
    this.joystickCenter = { x: 0, y: 0 };
    this.joystickDelta = { x: 0, y: 0 };
    this.maxRadius = 55;

    // Camera look state
    this.lookTouchId = null;
    this.lastLookX = 0;
    this.lastLookY = 0;

    // Fire button look state (Aim-on-Fire)
    this.fireTouchId = null;
    this.lastFireX = 0;
    this.lastFireY = 0;

    // Left Fire button look state
    this.leftFireTouchId = null;
    this.lastLeftFireX = 0;
    this.lastLeftFireY = 0;

    // Aim Assist & Auto Fire
    this.aimAssistEnabled = true;
    this.autoFire = false;
    this.isAimFrictionActive = false;
    this.lastAutoFireTime = 0;

    // Forward vector cache
    this.camDir = new THREE.Vector3();

    this.initDOM();
    this.setupOrientationHandler();

    if (this.enabled) {
      this.show();
    } else {
      this.hide();
    }
  }

  initDOM() {
    this.container = document.createElement('div');
    this.container.id = 'mobile-controls-root';
    this.container.innerHTML = `
      <style>
        #mobile-controls-root {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          pointer-events: none;
          z-index: 50;
          user-select: none;
          -webkit-user-select: none;
          display: none;
        }
        #mobile-controls-root.active {
          display: block;
        }

        /* Top Mobile Control Bar */
        #mobile-top-bar {
          position: absolute;
          top: 12px;
          left: 12px;
          right: 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          pointer-events: auto;
          z-index: 80;
        }
        .mob-top-group {
          display: flex;
          align-items: center;
          gap: 8px;
          pointer-events: auto;
        }
        .mob-icon-btn {
          width: 44px;
          height: 44px;
          border-radius: 8px;
          background: rgba(10, 16, 26, 0.85);
          border: 1px solid rgba(0, 255, 204, 0.4);
          color: #00ffcc;
          font-size: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 10px rgba(0, 255, 204, 0.2);
          cursor: pointer;
          touch-action: manipulation;
          pointer-events: auto;
        }
        .mob-icon-btn:active {
          transform: scale(0.92);
          background: rgba(0, 255, 204, 0.3);
        }

        .mob-pill-btn {
          padding: 7px 12px;
          background: rgba(10, 16, 26, 0.85);
          border: 1px solid rgba(0, 255, 204, 0.35);
          border-radius: 6px;
          color: #88bbdd;
          font-family: 'Rajdhani', sans-serif;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1px;
          cursor: pointer;
          touch-action: manipulation;
          box-shadow: 0 2px 6px rgba(0,0,0,0.5);
          white-space: nowrap;
          pointer-events: auto;
        }
        .mob-pill-btn.active {
          border-color: #00ffcc;
          color: #ffffff;
          background: rgba(0, 255, 204, 0.3);
          box-shadow: 0 0 12px rgba(0, 255, 204, 0.4);
        }
        #btn-mob-autofire.active {
          border-color: #ffaa00;
          color: #ffea79;
          background: rgba(255, 170, 0, 0.3);
          box-shadow: 0 0 12px rgba(255, 170, 0, 0.5);
        }

        /* Left Touch Movement Area */
        #touch-move-zone {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 46vw;
          height: 75vh;
          pointer-events: auto;
          touch-action: none;
        }

        /* Virtual Floating Joystick */
        #virtual-joystick-base {
          position: absolute;
          width: 124px;
          height: 124px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(12, 22, 34, 0.6) 0%, rgba(5, 10, 18, 0.75) 100%);
          border: 2px solid rgba(0, 255, 204, 0.5);
          box-shadow: 0 0 18px rgba(0, 255, 204, 0.25);
          transform: translate(-50%, -50%);
          display: none;
          pointer-events: none;
        }
        #virtual-joystick-sprint-zone {
          position: absolute;
          top: -14px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1px;
          color: rgba(0, 255, 204, 0.5);
          transition: color 0.15s ease, text-shadow 0.15s ease;
        }
        #virtual-joystick-sprint-zone.locked {
          color: #ffcc00;
          text-shadow: 0 0 8px #ffcc00;
        }
        #virtual-joystick-knob {
          position: absolute;
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: linear-gradient(135deg, #00ffcc, #0088ff);
          box-shadow: 0 0 14px #00ffcc;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }

        /* Secondary Left Fire Button (Claw Grip) */
        #btn-mob-left-fire {
          position: absolute;
          left: 20px;
          bottom: 160px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg, rgba(255, 40, 60, 0.8), rgba(255, 90, 0, 0.8));
          border: 2px solid rgba(255, 255, 255, 0.7);
          box-shadow: 0 0 14px rgba(255, 40, 60, 0.6);
          color: #ffffff;
          font-family: 'Rajdhani', sans-serif;
          font-weight: 800;
          font-size: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: auto;
          touch-action: none;
        }
        #btn-mob-left-fire:active, #btn-mob-left-fire.pressed {
          transform: scale(0.92);
          box-shadow: 0 0 22px rgba(255, 40, 60, 0.9);
        }

        /* Right Touch Look Area (Below Top Bar) */
        #touch-look-zone {
          position: absolute;
          top: 60px;
          right: 0;
          width: 54vw;
          height: calc(100vh - 60px);
          pointer-events: auto;
          touch-action: none;
          z-index: 10;
        }

        /* Bottom Right Action Buttons */
        #mobile-actions {
          position: absolute;
          bottom: 20px;
          right: 20px;
          display: grid;
          grid-template-columns: repeat(3, 58px);
          grid-template-rows: repeat(2, 58px);
          gap: 12px;
          pointer-events: auto;
          touch-action: none;
          z-index: 80;
        }

        .mob-btn {
          width: 58px;
          height: 58px;
          border-radius: 50%;
          background: rgba(14, 20, 32, 0.8);
          border: 2px solid rgba(255, 255, 255, 0.35);
          color: #ffffff;
          font-family: 'Rajdhani', sans-serif;
          font-weight: 800;
          font-size: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.6);
          touch-action: manipulation;
          cursor: pointer;
        }
        .mob-btn:active, .mob-btn.pressed {
          transform: scale(0.92);
          background: rgba(0, 255, 204, 0.35);
          border-color: #00ffcc;
          box-shadow: 0 0 16px #00ffcc;
        }

        /* Primary Right Fire Button (Aim-on-Fire Enabled!) */
        #btn-mob-fire {
          grid-column: 3;
          grid-row: 1 / span 2;
          width: 76px;
          height: 76px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ff1a40, #ff6600);
          border: 3px solid #ffffff;
          box-shadow: 0 0 20px rgba(255, 26, 64, 0.85);
          font-size: 16px;
          letter-spacing: 1px;
          color: #ffffff;
          touch-action: none;
        }
        #btn-mob-fire:active, #btn-mob-fire.pressed {
          transform: scale(0.94);
          box-shadow: 0 0 28px rgba(255, 26, 64, 1.0);
        }

        #btn-mob-ads {
          border-color: #00e1ff;
          color: #00e1ff;
        }
        #btn-mob-ads.active {
          background: rgba(0, 225, 255, 0.45);
          box-shadow: 0 0 16px #00e1ff;
        }
      </style>

      <!-- Top Bar Controls -->
      <div id="mobile-top-bar">
        <div class="mob-top-group">
          <button class="mob-icon-btn" id="btn-mob-pause" title="Pause Game">⏸</button>
          <button class="mob-icon-btn" id="btn-mob-fullscreen" title="Full Screen">⛶</button>
          <button class="mob-pill-btn" id="btn-mob-quality" title="Graphics Quality">⚡ BAL</button>
        </div>
        <div class="mob-top-group">
          <button class="mob-pill-btn" id="btn-mob-autofire">AUTO-FIRE: OFF</button>
          <button class="mob-pill-btn active" id="mob-w1">1: SMG</button>
          <button class="mob-pill-btn" id="mob-w2">2: SHOTGUN</button>
          <button class="mob-pill-btn" id="mob-w3">3: DMR</button>
        </div>
      </div>

      <!-- Movement Zone with Floating Joystick -->
      <div id="touch-move-zone"></div>
      <div id="virtual-joystick-base">
        <div id="virtual-joystick-sprint-zone">▲ SPRINT LOCK</div>
        <div id="virtual-joystick-knob"></div>
      </div>

      <!-- Secondary Left Fire for Claw / 3-Finger Aiming -->
      <button id="btn-mob-left-fire">FIRE</button>

      <!-- Right Touch Aiming Area -->
      <div id="touch-look-zone"></div>

      <!-- Action Cluster -->
      <div id="mobile-actions">
        <button class="mob-btn" id="btn-mob-sprint">RUN</button>
        <button class="mob-btn" id="btn-mob-jump">JUMP</button>
        <button class="mob-btn" id="btn-mob-reload">RELOAD</button>
        <button class="mob-btn" id="btn-mob-ads">ADS</button>
        <button class="mob-btn" id="btn-mob-fire">FIRE</button>
      </div>
    `;

    document.body.appendChild(this.container);

    this.moveZone = this.container.querySelector('#touch-move-zone');
    this.lookZone = this.container.querySelector('#touch-look-zone');
    this.joystickBase = this.container.querySelector('#virtual-joystick-base');
    this.joystickKnob = this.container.querySelector('#virtual-joystick-knob');
    this.sprintZoneLabel = this.container.querySelector('#virtual-joystick-sprint-zone');

    this.btnFire = this.container.querySelector('#btn-mob-fire');
    this.btnLeftFire = this.container.querySelector('#btn-mob-left-fire');
    this.btnAds = this.container.querySelector('#btn-mob-ads');
    this.btnJump = this.container.querySelector('#btn-mob-jump');
    this.btnReload = this.container.querySelector('#btn-mob-reload');
    this.btnSprint = this.container.querySelector('#btn-mob-sprint');
    this.btnPause = this.container.querySelector('#btn-mob-pause');
    this.btnFullscreen = this.container.querySelector('#btn-mob-fullscreen');
    this.btnQuality = this.container.querySelector('#btn-mob-quality');
    this.btnAutoFire = this.container.querySelector('#btn-mob-autofire');

    this.wepPills = [
      this.container.querySelector('#mob-w1'),
      this.container.querySelector('#mob-w2'),
      this.container.querySelector('#mob-w3')
    ];

    this.setupTouchListeners();
  }

  setupOrientationHandler() {
    this.orientationOverlay = document.querySelector('#orientation-overlay');
    if (!this.orientationOverlay) {
      this.orientationOverlay = document.createElement('div');
      this.orientationOverlay.id = 'orientation-overlay';
      this.orientationOverlay.innerHTML = `
        <div class="rotate-icon">📱 ↷</div>
        <div class="rotate-title">SILA PUTAR PERANTI</div>
        <div class="rotate-sub">Please rotate your phone to Landscape mode for the ultimate tactical combat experience.</div>
      `;
      document.body.appendChild(this.orientationOverlay);
    }

    const checkOrientation = () => {
      const isPortrait = window.innerHeight > window.innerWidth;
      if (isPortrait && this.isTouchDevice) {
        this.orientationOverlay.style.display = 'flex';
      } else {
        this.orientationOverlay.style.display = 'none';
      }
    };

    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    checkOrientation();
  }

  show() {
    this.container.classList.add('active');
  }

  hide() {
    this.container.classList.remove('active');
  }

  applyLookDelta(dx, dy) {
    const dist = Math.hypot(dx, dy);
    // Non-linear flick acceleration curve
    let mult = 2.4;
    if (dist > 8) {
      mult = 2.6 + Math.min(dist, 40) * 0.045;
    }
    // Precision ADS dampening
    if (this.weapons && this.weapons.isADS) {
      mult *= 0.62;
    }
    // Subtle friction when sweeping across an enemy
    if (this.isAimFrictionActive) {
      mult *= 0.58;
    }

    if (this.input) {
      this.input.mouseDelta.x += dx * mult;
      this.input.mouseDelta.y += dy * mult;
    }
  }

  setupTouchListeners() {
    // 1. Dynamic Floating Joystick on Left Move Zone
    this.moveZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.joystickTouchId !== null) return;
      if (!e.changedTouches || e.changedTouches.length === 0) return;
      const touch = e.changedTouches[0];
      this.joystickTouchId = touch.identifier;

      this.joystickCenter.x = touch.clientX;
      this.joystickCenter.y = touch.clientY;
      this.joystickDelta.x = 0;
      this.joystickDelta.y = 0;

      this.joystickBase.style.left = `${touch.clientX}px`;
      this.joystickBase.style.top = `${touch.clientY}px`;
      this.joystickKnob.style.transform = `translate(-50%, -50%) translate(0px, 0px)`;
      this.joystickBase.style.display = 'block';
      this.sprintZoneLabel.classList.remove('locked');
    }, { passive: false });

    this.moveZone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!e.changedTouches) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.joystickTouchId) {
          let dx = touch.clientX - this.joystickCenter.x;
          let dy = touch.clientY - this.joystickCenter.y;
          const dist = Math.hypot(dx, dy);

          if (dist > this.maxRadius) {
            dx = (dx / dist) * this.maxRadius;
            dy = (dy / dist) * this.maxRadius;
          }

          this.joystickDelta.x = dx;
          this.joystickDelta.y = dy;

          this.joystickKnob.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px)`;

          // Normalized outputs
          this.moveVector.forward = -dy / this.maxRadius;
          this.moveVector.right = dx / this.maxRadius;

          // Auto-Sprint Lock: pushed forward beyond 82%
          if (this.moveVector.forward > 0.82) {
            this.isSprinting = true;
            this.sprintZoneLabel.classList.add('locked');
          } else if (dist < this.maxRadius * 0.4) {
            this.isSprinting = false;
            this.sprintZoneLabel.classList.remove('locked');
          }
          break;
        }
      }
    }, { passive: false });

    const endJoystick = (e) => {
      if (e && e.changedTouches) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this.joystickTouchId) {
            this.joystickTouchId = null;
            break;
          }
        }
      } else {
        this.joystickTouchId = null;
      }
      if (this.joystickTouchId === null) {
        this.joystickDelta.x = 0;
        this.joystickDelta.y = 0;
        this.moveVector.forward = 0;
        this.moveVector.right = 0;
        this.isSprinting = false;
        this.joystickBase.style.display = 'none';
        this.sprintZoneLabel.classList.remove('locked');
      }
    };
    this.moveZone.addEventListener('touchend', endJoystick, { passive: true });
    this.moveZone.addEventListener('touchcancel', endJoystick, { passive: true });

    // 2. Camera Look on Right Zone (Whole Right Half)
    this.lookZone.addEventListener('touchstart', (e) => {
      if (this.lookTouchId !== null) return;
      if (!e.changedTouches || e.changedTouches.length === 0) return;
      const touch = e.changedTouches[0];
      this.lookTouchId = touch.identifier;
      this.lastLookX = touch.clientX;
      this.lastLookY = touch.clientY;
    }, { passive: true });

    this.lookZone.addEventListener('touchmove', (e) => {
      if (!e.changedTouches) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.lookTouchId) {
          const dx = touch.clientX - this.lastLookX;
          const dy = touch.clientY - this.lastLookY;
          this.lastLookX = touch.clientX;
          this.lastLookY = touch.clientY;

          this.applyLookDelta(dx, dy);
          break;
        }
      }
    }, { passive: true });

    const endLook = (e) => {
      if (e && e.changedTouches) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this.lookTouchId) {
            this.lookTouchId = null;
            break;
          }
        }
      } else {
        this.lookTouchId = null;
      }
    };
    this.lookZone.addEventListener('touchend', endLook, { passive: true });
    this.lookZone.addEventListener('touchcancel', endLook, { passive: true });

    // 3. Primary Right Fire Button (Aim-on-Fire Enabled!)
    this.btnFire.addEventListener('touchstart', (e) => {
      if (e.cancelable) e.preventDefault();
      const touch = (e.changedTouches && e.changedTouches.length > 0) ? e.changedTouches[0] : null;
      if (touch) {
        this.fireTouchId = touch.identifier;
        this.lastFireX = touch.clientX;
        this.lastFireY = touch.clientY;
      }

      if (this.input) this.input.mouseButtons.left = true;
      this.btnFire.classList.add('pressed');
    }, { passive: false });

    this.btnFire.addEventListener('touchmove', (e) => {
      if (e.cancelable) e.preventDefault();
      if (!e.changedTouches) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.fireTouchId) {
          const dx = touch.clientX - this.lastFireX;
          const dy = touch.clientY - this.lastFireY;
          this.lastFireX = touch.clientX;
          this.lastFireY = touch.clientY;

          // Seamless drag-to-aim while shooting
          this.applyLookDelta(dx, dy);
          break;
        }
      }
    }, { passive: false });

    const stopFire = (e) => {
      if (e && e.changedTouches) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this.fireTouchId) {
            this.fireTouchId = null;
            break;
          }
        }
      } else {
        this.fireTouchId = null;
      }
      if (this.input) this.input.mouseButtons.left = false;
      this.btnFire.classList.remove('pressed');
    };
    this.btnFire.addEventListener('touchend', stopFire, { passive: true });
    this.btnFire.addEventListener('touchcancel', stopFire, { passive: true });

    // 4. Secondary Left Fire Button (Claw Grip)
    this.btnLeftFire.addEventListener('touchstart', (e) => {
      if (e.cancelable) e.preventDefault();
      const touch = (e.changedTouches && e.changedTouches.length > 0) ? e.changedTouches[0] : null;
      if (touch) {
        this.leftFireTouchId = touch.identifier;
        this.lastLeftFireX = touch.clientX;
        this.lastLeftFireY = touch.clientY;
      }

      if (this.input) this.input.mouseButtons.left = true;
      this.btnLeftFire.classList.add('pressed');
    }, { passive: false });

    this.btnLeftFire.addEventListener('touchmove', (e) => {
      if (e.cancelable) e.preventDefault();
      if (!e.changedTouches) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.leftFireTouchId) {
          const dx = touch.clientX - this.lastLeftFireX;
          const dy = touch.clientY - this.lastLeftFireY;
          this.lastLeftFireX = touch.clientX;
          this.lastLeftFireY = touch.clientY;

          this.applyLookDelta(dx, dy);
          break;
        }
      }
    }, { passive: false });

    const stopLeftFire = (e) => {
      if (e && e.changedTouches) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this.leftFireTouchId) {
            this.leftFireTouchId = null;
            break;
          }
        }
      } else {
        this.leftFireTouchId = null;
      }
      if (this.input) this.input.mouseButtons.left = false;
      this.btnLeftFire.classList.remove('pressed');
    };
    this.btnLeftFire.addEventListener('touchend', stopLeftFire, { passive: true });
    this.btnLeftFire.addEventListener('touchcancel', stopLeftFire, { passive: true });

    // 5. ADS (Aim Down Sights) with Snap-on-ADS
    const toggleAds = (e) => {
      if (e && e.cancelable) e.preventDefault();
      if (this.weapons) {
        const nextAds = !this.weapons.isADS;
        this.weapons.setADS(nextAds);
        if (nextAds) {
          this.btnAds.classList.add('active');
          this.triggerSnapOnAds();
        } else {
          this.btnAds.classList.remove('active');
        }
      }
    };
    this.btnAds.addEventListener('touchstart', toggleAds, { passive: false });
    this.btnAds.addEventListener('click', toggleAds);

    // 6. Jump
    const doJump = (e) => {
      if (e && e.cancelable) e.preventDefault();
      if (this.player && this.player.isGrounded) {
        this.player.velocity.y = this.player.jumpForce;
        this.player.isGrounded = false;
        if (this.player.audioManager) {
          this.player.audioManager.playFootstep(true);
        }
      }
    };
    this.btnJump.addEventListener('touchstart', doJump, { passive: false });
    this.btnJump.addEventListener('click', doJump);

    // 7. Reload
    const doReload = (e) => {
      if (e && e.cancelable) e.preventDefault();
      if (this.weapons) this.weapons.triggerReload();
    };
    this.btnReload.addEventListener('touchstart', doReload, { passive: false });
    this.btnReload.addEventListener('click', doReload);

    // 8. Sprint Toggle
    const toggleSprint = (e) => {
      if (e && e.cancelable) e.preventDefault();
      this.isSprinting = !this.isSprinting;
      if (this.isSprinting) this.btnSprint.classList.add('pressed');
      else this.btnSprint.classList.remove('pressed');
    };
    this.btnSprint.addEventListener('touchstart', toggleSprint, { passive: false });
    this.btnSprint.addEventListener('click', toggleSprint);

    // 9. Weapon Pills
    this.wepPills.forEach((pill, idx) => {
      const equip = (e) => {
        if (e && e.cancelable) e.preventDefault();
        if (this.weapons) this.weapons.equipSlot(idx);
      };
      pill.addEventListener('touchstart', equip, { passive: false });
      pill.addEventListener('click', equip);
    });

    // 10. Pause Button
    const doPause = (e) => {
      if (e && e.cancelable) e.preventDefault();
      if (this.onPause) this.onPause();
    };
    this.btnPause.addEventListener('touchstart', doPause, { passive: false });
    this.btnPause.addEventListener('click', doPause);

    // 11. Fullscreen Button
    const toggleFs = (e) => {
      if (e && e.cancelable) e.preventDefault();
      toggleFullScreen();
    };
    this.btnFullscreen.addEventListener('touchstart', toggleFs, { passive: false });
    this.btnFullscreen.addEventListener('click', toggleFs);

    onFullScreenChange((isFs) => {
      if (this.btnFullscreen) {
        if (isFs) {
          this.btnFullscreen.classList.add('active');
          this.btnFullscreen.textContent = '✖';
          this.btnFullscreen.title = 'Exit Fullscreen';
        } else {
          this.btnFullscreen.classList.remove('active');
          this.btnFullscreen.textContent = '⛶';
          this.btnFullscreen.title = 'Full Screen';
        }
      }
    });

    // 12. Auto-Fire Toggle Pill
    const toggleAutoFire = (e) => {
      if (e && e.cancelable) e.preventDefault();
      this.autoFire = !this.autoFire;
      if (this.autoFire) {
        this.btnAutoFire.textContent = 'AUTO-FIRE: ON';
        this.btnAutoFire.classList.add('active');
      } else {
        this.btnAutoFire.textContent = 'AUTO-FIRE: OFF';
        this.btnAutoFire.classList.remove('active');
      }
    };
    this.btnAutoFire.addEventListener('touchstart', toggleAutoFire, { passive: false });
    this.btnAutoFire.addEventListener('click', toggleAutoFire);

    // 13. Quality Toggle Pill
    const handleCycleQuality = (e) => {
      if (e && e.cancelable) e.preventDefault();
      this.cycleQuality();
    };
    if (this.btnQuality) {
      this.btnQuality.addEventListener('touchstart', handleCycleQuality, { passive: false });
      this.btnQuality.addEventListener('click', handleCycleQuality);
    }
  }

  setQuality(quality) {
    this.quality = quality;
    const labelMap = {
      performance: '⚡ PERF',
      balanced: '⚡ BAL',
      high: '⚡ HIGH'
    };
    if (this.btnQuality) {
      this.btnQuality.textContent = labelMap[quality] || '⚡ BAL';
      if (quality === 'performance') {
        this.btnQuality.style.color = '#00ffcc';
        this.btnQuality.style.borderColor = '#00ffcc';
      } else if (quality === 'high') {
        this.btnQuality.style.color = '#ffaa00';
        this.btnQuality.style.borderColor = '#ffaa00';
      } else {
        this.btnQuality.style.color = '#88bbdd';
        this.btnQuality.style.borderColor = 'rgba(0, 255, 204, 0.35)';
      }
    }
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

  triggerSnapOnAds() {
    if (!this.aimAssistEnabled || !this.player || !this.lastLivingEnemies) return;
    const cam = this.player.camera;
    cam.getWorldDirection(this.camDir);

    let closestEnemy = null;
    let highestDot = 0.955; // ~17 degrees cone

    for (const enemy of this.lastLivingEnemies) {
      if (!enemy || enemy.health <= 0) continue;
      const toEnemy = enemy.position.clone().add(new THREE.Vector3(0, enemy.height * 0.6, 0)).sub(cam.position);
      const dist = toEnemy.length();
      if (dist > 45 || dist < 1.0) continue;
      toEnemy.normalize();
      const dot = this.camDir.dot(toEnemy);
      if (dot > highestDot) {
        highestDot = dot;
        closestEnemy = enemy;
      }
    }

    if (closestEnemy) {
      const toEnemy = closestEnemy.position.clone().add(new THREE.Vector3(0, closestEnemy.height * 0.6, 0)).sub(cam.position);
      const targetYaw = Math.atan2(toEnemy.x, -toEnemy.z);
      this.player.yaw = THREE.MathUtils.lerp(this.player.yaw, targetYaw, 0.45);
    }
  }

  update(weaponManager, player, hordeManager, delta = 0.016, time = 0, targetables = [], hud = null, gameState = null) {
    if (weaponManager) {
      this.wepPills.forEach((pill, idx) => {
        if (idx === weaponManager.currentSlot) pill.classList.add('active');
        else pill.classList.remove('active');
      });
    }

    if (player && hordeManager) {
      const enemies = hordeManager.enemies;
      this.lastLivingEnemies = enemies;

      if (this.aimAssistEnabled && enemies.length > 0) {
        const cam = player.camera;
        cam.getWorldDirection(this.camDir);

        let bestTarget = null;
        let bestDot = 0.965; // ~15 degrees

        for (const enemy of enemies) {
          if (!enemy || enemy.health <= 0) continue;
          const toEnemy = enemy.position.clone().add(new THREE.Vector3(0, enemy.height * 0.55, 0)).sub(cam.position);
          const dist = toEnemy.length();
          if (dist > 40 || dist < 1.0) continue;
          toEnemy.normalize();
          const dot = this.camDir.dot(toEnemy);
          if (dot > bestDot) {
            bestDot = dot;
            bestTarget = enemy;
          }
        }

        if (bestTarget) {
          this.isAimFrictionActive = true;

          // Subtle aim magnetism pull when aiming or moving
          const toTarget = bestTarget.position.clone().add(new THREE.Vector3(0, bestTarget.height * 0.55, 0)).sub(cam.position);
          const desiredYaw = Math.atan2(toTarget.x, -toTarget.z);
          let diffYaw = desiredYaw - player.yaw;
          diffYaw = Math.atan2(Math.sin(diffYaw), Math.cos(diffYaw));

          if (Math.abs(diffYaw) < 0.22) {
            const pullStrength = (this.weapons && this.weapons.isADS ? 1.8 : 1.1);
            player.yaw += diffYaw * delta * pullStrength;
          }

          // Auto-Fire mode ("Simple Mode")
          if (this.autoFire && bestDot > 0.985 && weaponManager) {
            const activeWeapon = weaponManager.getActiveWeapon();
            if (activeWeapon && !activeWeapon.isReloading && (time - this.lastAutoFireTime > 0.08)) {
              this.lastAutoFireTime = time;
              const targets = typeof targetables === 'function' ? targetables() : (targetables || []);
              weaponManager.tryFire(time, targets, hud, gameState);
            }
          }
        } else {
          this.isAimFrictionActive = false;
        }
      }
    }
  }

  getMovementVector() {
    return this.moveVector;
  }
}
