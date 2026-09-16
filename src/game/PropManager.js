import * as THREE from 'three';

export class PropManager {
  constructor(scene, audioManager) {
    this.scene = scene;
    this.audioManager = audioManager;
    this.props = [];

    this.initMamakFurniture();
    this.propMeshes = this.props.map(p => p.mesh);
  }

  getPropMeshes() {
    return this.propMeshes;
  }

  // Create the iconic Malaysian red plastic stool (with center hole!)
  createMamakStoolMesh() {
    const group = new THREE.Group();
    const stoolMat = new THREE.MeshStandardMaterial({
      color: 0xdd2222,
      roughness: 0.35,
      metalness: 0.08
    });

    // Stool seat (with center hole simulated with border segments)
    const seatTop = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 0.55), stoolMat);
    seatTop.position.y = 0.45;
    group.add(seatTop);

    // Center hole detail (dark recess)
    const holeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 12), holeMat);
    hole.position.y = 0.451;
    group.add(hole);

    // 4 Flared plastic legs
    const legGeom = new THREE.CylinderGeometry(0.028, 0.038, 0.45, 8);
    const legOffsets = [
      [-0.2, 0.22, -0.2],
      [0.2, 0.22, -0.2],
      [-0.2, 0.22, 0.2],
      [0.2, 0.22, 0.2]
    ];

    legOffsets.forEach(pos => {
      const leg = new THREE.Mesh(legGeom, stoolMat);
      leg.position.set(...pos);
      leg.rotation.x = (pos[2] > 0 ? 1 : -1) * 0.1;
      leg.rotation.z = (pos[0] > 0 ? -1 : 1) * 0.1;
      group.add(leg);
    });

    return group;
  }

  // Create blue plastic square folding mamak table
  createMamakTableMesh() {
    const group = new THREE.Group();
    const tableTopMat = new THREE.MeshStandardMaterial({
      color: 0x1565c0,
      roughness: 0.3,
      metalness: 0.1
    });

    // Square tabletop
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 1.4), tableTopMat);
    top.position.y = 0.85;
    group.add(top);

    // Metal folding legs
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x88929b, roughness: 0.4, metalness: 0.85 });
    const legGeom = new THREE.CylinderGeometry(0.03, 0.03, 0.85, 8);

    const legPositions = [
      [-0.55, 0.42, -0.55],
      [0.55, 0.42, -0.55],
      [-0.55, 0.42, 0.55],
      [0.55, 0.42, 0.55]
    ];

    legPositions.forEach(pos => {
      const leg = new THREE.Mesh(legGeom, metalMat);
      leg.position.set(...pos);
      group.add(leg);
    });

    return group;
  }

  initMamakFurniture() {
    // Cluster 1: Left alley outdoor seating
    this.addTableAndChairs(-5.5, -4.0);
    this.addTableAndChairs(-5.5, 4.0);
    this.addTableAndChairs(-5.5, 12.0);

    // Cluster 2: Right alley outdoor seating
    this.addTableAndChairs(5.5, -3.0);
    this.addTableAndChairs(5.5, 5.0);
    this.addTableAndChairs(5.5, 13.0);

    // Some stray stools and tables near the stall
    this.addStool(-1.5, -8.0);
    this.addStool(1.5, -8.0);
    this.addStool(0.0, -9.0);
  }

  addTableAndChairs(centerX, centerZ) {
    // Add Table
    const tableMesh = this.createMamakTableMesh();
    tableMesh.position.set(centerX, 0, centerZ);
    this.scene.add(tableMesh);

    this.props.push({
      mesh: tableMesh,
      type: 'table',
      initialPosition: tableMesh.position.clone(),
      initialRotation: tableMesh.rotation.clone(),
      velocity: new THREE.Vector3(),
      angularVelocity: new THREE.Vector3(),
      mass: 8.0,
      radius: 0.9,
      height: 0.88,
      isGrounded: true
    });

    // Add 4 surrounding plastic red stools
    const offsets = [
      [-0.85, 0],
      [0.85, 0],
      [0, -0.85],
      [0, 0.85]
    ];

    offsets.forEach(([ox, oz]) => {
      this.addStool(centerX + ox + (Math.random() - 0.5) * 0.15, centerZ + oz + (Math.random() - 0.5) * 0.15);
    });
  }

  addStool(x, z) {
    const stoolMesh = this.createMamakStoolMesh();
    stoolMesh.position.set(x, 0, z);
    stoolMesh.rotation.y = Math.random() * Math.PI * 2;
    this.scene.add(stoolMesh);

    this.props.push({
      mesh: stoolMesh,
      type: 'stool',
      initialPosition: stoolMesh.position.clone(),
      initialRotation: stoolMesh.rotation.clone(),
      velocity: new THREE.Vector3(),
      angularVelocity: new THREE.Vector3(),
      mass: 2.2,
      radius: 0.42,
      height: 0.48,
      isGrounded: true
    });
  }

  // Apply kinetic impulse from gunshots or blast shockwaves
  applyImpulse(hitPoint, impulseDirection, force) {
    const hp = (hitPoint && typeof hitPoint.clone === 'function')
      ? hitPoint
      : new THREE.Vector3(hitPoint?.x || 0, hitPoint?.y || 0, hitPoint?.z || 0);

    const dir = (impulseDirection && typeof impulseDirection.clone === 'function')
      ? impulseDirection.clone().normalize()
      : new THREE.Vector3(impulseDirection?.x || 0, impulseDirection?.y || 0, impulseDirection?.z || -1).normalize();

    for (const prop of this.props) {
      const pos = prop.mesh.position;
      const dist = pos.distanceTo(hp);

      if (dist < prop.radius * 1.5) {
        // Direct hit!
        const pushForce = force / prop.mass;
        prop.velocity.add(dir.clone().multiplyScalar(pushForce));
        prop.velocity.y += Math.min(pushForce * 0.45, 6.5); // Lift into the air!

        // Angular spin impulse
        prop.angularVelocity.x += (Math.random() - 0.5) * pushForce * 3.0;
        prop.angularVelocity.y += (Math.random() - 0.5) * pushForce * 4.0;
        prop.angularVelocity.z += (Math.random() - 0.5) * pushForce * 3.0;

        prop.isGrounded = false;

        if (this.audioManager) {
          this.audioManager.playPropImpact(prop.type === 'table');
        }
        return true;
      }
    }
    return false;
  }

  // Area of effect blast impulse (e.g. shotgun point blank or bio-goliath ground smash)
  applyExplosionImpulse(epicenter, maxRadius, maxForce) {
    const center = (epicenter && typeof epicenter.clone === 'function')
      ? epicenter
      : new THREE.Vector3(epicenter?.x || 0, epicenter?.y || 0, epicenter?.z || 0);

    for (const prop of this.props) {
      const pos = prop.mesh.position;
      const dist = pos.distanceTo(center);

      if (dist < maxRadius) {
        const falloff = 1.0 - dist / maxRadius;
        const dir = pos.clone().sub(center).normalize();
        dir.y += 0.5;
        dir.normalize();

        const force = (maxForce * falloff) / prop.mass;
        prop.velocity.add(dir.multiplyScalar(force));
        prop.angularVelocity.x += (Math.random() - 0.5) * force * 2.5;
        prop.angularVelocity.y += (Math.random() - 0.5) * force * 3.0;
        prop.angularVelocity.z += (Math.random() - 0.5) * force * 2.5;

        prop.isGrounded = false;

        if (this.audioManager && Math.random() < 0.35) {
          this.audioManager.playPropImpact(prop.type === 'table');
        }
      }
    }
  }

  update(delta) {
    const gravity = -19.6;
    const groundFriction = 0.88;
    const airDrag = 0.985;
    const angularDrag = 0.93;

    for (const prop of this.props) {
      if (prop.velocity.lengthSq() < 0.001 && prop.isGrounded && prop.angularVelocity.lengthSq() < 0.001) {
        continue;
      }

      // Apply gravity
      prop.velocity.y += gravity * delta;

      // Integrate position
      prop.mesh.position.addScaledVector(prop.velocity, delta);

      // Integrate rotation
      prop.mesh.rotation.x += prop.angularVelocity.x * delta;
      prop.mesh.rotation.y += prop.angularVelocity.y * delta;
      prop.mesh.rotation.z += prop.angularVelocity.z * delta;

      // Ground collision (Y = 0)
      if (prop.mesh.position.y <= 0) {
        prop.mesh.position.y = 0;
        if (prop.velocity.y < -1.5) {
          // Bounce
          prop.velocity.y = -prop.velocity.y * 0.35;
          prop.velocity.x *= groundFriction;
          prop.velocity.z *= groundFriction;

          if (this.audioManager && prop.velocity.length() > 2.0) {
            this.audioManager.playPuddleSplash(0.3);
          }
        } else {
          prop.velocity.y = 0;
          prop.isGrounded = true;
          prop.velocity.x *= 0.8;
          prop.velocity.z *= 0.8;
        }
      } else {
        prop.isGrounded = false;
        prop.velocity.x *= airDrag;
        prop.velocity.z *= airDrag;
      }

      // Angular dampening
      prop.angularVelocity.multiplyScalar(angularDrag);

      // Arena boundary collision clamp
      prop.mesh.position.x = Math.max(-15.0, Math.min(15.0, prop.mesh.position.x));
      prop.mesh.position.z = Math.max(-23.0, Math.min(23.0, prop.mesh.position.z));
    }
  }

  reset() {
    for (const prop of this.props) {
      if (prop.initialPosition) {
        prop.mesh.position.copy(prop.initialPosition);
      }
      if (prop.initialRotation) {
        prop.mesh.rotation.copy(prop.initialRotation);
      }
      prop.velocity.set(0, 0, 0);
      prop.angularVelocity.set(0, 0, 0);
      prop.isGrounded = true;
    }
  }
}
