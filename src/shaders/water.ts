import * as THREE from 'three';

export interface WaterUniforms {
  [uniform: string]: THREE.IUniform<unknown>;
  uTime: { value: number };
  uSunDir: { value: THREE.Vector3 };
  uSunColor: { value: THREE.Color };
  uSkyColor: { value: THREE.Color };
  uDeepColor: { value: THREE.Color };
  uShallowColor: { value: THREE.Color };
  uRainIntensity: { value: number };
  uIsPaddy: { value: number };
}

export function createWaterMaterial(isPaddy = false): THREE.ShaderMaterial {
  const uniforms: WaterUniforms = {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.55, 0.35, -0.75).normalize() },
    uSunColor: { value: new THREE.Color('#FFE6AE') },
    uSkyColor: { value: new THREE.Color('#8ECAE6') },
    uDeepColor: { value: new THREE.Color(isPaddy ? '#2B6E5C' : '#1D6B82') },
    uShallowColor: { value: new THREE.Color(isPaddy ? '#569D7E' : '#4EAEC7') },
    uRainIntensity: { value: 0 },
    uIsPaddy: { value: isPaddy ? 1 : 0 },
  };

  return new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uIsPaddy;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying float vWave;

      void main() {
        vUv = uv;
        vec3 pos = position;
        float amp = uIsPaddy > 0.5 ? 0.012 : 0.025;
        float w = sin(pos.x * 3.1 + uTime * 1.9) * cos(pos.y * 2.7 + uTime * 1.5) * amp;
        pos.z += w;
        vWave = w;
        vec4 world = modelMatrix * vec4(pos, 1.0);
        vWorldPos = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uSkyColor;
      uniform vec3 uDeepColor;
      uniform vec3 uShallowColor;
      uniform float uRainIntensity;
      uniform float uIsPaddy;

      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying float vWave;

      void main() {
        vec2 centered = (vUv - 0.5) * 2.0;
        float radial = length(centered);

        // Animated surface normal ripples
        float r1 = sin(vWorldPos.x * 5.2 + uTime * 2.2) * cos(vWorldPos.z * 4.8 - uTime * 1.7);
        float r2 = sin((vWorldPos.x + vWorldPos.z) * 8.5 - uTime * 3.1);

        // Extra raindrop ripple rings when live weather has rain
        float rainRing = 0.0;
        if (uRainIntensity > 0.05) {
          float dA = length(fract(vWorldPos.xz * 0.65) - 0.5);
          float dB = length(fract(vWorldPos.xz * 0.9 + 0.37) - 0.5);
          rainRing += sin(dA * 32.0 - uTime * 10.0) * smoothstep(0.45, 0.05, dA);
          rainRing += sin(dB * 28.0 - uTime * 9.0 + 1.8) * smoothstep(0.45, 0.05, dB);
          rainRing *= 0.24 * uRainIntensity;
        }

        vec3 n = normalize(vec3(
          (r1 * 0.09 + r2 * 0.05 + rainRing),
          1.0,
          (r1 * 0.08 - r2 * 0.05 + rainRing)
        ));

        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - max(dot(viewDir, n), 0.0), 3.0);

        vec3 baseWater = mix(uDeepColor, uShallowColor, clamp(radial * 0.85, 0.0, 1.0));
        vec3 col = mix(baseWater, uSkyColor, clamp(fresnel * 0.72 + 0.14, 0.0, 0.85));

        // Sun specular sparkle on ripples
        vec3 halfVec = normalize(normalize(uSunDir) + viewDir);
        float spec = pow(max(dot(n, halfVec), 0.0), 72.0);
        col += uSunColor * spec * 0.95;

        // Subtle shoreline foam shimmer
        if (uIsPaddy < 0.5) {
          float shore = smoothstep(0.78, 0.98, radial + r1 * 0.04);
          col = mix(col, vec3(0.86, 0.95, 0.96), shore * 0.35);
        }

        float alpha = uIsPaddy > 0.5 ? 0.78 : mix(0.92, 0.68, smoothstep(0.82, 1.02, radial));
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}
