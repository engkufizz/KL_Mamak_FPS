/**
 * Holographic Parallax Red Dot Sight (RDS) Shader
 * Renders an optical holographic sight reticle that exhibits true parallax:
 * The reticle appears projected at optical infinity along the gun's aim vector,
 * staying on-target as the rifle sways or recoils.
 */

export const HolographicReticleShader = {
  uniforms: {
    uTime: { value: 0 },
    uViewOffset: { value: [0.0, 0.0] }, // Gun sway / eye alignment offset
    uReticleColor: { value: [1.0, 0.1, 0.15] }, // Neon red / cyber amber
    uBrightness: { value: 2.2 },
    uZoomFactor: { value: 1.0 },
    uGlassTint: { value: [0.04, 0.09, 0.12, 0.2] } // Anti-glare optical coating
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;
    varying vec3 vViewPosition;
    varying vec3 vNormal;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,

  fragmentShader: /* glsl */ `
    precision highp float;

    uniform float uTime;
    uniform vec2 uViewOffset;
    uniform vec3 uReticleColor;
    uniform float uBrightness;
    uniform float uZoomFactor;
    uniform vec4 uGlassTint;

    varying vec2 vUv;
    varying vec3 vViewPosition;
    varying vec3 vNormal;

    void main() {
      // Centered UV in sight aperture [-1, 1]
      vec2 p = (vUv - 0.5) * 2.0;

      // Parallax projection offset based on viewing angle
      vec3 viewDir = normalize(vViewPosition);
      vec2 parallax = uViewOffset * 0.95 + vec2(dot(viewDir, vec3(1.0, 0.0, 0.0)), dot(viewDir, vec3(0.0, 1.0, 0.0))) * 0.15;

      vec2 reticlePos = (p + parallax) / uZoomFactor;
      float dist = length(reticlePos);

      // Glass aperture circular mask
      float glassMask = smoothstep(0.98, 0.92, length(p));
      if (glassMask <= 0.001) {
        discard;
      }

      // Draw Holographic Elements:
      // 1. Center Red Dot
      float centerDot = 1.0 - smoothstep(0.0, 0.05, dist);

      // 2. Center Chevron / Arrow
      float chevron = 0.0;
      vec2 chPos = reticlePos * 12.0;
      if (chPos.y > -0.8 && chPos.y < 1.2 && abs(chPos.x) < 1.2) {
        float lineDist = abs(chPos.y - abs(chPos.x) * 0.9);
        chevron = smoothstep(0.35, 0.0, lineDist);
      }

      // 3. Outer Stadiametric Circular Ring
      float ring = smoothstep(0.03, 0.0, abs(dist - 0.38));

      // 4. Tick Marks (North, South, East, West)
      float ticks = 0.0;
      if (abs(reticlePos.x) < 0.015 && abs(reticlePos.y) > 0.35 && abs(reticlePos.y) < 0.46) {
        ticks = 1.0;
      }
      if (abs(reticlePos.y) < 0.015 && abs(reticlePos.x) > 0.35 && abs(reticlePos.x) < 0.46) {
        ticks = 1.0;
      }

      // 5. Holographic Scanline & Micro-Flicker
      float scanline = sin(p.y * 120.0 + uTime * 15.0) * 0.05 + 0.95;
      float microFlicker = sin(uTime * 45.0) * 0.03 + 0.97;

      float reticleIntensity = clamp(centerDot * 1.5 + chevron * 1.2 + ring * 0.8 + ticks, 0.0, 1.0);
      reticleIntensity *= scanline * microFlicker;

      // Anti-glare optical glass border glow and tint
      vec3 glassColor = uGlassTint.rgb * uGlassTint.a;
      float borderGlow = pow(length(p), 3.0) * 0.3;
      glassColor += vec3(0.0, 0.3, 0.4) * borderGlow;

      // Glow halo around reticle
      float halo = exp(-dist * 5.0) * 0.25;

      vec3 finalColor = glassColor + (uReticleColor * reticleIntensity * uBrightness) + (uReticleColor * halo);
      float finalAlpha = clamp(uGlassTint.a + reticleIntensity + halo, 0.0, 1.0) * glassMask;

      gl_FragColor = vec4(finalColor, finalAlpha);
    }
  `
};
