import * as THREE from 'three';
import { HolographicReticleShader } from '../shaders/holographicReticle.js';

export class Weapon {
  constructor(config) {
    this.name = config.name;
    this.type = config.type; // 'bullpup', 'shotgun', 'dmr'
    this.magSize = config.magSize;
    this.currentAmmo = config.magSize;
    this.maxReserveAmmo = config.reserveAmmo;
    this.reserveAmmo = config.reserveAmmo;
    this.fireRate = config.fireRate; // shots per sec
    this.fireInterval = 1.0 / config.fireRate;
    this.lastFireTime = 0;
    this.damage = config.damage;
    this.pellets = config.pellets || 1;
    this.spread = config.spread || 0.015;
    this.adsSpread = config.adsSpread || 0.003;
    this.range = config.range || 120;
    this.isAutomatic = !!config.isAutomatic;

    // ADS parameters
    this.hipPosition = config.hipPosition.clone();
    this.adsPosition = config.adsPosition.clone();
    this.hipRotation = config.hipRotation.clone();
    this.adsRotation = config.adsRotation.clone();
    this.adsFov = config.adsFov || 50;

    // Recoil parameters
    this.recoilKickZ = config.recoilKickZ || 0.08;
    this.recoilPitch = config.recoilPitch || 0.12;
    this.recoilYaw = config.recoilYaw || 0.03;
    this.camKickPitch = config.camKickPitch || 0.04;

    // Pump action specific
    this.isPumpAction = !!config.isPumpAction;
    this.pumpTimer = 0;
    this.pumpSlideMesh = null;

    // Mesh container
    this.root = new THREE.Group();
    this.muzzlePoint = new THREE.Vector3();
    this.muzzleFlash = null;
    this.muzzleLight = null;
    this.reticleMaterial = null;

    this.isReloading = false;
    this.reloadTimer = 0;
    this.reloadDuration = config.reloadDuration || 1.6;

    this.buildModel();
  }

  buildModel() {
    if (this.type === 'bullpup') {
      this.buildBullpupModel();
    } else if (this.type === 'shotgun') {
      this.buildShotgunModel();
    } else if (this.type === 'dmr') {
      this.buildDMRModel();
    }

    this.buildMuzzleFlash();
  }

  // 1. Compact Bullpup AR / SMG 3D Model
  buildBullpupModel() {
    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1d2228, roughness: 0.35, metalness: 0.8 });
    const olivePolymer = new THREE.MeshStandardMaterial({ color: 0x2e3532, roughness: 0.6, metalness: 0.2 });
    const cyanAccent = new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00c8e0, emissiveIntensity: 1.5 });

    // Main Bullpup Receiver
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.75), darkMetal);
    receiver.position.set(0, 0, 0);
    this.root.add(receiver);

    // Polymer Handguard / Shroud
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.16, 0.4), olivePolymer);
    handguard.position.set(0, -0.01, -0.32);
    this.root.add(handguard);

    // Barrel & Flash Hider
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.35, 12), darkMetal);
    barrel.rotateX(Math.PI / 2);
    barrel.position.set(0, 0.02, -0.65);
    this.root.add(barrel);

    // Magazine (behind pistol grip in stock)
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.14), darkMetal);
    mag.position.set(0, -0.16, 0.2);
    mag.rotation.x = -0.15;
    this.root.add(mag);

    // Pistol Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.1), olivePolymer);
    grip.position.set(0, -0.14, -0.08);
    grip.rotation.x = 0.25;
    this.root.add(grip);

    // Top Picatinny Rail
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.6), darkMetal);
    rail.position.set(0, 0.105, -0.1);
    this.root.add(rail);

    // Iron Sights (Rear ring & Front glowing tritium post)
    const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), darkMetal);
    rearSight.position.set(0, 0.14, 0.15);
    this.root.add(rearSight);

    const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.04, 0.02), cyanAccent);
    frontSight.position.set(0, 0.135, -0.5);
    this.root.add(frontSight);

    // Glowing cyber status strip
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.015, 0.3), cyanAccent);
    strip.position.set(0, 0.04, -0.05);
    this.root.add(strip);

    this.muzzlePoint.set(0, 0.02, -0.85);
  }

  // 2. Tactical Pump-Action Shotgun 3D Model
  buildShotgunModel() {
    const gunMetal = new THREE.MeshStandardMaterial({ color: 0x22272e, roughness: 0.3, metalness: 0.85 });
    const polymerMat = new THREE.MeshStandardMaterial({ color: 0x181a1d, roughness: 0.7, metalness: 0.1 });
    const orangeDecal = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xdd4400, emissiveIntensity: 1.2 });

    // Heavy 12G Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.95, 16), gunMetal);
    barrel.rotateX(Math.PI / 2);
    barrel.position.set(0, 0.04, -0.45);
    this.root.add(barrel);

    // Tubular Magazine underneath
    const magTube = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.85, 16), gunMetal);
    magTube.rotateX(Math.PI / 2);
    magTube.position.set(0, -0.025, -0.4);
    this.root.add(magTube);

    // Receiver block
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.5), gunMetal);
    receiver.position.set(0, 0.01, 0.15);
    this.root.add(receiver);

    // Pump Slide (Movable for racking animation!)
    this.pumpSlideMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.32), polymerMat);
    this.pumpSlideMesh.position.set(0, -0.02, -0.42);
    this.root.add(this.pumpSlideMesh);

    // Tactical Pistol Grip & Stock
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.11), polymerMat);
    grip.position.set(0, -0.15, 0.25);
    grip.rotation.x = 0.35;
    this.root.add(grip);

    // Orange shell ejection port indicator
    const shellPort = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.12), orangeDecal);
    shellPort.position.set(0.062, 0.02, 0.18);
    this.root.add(shellPort);

    // Front bead sight
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), orangeDecal);
    bead.position.set(0, 0.075, -0.9);
    this.root.add(bead);

    this.muzzlePoint.set(0, 0.04, -0.95);
  }

  // 3. Heavy Marksman Rifle (Cyber-DMR) with Holographic RDS
  buildDMRModel() {
    const matteAlloy = new THREE.MeshStandardMaterial({ color: 0x1a1e23, roughness: 0.25, metalness: 0.9 });
    const carbonFiber = new THREE.MeshStandardMaterial({ color: 0x111315, roughness: 0.4, metalness: 0.6 });
    const redAccent = new THREE.MeshStandardMaterial({ color: 0xff1133, emissive: 0xff0022, emissiveIntensity: 1.8 });

    // Long fluted heavy barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 1.25, 16), matteAlloy);
    barrel.rotateX(Math.PI / 2);
    barrel.position.set(0, 0.02, -0.7);
    this.root.add(barrel);

    // Muzzle Brake with side gas ports
    const brake = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.065, 0.14), matteAlloy);
    brake.position.set(0, 0.02, -1.34);
    this.root.add(brake);

    // Monolithic Receiver & Handguard
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.17, 0.95), carbonFiber);
    receiver.position.set(0, 0, -0.1);
    this.root.add(receiver);

    // Heavy Box Magazine (10 round Cyber-DMR)
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.16), matteAlloy);
    mag.position.set(0, -0.18, -0.12);
    this.root.add(mag);

    // Ergonomic Sniper Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.24, 0.11), carbonFiber);
    grip.position.set(0, -0.16, 0.15);
    grip.rotation.x = 0.22;
    this.root.add(grip);

    // Adjustable Cheekpiece Stock
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.35), carbonFiber);
    stock.position.set(0, 0.02, 0.52);
    this.root.add(stock);

    // Holographic Red Dot Sight (RDS) Housing
    const sightHousing = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.22), matteAlloy);
    sightHousing.position.set(0, 0.14, -0.22);
    this.root.add(sightHousing);

    // Hollow aperture interior through optic
    const sightTunnel = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.23, 16), new THREE.MeshBasicMaterial({ color: 0x050508 }));
    sightTunnel.rotateX(Math.PI / 2);
    sightTunnel.position.set(0, 0.14, -0.22);
    this.root.add(sightTunnel);

    // Optical Lens Plane with Custom Parallax Holographic Reticle Shader
    this.reticleMaterial = new THREE.ShaderMaterial({
      vertexShader: HolographicReticleShader.vertexShader,
      fragmentShader: HolographicReticleShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(HolographicReticleShader.uniforms),
      transparent: true,
      depthWrite: false
    });

    const lensGeom = new THREE.PlaneGeometry(0.076, 0.076);
    const opticLens = new THREE.Mesh(lensGeom, this.reticleMaterial);
    opticLens.position.set(0, 0.14, -0.32); // Front of optic tube
    this.root.add(opticLens);

    this.muzzlePoint.set(0, 0.02, -1.42);
  }

  buildMuzzleFlash() {
    // Cross-plane billboard muzzle flash
    const flashGeom = new THREE.PlaneGeometry(0.45, 0.45);
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createRadialGradient(64, 64, 5, 64, 64, 64);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, '#ffcc00');
    grad.addColorStop(0.7, '#ff3300');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    const flashTex = new THREE.CanvasTexture(canvas);
    const flashMat = new THREE.MeshBasicMaterial({
      map: flashTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      visible: false
    });

    const flash1 = new THREE.Mesh(flashGeom, flashMat);
    const flash2 = new THREE.Mesh(flashGeom, flashMat);
    flash2.rotation.z = Math.PI / 2;

    this.muzzleFlash = new THREE.Group();
    this.muzzleFlash.add(flash1, flash2);
    this.muzzleFlash.position.copy(this.muzzlePoint);
    this.root.add(this.muzzleFlash);

    // Dynamic point light for muzzle flash illumination
    this.muzzleLight = new THREE.PointLight(0xffaa22, 0.0, 10, 2);
    this.muzzleLight.position.copy(this.muzzlePoint);
    this.root.add(this.muzzleLight);
  }

  canFire(currentTime) {
    if (this.isReloading) return false;
    if (this.isPumpAction && this.pumpTimer > 0) return false;
    if (currentTime - this.lastFireTime < this.fireInterval) return false;
    return this.currentAmmo > 0;
  }

  fire(currentTime, audioManager) {
    this.lastFireTime = currentTime;
    this.currentAmmo--;

    // Flash visibility
    if (this.muzzleFlash) {
      if (this.flashTimeout) clearTimeout(this.flashTimeout);
      this.muzzleFlash.children.forEach(c => c.material.visible = true);
      this.muzzleFlash.rotation.z = Math.random() * Math.PI * 2;
      this.muzzleLight.intensity = 4.5;

      this.flashTimeout = setTimeout(() => {
        if (this.muzzleFlash) {
          this.muzzleFlash.children.forEach(c => c.material.visible = false);
          this.muzzleLight.intensity = 0.0;
        }
        this.flashTimeout = null;
      }, 50);
    }

    // Audio
    if (audioManager) {
      if (this.type === 'bullpup') audioManager.playBullpupShoot();
      else if (this.type === 'shotgun') audioManager.playShotgunShoot();
      else if (this.type === 'dmr') audioManager.playDMRShoot();
    }

    // Pump action rack trigger
    if (this.isPumpAction) {
      this.pumpTimer = 0.48;
      if (this.pumpTimeout) clearTimeout(this.pumpTimeout);
      this.pumpTimeout = setTimeout(() => {
        if (audioManager) audioManager.playShotgunPump();
        this.pumpTimeout = null;
      }, 120);
    }

    return true;
  }

  startReload(audioManager) {
    if (this.isReloading || this.currentAmmo >= this.magSize || this.reserveAmmo <= 0) {
      return false;
    }
    this.isReloading = true;
    this.reloadTimer = this.reloadDuration;

    if (audioManager) {
      audioManager.playReloadSound(this.type);
    }
    return true;
  }

  cancelActions() {
    if (this.flashTimeout) {
      clearTimeout(this.flashTimeout);
      this.flashTimeout = null;
    }
    if (this.pumpTimeout) {
      clearTimeout(this.pumpTimeout);
      this.pumpTimeout = null;
    }
    if (this.muzzleFlash) {
      this.muzzleFlash.children.forEach(c => c.material.visible = false);
      if (this.muzzleLight) this.muzzleLight.intensity = 0.0;
    }
    this.pumpTimer = 0;
    if (this.pumpSlideMesh) {
      this.pumpSlideMesh.position.z = -0.42;
    }
  }

  update(delta, time, swayOffset) {
    // Update Reticle Shader parallax uniforms
    if (this.reticleMaterial) {
      this.reticleMaterial.uniforms.uTime.value = time;
      if (swayOffset) {
        this.reticleMaterial.uniforms.uViewOffset.value = [swayOffset.x * 2.5, swayOffset.y * 2.5];
      }
    }

    // Pump action slide procedural animation
    if (this.isPumpAction && this.pumpSlideMesh) {
      if (this.pumpTimer > 0) {
        this.pumpTimer -= delta;
        const p = Math.max(0, this.pumpTimer / 0.48);
        // Back then forward: sin curve
        const slideOffset = Math.sin(p * Math.PI) * 0.14;
        this.pumpSlideMesh.position.z = -0.42 + slideOffset;
      } else {
        this.pumpSlideMesh.position.z = -0.42;
      }
    }

    // Reload timer
    if (this.isReloading) {
      this.reloadTimer -= delta;
      if (this.reloadTimer <= 0) {
        this.isReloading = false;
        const needed = this.magSize - this.currentAmmo;
        const loaded = Math.min(needed, this.reserveAmmo);
        this.currentAmmo += loaded;
        this.reserveAmmo -= loaded;
      }
    }
  }

  reset() {
    this.cancelActions();
    this.currentAmmo = this.magSize;
    this.reserveAmmo = this.maxReserveAmmo;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.pumpTimer = 0;
  }

  getWorldMuzzlePosition(targetVec) {
    this.muzzleFlash.getWorldPosition(targetVec);
    return targetVec;
  }
}
