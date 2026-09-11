/**
 * Custom Floor Puddle WebGL Shader
 * Features:
 * - Real-time planar reflections sampled from reflection render target
 * - Dynamic procedural rain impact rings expanding across puddles
 * - Micro-ripple normal distortion from wind and raindrops
 * - Wet asphalt roughness variation, dark water absorption, and Fresnel specular falloff
 */

export const PuddleShader = {
  uniforms: {
    tReflection: { value: null },
    tBaseAsphalt: { value: null },
    tPuddleMask: { value: null },
    uTime: { value: 0 },
    uRainIntensity: { value: 1.0 },
    uRoughness: { value: 0.15 },
    uReflectionIntensity: { value: 1.0 },
    uPuddleColor: { value: [0.08, 0.11, 0.15] },
    uLightDirection: { value: [0.3, 1.0, -0.4] },
    uNeonTint: { value: [0.26, 0.30, 0.36] }
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;
    varying vec4 vReflectCoord;
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec3 vViewDir;

    uniform mat4 textureMatrix;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      vViewDir = normalize(cameraPosition - worldPos.xyz);

      // Transform world position into reflection camera screen coords
      vReflectCoord = textureMatrix * worldPos;

      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,

  fragmentShader: /* glsl */ `
    precision highp float;

    uniform sampler2D tReflection;
    uniform sampler2D tBaseAsphalt;
    uniform sampler2D tPuddleMask;
    uniform float uTime;
    uniform float uRainIntensity;
    uniform float uRoughness;
    uniform float uReflectionIntensity;
    uniform vec3 uPuddleColor;
    uniform vec3 uNeonTint;

    varying vec2 vUv;
    varying vec4 vReflectCoord;
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec3 vViewDir;

    // Procedural hash for pseudo-random ring centers
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    vec2 hash2(vec2 p) {
      return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
    }

    // Dynamic rain drop ripple ring normal generator
    vec3 calculateRainRipples(vec2 uv, float time) {
      vec2 p = uv * 35.0;
      vec3 normalAccum = vec3(0.0, 0.0, 1.0);

      // Multi-cell jittered raindrop grid
      vec2 i_p = floor(p);
      vec2 f_p = fract(p);

      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec2 neighbor = vec2(float(x), float(y));
          vec2 cell = i_p + neighbor;
          vec2 center = neighbor + hash2(cell);
          float birthOffset = hash(cell + vec2(1.5, 3.7)) * 2.0;

          // Local time for drop
          float dropAge = fract((time * 1.8 + birthOffset) * 0.7);
          float radius = dropAge * 0.85;

          vec2 diff = f_p - center;
          float dist = length(diff);

          // Wave profile: damped cosine ring
          float wave = sin(dist * 35.0 - dropAge * 22.0);
          float ringDist = abs(dist - radius);
          float ringMask = exp(-ringDist * 16.0) * (1.0 - dropAge);

          if (dist < 0.9 && dropAge > 0.05) {
            vec2 dir = normalize(diff + 0.0001);
            float slope = wave * ringMask * 0.12 * uRainIntensity;
            normalAccum.xy += dir * slope;
          }
        }
      }

      // Secondary micro-ripples for subtle wind flow
      float wind1 = sin(uv.x * 60.0 + uv.y * 30.0 + time * 4.0) * 0.02;
      float wind2 = cos(uv.x * 40.0 - uv.y * 50.0 + time * 3.5) * 0.02;
      normalAccum.xy += vec2(wind1, wind2) * uRainIntensity;

      return normalize(normalAccum);
    }

    void main() {
      // Sample procedural puddle mask and base asphalt
      vec4 asphaltTex = texture2D(tBaseAsphalt, vUv * 16.0);
      vec4 puddleMaskTex = texture2D(tPuddleMask, vUv * 4.0);

      // Puddle factor: 0 = damp asphalt, 1 = deep standing water puddle
      float puddleFactor = clamp((puddleMaskTex.r - 0.28) / 0.45, 0.0, 1.0);

      // Calculate raindrop ripple normals
      vec3 rippleNormalLocal = calculateRainRipples(vUv, uTime);

      // Distort reflection texture coordinates based on puddle ripples
      vec2 reflectUV = vReflectCoord.xy / vReflectCoord.w;
      vec2 distortion = rippleNormalLocal.xy * (0.015 + 0.035 * puddleFactor);
      vec4 reflectionColor = texture2D(tReflection, reflectUV + distortion);

      // Wet surface darkens base asphalt (water saturation effect)
      vec3 wetAsphaltColor = asphaltTex.rgb * 0.78;

      // Fresnel reflection equation for water (Schlick's approximation)
      float cosTheta = clamp(dot(vViewDir, vec3(0.0, 1.0, 0.0) + vec3(rippleNormalLocal.x, 0.0, rippleNormalLocal.y) * 0.2), 0.0, 1.0);
      float fresnel = 0.04 + (1.0 - 0.04) * pow(1.0 - cosTheta, 5.0);

      // Combine wet ground with mirror reflection
      vec3 waterSurface = mix(uPuddleColor, reflectionColor.rgb * 1.45 + uNeonTint, clamp(fresnel * uReflectionIntensity + 0.22, 0.0, 1.0));

      // Rain splash ring highlight
      float splashHighlight = length(distortion) * 4.0 * puddleFactor;
      waterSurface += vec3(0.18, 0.24, 0.30) * splashHighlight;

      // Blend between wet asphalt and reflective puddles
      vec3 finalColor = mix(wetAsphaltColor, waterSurface, puddleFactor * 0.90);

      // Add wet specular sheen on dry areas
      finalColor += reflectionColor.rgb * 0.20 * (1.0 - puddleFactor);

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
};
