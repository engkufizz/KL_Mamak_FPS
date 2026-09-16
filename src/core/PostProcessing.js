import * as THREE from 'three';
import { BrightPassShader, BlurShader, CompositeShader } from '../shaders/postProcessingShaders.js';

export class PostProcessing {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Render targets with UnsignedByteType for maximum bandwidth efficiency on mobile/SBC GPUs
    const rtParams = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType
    };

    this.enabled = true;
    this.sceneTarget = new THREE.WebGLRenderTarget(width, height, rtParams);
    this.brightTarget = new THREE.WebGLRenderTarget(Math.floor(width / 2), Math.floor(height / 2), rtParams);
    this.blurTargetH = new THREE.WebGLRenderTarget(Math.floor(width / 4), Math.floor(height / 4), rtParams);
    this.blurTargetV = new THREE.WebGLRenderTarget(Math.floor(width / 4), Math.floor(height / 4), rtParams);

    // Orthographic post-processing camera & screen quad
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postQuadGeom = new THREE.PlaneGeometry(2, 2);

    // Bright pass
    this.brightMaterial = new THREE.ShaderMaterial({
      vertexShader: BrightPassShader.vertexShader,
      fragmentShader: BrightPassShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(BrightPassShader.uniforms),
      depthTest: false,
      depthWrite: false
    });
    this.brightQuad = new THREE.Mesh(this.postQuadGeom, this.brightMaterial);

    // Blur H & V
    this.blurHMaterial = new THREE.ShaderMaterial({
      vertexShader: BlurShader.vertexShader,
      fragmentShader: BlurShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(BlurShader.uniforms),
      depthTest: false,
      depthWrite: false
    });
    this.blurHMaterial.uniforms.uDirection.value = [1.0, 0.0];

    this.blurVMaterial = new THREE.ShaderMaterial({
      vertexShader: BlurShader.vertexShader,
      fragmentShader: BlurShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(BlurShader.uniforms),
      depthTest: false,
      depthWrite: false
    });
    this.blurVMaterial.uniforms.uDirection.value = [0.0, 1.0];

    this.blurQuad = new THREE.Mesh(this.postQuadGeom, this.blurHMaterial);

    // Composite pass
    this.compositeMaterial = new THREE.ShaderMaterial({
      vertexShader: CompositeShader.vertexShader,
      fragmentShader: CompositeShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(CompositeShader.uniforms),
      depthTest: false,
      depthWrite: false
    });
    this.compositeQuad = new THREE.Mesh(this.postQuadGeom, this.compositeMaterial);

    this.postScene = new THREE.Scene();
    this.updateDimensions(width, height);
  }

  setQuality(quality) {
    // In performance mode, completely bypass post-processing for 60 FPS on Orange Pi / low-spec devices
    this.enabled = (quality !== 'performance');
  }

  updateDimensions(width, height) {
    if (!this.enabled) return;
    this.sceneTarget.setSize(width, height);
    this.brightTarget.setSize(Math.floor(width / 2), Math.floor(height / 2));
    this.blurTargetH.setSize(Math.floor(width / 4), Math.floor(height / 4));
    this.blurTargetV.setSize(Math.floor(width / 4), Math.floor(height / 4));

    const halfW = Math.floor(width / 4);
    const halfH = Math.floor(height / 4);
    this.blurHMaterial.uniforms.uResolution.value = [halfW, halfH];
    this.blurVMaterial.uniforms.uResolution.value = [halfW, halfH];

    this.compositeMaterial.uniforms.uResolution.value = [width, height];
  }

  render(time, damageVignette = 0.0, lowHealth = 0.0) {
    if (!this.enabled) {
      // Direct forward render: 0 extra render passes, 0 blurs, 0 offscreen framebuffers!
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, this.camera);
      return;
    }
    // 1. Render primary scene into sceneTarget
    this.renderer.setRenderTarget(this.sceneTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    // 2. Bright pass: extract emissive pixels to brightTarget
    this.postScene.children = [];
    this.brightMaterial.uniforms.tDiffuse.value = this.sceneTarget.texture;
    this.postScene.add(this.brightQuad);

    this.renderer.setRenderTarget(this.brightTarget);
    this.renderer.clear();
    this.renderer.render(this.postScene, this.postCamera);

    // 3. Horizontal Blur
    this.postScene.children = [];
    this.blurHMaterial.uniforms.tDiffuse.value = this.brightTarget.texture;
    this.blurQuad.material = this.blurHMaterial;
    this.postScene.add(this.blurQuad);

    this.renderer.setRenderTarget(this.blurTargetH);
    this.renderer.clear();
    this.renderer.render(this.postScene, this.postCamera);

    // 4. Vertical Blur
    this.postScene.children = [];
    this.blurVMaterial.uniforms.tDiffuse.value = this.blurTargetH.texture;
    this.blurQuad.material = this.blurVMaterial;
    this.postScene.add(this.blurQuad);

    this.renderer.setRenderTarget(this.blurTargetV);
    this.renderer.clear();
    this.renderer.render(this.postScene, this.postCamera);

    // 5. Final Composite to Screen
    this.postScene.children = [];
    this.compositeMaterial.uniforms.tScene.value = this.sceneTarget.texture;
    this.compositeMaterial.uniforms.tBloom.value = this.blurTargetV.texture;
    this.compositeMaterial.uniforms.uTime.value = time;
    this.compositeMaterial.uniforms.uDamageVignette.value = damageVignette;
    this.compositeMaterial.uniforms.uLowHealth.value = lowHealth;
    this.postScene.add(this.compositeQuad);

    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCamera);
  }
}
