import * as THREE from 'three';

export class BulletManager {
  constructor(scene, audioManager, pickupManager) {
    this.scene = scene;
    this.audioManager = audioManager;
    this.pickupManager = pickupManager;

    this.tracers = [];
    this.sparks = [];
    this.dustPuffs = [];
    this.decals = [];

    // Raycaster for hitscan verification
    this.raycaster = new THREE.Raycaster();

    // Reusable tracer geometry & materials
    this.tracerGeom = new THREE.CylinderGeometry(0.015, 0.015, 1.0, 4);
    this.tracerGeom.rotateX(Math.PI / 2);

    this.yellowTracerMat = new THREE.MeshBasicMaterial({ color: 0xffea79 });
    this.cyanTracerMat = new THREE.MeshBasicMaterial({ color: 0x66ffff });
    this.redTracerMat = new THREE.MeshBasicMaterial({ color: 0xff3344 });

    // Spark particle buffer geometry
    this.maxSparks = 600;
    this.sparkPositions = new Float32Array(this.maxSparks * 3);
    this.sparkVelocities = [];
    this.sparkColors = new Float32Array(this.maxSparks * 3);
    this.sparkLifetimes = new Float32Array(this.maxSparks);

    this.sparkGeom = new THREE.BufferGeometry();
    this.sparkGeom.setAttribute('position', new THREE.BufferAttribute(this.sparkPositions, 3));
    this.sparkGeom.setAttribute('color', new THREE.BufferAttribute(this.sparkColors, 3));

    this.sparkMat = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false
    });

    this.sparkPoints = new THREE.Points(this.sparkGeom, this.sparkMat);
    this.scene.add(this.sparkPoints);

    for (let i = 0; i < this.maxSparks; i++) {
      this.sparkVelocities.push(new THREE.Vector3());
      this.sparkLifetimes[i] = -1.0;
    }
  }

  // Fire a projectile ray
  fireBullet(origin, direction, range, damage, spreadAngle, weaponType, targetables, propManager, hud, gameState) {
    // Apply weapon spread cone
    const dir = direction.clone();
    if (spreadAngle > 0) {
      const spreadX = (Math.random() - 0.5) * spreadAngle;
      const spreadY = (Math.random() - 0.5) * spreadAngle;
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir));
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir));
      dir.addScaledVector(right, spreadX);
      dir.addScaledVector(up, spreadY);
      dir.normalize();
    }

    this.raycaster.set(origin, dir);
    this.raycaster.far = range;

    const hits = this.raycaster.intersectObjects(targetables, true);
    let hitPoint = origin.clone().add(dir.clone().multiplyScalar(range));
    let hitNormal = new THREE.Vector3(0, 1, 0);
    let hitEnemy = false;
    let isHeadshot = false;

    if (hits.length > 0) {
      const hit = hits[0];
      hitPoint = hit.point;
      if (hit.face) {
        hitNormal = hit.face.normal.clone().applyQuaternion(hit.object.getWorldQuaternion(new THREE.Quaternion()));
      }

      // Check if target is an enemy
      let curr = hit.object;
      let enemyRef = null;
      while (curr) {
        if (curr.userData && curr.userData.enemy) {
          enemyRef = curr.userData.enemy;
          break;
        }
        curr = curr.parent;
      }

      if (enemyRef && enemyRef.isAlive()) {
        hitEnemy = true;
        // Headshot detection: hit height relative to enemy mesh
        const localHitY = hit.point.y - enemyRef.mesh.position.y;
        if (localHitY > enemyRef.headshotMinY) {
          isHeadshot = true;
          damage *= 2.2; // Call of Duty high headshot multiplier
        }

        const knockbackForce = weaponType === 'shotgun' ? 14.0 : (weaponType === 'dmr' ? 10.0 : 4.0);
        const killResult = enemyRef.takeDamage(damage, dir, knockbackForce, isHeadshot);

        if (killResult && killResult.killed) {
          if (gameState) {
            gameState.recordKill(killResult.isHeadshot, killResult.score);
          }
          if (this.pickupManager) {
            this.pickupManager.spawnDrop(hitPoint);
          }
        }

        // Splatter cyber-sparks / synth-blood
        this.spawnEnemySparks(hitPoint, dir, isHeadshot ? 0xff2244 : 0x00ffff);

        if (hud) {
          hud.triggerHitmarker(isHeadshot);
        }
        if (this.audioManager) {
          this.audioManager.playHitmarker(isHeadshot);
        }
      } else {
        // Hit environment or prop
        if (propManager) {
          const impulseForce = weaponType === 'shotgun' ? 32.0 : (weaponType === 'dmr' ? 24.0 : 9.0);
          propManager.applyImpulse(hitPoint, dir, impulseForce);
        }

        // Concrete chips & neon sparks on walls/surfaces
        this.spawnSurfaceSparks(hitPoint, hitNormal);
      }
    }

    // Spawn visible high-velocity tracer mesh
    this.spawnTracer(origin, hitPoint, weaponType);
  }

  spawnTracer(from, to, weaponType) {
    const dist = from.distanceTo(to);
    let mat = this.yellowTracerMat;
    if (weaponType === 'shotgun') mat = this.redTracerMat;
    if (weaponType === 'dmr') mat = this.cyanTracerMat;

    const tracer = new THREE.Mesh(this.tracerGeom, mat);
    tracer.scale.set(1, 1, Math.min(dist, 4.0));
    tracer.position.copy(from);
    tracer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), to.clone().sub(from).normalize());

    this.scene.add(tracer);

    this.tracers.push({
      mesh: tracer,
      start: from.clone(),
      end: to.clone(),
      current: from.clone(),
      dir: to.clone().sub(from).normalize(),
      speed: 180.0, // m/s
      progress: 0.0,
      totalDist: dist
    });
  }

  spawnSurfaceSparks(pos, normal) {
    const count = 12 + Math.floor(Math.random() * 8);
    for (let i = 0; i < count; i++) {
      this.createSpark(pos, normal, 0xffaa33, 0.45);
    }
  }

  spawnEnemySparks(pos, shotDir, colorHex) {
    const count = 16;
    const invDir = shotDir.clone().negate();
    for (let i = 0; i < count; i++) {
      this.createSpark(pos, invDir, colorHex, 0.55);
    }
  }

  createSpark(pos, normal, colorHex, lifetime) {
    // Find inactive spark slot in pool
    let slot = -1;
    for (let i = 0; i < this.maxSparks; i++) {
      if (this.sparkLifetimes[i] <= 0) {
        slot = i;
        break;
      }
    }
    if (slot === -1) return;

    this.sparkPositions[slot * 3 + 0] = pos.x;
    this.sparkPositions[slot * 3 + 1] = pos.y;
    this.sparkPositions[slot * 3 + 2] = pos.z;

    // Conical spread around normal
    const speed = 4.0 + Math.random() * 8.0;
    const v = normal.clone().add(
      new THREE.Vector3((Math.random() - 0.5) * 1.8, (Math.random() - 0.5) * 1.8, (Math.random() - 0.5) * 1.8)
    ).normalize().multiplyScalar(speed);

    this.sparkVelocities[slot].copy(v);
    this.sparkLifetimes[slot] = lifetime;

    const col = new THREE.Color(colorHex);
    this.sparkColors[slot * 3 + 0] = col.r;
    this.sparkColors[slot * 3 + 1] = col.g;
    this.sparkColors[slot * 3 + 2] = col.b;
  }

  update(delta) {
    // Update bullet tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.progress += (t.speed * delta);
      if (t.progress >= t.totalDist) {
        this.scene.remove(t.mesh);
        this.tracers.splice(i, 1);
      } else {
        t.mesh.position.addScaledVector(t.dir, t.speed * delta);
      }
    }

    // Update spark particles
    let needsUpdate = false;
    for (let i = 0; i < this.maxSparks; i++) {
      if (this.sparkLifetimes[i] > 0) {
        needsUpdate = true;
        this.sparkLifetimes[i] -= delta;

        // Apply gravity
        this.sparkVelocities[i].y -= 18.0 * delta;

        this.sparkPositions[i * 3 + 0] += this.sparkVelocities[i].x * delta;
        this.sparkPositions[i * 3 + 1] += this.sparkVelocities[i].y * delta;
        this.sparkPositions[i * 3 + 2] += this.sparkVelocities[i].z * delta;

        // Ground bounce
        if (this.sparkPositions[i * 3 + 1] <= 0) {
          this.sparkPositions[i * 3 + 1] = 0;
          this.sparkVelocities[i].y *= -0.3;
          this.sparkVelocities[i].x *= 0.7;
          this.sparkVelocities[i].z *= 0.7;
        }

        if (this.sparkLifetimes[i] <= 0) {
          this.sparkPositions[i * 3 + 1] = -999;
        }
      }
    }

    if (needsUpdate) {
      this.sparkGeom.attributes.position.needsUpdate = true;
    }
  }
}
