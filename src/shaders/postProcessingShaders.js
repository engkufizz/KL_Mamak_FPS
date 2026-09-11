/**
 * Post-Processing Shaders
 * - BrightPassShader: Isolates high-luminance pixels for bloom
 * - BlurShader: Separable 9-tap Gaussian blur pass
 * - CompositeShader: Volumetric bloom, monsoon screen-space running droplets, chromatic aberration, vignette, and damage effects
 */

export const BrightPassShader = {
  uniforms: {
    tDiffuse: { value: null },
    uThreshold: { value: 0.72 },
    uKnee: { value: 0.15 }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uThreshold;
    uniform float uKnee;
    varying vec2 vUv;

    void main() {
      vec4 col = texture2D(tDiffuse, vUv);
      float brightness = dot(col.rgb, vec3(0.2126, 0.7152, 0.0722));
      float soft = brightness - uThreshold + uKnee;
      soft = clamp(soft, 0.0, 2.0 * uKnee);
      soft = (soft * soft) / (4.0 * uKnee + 0.00001);
      float contribution = max(soft, brightness - uThreshold);
      contribution /= max(brightness, 0.00001);
      gl_FragColor = vec4(col.rgb * clamp(contribution, 0.0, 1.0), 1.0);
    }
  `
};

export const BlurShader = {
  uniforms: {
    tDiffuse: { value: null },
    uDirection: { value: [1.0, 0.0] },
    uResolution: { value: [1920.0, 1080.0] }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform vec2 uDirection;
    uniform vec2 uResolution;
    varying vec2 vUv;

    void main() {
      vec2 off = uDirection / uResolution;
      vec4 sum = vec4(0.0);

      // 9-tap Gaussian weights
      sum += texture2D(tDiffuse, vUv - off * 4.0) * 0.051;
      sum += texture2D(tDiffuse, vUv - off * 3.0) * 0.0918;
      sum += texture2D(tDiffuse, vUv - off * 2.0) * 0.12245;
      sum += texture2D(tDiffuse, vUv - off * 1.0) * 0.1531;
      sum += texture2D(tDiffuse, vUv) * 0.1633;
      sum += texture2D(tDiffuse, vUv + off * 1.0) * 0.1531;
      sum += texture2D(tDiffuse, vUv + off * 2.0) * 0.12245;
      sum += texture2D(tDiffuse, vUv + off * 3.0) * 0.0918;
      sum += texture2D(tDiffuse, vUv + off * 4.0) * 0.051;

      gl_FragColor = sum;
    }
  `
};

export const CompositeShader = {
  uniforms: {
    tScene: { value: null },
    tBloom: { value: null },
    uBloomIntensity: { value: 0.8 },
    uTime: { value: 0 },
    uRainDroplets: { value: 1.0 },
    uDamageVignette: { value: 0.0 }, // 0 to 1 when hit
    uLowHealth: { value: 0.0 },      // 0 to 1 heartbeat pulse
    uResolution: { value: [1920.0, 1080.0] }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tScene;
    uniform sampler2D tBloom;
    uniform float uBloomIntensity;
    uniform float uTime;
    uniform float uRainDroplets;
    uniform float uDamageVignette;
    uniform float uLowHealth;
    uniform vec2 uResolution;
    varying vec2 vUv;

    // Hash helpers
    float hash12(vec2 p) {
      vec3 p3  = fract(vec3(p.xyx) * .1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    // Screen-space monsoon water droplets and dripping trails
    vec2 calculateScreenDroplets(vec2 uv, float time) {
      vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
      vec2 st = uv * vec2(18.0, 9.0);

      vec2 normalOffset = vec2(0.0);

      // Droplet grid cells
      vec2 id = floor(st);
      vec2 f = fract(st);

      float h = hash12(id);
      if (h > 0.45) {
        // Falling trail offset
        float speed = 0.6 + h * 0.8;
        float trailY = fract(time * speed + h * 5.0);
        vec2 center = vec2(0.5 + (h - 0.5) * 0.4, 1.0 - trailY);

        vec2 delta = f - center;
        float d = length(delta);
        float radius = 0.12 + h * 0.08;

        if (d < radius) {
          float dropMask = smoothstep(radius, radius * 0.2, d);
          normalOffset += normalize(delta + 0.0001) * dropMask * 0.035;
        }

        // Drip tail streak
        if (delta.y > 0.0 && delta.y < 0.45 && abs(delta.x) < 0.03) {
          float trailMask = (1.0 - delta.y / 0.45) * smoothstep(0.03, 0.0, abs(delta.x));
          normalOffset += vec2(delta.x * 2.0, 0.0) * trailMask * 0.02;
        }
      }

      // Static condensation micro-droplets
      vec2 microSt = uv * vec2(45.0, 25.0);
      vec2 microId = floor(microSt);
      vec2 microF = fract(microSt);
      float mh = hash12(microId);
      if (mh > 0.72) {
        vec2 mCenter = vec2(0.5, 0.5);
        vec2 mDelta = microF - mCenter;
        float md = length(mDelta);
        if (md < 0.25) {
          normalOffset += normalize(mDelta + 0.0001) * smoothstep(0.25, 0.05, md) * 0.015;
        }
      }

      return normalOffset * uRainDroplets;
    }

    void main() {
      // Calculate screen droplet distortion
      vec2 dropletDistort = calculateScreenDroplets(vUv, uTime);
      vec2 uv = vUv + dropletDistort;

      // Chromatic aberration at screen edges (anamorphic lens distortion)
      vec2 toCenter = uv - 0.5;
      float rDist = dot(toCenter, toCenter);
      float caStrength = 0.0035 + rDist * 0.008 + (uDamageVignette * 0.012);

      float r = texture2D(tScene, uv + toCenter * caStrength).r;
      float g = texture2D(tScene, uv).g;
      float b = texture2D(tScene, uv - toCenter * caStrength).b;
      vec3 sceneColor = vec3(r, g, b);

      // Add Volumetric Bloom
      vec3 bloomColor = texture2D(tBloom, uv).rgb * uBloomIntensity;
      vec3 color = sceneColor + bloomColor;

      // Lens vignette (softened for maximum screen clarity)
      float vignette = smoothstep(0.95, 0.55, length(toCenter));
      color *= (vignette * 0.08 + 0.92);

      // Red damage vignette and low health pulse
      if (uDamageVignette > 0.01 || uLowHealth > 0.01) {
        float edgeVignette = smoothstep(0.4, 0.85, length(toCenter));
        float redIntensity = clamp(uDamageVignette + uLowHealth * (sin(uTime * 8.0) * 0.3 + 0.7), 0.0, 1.0);

        vec3 bloodColor = vec3(0.85, 0.05, 0.02);
        color = mix(color, bloodColor * (color + 0.3), edgeVignette * redIntensity * 0.85);

        // Scanline glitch on heavy damage
        if (uDamageVignette > 0.3) {
          float glitch = sin(vUv.y * 300.0 + uTime * 40.0) * 0.08 * uDamageVignette;
          color += vec3(glitch, 0.0, glitch * 0.5);
        }
      }

      // Brightness lift & shadow clarity for crisp, high-visibility gameplay
      vec3 graded = color * 1.25;
      // Gamma lift for shadow and midtone readability so pre-war alley and enemies are clear
      graded = pow(graded, vec3(0.90));
      // Lift shadow floor slightly so dark geometry retains clear form definition
      graded = max(graded, vec3(0.012));
      // Shoulder roll-off: preserves bright neon signs and muzzle flashes without crushing darks
      vec3 mapped = clamp(graded / (vec3(1.0) + graded * 0.20), 0.0, 1.0);

      // Subtle atmospheric grain
      float grain = (hash12(vUv * 500.0 + fract(uTime)) - 0.5) * 0.012;
      mapped += grain;

      gl_FragColor = vec4(mapped, 1.0);
    }
  `
};
