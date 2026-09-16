import * as THREE from 'three';

export class PickupManager {
  constructor(scene, audioManager, gameState, weaponManager, hud) {
    this.scene = scene;
    this.audioManager = audioManager;
    this.gameState = gameState;
    this.weaponManager = weaponManager;
    this.hud = hud;

    this.pickups = [];

    // ---------------------------------------------------------------------
    // Pooled glow lights.
    //
    // Each drop used to create its own PointLight. Adding/removing a light
    // changes the light count, which forces three.js to recompile every lit
    // material's shader: measured +13..16 GL programs PER DROP (a multi-hundred
    // millisecond freeze on mobile), and the program count never came back down.
    //
    // Instead, a fixed pool of lights lives in the scene for the whole session
    // (light count never changes, so shaders compile once at boot). Lights are
    // re-coloured and repositioned per drop; unused ones sit at intensity 0.
    this.lightPoolSize = 4;
    this.lightPool = [];
    for (let i = 0; i < this.lightPoolSize; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 6, 1.5);
      light.position.set(0, -50, 0); // parked out of view until assigned
      this.scene.add(light);
      this.lightPool.push({ light, pickup: null });
    }

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

    // Shared white detail material (used by the health-pack cross)
    this.crossMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // Geometry cache: pickups used to build fresh geometries on every drop,
    // which uploaded new buffers to the GPU each time (visible hitch) and grew
    // memory without bound. Identical shapes are now shared.
    this._geoCache = new Map();
  }

  sharedGeo(Ctor, ...args) {
    const key = `${Ctor.name}:${args.join(',')}`;
    let geo = this._geoCache.get(key);
    if (!geo) {
      geo = new Ctor(...args);
      this._geoCache.set(key, geo);
    }
    return geo;
  }

  spawnDrop(position, forceType = null) {
    // 55% chance to drop on kill if not forced
    if (!forceType && Math.random() > 0.55) return;

    const type = forceType || (Math.random() < 0.45 ? 'health' : 'ammo');
    const dropPos = position.clone();
    dropPos.y = 0.5;

    const group = new THREE.Group();
    group.position.copy(dropPos);

    const light = this._acquireLight(type === 'health' ? 0x00ff66 : 0x00e1ff);
    // NOTE: the pooled light is deliberately NOT added to the group — it must
    // stay a direct child of the scene, otherwise three.js sees the light count
    // change and recompiles every lit shader (the freeze we are fixing).
    light.position.set(dropPos.x, dropPos.y + 0.3, dropPos.z);

    if (type === 'health') {
      // Emerald Green Teh Tarik Restorative Pack
      const bottle = new THREE.Mesh(this.sharedGeo(THREE.CylinderGeometry, 0.12, 0.14, 0.45, 12), this.healthMat);
      bottle.position.y = 0.22;
      group.add(bottle);

      // Cross
      const cross1 = new THREE.Mesh(this.sharedGeo(THREE.BoxGeometry, 0.06, 0.22, 0.04), this.crossMat);
      cross1.position.set(0, 0.22, 0.13);
      const cross2 = new THREE.Mesh(this.sharedGeo(THREE.BoxGeometry, 0.2, 0.06, 0.04), this.crossMat);
      cross2.position.set(0, 0.22, 0.13);
      group.add(cross1, cross2);
    } else {
      // Neon Cyan Cyber Ammo Crate
      const crate = new THREE.Mesh(this.sharedGeo(THREE.BoxGeometry, 0.42, 0.26, 0.28), this.crateMat);
      crate.position.y = 0.13;
      group.add(crate);

      // Glowing power core
      const core = new THREE.Mesh(this.sharedGeo(THREE.BoxGeometry, 0.44, 0.08, 0.12), this.ammoMat);
      core.position.y = 0.13;
      group.add(core);
    }

    this.scene.add(group);

    const record = {
      mesh: group,
      type: type,
      timer: 35.0, // seconds before despawn
      baseY: dropPos.y,
      light
    };
    this.pickups.push(record);
    // remember which pickup owns each pooled light
    for (const slot of this.lightPool) {
      if (slot.light === light) slot.pickup = record;
    }
  }

  // Grab a pooled light (recolouring is a uniform change: no shader recompile).
  _acquireLight(color) {
    let slot = this.lightPool.find(s => s.pickup === null);
    if (!slot) {
      // all in use: steal the one from the oldest pickup still alive
      slot = this.lightPool[0];
      for (const s of this.lightPool) {
        if (s.pickup && (!slot.pickup || s.pickup.timer < slot.pickup.timer)) slot = s;
      }
      if (slot.pickup) slot.pickup.light = null;
    }
    slot.pickup = null;
    slot.light.color.set(color);
    slot.light.intensity = 2.5;
    return slot.light;
  }

  _releaseLight(record) {
    if (!record || !record.light) return;
    for (const slot of this.lightPool) {
      if (slot.light === record.light) {
        slot.pickup = null;
        slot.light.intensity = 0;
        slot.light.position.set(0, -50, 0);
      }
    }
    record.light = null;
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

      // Keep this pickup's pooled glow light in sync with the mesh
      if (p.light) {
        p.light.position.set(p.mesh.position.x, p.mesh.position.y + 0.3, p.mesh.position.z);
        p.light.visible = p.mesh.visible;
      }

      // Despawn blink
      if (p.timer < 5.0) {
        p.mesh.visible = Math.floor(p.timer * 8) % 2 === 0;
      }

      // Check player proximity
      const dist = p.mesh.position.distanceTo(playerPos);
      if (dist < pickupDist) {
        this.collectPickup(p);
        this._releaseLight(p);
        this.disposePickupMesh(p.mesh);
        this.scene.remove(p.mesh);
        this.pickups.splice(i, 1);
        continue;
      }

      if (p.timer <= 0) {
        this._releaseLight(p);
        this.disposePickupMesh(p.mesh);
        this.scene.remove(p.mesh);
        this.pickups.splice(i, 1);
      }
    }
  }

  disposePickupMesh(meshGroup) {
    if (!meshGroup) return;
    // Geometries and materials are shared/cached now (see sharedGeo and the
    // *Mat fields), so nothing is disposed here — just detach the group.
    if (meshGroup.parent) meshGroup.parent.remove(meshGroup);
  }

  reset() {
    for (const p of this.pickups) {
      this._releaseLight(p);
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
