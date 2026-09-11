import * as THREE from 'three';

export class Engine {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x182436);
    this.scene.fog = new THREE.Fog(0x152233, 35, 140);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 300);
    this.camera.position.set(0, 1.7, 14);
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const pixelRatio = isTouch ? Math.min(window.devicePixelRatio, 1.6) : Math.min(window.devicePixelRatio, 2.0);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.75;

    document.body.appendChild(this.renderer.domElement);

    this.resizeCallbacks = [];
    window.addEventListener('resize', this.onResize.bind(this));
  }

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const pixelRatio = isTouch ? Math.min(window.devicePixelRatio, 1.6) : Math.min(window.devicePixelRatio, 2.0);
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(pixelRatio);

    for (const cb of this.resizeCallbacks) {
      cb(width, height);
    }
  }

  onWindowResize(cb) {
    this.resizeCallbacks.push(cb);
  }
}
