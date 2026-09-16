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
      antialias: false,
      powerPreference: 'high-performance'
    });

    this.quality = this.detectDefaultQuality();
    const pixelRatio = this.getDprForQuality(this.quality);

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.75;

    document.body.appendChild(this.renderer.domElement);

    this.resizeCallbacks = [];
    window.addEventListener('resize', this.onResize.bind(this));
  }

  detectDefaultQuality() {
    const saved = localStorage.getItem('kl_mamak_perf_profile');
    if (saved) return saved;

    try {
      const gl = this.renderer.getContext();
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const rendererStr = (gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '').toLowerCase();
        if (rendererStr.includes('mali') ||
            rendererStr.includes('panfrost') ||
            rendererStr.includes('llvmpipe') ||
            rendererStr.includes('software') ||
            rendererStr.includes('powervr')) {
          return 'performance';
        }
      }
    } catch (_) {}

    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) {
      return 'performance';
    }

    return 'balanced';
  }

  getDprForQuality(q) {
    if (q === 'performance') return Math.min(window.devicePixelRatio, 1.0);
    if (q === 'high') return Math.min(window.devicePixelRatio, 1.5);
    return Math.min(window.devicePixelRatio, 1.25); // balanced
  }

  setQuality(q) {
    this.quality = q;
    try {
      localStorage.setItem('kl_mamak_perf_profile', q);
    } catch (_) {}
    const pr = this.getDprForQuality(q);
    this.renderer.setPixelRatio(pr);
  }

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    const pixelRatio = this.getDprForQuality(this.quality);
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
