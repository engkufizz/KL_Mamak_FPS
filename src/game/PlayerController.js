import * as THREE from 'three';

export class PlayerController {
  constructor(camera, colliders, audioManager) {
    this.camera = camera;
    this.colliders = colliders || [];
    this.audioManager = audioManager;

    // Movement speeds (m/s)
    this.walkSpeed = 5.2;
    this.sprintSpeed = 8.6;
    this.jumpForce = 7.2;
    this.gravity = -20.0;

    // Position & Physics state
    this.position = new THREE.Vector3(0, 1.7, 14); // Start near entrance looking toward mamak stall
    this.velocity = new THREE.Vector3();
    this.isGrounded = true;
    this.radius = 0.45;
    this.eyeHeight = 1.7;

    // Stamina system
    this.maxStamina = 100;
    this.stamina = 100;
    this.isSprinting = false;

    // Rotation angles (Euler YXZ)
    this.yaw = 0; // Face north toward mamak stall (-Z)
    this.pitch = 0;

    // Footstep audio timing
    this.stepTimer = 0;

    // Bounding Box
    this.playerBox = new THREE.Box3();
    this.updateBoundingBox();
  }

  updateBoundingBox() {
    this.playerBox.min.set(this.position.x - this.radius, this.position.y - this.eyeHeight, this.position.z - this.radius);
    this.playerBox.max.set(this.position.x + this.radius, this.position.y + 0.2, this.position.z + this.radius);
  }

  update(delta, inputManager, weaponManager, mobileVector = null, mobileSprint = false) {
    const mouse = inputManager.update();

    // 1. Mouse Look (Yaw & Pitch)
    this.yaw -= mouse.deltaX;
    this.pitch -= mouse.deltaY;
    this.pitch = Math.max(-Math.PI / 2.05, Math.min(Math.PI / 2.05, this.pitch));

    // Integrate recoil pitch kick from weapon manager
    const camRecoil = weaponManager ? weaponManager.getCameraRecoilPitch() : 0;
    const finalPitch = Math.max(-Math.PI / 2.05, Math.min(Math.PI / 2.05, this.pitch + camRecoil));

    // Apply rotation to camera
    this.camera.rotation.set(0, 0, 0);
    this.camera.quaternion.setFromEuler(new THREE.Euler(finalPitch, this.yaw, 0, 'YXZ'));

    // 2. Movement Direction relative to camera yaw
    const keyMove = inputManager.getMovementVector();
    let moveForward = keyMove.forward;
    let moveRight = keyMove.right;

    if (mobileVector && (Math.abs(mobileVector.forward) > 0.05 || Math.abs(mobileVector.right) > 0.05)) {
      moveForward = mobileVector.forward;
      moveRight = mobileVector.right;
    }

    const isMoving = Math.abs(moveForward) > 0.05 || Math.abs(moveRight) > 0.05;

    // Sprint & Stamina
    const wantsSprint = (inputManager.isSprinting() || mobileSprint) && moveForward > 0.1 && this.stamina > 10;
    if (wantsSprint) {
      this.isSprinting = true;
      this.stamina = Math.max(0, this.stamina - 28.0 * delta);
    } else {
      this.isSprinting = false;
      this.stamina = Math.min(this.maxStamina, this.stamina + 35.0 * delta);
    }

    const currentSpeed = this.isSprinting ? this.sprintSpeed : this.walkSpeed;

    // Forward & Right vectors along horizontal plane
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();

    const targetVelocity = new THREE.Vector3();
    targetVelocity.addScaledVector(forward, moveForward);
    targetVelocity.addScaledVector(right, moveRight);
    if (targetVelocity.lengthSq() > 0.001) {
      targetVelocity.normalize().multiplyScalar(currentSpeed);
    }

    // Horizontal acceleration & ground friction
    const accel = this.isGrounded ? 18.0 : 4.0;
    this.velocity.x += (targetVelocity.x - this.velocity.x) * Math.min(1.0, accel * delta);
    this.velocity.z += (targetVelocity.z - this.velocity.z) * Math.min(1.0, accel * delta);

    // 3. Jump & Vertical Gravity
    if (this.isGrounded && inputManager.isJumpJustPressed()) {
      this.velocity.y = this.jumpForce;
      this.isGrounded = false;
      if (this.audioManager) {
        this.audioManager.playFootstep(true);
      }
    }

    this.velocity.y += this.gravity * delta;

    // 4. Resolve Horizontal Movement with Collision Resolution
    const moveStepX = this.velocity.x * delta;
    this.position.x += moveStepX;
    this.updateBoundingBox();
    for (const collider of this.colliders) {
      if (this.playerBox.intersectsBox(collider)) {
        this.position.x -= moveStepX;
        this.velocity.x = 0;
        this.updateBoundingBox();
        break;
      }
    }

    const moveStepZ = this.velocity.z * delta;
    this.position.z += moveStepZ;
    this.updateBoundingBox();
    for (const collider of this.colliders) {
      if (this.playerBox.intersectsBox(collider)) {
        this.position.z -= moveStepZ;
        this.velocity.z = 0;
        this.updateBoundingBox();
        break;
      }
    }

    // Arena boundary limits
    this.position.x = Math.max(-15.2, Math.min(15.2, this.position.x));
    this.position.z = Math.max(-23.2, Math.min(23.2, this.position.z));

    // 5. Vertical Integration & Ground Check
    this.position.y += this.velocity.y * delta;
    if (this.position.y <= this.eyeHeight) {
      this.position.y = this.eyeHeight;
      this.velocity.y = 0;
      this.isGrounded = true;
    }
    this.updateBoundingBox();

    // 6. Camera Position
    this.camera.position.copy(this.position);

    // 7. Footstep Audio Timing
    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (this.isGrounded && horizSpeed > 1.2) {
      const stepInterval = this.isSprinting ? 0.32 : 0.48;
      this.stepTimer += delta;
      if (this.stepTimer >= stepInterval) {
        this.stepTimer = 0;
        if (this.audioManager) {
          this.audioManager.playFootstep(true);
        }
      }
    } else {
      this.stepTimer = 0.2;
    }

    return {
      isMoving: horizSpeed > 0.8,
      isSprinting: this.isSprinting,
      mouseInput: mouse
    };
  }
}
