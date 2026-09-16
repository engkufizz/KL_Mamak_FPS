import * as THREE from 'three';

export class WeatherSystem {
  constructor(scene, audioManager) {
    this.scene = scene;
    this.audioManager = audioManager;

    this.maxRainCount = 1800;
    this.rainCount = 1200; // Balanced default (saves 65% CPU loop & WebGL bandwidth compared to 3500)
    this.rainGeometry = null;
    this.rainMaterial = null;
    this.rainSystem = null;

    this.lightningLight = null;
    this.ambientLight = null;
    this.nextLightningTime = 6.0;
    this.lightningActive = false;
    this.lightningTimer = 0;
    this.lightningIntensity = 0;

    this.initRain();
    this.initLightning();
  }

  initRain() {
    const rainPositions = new Float32Array(this.maxRainCount * 6); // 2 vertices per line streak
    const rainVelocities = new Float32Array(this.maxRainCount);

    const boundsX = 50;
    const boundsZ = 60;
    const height = 30;

    for (let i = 0; i < this.maxRainCount; i++) {
      const x = (Math.random() - 0.5) * boundsX;
      const y = Math.random() * height;
      const z = (Math.random() - 0.5) * boundsZ;
      const streakLen = 0.8 + Math.random() * 0.7;

      // Top vertex
      rainPositions[i * 6 + 0] = x;
      rainPositions[i * 6 + 1] = y;
      rainPositions[i * 6 + 2] = z;

      // Bottom vertex (slanted with wind)
      rainPositions[i * 6 + 3] = x - 0.12;
      rainPositions[i * 6 + 4] = y - streakLen;
      rainPositions[i * 6 + 5] = z + 0.15;

      rainVelocities[i] = 32.0 + Math.random() * 14.0;
    }

    this.rainGeometry = new THREE.BufferGeometry();
    this.rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    this.rainGeometry.setDrawRange(0, this.rainCount * 2);
    this.rainVelocities = rainVelocities;

    this.rainMaterial = new THREE.LineBasicMaterial({
      color: 0x88bbdd,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.rainSystem = new THREE.LineSegments(this.rainGeometry, this.rainMaterial);
    this.scene.add(this.rainSystem);
  }

  initLightning() {
    // Continuous nocturnal moonlight / city glow
    this.moonLight = new THREE.DirectionalLight(0x8cb2e6, 2.8);
    this.moonLight.position.set(-12, 35, 18);
    this.scene.add(this.moonLight);

    // Front fill moonlight from over the stall to illuminate oncoming enemies
    this.frontFill = new THREE.DirectionalLight(0x648dbf, 2.4);
    this.frontFill.position.set(6, 26, -26);
    this.scene.add(this.frontFill);

    // High-altitude atmospheric directional light for lightning flashes
    this.lightningLight = new THREE.DirectionalLight(0xddeeff, 0.0);
    this.lightningLight.position.set(15, 45, 10);
    this.scene.add(this.lightningLight);

    // Blue-violet ambient fill with clear visibility
    this.ambientLight = new THREE.AmbientLight(0x4a6a94, 3.4);
    this.scene.add(this.ambientLight);
  }

  triggerLightning() {
    this.lightningActive = true;
    this.lightningTimer = 0;
    const distance = 0.8 + Math.random() * 2.0;

    // Delay thunder depending on lightning distance (speed of sound)
    const thunderDelay = distance * 400;
    if (this.thunderTimeout) clearTimeout(this.thunderTimeout);
    this.thunderTimeout = setTimeout(() => {
      if (this.audioManager) {
        this.audioManager.playThunder(distance);
      }
      this.thunderTimeout = null;
    }, thunderDelay);
  }

  reset() {
    if (this.thunderTimeout) {
      clearTimeout(this.thunderTimeout);
      this.thunderTimeout = null;
    }
    this.lightningActive = false;
    this.lightningTimer = 0;
    if (this.lightningLight) this.lightningLight.intensity = 0.0;
    if (this.ambientLight) this.ambientLight.intensity = 3.4;
  }

  setQuality(quality) {
    if (quality === 'performance') {
      this.rainCount = 600; // Orange Pi / Low-spec: 83% lighter CPU loop
    } else if (quality === 'high') {
      this.rainCount = 1800;
    } else {
      this.rainCount = 1200; // Balanced
    }
    if (this.rainGeometry) {
      this.rainGeometry.setDrawRange(0, this.rainCount * 2);
    }
  }

  update(delta, playerPos) {
    // 1. Update rain streaks relative to player position
    const positions = this.rainGeometry.attributes.position.array;
    const boundsX = 50;
    const boundsZ = 60;
    const topY = 28;

    for (let i = 0; i < this.rainCount; i++) {
      const speed = this.rainVelocities[i];
      const dropAmount = speed * delta;

      positions[i * 6 + 1] -= dropAmount;
      positions[i * 6 + 4] -= dropAmount;

      // Keep rain centered around player
      const px = playerPos ? playerPos.x : 0;
      const pz = playerPos ? playerPos.z : 0;

      if (positions[i * 6 + 4] <= 0.0) {
        const streakLen = 0.8 + Math.random() * 0.7;
        const newX = px + (Math.random() - 0.5) * boundsX;
        const newZ = pz + (Math.random() - 0.5) * boundsZ;
        const newY = topY + Math.random() * 5.0;

        positions[i * 6 + 0] = newX;
        positions[i * 6 + 1] = newY;
        positions[i * 6 + 2] = newZ;

        positions[i * 6 + 3] = newX - 0.12;
        positions[i * 6 + 4] = newY - streakLen;
        positions[i * 6 + 5] = newZ + 0.15;
      }
    }
    this.rainGeometry.attributes.position.needsUpdate = true;

    // 2. Update lightning cycle
    this.nextLightningTime -= delta;
    if (this.nextLightningTime <= 0 && !this.lightningActive) {
      this.triggerLightning();
      this.nextLightningTime = 9.0 + Math.random() * 15.0;
    }

    if (this.lightningActive) {
      this.lightningTimer += delta;
      // Multi-pulse flash envelope
      let flash = 0.0;
      if (this.lightningTimer < 0.06) {
        flash = this.lightningTimer / 0.06;
      } else if (this.lightningTimer < 0.14) {
        flash = 0.3;
      } else if (this.lightningTimer < 0.22) {
        flash = 1.0; // peak strike
      } else if (this.lightningTimer < 0.45) {
        flash = (0.45 - this.lightningTimer) / 0.23;
      } else {
        this.lightningActive = false;
        flash = 0.0;
      }

      this.lightningLight.intensity = flash * 5.5;
      this.ambientLight.intensity = 3.4 + flash * 2.5;
    } else {
      this.lightningLight.intensity = 0.0;
      this.ambientLight.intensity = 3.4;
    }
  }
}
