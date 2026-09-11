import * as THREE from 'three';
import { Engine } from './core/Engine.js';
import { InputManager } from './core/InputManager.js';
import { AudioManager } from './core/AudioManager.js';
import { PostProcessing } from './core/PostProcessing.js';

import { AlleywayBuilder } from './environment/AlleywayBuilder.js';
import { MamakStallBuilder } from './environment/MamakStallBuilder.js';
import { WeatherSystem } from './environment/WeatherSystem.js';
import { PuddleReflection } from './environment/PuddleReflection.js';

import { PropManager } from './game/PropManager.js';
import { BulletManager } from './game/BulletManager.js';
import { WeaponManager } from './game/WeaponManager.js';
import { PlayerController } from './game/PlayerController.js';
import { HordeManager } from './game/HordeManager.js';
import { GameState } from './game/GameState.js';
import { PickupManager } from './game/PickupManager.js';

import { HUD } from './ui/HUD.js';
import { Menu } from './ui/Menu.js';
import { MobileControls } from './ui/MobileControls.js';

class Game {
  constructor() {
    this.engine = new Engine();
    this.inputManager = new InputManager(this.engine.renderer.domElement);
    this.audioManager = new AudioManager();

    this.postProcessing = new PostProcessing(
      this.engine.renderer,
      this.engine.scene,
      this.engine.camera
    );
    this.engine.onWindowResize((w, h) => this.postProcessing.updateDimensions(w, h));

    // Game state & HUD
    this.gameState = new GameState(this.audioManager);
    this.hud = new HUD();

    // Environment & Props
    this.alleyway = new AlleywayBuilder(this.engine.scene);
    this.mamakStall = new MamakStallBuilder(this.engine.scene);
    this.weather = new WeatherSystem(this.engine.scene, this.audioManager);
    this.puddleReflection = new PuddleReflection(
      this.engine.renderer,
      this.engine.scene,
      this.alleyway.groundMesh
    );

    this.propManager = new PropManager(this.engine.scene, this.audioManager);

    // Player & Weaponry
    this.player = new PlayerController(
      this.engine.camera,
      this.alleyway.getColliders(),
      this.audioManager
    );

    this.bulletManager = new BulletManager(this.engine.scene, this.audioManager, null);

    this.weaponManager = new WeaponManager(
      this.engine.camera,
      this.engine.scene,
      this.bulletManager,
      this.audioManager,
      this.propManager
    );

    // Pickups system
    this.pickupManager = new PickupManager(
      this.engine.scene,
      this.audioManager,
      this.gameState,
      this.weaponManager,
      this.hud
    );
    this.bulletManager.pickupManager = this.pickupManager;

    // Mobile touch controls
    this.mobileControls = new MobileControls(
      this.player,
      this.weaponManager,
      this.inputManager,
      () => this.pauseGame()
    );

    // Horde Director
    this.hordeManager = new HordeManager(
      this.engine.scene,
      this.alleyway.getSpawnPoints(),
      this.audioManager,
      this.propManager,
      this.gameState,
      this.hud
    );

    // UI Menus
    this.isPlaying = false;
    this.isPaused = false;
    this.menu = new Menu(
      () => this.startGame(),
      () => this.restartGame()
    );

    this.lastTime = performance.now();
    this.setupEvents();
  }

  setupEvents() {
    // Pointer lock change handler
    this.inputManager.onLockChange((isLocked) => {
      if (!isLocked && this.isPlaying && !this.gameState.isDead && !this.mobileControls.isTouchDevice) {
        this.pauseGame();
      }
    });

    // Escape or P key for pause
    window.addEventListener('keydown', (e) => {
      if ((e.code === 'KeyP' || e.code === 'Escape') && this.isPlaying && !this.gameState.isDead) {
        if (this.isPaused) {
          this.startGame();
        } else {
          this.pauseGame();
        }
      }
    });

    // Window resize & orientation change handler
    this.engine.onWindowResize((width, height) => {
      if (this.postProcessing) {
        this.postProcessing.updateDimensions(width, height);
      }
    });
  }

  pauseGame() {
    if (this.isPlaying && !this.gameState.isDead) {
      this.isPaused = true;
      this.inputManager.exitLock();
      this.inputManager.resetKeys();
      if (this.mobileControls.isTouchDevice) {
        this.mobileControls.hide();
      }
      this.menu.showPause();
    }
  }

  startGame() {
    this.audioManager.init();
    this.audioManager.resume();
    this.inputManager.requestLock();
    this.isPlaying = true;
    this.isPaused = false;
    if (this.mobileControls.isTouchDevice) {
      this.mobileControls.show();
    }
  }

  restartGame() {
    this.gameState.reset();
    this.inputManager.resetKeys();

    // Reset horde manager & living enemies with GPU cleanup
    if (typeof this.hordeManager.reset === 'function') {
      this.hordeManager.reset();
    } else {
      for (const e of this.hordeManager.enemies) {
        this.engine.scene.remove(e.mesh);
        if (typeof e.dispose === 'function') e.dispose();
      }
      this.hordeManager.enemies = [];
      this.hordeManager.currentWave = 0;
      this.hordeManager.waveState = 'intermission';
      this.hordeManager.intermissionTimer = 1.0;
      this.hordeManager.updateTargetableMeshes();
    }

    // Reset weather & thunder timeouts
    if (typeof this.weather.reset === 'function') {
      this.weather.reset();
    }

    // Reset pickups
    if (typeof this.pickupManager.reset === 'function') {
      this.pickupManager.reset();
    } else {
      for (const p of this.pickupManager.pickups) {
        this.engine.scene.remove(p.mesh);
      }
      this.pickupManager.pickups = [];
    }

    // Reset bullets, tracers & particles
    if (typeof this.bulletManager.reset === 'function') {
      this.bulletManager.reset();
    }

    // Reset mamak stools & tables to initial layout
    if (typeof this.propManager.reset === 'function') {
      this.propManager.reset();
    }

    // Reset player position & vitals
    this.player.position.set(0, 1.7, 14);
    this.player.velocity.set(0, 0, 0);
    this.player.yaw = 0;
    this.player.pitch = 0;

    // Reset weapons & ammo to full
    this.weaponManager.reset();

    this.startGame();
  }

  run() {
    requestAnimationFrame(this.run.bind(this));

    const now = performance.now();
    const rawDelta = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const delta = Math.min(rawDelta, 0.08); // clamp frame spikes
    const time = now / 1000;

    if (this.isPlaying && !this.isPaused) {
      // 1. Handle Weapons Input
      const weaponSlot = this.inputManager.isWeaponSlotJustPressed();
      if (weaponSlot !== -1) {
        this.weaponManager.equipSlot(weaponSlot);
      }

      // Mouse Wheel weapon cycle
      if (this.inputManager.wheelDelta !== 0) {
        this.weaponManager.cycleWeapon(this.inputManager.wheelDelta);
      }

      // Reload
      if (this.inputManager.isReloadJustPressed()) {
        this.weaponManager.triggerReload();
      }

      // ADS Aim Down Sights (Right-Click)
      if (!this.mobileControls.isTouchDevice) {
        const isAiming = this.inputManager.isMouseDown(2);
        this.weaponManager.setADS(isAiming);
      }

      // Fire (Left-Click or Mobile Fire)
      const activeWeapon = this.weaponManager.getActiveWeapon();
      const wantsFire = activeWeapon && activeWeapon.isAutomatic
        ? this.inputManager.isMouseDown(0)
        : this.inputManager.isMouseJustPressed(0);

      if (wantsFire) {
        // Collect targetable enemy meshes, props, and environment surfaces for raycast detection
        const targetables = [
          ...this.hordeManager.getTargetables(),
          ...this.propManager.props.map(p => p.mesh),
          ...this.alleyway.group.children,
          ...this.mamakStall.stallGroup.children
        ];

        this.weaponManager.tryFire(time, targetables, this.hud, this.gameState);
      }

      // 2. Update Player Movement & Camera
      const moveState = this.player.update(
        delta,
        this.inputManager,
        this.weaponManager,
        this.mobileControls.getMovementVector(),
        this.mobileControls.isSprinting
      );

      // 3. Update Weapon Manager (Procedural sway, recoil, ADS)
      this.weaponManager.update(
        delta,
        time,
        moveState.mouseInput,
        moveState.isMoving,
        moveState.isSprinting
      );

      // 4. Update Game State & Vitals
      this.gameState.update(delta);

      // 5. Update Horde AI & Waves
      this.hordeManager.update(delta, this.player.position, (damage, attackerPos) => {
        this.gameState.applyDamage(damage);

        // Directional threat damage ring
        if (attackerPos) {
          const dx = attackerPos.x - this.player.position.x;
          const dz = attackerPos.z - this.player.position.z;
          const angleToAttacker = Math.atan2(dx, -dz);
          const relativeAngle = angleToAttacker - this.player.yaw;
          this.hud.showDamageDirection(relativeAngle);
        }

        if (this.gameState.isDead) {
          this.inputManager.exitLock();
          if (this.mobileControls.isTouchDevice) {
            this.mobileControls.hide();
          }
          this.menu.showGameOver(this.gameState);
        }
      });

      // 6. Update Pickups, Projectiles & Destructible Props
      this.pickupManager.update(delta, this.player.position);
      this.bulletManager.update(delta);
      this.propManager.update(delta);

      // 7. Update HUD & Mobile Controls (Aim Assist, Auto-Fire, Movement)
      this.hud.update(this.gameState, this.weaponManager, this.player, this.hordeManager.enemies);

      const targetables = [
        ...this.hordeManager.getTargetables(),
        ...this.propManager.props.map(p => p.mesh),
        ...this.alleyway.group.children,
        ...this.mamakStall.stallGroup.children
      ];
      this.mobileControls.update(
        this.weaponManager,
        this.player,
        this.hordeManager,
        delta,
        time,
        targetables,
        this.hud,
        this.gameState
      );
    }

    // Always update environment animations (spinning fans, monsoon rain, lightning)
    this.mamakStall.update(delta);
    this.weather.update(delta, this.player.position);

    // Planar floor puddle reflection pass
    this.puddleReflection.update(this.engine.camera, time);

    // Multi-pass Post-Processing render (Bloom, Droplets, Vignette)
    this.postProcessing.render(
      time,
      this.gameState.damageVignette,
      this.gameState.getLowHealthFactor()
    );

    // Snapshot keys/buttons for edge trigger detection
    this.inputManager.postUpdate();
  }
}

// Boot game reliably regardless of module loading timing
function initGame() {
  const game = new Game();
  window.currentGame = game;
  game.run();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initGame);
} else {
  initGame();
}

