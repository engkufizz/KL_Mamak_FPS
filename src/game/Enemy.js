import * as THREE from 'three';

// Reusable scratch vectors — the steering/separation code runs for every enemy
// on every frame, so allocating here caused heavy GC churn (visible as periodic
// stutter with a large horde). These are module-scoped because the values are
// consumed immediately, before another enemy's update runs.
const _toPlayer = new THREE.Vector3();
const _steer = new THREE.Vector3();
const _flankDir = new THREE.Vector3();
const _separation = new THREE.Vector3();
const _diff = new THREE.Vector3();

export class Enemy {
  constructor(scene, type, spawnPos, audioManager, waveNumber = 1) {
    this.scene = scene;
    this.type = type; // 'runner', 'enforcer', 'goliath'
    this.audioManager = audioManager;
    this.waveNumber = waveNumber;

    this.position = spawnPos.clone();
    this.velocity = new THREE.Vector3();
    this.heading = Math.random() * Math.PI * 2;
    this.state = 'spawning'; // 'spawning', 'running', 'attacking', 'dead'

    // Configure archetype attributes scaled by wave
    this.setupArchetype();

    // Visual meshes & materials
    this.mesh = new THREE.Group();
    this.mesh.position.copy(this.position);
    this.mesh.userData = { enemy: this };

    this.buildModel();
    this.buildHealthBar();
    this.scene.add(this.mesh);

    // Flanking angle offset unique to each enemy
    this.flankAngle = (Math.random() - 0.5) * 1.2;
    this.flankDist = 1.0 + Math.random() * 3.0;

    this.attackCooldown = 0;
    this.staggerTimer = 0;
    this.deathTimer = 0;

    // Headshot threshold relative to model base
    this.headshotMinY = this.height * 0.78;
  }

  setupArchetype() {
    const wave = this.waveNumber || 1;
    if (this.type === 'runner') {
      // Wave 1: manageable 4.2 m/s sprint, scales up with waves
      this.maxHealth = Math.min(85, 42 + (wave - 1) * 7);
      const baseSpeed = Math.min(6.2, 4.2 + (wave - 1) * 0.4);
      this.speed = baseSpeed + Math.random() * 0.5;
      this.damage = Math.min(18, 8 + (wave - 1) * 2);
      this.attackRange = 1.6;
      this.height = 1.75;
      this.radius = 0.4;
      this.scoreValue = 100;
    } else if (this.type === 'enforcer') {
      this.maxHealth = Math.min(180, 95 + (wave - 1) * 14);
      this.speed = Math.min(5.0, 3.6 + (wave - 1) * 0.35);
      this.damage = Math.min(26, 14 + (wave - 1) * 3);
      this.attackRange = 1.8;
      this.height = 1.9;
      this.radius = 0.5;
      this.scoreValue = 250;
    } else { // 'goliath'
      this.maxHealth = Math.min(420, 250 + (wave - 1) * 25);
      this.speed = Math.min(3.8, 2.6 + (wave - 1) * 0.25);
      this.damage = Math.min(45, 24 + (wave - 1) * 4);
      this.attackRange = 2.4;
      this.height = 2.4;
      this.radius = 0.85;
      this.scoreValue = 600;
    }
    this.health = this.maxHealth;
  }

  buildHealthBar() {
    this.hpBarGroup = new THREE.Group();
    this.hpBarGroup.position.y = this.height + 0.35;

    const bgMat = new THREE.MeshBasicMaterial({ color: 0x11161d });
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.08), bgMat);
    this.hpBarGroup.add(bg);

    const fillMat = new THREE.MeshBasicMaterial({
      color: this.type === 'goliath' ? 0x39ff14 : (this.type === 'enforcer' ? 0xff3344 : 0x00ffcc)
    });
    this.hpBarFill = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.06), fillMat);
    this.hpBarFill.position.z = 0.005;
    this.hpBarGroup.add(this.hpBarFill);

    this.hpBarGroup.visible = false; // Hidden until damaged
    this.mesh.add(this.hpBarGroup);
  }

  buildModel() {
    if (this.type === 'runner') {
      this.buildRunnerModel();
    } else if (this.type === 'enforcer') {
      this.buildEnforcerModel();
    } else {
      this.buildGoliathModel();
    }
  }

  // 1. Mat Rempit Cyber-Runner: High-contrast cyan visor, glowing chest reactor & hot blade
  buildRunnerModel() {
    const suitMat = new THREE.MeshStandardMaterial({ color: 0x1c242d, roughness: 0.45 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xccddee, metalness: 0.9, roughness: 0.2 });
    const neonVisorMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ddff, emissiveIntensity: 2.5 });
    const neonCoreMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00e1ff, emissiveIntensity: 2.8 });

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.3), suitMat);
    torso.position.y = 1.1;
    this.mesh.add(torso);

    // Glowing chest power core
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.04), neonCoreMat);
    core.position.set(0, 1.2, -0.16);
    this.mesh.add(core);

    // Cyber Head & Glowing Visor
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.32), chromeMat);
    head.position.y = 1.6;
    this.mesh.add(head);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.06), neonVisorMat);
    visor.position.set(0, 1.62, -0.17);
    this.mesh.add(visor);

    // Glowing shoulder strips
    const stripL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.16), neonVisorMat);
    stripL.position.set(-0.26, 1.35, 0);
    const stripR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.16), neonVisorMat);
    stripR.position.set(0.26, 1.35, 0);
    this.mesh.add(stripL, stripR);

    // Limbs
    const armMat = chromeMat;
    this.leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.14), armMat);
    this.leftArm.position.set(-0.35, 1.05, 0);
    this.mesh.add(this.leftArm);

    this.rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.14), armMat);
    this.rightArm.position.set(0.35, 1.05, 0);
    this.mesh.add(this.rightArm);

    // Weapon: Cyber Machete with hot magenta energy glow
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xff0055, emissive: 0xff0044, emissiveIntensity: 2.4 });
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.75, 0.12), bladeMat);
    blade.position.set(0.38, 0.75, -0.2);
    blade.rotation.x = Math.PI / 4;
    this.mesh.add(blade);

    // Legs
    this.leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.75, 0.18), suitMat);
    this.leftLeg.position.set(-0.16, 0.4, 0);
    this.mesh.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.75, 0.18), suitMat);
    this.rightLeg.position.set(0.16, 0.4, 0);
    this.mesh.add(this.rightLeg);
  }

  // 2. Syndicate Enforcer: Tactical red optics, illuminated chest core, electric baton
  buildEnforcerModel() {
    const armorMat = new THREE.MeshStandardMaterial({ color: 0x242a32, roughness: 0.35, metalness: 0.8 });
    const redVisor = new THREE.MeshStandardMaterial({ color: 0xff1122, emissive: 0xff0011, emissiveIntensity: 2.8 });
    const batonMat = new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff77, emissiveIntensity: 2.6 });

    // Torso with heavy armor chestplate
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.72, 0.38), armorMat);
    torso.position.y = 1.15;
    this.mesh.add(torso);

    // Red illuminated chest armor chevron
    const chestGlow = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.04), redVisor);
    chestGlow.position.set(0, 1.25, -0.2);
    this.mesh.add(chestGlow);

    // Tactical Helmet
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.36), armorMat);
    head.position.y = 1.72;
    this.mesh.add(head);

    // Wide glowing red cyber-visor
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.06), redVisor);
    eye.position.set(0, 1.74, -0.19);
    this.mesh.add(eye);

    // Arms & Shock Baton
    this.leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 0.18), armorMat);
    this.leftArm.position.set(-0.45, 1.1, 0);
    this.mesh.add(this.leftArm);

    this.rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 0.18), armorMat);
    this.rightArm.position.set(0.45, 1.1, 0);
    this.mesh.add(this.rightArm);

    const baton = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.85, 8), batonMat);
    baton.position.set(0.48, 0.85, -0.2);
    baton.rotation.x = Math.PI / 3;
    this.mesh.add(baton);

    // Legs
    this.leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), armorMat);
    this.leftLeg.position.set(-0.2, 0.42, 0);
    this.mesh.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), armorMat);
    this.rightLeg.position.set(0.2, 0.42, 0);
    this.mesh.add(this.rightLeg);
  }

  // 3. Bio-Goliath: Towering mutant with pulsing toxic green spinal cysts and glowing eyes
  buildGoliathModel() {
    const fleshMat = new THREE.MeshStandardMaterial({ color: 0x36423d, roughness: 0.7 });
    const toxicGlow = new THREE.MeshStandardMaterial({ color: 0x39ff14, emissive: 0x24ff00, emissiveIntensity: 2.8 });

    // Massive hunched torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 0.8), fleshMat);
    torso.position.y = 1.45;
    this.mesh.add(torso);

    // Glowing spinal cysts
    const cyst1 = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), toxicGlow);
    cyst1.position.set(-0.3, 1.75, 0.45);
    this.mesh.add(cyst1);

    const cyst2 = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), toxicGlow);
    cyst2.position.set(0.25, 1.9, 0.42);
    this.mesh.add(cyst2);

    const cyst3 = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), toxicGlow);
    cyst3.position.set(0.0, 1.5, 0.46);
    this.mesh.add(cyst3);

    // Brute Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.5), fleshMat);
    head.position.y = 2.05;
    head.position.z = -0.3;
    this.mesh.add(head);

    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.35), fleshMat);
    jaw.position.set(0, 1.88, -0.42);
    this.mesh.add(jaw);

    // Glowing bio-eyes
    const eye1 = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), toxicGlow);
    eye1.position.set(-0.14, 2.12, -0.55);
    this.mesh.add(eye1);

    const eye2 = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), toxicGlow);
    eye2.position.set(0.14, 2.12, -0.55);
    this.mesh.add(eye2);

    // Giant Battering Arms
    this.leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.1, 0.38), fleshMat);
    this.leftArm.position.set(-0.8, 1.25, -0.1);
    this.mesh.add(this.leftArm);

    this.rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.1, 0.38), fleshMat);
    this.rightArm.position.set(0.8, 1.25, -0.1);
    this.mesh.add(this.rightArm);

    // Thick Legs
    this.leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.95, 0.4), fleshMat);
    this.leftLeg.position.set(-0.35, 0.48, 0);
    this.mesh.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.95, 0.4), fleshMat);
    this.rightLeg.position.set(0.35, 0.48, 0);
    this.mesh.add(this.rightLeg);
  }

  takeDamage(amount, hitDir, knockback, isHeadshot) {
    if (this.state === 'dead') return { killed: false };

    this.health -= amount;

    // Show health bar
    if (this.hpBarGroup) {
      this.hpBarGroup.visible = true;
      const ratio = Math.max(0, this.health / this.maxHealth);
      this.hpBarFill.scale.x = ratio;
    }

    // Apply knockback impulse safely
    const dir = (hitDir && typeof hitDir.clone === 'function')
      ? hitDir.clone().normalize()
      : (hitDir ? new THREE.Vector3(hitDir.x || 0, hitDir.y || 0, hitDir.z || -1).normalize() : new THREE.Vector3(0, 0, -1));

    this.velocity.add(dir.clone().multiplyScalar(knockback));
    this.velocity.y += knockback * 0.25;

    this.staggerTimer = 0.2;

    if (this.health <= 0) {
      this.die(dir, knockback, isHeadshot);
      return { killed: true, isHeadshot, score: this.scoreValue };
    }
    return { killed: false };
  }

  die(hitDir, knockback, isHeadshot) {
    this.state = 'dead';
    this.deathTimer = 3.5;

    if (this.hpBarGroup) {
      this.hpBarGroup.visible = false;
    }

    const dir = (hitDir && typeof hitDir.clone === 'function')
      ? hitDir.clone().normalize()
      : (hitDir ? new THREE.Vector3(hitDir.x || 0, hitDir.y || 0, hitDir.z || -1).normalize() : new THREE.Vector3(0, 0, -1));

    // Ragdoll tumble velocity
    this.velocity.add(dir.clone().multiplyScalar(knockback * 1.5));
    this.velocity.y += 3.5;

    if (this.audioManager) {
      this.audioManager.playEnemyDeath();
    }
  }

  isAlive() {
    return this.state !== 'dead';
  }

  update(delta, playerPos, otherEnemies, propManager, onAttackPlayer) {
    if (this.state === 'dead') {
      this.deathTimer -= delta;

      // Integrate ragdoll fall
      this.velocity.y -= 22.0 * delta;
      this.position.addScaledVector(this.velocity, delta);
      this.mesh.position.copy(this.position);

      // Tumble backwards
      this.mesh.rotation.x += delta * 4.0;

      if (this.position.y <= 0) {
        this.position.y = 0;
        this.velocity.set(0, 0, 0);
        this.mesh.position.y = 0;
      }

      // Shrink & sink into ground before removal
      if (this.deathTimer < 0.6) {
        const s = Math.max(0, this.deathTimer / 0.6);
        this.mesh.scale.set(s, s, s);
      }
      return this.deathTimer > 0;
    }

    // Billboard health bar to face player
    if (this.hpBarGroup && this.hpBarGroup.visible) {
      this.hpBarGroup.lookAt(playerPos.x, this.hpBarGroup.position.y + this.position.y, playerPos.z);
    }

    // 1. Spawning / Leaping from rooftop ledge
    if (this.position.y > 0) {
      this.velocity.y -= 22.0 * delta;
      this.position.y += this.velocity.y * delta;
      if (this.position.y <= 0) {
        this.position.y = 0;
        this.velocity.y = 0;
        this.state = 'running';
        if (this.audioManager) {
          this.audioManager.playFootstep(true);
        }
      }
      this.mesh.position.copy(this.position);
      return true;
    }

    // 2. Navigation Steering & Flocking towards Player
    const toPlayer = _toPlayer.subVectors(playerPos, this.position);
    toPlayer.y = 0;
    const distToPlayer = toPlayer.length();

    // Desired steering direction
    const steer = _steer.copy(toPlayer).normalize();

    // Flank offset: rusher and enforcers fan out sideways
    if (distToPlayer > 4.0) {
      const flankDir = _flankDir.set(-steer.z, 0, steer.x).multiplyScalar(this.flankAngle);
      steer.add(flankDir.multiplyScalar(0.45)).normalize();
    }

    // Flocking Separation: Push away from nearby horde members
    const separation = _separation.set(0, 0, 0);
    let neighborCount = 0;
    for (const other of otherEnemies) {
      if (other === this || !other.isAlive()) continue;
      const diff = _diff.subVectors(this.position, other.position);
      diff.y = 0;
      const d = diff.length();
      const sepDist = this.radius + other.radius + 0.35;
      if (d < sepDist && d > 0.001) {
        diff.normalize().divideScalar(d);
        separation.add(diff);
        neighborCount++;
      }
    }
    if (neighborCount > 0) {
      separation.divideScalar(neighborCount).normalize();
      steer.add(separation.multiplyScalar(0.75)).normalize();
    }

    // Integrate horizontal velocity
    if (this.staggerTimer > 0) {
      this.staggerTimer -= delta;
      this.velocity.multiplyScalar(0.88);
    } else {
      const targetVel = steer.multiplyScalar(this.speed);
      this.velocity.x += (targetVel.x - this.velocity.x) * Math.min(1.0, 10.0 * delta);
      this.velocity.z += (targetVel.z - this.velocity.z) * Math.min(1.0, 10.0 * delta);
    }

    this.position.x += this.velocity.x * delta;
    this.position.z += this.velocity.z * delta;

    // Boundaries clamp
    this.position.x = Math.max(-15.0, Math.min(15.0, this.position.x));
    this.position.z = Math.max(-23.0, Math.min(23.0, this.position.z));

    this.mesh.position.copy(this.position);

    // Look towards movement or player
    if (distToPlayer > 0.1) {
      this.mesh.lookAt(playerPos.x, this.position.y, playerPos.z);
    }

    // Limb run animation
    const runCycle = Date.now() * 0.009 * (this.speed / 5.0);
    if (this.leftLeg && this.rightLeg) {
      this.leftLeg.rotation.x = Math.sin(runCycle) * 0.65;
      this.rightLeg.rotation.x = -Math.sin(runCycle) * 0.65;
    }
    if (this.leftArm && this.rightArm) {
      this.leftArm.rotation.x = -Math.sin(runCycle) * 0.65;
      this.rightArm.rotation.x = Math.sin(runCycle) * 0.65;
    }

    // 3. Attack Player Check
    this.attackCooldown -= delta;
    if (distToPlayer <= this.attackRange && this.attackCooldown <= 0) {
      this.attackCooldown = 1.1;

      if (this.audioManager) {
        this.audioManager.playEnemyAttack();
      }

      // Goliath ground smash shockwave
      if (this.type === 'goliath') {
        if (propManager) {
          propManager.applyExplosionImpulse(this.position, 6.0, 45.0);
        }
      }

      if (onAttackPlayer) {
        onAttackPlayer(this.damage, this.position);
      }
    }

    return true;
  }

  dispose() {
    this.mesh.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
}
