import * as THREE from 'three';

export interface SkyUniforms {
  [uniform: string]: THREE.IUniform<unknown>;
  uTime: { value: number };
  uSunDir: { value: THREE.Vector3 };
  uTopColor: { value: THREE.Color };
  uHorizonColor: { value: THREE.Color };
  uSunColor: { value: THREE.Color };
  uNightAmount: { value: number };
  uSunsetAmount: { value: number };
}

export function createSkyMaterial(): THREE.ShaderMaterial {
  const uniforms: SkyUniforms = {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.55, 0.32, -0.75).normalize() },
    uTopColor: { value: new THREE.Color('#5A9FD4') },
    uHorizonColor: { value: new THREE.Color('#FCE0AE') },
    uSunColor: { value: new THREE.Color('#FFF4CC') },
    uNightAmount: { value: 0 },
    uSunsetAmount: { value: 0.7 },
  };

  return new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vWorldDir;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(worldPos.xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uTopColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSunColor;
      uniform float uNightAmount;
      uniform float uSunsetAmount;

      varying vec3 vWorldDir;

      float hash31(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }

      void main() {
        vec3 dir = normalize(vWorldDir);
        float h = clamp(dir.y, 0.0, 1.0);

        // Smooth sky vertical gradient
        float grad = pow(h, 0.55);
        vec3 sky = mix(uHorizonColor, uTopColor, grad);

        // Warm golden horizon band at dawn/golden-hour/sunset
        float horizonGlow = pow(1.0 - h, 4.5) * (0.35 + uSunsetAmount * 0.55) * (1.0 - uNightAmount * 0.85);
        sky += vec3(1.0, 0.64, 0.28) * horizonGlow * 0.45;

        // Sun disc + atmospheric corona
        float sunCos = max(dot(dir, normalize(uSunDir)), 0.0);
        float sunCorona = pow(sunCos, 10.0) * 0.38 * (1.0 - uNightAmount * 0.92);
        float sunHalo = pow(sunCos, 96.0) * 0.75 * (1.0 - uNightAmount * 0.95);
        float sunDisc = smoothstep(0.9978, 0.9992, sunCos) * (1.0 - uNightAmount);
        sky += uSunColor * (sunCorona + sunHalo + sunDisc * 1.4);

        // Moon opposite sun at night
        vec3 moonDir = normalize(vec3(-uSunDir.x, max(0.28, -uSunDir.y * 0.8 + 0.35), -uSunDir.z));
        float moonCos = max(dot(dir, moonDir), 0.0);
        float moonDisc = smoothstep(0.9985, 0.9994, moonCos) * uNightAmount;
        float moonHalo = pow(moonCos, 32.0) * 0.18 * uNightAmount;
        sky += vec3(0.78, 0.88, 1.0) * (moonDisc * 0.95 + moonHalo);

        // Subtle procedural twinkling stars at night
        if (uNightAmount > 0.05 && dir.y > 0.04) {
          vec3 starCell = floor(dir * 260.0);
          float r = hash31(starCell);
          if (r > 0.992) {
            float twinkle = 0.6 + 0.4 * sin(uTime * 2.3 + r * 90.0);
            float starVis = smoothstep(0.04, 0.25, dir.y) * uNightAmount * twinkle;
            sky += vec3(0.92, 0.96, 1.0) * starVis * 0.95;
          }
        }

        // Soft warm below-horizon ground bounce so low angles look natural
        if (dir.y < 0.0) {
          sky = mix(uHorizonColor * 0.75, uTopColor * 0.4, clamp(-dir.y * 3.0, 0.0, 1.0));
        }

        gl_FragColor = vec4(sky, 1.0);
      }
    `,
  });
}
