import * as THREE from 'three';
import { PuddleShader } from '../shaders/puddleShader.js';

export class PuddleReflection {
  constructor(renderer, scene, groundMesh) {
    this.renderer = renderer;
    this.scene = scene;
    this.groundMesh = groundMesh;

    // Optimized reflection render target (512x512 is 75% lighter than 1024 with identical visual fidelity under ripple distortion)
    this.renderTarget = new THREE.WebGLRenderTarget(512, 512, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat
    });

    // Frame throttling and mesh exclusion
    this.updateInterval = 2; // Default 30 Hz updates (every 2nd frame)
    this.frameCount = 0;
    this.excludedMeshes = [];

    // Virtual reflection camera
    this.reflectionCamera = new THREE.PerspectiveCamera();

    // Reflection transformation matrix
    this.textureMatrix = new THREE.Matrix4();

    // Procedural textures
    this.baseAsphaltTexture = this.generateAsphaltTexture();
    this.puddleMaskTexture = this.generatePuddleMaskTexture();

    // Ground puddle material
    this.material = new THREE.ShaderMaterial({
      vertexShader: PuddleShader.vertexShader,
      fragmentShader: PuddleShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(PuddleShader.uniforms)
    });

    this.material.uniforms.tReflection.value = this.renderTarget.texture;
    this.material.uniforms.tBaseAsphalt.value = this.baseAsphaltTexture;
    this.material.uniforms.tPuddleMask.value = this.puddleMaskTexture;
    this.material.uniforms.textureMatrix = { value: this.textureMatrix };

    this.groundMesh.material = this.material;

    this.reflectorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.normal = new THREE.Vector3(0, 1, 0);
    this.reflectorWorldPosition = new THREE.Vector3();
    this.cameraWorldPosition = new THREE.Vector3();
    this.rotationMatrix = new THREE.Matrix4();
    this.lookAtPosition = new THREE.Vector3(0, 0, -1);
    this.clipPlane = new THREE.Vector4();
    this.q = new THREE.Vector4();
  }

  generateAsphaltTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Refined charcoal/slate base with visible road aggregate
    ctx.fillStyle = '#2e353f';
    ctx.fillRect(0, 0, 512, 512);

    // Fine gravel / aggregate specks
    const imgData = ctx.getImageData(0, 0, 512, 512);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 55;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise * 1.15));
    }
    ctx.putImageData(imgData, 0, 0);

    // Weathered asphalt patches and cracks
    ctx.strokeStyle = '#1d2229';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 15; i++) {
      ctx.beginPath();
      let x = Math.random() * 512;
      let y = Math.random() * 512;
      ctx.moveTo(x, y);
      for (let j = 0; j < 6; j++) {
        x += (Math.random() - 0.5) * 40;
        y += (Math.random() - 0.5) * 40;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  generatePuddleMaskTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Dry background
    ctx.fillStyle = '#101010';
    ctx.fillRect(0, 0, 512, 512);

    // Multiple organic puddle pooling spots across alley square
    const puddleSpots = [
      { x: 140, y: 150, r: 85 },
      { x: 340, y: 180, r: 110 },
      { x: 260, y: 360, r: 130 },
      { x: 100, y: 410, r: 75 },
      { x: 420, y: 390, r: 90 },
      { x: 256, y: 256, r: 95 }
    ];

    puddleSpots.forEach(spot => {
      const grad = ctx.createRadialGradient(spot.x, spot.y, spot.r * 0.2, spot.x, spot.y, spot.r);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.65, '#a0a0a0');
      grad.addColorStop(1, '#000000');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, spot.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // Add noise disturbance for organic puddle boundaries
    const imgData = ctx.getImageData(0, 0, 512, 512);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const perturb = (Math.random() - 0.5) * 35;
      d[i] = Math.min(255, Math.max(0, d[i] + perturb));
      d[i + 1] = d[i];
      d[i + 2] = d[i];
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  setQuality(quality) {
    if (quality === 'performance') {
      this.updateInterval = 3; // 20 Hz update
      this.renderTarget.setSize(256, 256); // 93% less fillrate
    } else if (quality === 'high') {
      this.updateInterval = 1; // 60 Hz update
      this.renderTarget.setSize(512, 512);
    } else {
      this.updateInterval = 2; // Balanced: 30 Hz update
      this.renderTarget.setSize(512, 512);
    }
  }

  setExcludedMeshes(meshes) {
    this.excludedMeshes = meshes.filter(Boolean);
  }

  update(camera, time) {
    if (!this.groundMesh) return;

    this.material.uniforms.uTime.value = time;

    // Frame throttling: skip expensive scene re-render on throttled frames
    this.frameCount++;
    if (this.updateInterval > 1 && (this.frameCount % this.updateInterval !== 0)) {
      return;
    }

    // Planar reflection camera calculation
    this.reflectorWorldPosition.setFromMatrixPosition(this.groundMesh.matrixWorld);
    this.cameraWorldPosition.setFromMatrixPosition(camera.matrixWorld);

    this.rotationMatrix.extractRotation(this.groundMesh.matrixWorld);
    this.normal.set(0, 1, 0).applyMatrix4(this.rotationMatrix);

    const view = this.reflectorWorldPosition.clone().sub(this.cameraWorldPosition);
    if (view.dot(this.normal) > 0) return; // Behind reflector

    view.reflect(this.normal).negate();
    view.add(this.reflectorWorldPosition);

    this.rotationMatrix.extractRotation(camera.matrixWorld);
    this.lookAtPosition.set(0, 0, -1).applyMatrix4(this.rotationMatrix);
    this.lookAtPosition.add(this.cameraWorldPosition);

    const target = this.reflectorWorldPosition.clone().sub(this.lookAtPosition);
    target.reflect(this.normal).negate();
    target.add(this.reflectorWorldPosition);

    this.reflectionCamera.position.copy(view);
    this.reflectionCamera.up.set(0, 1, 0).applyMatrix4(this.rotationMatrix).reflect(this.normal);
    this.reflectionCamera.lookAt(target);
    this.reflectionCamera.fov = camera.fov;
    this.reflectionCamera.aspect = camera.aspect;
    this.reflectionCamera.near = camera.near;
    this.reflectionCamera.far = camera.far;
    this.reflectionCamera.updateMatrixWorld();
    this.reflectionCamera.updateProjectionMatrix();

    // Oblique near-plane clipping
    this.reflectorPlane.setFromNormalAndCoplanarPoint(this.normal, this.reflectorWorldPosition);
    this.reflectorPlane.applyMatrix4(this.reflectionCamera.matrixWorldInverse);

    this.clipPlane.set(
      this.reflectorPlane.normal.x,
      this.reflectorPlane.normal.y,
      this.reflectorPlane.normal.z,
      this.reflectorPlane.constant
    );

    const projectionMatrix = this.reflectionCamera.projectionMatrix;
    this.q.x = (Math.sign(this.clipPlane.x) + projectionMatrix.elements[8]) / projectionMatrix.elements[0];
    this.q.y = (Math.sign(this.clipPlane.y) + projectionMatrix.elements[9]) / projectionMatrix.elements[5];
    this.q.z = -1.0;
    this.q.w = (1.0 + projectionMatrix.elements[10]) / projectionMatrix.elements[14];

    const c = this.clipPlane.multiplyScalar(2.0 / this.clipPlane.dot(this.q));
    projectionMatrix.elements[2] = c.x;
    projectionMatrix.elements[6] = c.y;
    projectionMatrix.elements[10] = c.z + 1.0;
    projectionMatrix.elements[14] = c.w;

    // Texture projection matrix [0, 1] bias
    this.textureMatrix.set(
      0.5, 0.0, 0.0, 0.5,
      0.0, 0.5, 0.0, 0.5,
      0.0, 0.0, 0.5, 0.5,
      0.0, 0.0, 0.0, 1.0
    );
    this.textureMatrix.multiply(this.reflectionCamera.projectionMatrix);
    this.textureMatrix.multiply(this.reflectionCamera.matrixWorldInverse);

    // Hide ground mesh & particle systems during reflection pass to avoid self-reflection & redundant work
    this.groundMesh.visible = false;
    for (let i = 0; i < this.excludedMeshes.length; i++) {
      this.excludedMeshes[i].visible = false;
    }

    const currentRenderTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.reflectionCamera);
    this.renderer.setRenderTarget(currentRenderTarget);

    this.groundMesh.visible = true;
    for (let i = 0; i < this.excludedMeshes.length; i++) {
      this.excludedMeshes[i].visible = true;
    }
  }
}
