import * as THREE from 'three';
import { Weapon } from './Weapon.js';

export class WeaponManager {
  constructor(camera, scene, bulletManager, audioManager, propManager) {
    this.camera = camera;
    this.scene = scene;
    this.bulletManager = bulletManager;
    this.audioManager = audioManager;
    this.propManager = propManager;

    // Viewmodel rig attached to camera
    this.viewmodelRig = new THREE.Group();
    this.camera.add(this.viewmodelRig);

    // Subtle viewmodel key & rim light for crisp first-person weapon readability
    const viewmodelLight = new THREE.PointLight(0xaad2ff, 1.4, 4.0, 1.5);
    viewmodelLight.position.set(0.2, 0.3, -0.2);
    this.viewmodelRig.add(viewmodelLight);

    // Weapon slots
    this.weapons = [];
    this.currentSlot = 0;
    this.isADS = false;
    this.adsAlpha = 0.0; // 0 = Hip, 1 = ADS
    this.baseFov = 75;

    // Procedural Sway & Lag Physics
    this.swayPos = new THREE.Vector2();
    this.swayVel = new THREE.Vector2();
    this.swayRot = new THREE.Vector3();

    // Procedural Recoil Spring Physics
    this.recoilOffset = new THREE.Vector3();
    this.recoilVelocity = new THREE.Vector3();
    this.recoilRot = new THREE.Vector3();
    this.recoilRotVel = new THREE.Vector3();

    // Camera Recoil Impulse
    this.camRecoilPitch = 0;
    this.camRecoilPitchVel = 0;

    // Procedural Bobbing
    this.bobTimer = 0;
    this.bobOffset = new THREE.Vector3();

    this.initWeapons();
    this.equipSlot(0);
  }

  initWeapons() {
    // 1. Bullpup AR / SMG
    const bullpup = new Weapon({
      name: 'MAMAK COMMANDO-9',
      type: 'bullpup',
      magSize: 30,
      reserveAmmo: 180,
      fireRate: 12.5, // 750 RPM
      damage: 32,
      spread: 0.018,
      adsSpread: 0.0035,
      range: 120,
      isAutomatic: true,
      reloadDuration: 1.5,
      adsFov: 52,
      hipPosition: new THREE.Vector3(0.22, -0.22, -0.48),
      adsPosition: new THREE.Vector3(0.0, -0.143, -0.38), // Sight lined up with center screen!
      hipRotation: new THREE.Euler(0.02, -0.04, 0.02),
      adsRotation: new THREE.Euler(0.0, 0.0, 0.0),
      recoilKickZ: 0.05,
      recoilPitch: 0.075,
      recoilYaw: 0.015,
      camKickPitch: 0.025
    });

    // 2. Tactical Pump-Action Shotgun
    const shotgun = new Weapon({
      name: 'STREET SWEEPER 12G',
      type: 'shotgun',
      magSize: 6,
      reserveAmmo: 42,
      fireRate: 1.25,
      damage: 22, // 22 x 8 pellets = 176 max point-blank damage!
      pellets: 8,
      spread: 0.055,
      adsSpread: 0.032,
      range: 55,
      isAutomatic: false,
      isPumpAction: true,
      reloadDuration: 2.2,
      adsFov: 60,
      hipPosition: new THREE.Vector3(0.24, -0.24, -0.52),
      adsPosition: new THREE.Vector3(0.0, -0.075, -0.42),
      hipRotation: new THREE.Euler(0.02, -0.04, 0.02),
      adsRotation: new THREE.Euler(0.0, 0.0, 0.0),
      recoilKickZ: 0.14,
      recoilPitch: 0.18,
      recoilYaw: 0.04,
      camKickPitch: 0.065
    });

    // 3. Heavy Marksman Rifle (Cyber-DMR)
    const dmr = new Weapon({
      name: 'KL-50 CYBER DMR',
      type: 'dmr',
      magSize: 10,
      reserveAmmo: 50,
      fireRate: 2.8,
      damage: 110, // One-shot kill on regular grunts!
      spread: 0.009,
      adsSpread: 0.0008,
      range: 200,
      isAutomatic: false,
      reloadDuration: 1.8,
      adsFov: 36, // Deep optical zoom
      hipPosition: new THREE.Vector3(0.25, -0.26, -0.55),
      adsPosition: new THREE.Vector3(0.0, -0.14, -0.36), // Perfect RDS holographic center alignment
      hipRotation: new THREE.Euler(0.01, -0.03, 0.01),
      adsRotation: new THREE.Euler(0.0, 0.0, 0.0),
      recoilKickZ: 0.09,
      recoilPitch: 0.15,
      recoilYaw: 0.02,
      camKickPitch: 0.045
    });

    this.weapons = [bullpup, shotgun, dmr];
  }

  getActiveWeapon() {
    return this.weapons[this.currentSlot];
  }

  equipSlot(slotIndex) {
    if (slotIndex < 0 || slotIndex >= this.weapons.length) return;
    if (slotIndex === this.currentSlot && this.viewmodelRig.children.length > 0) return;

    // Cancel reload on current weapon when switching
    const prev = this.getActiveWeapon();
    if (prev && prev.isReloading) {
      prev.isReloading = false;
      prev.reloadTimer = 0;
    }

    // Remove existing weapon mesh
    while (this.viewmodelRig.children.length > 0) {
      this.viewmodelRig.remove(this.viewmodelRig.children[0]);
    }

    this.currentSlot = slotIndex;
    const active = this.getActiveWeapon();
    this.viewmodelRig.add(active.root);

    if (this.audioManager) {
      this.audioManager.playSwitchWeapon();
    }
  }

  cycleWeapon(direction) {
    let next = this.currentSlot + direction;
    if (next < 0) next = this.weapons.length - 1;
    if (next >= this.weapons.length) next = 0;
    this.equipSlot(next);
  }

  setADS(isAiming) {
    this.isADS = isAiming;
  }

  triggerReload() {
    const active = this.getActiveWeapon();
    if (active) {
      active.startReload(this.audioManager);
    }
  }

  applyRecoil(weapon) {
    // Translational kick backward
    this.recoilVelocity.z += weapon.recoilKickZ * 6.5;
    this.recoilVelocity.y += weapon.recoilKickZ * 1.8;

    // Rotational kick: Pitch up, random yaw/roll
    this.recoilRotVel.x += weapon.recoilPitch * 14.0;
    this.recoilRotVel.y += (Math.random() - 0.5) * weapon.recoilYaw * 12.0;
    this.recoilRotVel.z += (Math.random() - 0.5) * weapon.recoilYaw * 8.0;

    // Camera recoil kick
    this.camRecoilPitchVel += weapon.camKickPitch * 10.0;
  }

  tryFire(currentTime, targetables, hud, gameState) {
    const active = this.getActiveWeapon();
    if (!active) return false;

    if (!active.canFire(currentTime)) {
      if (active.currentAmmo <= 0 && !active.isReloading) {
        if (this.audioManager) this.audioManager.playEmptyClick();
      }
      return false;
    }

    // Fire weapon!
    active.fire(currentTime, this.audioManager);
    this.applyRecoil(active);

    // Bullet origin & camera forward direction
    const muzzleWorld = new THREE.Vector3();
    active.getWorldMuzzlePosition(muzzleWorld);

    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);

    const spread = this.isADS ? active.adsSpread : active.spread;

    // Fire bullet pellets
    for (let i = 0; i < active.pellets; i++) {
      this.bulletManager.fireBullet(
        this.camera.position,
        camDir,
        active.range,
        active.damage,
        spread,
        active.type,
        targetables,
        this.propManager,
        hud,
        gameState
      );
    }

    return true;
  }

  update(delta, time, mouseInput, isMoving, isSprinting) {
    const active = this.getActiveWeapon();
    if (!active) return;

    // 1. Smooth ADS transition (Exponential approach)
    const adsSpeed = 12.0;
    const targetAlpha = this.isADS ? 1.0 : 0.0;
    this.adsAlpha += (targetAlpha - this.adsAlpha) * Math.min(1.0, adsSpeed * delta);

    // Dynamic FOV zoom
    const targetFov = THREE.MathUtils.lerp(this.baseFov, active.adsFov, this.adsAlpha);
    this.camera.fov = targetFov;
    this.camera.updateProjectionMatrix();

    // 2. Procedural Weapon Sway & Lag
    const swayAmount = (1.0 - this.adsAlpha * 0.85) * 0.003;
    const swayTargetX = -mouseInput.deltaX * swayAmount * 28.0;
    const swayTargetY = mouseInput.deltaY * swayAmount * 28.0;

    this.swayPos.x += (swayTargetX - this.swayPos.x) * Math.min(1.0, 16.0 * delta);
    this.swayPos.y += (swayTargetY - this.swayPos.y) * Math.min(1.0, 16.0 * delta);

    this.swayRot.z = this.swayPos.x * 0.8;
    this.swayRot.y = this.swayPos.x * 0.4;
    this.swayRot.x = -this.swayPos.y * 0.4;

    // 3. Movement Bobbing (Figure-8 Lissajous)
    if (isMoving) {
      const bobFreq = isSprinting ? 14.0 : 9.5;
      const bobScale = (isSprinting ? 0.024 : 0.012) * (1.0 - this.adsAlpha * 0.7);
      this.bobTimer += delta * bobFreq;

      this.bobOffset.x = Math.sin(this.bobTimer * 0.5) * bobScale * 0.8;
      this.bobOffset.y = Math.abs(Math.sin(this.bobTimer)) * bobScale;
    } else {
      // Gentle breathing idle sway
      this.bobTimer += delta * 2.0;
      this.bobOffset.x = Math.sin(this.bobTimer) * 0.002 * (1.0 - this.adsAlpha * 0.9);
      this.bobOffset.y = Math.cos(this.bobTimer * 2.0) * 0.0015 * (1.0 - this.adsAlpha * 0.9);
    }

    // 4. Recoil Dual-Spring Integration
    const springK = 220.0;
    const damperC = 24.0;

    // Position spring
    const springForceZ = -springK * this.recoilOffset.z - damperC * this.recoilVelocity.z;
    this.recoilVelocity.z += springForceZ * delta;
    this.recoilOffset.z += this.recoilVelocity.z * delta;

    const springForceY = -springK * this.recoilOffset.y - damperC * this.recoilVelocity.y;
    this.recoilVelocity.y += springForceY * delta;
    this.recoilOffset.y += this.recoilVelocity.y * delta;

    // Rotation spring
    const springForceRotX = -springK * this.recoilRot.x - damperC * this.recoilRotVel.x;
    this.recoilRotVel.x += springForceRotX * delta;
    this.recoilRot.x += this.recoilRotVel.x * delta;

    const springForceRotY = -springK * this.recoilRot.y - damperC * this.recoilRotVel.y;
    this.recoilRotVel.y += springForceRotY * delta;
    this.recoilRot.y += this.recoilRotVel.y * delta;

    const springForceRotZ = -springK * this.recoilRot.z - damperC * this.recoilRotVel.z;
    this.recoilRotVel.z += springForceRotZ * delta;
    this.recoilRot.z += this.recoilRotVel.z * delta;

    // Camera recoil spring
    const camSpringForce = -160.0 * this.camRecoilPitch - 18.0 * this.camRecoilPitchVel;
    this.camRecoilPitchVel += camSpringForce * delta;
    this.camRecoilPitch += this.camRecoilPitchVel * delta;

    // 5. Synthesize Viewmodel Transform
    const currentPos = new THREE.Vector3().lerpVectors(active.hipPosition, active.adsPosition, this.adsAlpha);
    const currentRot = new THREE.Euler(
      THREE.MathUtils.lerp(active.hipRotation.x, active.adsRotation.x, this.adsAlpha),
      THREE.MathUtils.lerp(active.hipRotation.y, active.adsRotation.y, this.adsAlpha),
      THREE.MathUtils.lerp(active.hipRotation.z, active.adsRotation.z, this.adsAlpha)
    );

    // Apply sway + bob + recoil
    this.viewmodelRig.position.set(
      currentPos.x + this.swayPos.x + this.bobOffset.x,
      currentPos.y + this.swayPos.y + this.bobOffset.y + this.recoilOffset.y,
      currentPos.z + this.recoilOffset.z
    );

    this.viewmodelRig.rotation.set(
      currentRot.x + this.swayRot.x + this.recoilRot.x,
      currentRot.y + this.swayRot.y + this.recoilRot.y,
      currentRot.z + this.swayRot.z + this.recoilRot.z
    );

    // Update active weapon internal animation / shaders
    active.update(delta, time, this.swayPos);
  }

  getCameraRecoilPitch() {
    return this.camRecoilPitch;
  }

  reset() {
    for (const w of this.weapons) {
      w.reset();
    }
    this.equipSlot(0);
    this.isADS = false;
    this.adsAlpha = 0.0;
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
    this.recoilOffset.set(0, 0, 0);
    this.recoilVelocity.set(0, 0, 0);
    this.recoilRot.set(0, 0, 0);
    this.recoilRotVel.set(0, 0, 0);
    this.camRecoilPitch = 0;
    this.camRecoilPitchVel = 0;
  }
}
