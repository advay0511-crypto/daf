import * as THREE from 'three';

export interface WindUniforms {
  uTime: { value: number };
  uWindStrength: { value: number };
  uGustCenter: { value: THREE.Vector2 };
  uGustStrength: { value: number };
  uReducedMotion: { value: number };
}

export interface WindOptions {
  /** Base sway amplitude in local meters (at height = 1.0 above pivotY) */
  amplitude?: number;
  /** Local Y coordinate below which vertices stay anchored to the soil */
  pivotY?: number;
  /** Frequency multiplier for individual leaves/stalks */
  freq?: number;
  /** Extra gust sensitivity (e.g., high for wheat & pasture grass) */
  gustWeight?: number;
  /** Unique shader cache key suffix */
  cacheKey?: string;
}

/**
 * Shared global wind uniforms reference helper.
 * Each patched material gets its own uniform object stored at `material.userData.windUniforms`,
 * which can be updated every frame in `useFrame` with zero allocations.
 */
export function applyWindShader<T extends THREE.Material>(
  material: T,
  options: WindOptions = {}
): T {
  const amplitude = options.amplitude ?? 0.14;
  const pivotY = options.pivotY ?? 0.0;
  const freq = options.freq ?? 1.85;
  const gustWeight = options.gustWeight ?? 1.0;
  const cacheKey = options.cacheKey ?? `wind-${amplitude}-${pivotY}-${freq}-${gustWeight}`;

  const uniforms: WindUniforms = {
    uTime: { value: 0 },
    uWindStrength: { value: 1.0 },
    uGustCenter: { value: new THREE.Vector2(-12, 0) },
    uGustStrength: { value: 0.0 },
    uReducedMotion: { value: 0.0 },
  };

  material.userData.windUniforms = uniforms;
  material.customProgramCacheKey = () => cacheKey;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWindStrength = uniforms.uWindStrength;
    shader.uniforms.uGustCenter = uniforms.uGustCenter;
    shader.uniforms.uGustStrength = uniforms.uGustStrength;
    shader.uniforms.uReducedMotion = uniforms.uReducedMotion;

    shader.vertexShader =
      `
      uniform float uTime;
      uniform float uWindStrength;
      uniform vec2 uGustCenter;
      uniform float uGustStrength;
      uniform float uReducedMotion;
      ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      {
        float windH = max(0.0, transformed.y - ${pivotY.toFixed(3)});
        float bendFactor = windH * windH * 0.55 + windH * 0.45;
        vec4 wOrigin = vec4(0.0, 0.0, 0.0, 1.0);
        #ifdef USE_INSTANCING
          wOrigin = instanceMatrix * wOrigin;
        #endif
        vec4 wWorld = modelMatrix * wOrigin;
        float phase = wWorld.x * 0.42 + wWorld.z * 0.37 + transformed.x * 0.5;
        float primary = sin(uTime * ${freq.toFixed(2)} + phase);
        float flutter = sin(uTime * ${(freq * 2.4).toFixed(2)} + phase * 1.9 + transformed.z * 1.4) * 0.32;

        // Rolling gust front moving diagonally across the valley
        float gustDist = length(wWorld.xz - uGustCenter);
        float gustWave = exp(-gustDist * gustDist * 0.022) * sin(uTime * 5.2 - phase) * uGustStrength * ${gustWeight.toFixed(2)};

        float motionScale = (1.0 - uReducedMotion * 0.85) * uWindStrength;
        float sway = (primary + flutter) * ${amplitude.toFixed(4)} * motionScale;
        float gustPush = exp(-gustDist * gustDist * 0.022) * uGustStrength * ${gustWeight.toFixed(2)} * ${(amplitude * 1.65).toFixed(4)} * motionScale;

        transformed.x += (sway + gustPush + gustWave * ${(amplitude * 0.55).toFixed(4)} * motionScale) * bendFactor;
        transformed.z += (sway * 0.48 + gustPush * 0.35) * bendFactor;
        transformed.y -= abs(sway + gustPush) * 0.14 * bendFactor;
      }
      `
    );
  };

  material.needsUpdate = true;
  return material;
}

export function updateWindUniforms(
  material: THREE.Material | null | undefined,
  elapsed: number,
  gustCenterX: number,
  gustCenterZ: number,
  gustStrength: number,
  reducedMotion: boolean,
  windStrength = 1.0
) {
  if (!material) return;
  const u = material.userData?.windUniforms as WindUniforms | undefined;
  if (!u) return;
  u.uTime.value = elapsed;
  u.uWindStrength.value = windStrength;
  u.uGustCenter.value.set(gustCenterX, gustCenterZ);
  u.uGustStrength.value = gustStrength;
  u.uReducedMotion.value = reducedMotion ? 1.0 : 0.0;
}
