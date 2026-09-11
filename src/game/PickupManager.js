import * as THREE from 'three';

export class PickupManager {
  constructor(scene, audioManager, gameState, weaponManager, hud) {
    this.scene = scene;
    this.audioManager = audioManager;
    this.gameState = gameState;
    this.weaponManager = weaponManager;
    this.hud = hud;

    this.pickups = [];

    // Shared materials & geometries
    this.healthMat = new THREE.MeshStandardMaterial({
      color: 0x00ff66,
      emissive: 0x00dd44,
      emissiveIntensity: 2.2,
      roughness: 0.2
    });

    this.ammoMat = new THREE.MeshStandardMaterial({
      color: 0x00e1ff,
      emissive: 0x00c4e0,
      emissiveIntensity: 2.2,
      roughness: 0.2
    });

    this.crateMat = new THREE.MeshStandardMaterial({
      color: 0x1a2228,
      metalness: 0.8,
      roughness: 0.3
    });
  }

  spawnDrop(position, forceType = null) {
    // 55% chance to drop on kill if not forced
    if (!forceType && Math.random() > 0.55) return;

    const type = forceType || (Math.random() < 0.45 ? 'health' : 'ammo');
    const dropPos = position.clone();
    dropPos.y = 0.5;

    const group = new THREE.Group();
    group.position.copy(dropPos);

    if (type === 'health') {
      // Emerald Green Teh Tarik Restorative Pack
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.45, 12), this.healthMat);
      bottle.position.y = 0.22;
      group.add(bottle);

      // Cross
      const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.04), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      cross1.position.set(0, 0.22, 0.13);
      const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.04), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      cross2.position.set(0, 0.22, 0.13);
      group.add(cross1, cross2);

      const light = new THREE.PointLight(0x00ff66, 2.5, 6, 1.5);
      light.position.y = 0.3;
      group.add(light);
    } else {
      // Neon Cyan Cyber Ammo Crate
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.28), this.crateMat);
      crate.position.y = 0.13;
      group.add(crate);

      // Glowing power core
      const core = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.08, 0.12), this.ammoMat);
      core.position.y = 0.13;
      group.add(core);

      const light = new THREE.PointLight(0x00e1ff, 2.5, 6, 1.5);
      light.position.y = 0.3;
      group.add(light);
    }

    this.scene.add(group);

    this.pickups.push({
      mesh: group,
      type: type,
      timer: 35.0, // seconds before despawn
      baseY: dropPos.y
    });
  }

  update(delta, playerPos) {
    const pickupDist = 1.8;
    const time = Date.now() * 0.003;

    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.timer -= delta;

      // Bob & Rotate
      p.mesh.rotation.y += delta * 2.5;
      p.mesh.position.y = p.baseY + Math.sin(time * 3.0 + i) * 0.1;

      // Despawn blink
      if (p.timer < 5.0) {
        p.mesh.visible = Math.floor(p.timer * 8) % 2 === 0;
      }

      // Check player proximity
      const dist = p.mesh.position.distanceTo(playerPos);
      if (dist < pickupDist) {
        this.collectPickup(p);
        this.disposePickupMesh(p.mesh);
        this.scene.remove(p.mesh);
        this.pickups.splice(i, 1);
        continue;
      }

      if (p.timer <= 0) {
        this.disposePickupMesh(p.mesh);
        this.scene.remove(p.mesh);
        this.pickups.splice(i, 1);
      }
    }
  }

  disposePickupMesh(meshGroup) {
    if (!meshGroup) return;
    meshGroup.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      // Dispose unique materials (like the cross or crate detail), keep shared ones
      if (child.material &&
          child.material !== this.healthMat &&
          child.material !== this.ammoMat &&
          child.material !== this.crateMat) {
        child.material.dispose();
      }
    });
  }

  reset() {
    for (const p of this.pickups) {
      this.disposePickupMesh(p.mesh);
      this.scene.remove(p.mesh);
    }
    this.pickups = [];
  }

  collectPickup(pickup) {
    if (pickup.type === 'health') {
      if (this.gameState) {
        this.gameState.health = Math.min(this.gameState.maxHealth, this.gameState.health + 40);
        this.gameState.shield = Math.min(this.gameState.maxShield, this.gameState.shield + 25);
      }
      if (this.hud) {
        this.hud.showPickupNotification('+HEALTH & SHIELD RESTORED', '#00ff66');
      }
      if (this.audioManager && this.audioManager.ctx) {
        const t = this.audioManager.ctx.currentTime;
        this.audioManager.playMechanicalClick(t, 880, 0.8, 0.15);
        this.audioManager.playMechanicalClick(t + 0.08, 1320, 0.9, 0.2);
      }
    } else if (pickup.type === 'ammo') {
      if (this.weaponManager) {
        for (const w of this.weaponManager.weapons) {
          if (w.type === 'bullpup') w.reserveAmmo = Math.min(240, w.reserveAmmo + 90);
          else if (w.type === 'shotgun') w.reserveAmmo = Math.min(54, w.reserveAmmo + 16);
          else if (w.type === 'dmr') w.reserveAmmo = Math.min(60, w.reserveAmmo + 20);
        }
      }
      if (this.hud) {
        this.hud.showPickupNotification('+AMMO CACHE RESUPPLIED', '#00e1ff');
      }
      if (this.audioManager && this.audioManager.ctx) {
        const t = this.audioManager.ctx.currentTime;
        this.audioManager.playMechanicalClick(t, 1100, 0.8, 0.12);
        this.audioManager.playMechanicalClick(t + 0.06, 1650, 0.9, 0.18);
      }
    }
  }
}
