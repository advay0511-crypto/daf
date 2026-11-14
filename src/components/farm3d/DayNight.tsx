import React from 'react';
import * as THREE from 'three';

export interface LightingState {
  sunDir: THREE.Vector3;
  sunIntensity: number;
  sunColor: string;
  topColor: string;
  horizonColor: string;
  fogColor: string;
  ambientIntensity: number;
  hemiSky: string;
  hemiGround: string;
  nightAmount: number;
  sunsetAmount: number;
}

export function computeLightingFromHour(hour: number): LightingState {
  // Normalize 0..24
  const h = ((hour % 24) + 24) % 24;
  // Sun rises ~6:00, peaks 12:30, sets ~19:00
  const sunAngle = ((h - 6) / 13) * Math.PI;
  const sinEl = Math.sin(sunAngle);
  const cosAz = -Math.cos(sunAngle);

  const elevation = Math.max(-0.4, sinEl);
  const sunDir = new THREE.Vector3(cosAz * 0.85, Math.max(0.08, elevation), -0.55).normalize();

  // Dawn (5..8) or Golden-hour/Sunset (16.5..20)
  const dawnPeak = Math.exp(-Math.pow((h - 6.6) / 1.3, 2));
  const duskPeak = Math.exp(-Math.pow((h - 18.2) / 1.4, 2));
  const sunsetAmount = Math.min(1, Math.max(dawnPeak, duskPeak));

  // Night factor (<5.5 or >19.5)
  let nightAmount = 0;
  if (h < 5.2 || h > 20.0) nightAmount = 1;
  else if (h < 7.0) nightAmount = 1 - (h - 5.2) / 1.8;
  else if (h > 18.4) nightAmount = (h - 18.4) / 1.6;
  nightAmount = Math.max(0, Math.min(1, nightAmount));

  const dayTop = new THREE.Color('#4B94CF');
  const goldenTop = new THREE.Color('#5A7CA8');
  const nightTop = new THREE.Color('#0B1528');
  const topColor = dayTop
    .clone()
    .lerp(goldenTop, sunsetAmount * 0.65)
    .lerp(nightTop, nightAmount);

  const dayHoriz = new THREE.Color('#DDEEF8');
  const goldenHoriz = new THREE.Color('#FBC886');
  const nightHoriz = new THREE.Color('#192A45');
  const horizonColor = dayHoriz
    .clone()
    .lerp(goldenHoriz, sunsetAmount * 0.85)
    .lerp(nightHoriz, nightAmount);

  const daySun = new THREE.Color('#FFF7E0');
  const goldenSun = new THREE.Color('#FFB861');
  const moonCol = new THREE.Color('#9EC5F8');
  const sunColor = daySun
    .clone()
    .lerp(goldenSun, sunsetAmount * 0.9)
    .lerp(moonCol, nightAmount);

  const fogColor = horizonColor.clone().lerp(topColor, 0.22);

  return {
    sunDir,
    sunIntensity: Math.max(0.28, (1 - nightAmount) * (1.85 - sunsetAmount * 0.35)),
    sunColor: `#${sunColor.getHexString()}`,
    topColor: `#${topColor.getHexString()}`,
    horizonColor: `#${horizonColor.getHexString()}`,
    fogColor: `#${fogColor.getHexString()}`,
    ambientIntensity: 0.32 + (1 - nightAmount) * 0.24,
    hemiSky: `#${horizonColor.getHexString()}`,
    hemiGround: nightAmount > 0.5 ? '#1B2B22' : '#5E7C48',
    nightAmount,
    sunsetAmount,
  };
}

interface DayNightProps {
  lighting: LightingState;
  isMobile: boolean;
  isSoftwareGl: boolean;
  lowQuality: boolean;
}

export const DayNight: React.FC<DayNightProps> = ({
  lighting,
  isMobile,
  isSoftwareGl,
  lowQuality,
}) => {
  const shadowSize = isMobile ? 1024 : 2048;
  const castShadows = !isSoftwareGl && !lowQuality;

  return (
    <group>
      <fog attach="fog" args={[lighting.fogColor, 26, 76]} />
      <ambientLight intensity={lighting.ambientIntensity} color={lighting.sunColor} />
      <hemisphereLight
        args={[lighting.hemiSky, lighting.hemiGround, 0.55 * (1 - lighting.nightAmount * 0.45)]}
      />

      {/* Single shadow-casting sun (or soft moonlight at night) */}
      <directionalLight
        position={[
          lighting.sunDir.x * 26,
          Math.max(4, lighting.sunDir.y * 26),
          lighting.sunDir.z * 26,
        ]}
        intensity={lighting.sunIntensity}
        color={lighting.sunColor}
        castShadow={castShadows}
        shadow-mapSize-width={shadowSize}
        shadow-mapSize-height={shadowSize}
        shadow-camera-near={1}
        shadow-camera-far={72}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
      />
    </group>
  );
};
