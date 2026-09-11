import * as THREE from 'three';
import { Enemy } from './Enemy.js';

export class HordeManager {
  constructor(scene, spawnPoints, audioManager, propManager, gameState, hud) {
    this.scene = scene;
    this.spawnPoints = spawnPoints || [];
    this.audioManager = audioManager;
    this.propManager = propManager;
    this.gameState = gameState;
    this.hud = hud;

    this.enemies = [];
    this.targetableMeshes = [];

    this.currentWave = 0;
    this.waveState = 'intermission'; // 'intermission', 'spawning', 'active'
    this.intermissionTimer = 0.8;

    this.totalEnemiesInWave = 0;
    this.enemiesSpawnedSoFar = 0;
    this.spawnInterval = 1.2;
    this.spawnTimer = 0;
  }

  startNextWave() {
    this.currentWave++;
    this.waveState = 'spawning';
    this.enemiesSpawnedSoFar = 0;

    // Escalating wave formula
    this.totalEnemiesInWave = Math.min(45, 8 + (this.currentWave - 1) * 5);
    this.spawnInterval = Math.max(0.45, 1.4 - (this.currentWave * 0.1));
    this.spawnTimer = 0.5;

    if (this.gameState) {
      this.gameState.wave = this.currentWave;
      this.gameState.enemiesRemaining = this.totalEnemiesInWave;
    }

    if (this.hud) {
      this.hud.showWaveBanner(this.currentWave);
    }

    if (this.audioManager) {
      this.audioManager.playWaveHorn(this.currentWave);
    }
  }

  spawnEnemy() {
    if (this.spawnPoints.length === 0) return;

    // Pick random spawn point
    const sp = this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)];

    // Determine archetype based on wave progression
    let type = 'runner';
    const roll = Math.random();

    if (this.currentWave >= 3 && roll < 0.22) {
      type = 'goliath';
    } else if (this.currentWave >= 2 && roll < 0.55) {
      type = 'enforcer';
    }

    const enemy = new Enemy(this.scene, type, sp.pos, this.audioManager, this.currentWave);
    this.enemies.push(enemy);
    this.enemiesSpawnedSoFar++;
    this.updateTargetableMeshes();
  }

  updateTargetableMeshes() {
    this.targetableMeshes = [];
    for (const e of this.enemies) {
      if (e.isAlive()) {
        this.targetableMeshes.push(e.mesh);
      }
    }
  }

  getTargetables() {
    return this.targetableMeshes;
  }

  update(delta, playerPos, onPlayerDamaged) {
    // 1. Wave Director State Machine
    if (this.waveState === 'intermission') {
      this.intermissionTimer -= delta;
      if (this.intermissionTimer <= 0) {
        this.startNextWave();
      }
    } else if (this.waveState === 'spawning') {
      this.spawnTimer -= delta;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = this.spawnInterval;
        this.spawnEnemy();

        if (this.enemiesSpawnedSoFar >= this.totalEnemiesInWave) {
          this.waveState = 'active';
        }
      }
    }

    // 2. Update all active enemies
    let livingCount = 0;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      const stillActive = enemy.update(delta, playerPos, this.enemies, this.propManager, onPlayerDamaged);

      if (!stillActive) {
        // Remove dead enemy from scene & GPU
        this.scene.remove(enemy.mesh);
        if (typeof enemy.dispose === 'function') enemy.dispose();
        this.enemies.splice(i, 1);
      } else if (enemy.isAlive()) {
        livingCount++;
      }
    }

    this.updateTargetableMeshes();

    if (this.gameState) {
      this.gameState.enemiesRemaining = livingCount + (this.totalEnemiesInWave - this.enemiesSpawnedSoFar);
    }

    // 3. Check for Wave Completion
    if (this.waveState === 'active' && livingCount === 0) {
      this.waveState = 'intermission';
      this.intermissionTimer = 4.5;
      if (this.hud) {
        this.hud.showWaveClearedBanner(this.currentWave);
      }
      if (this.gameState) {
        this.gameState.score += this.currentWave * 500;
      }
    }
  }
}
