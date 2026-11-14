import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createSkyMaterial } from '../../shaders/sky';

interface SkyProps {
  sunDir: THREE.Vector3;
  topColor: string;
  horizonColor: string;
  sunColor: string;
  nightAmount: number;
  sunsetAmount: number;
  reducedMotion: boolean;
}

const CLOUD_PUFFS = [
  { x: -16, y: 15, z: -22, scale: 1.4, speed: 0.38 },
  { x: -3, y: 17, z: -25, scale: 1.7, speed: 0.28 },
  { x: 11, y: 14.5, z: -20, scale: 1.25, speed: 0.34 },
  { x: 22, y: 16.5, z: -14, scale: 1.35, speed: 0.31 },
  { x: -22, y: 15.5, z: -6, scale: 1.2, speed: 0.26 },
  { x: 4, y: 18, z: -12, scale: 1.45, speed: 0.32 },
];

export const Sky: React.FC<SkyProps> = ({
  sunDir,
  topColor,
  horizonColor,
  sunColor,
  nightAmount,
  sunsetAmount,
  reducedMotion,
}) => {
  const skyMaterial = useMemo(() => createSkyMaterial(), []);
  const cloudsGroupRef = useRef<THREE.Group | null>(null);
  const mistGroupRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    return () => {
      skyMaterial.dispose();
    };
  }, [skyMaterial]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    skyMaterial.uniforms.uTime.value = t;
    (skyMaterial.uniforms.uSunDir.value as THREE.Vector3).copy(sunDir).normalize();
    (skyMaterial.uniforms.uTopColor.value as THREE.Color).set(topColor);
    (skyMaterial.uniforms.uHorizonColor.value as THREE.Color).set(horizonColor);
    (skyMaterial.uniforms.uSunColor.value as THREE.Color).set(sunColor);
    skyMaterial.uniforms.uNightAmount.value = nightAmount;
    skyMaterial.uniforms.uSunsetAmount.value = sunsetAmount;

    if (cloudsGroupRef.current && !reducedMotion) {
      cloudsGroupRef.current.children.forEach((cloud, idx) => {
        const cfg = CLOUD_PUFFS[idx];
        if (!cfg) return;
        const wrappedX = ((cfg.x + t * cfg.speed + 34) % 68) - 34;
        cloud.position.x = wrappedX;
      });
    }

    if (mistGroupRef.current && !reducedMotion) {
      mistGroupRef.current.children.forEach((m, idx) => {
        m.position.x = Math.sin(t * 0.12 + idx * 1.9) * 3.2;
      });
    }
  });

  // Soft low-poly clouds tinted warmly near golden hour / muted at night
  const cloudColor = useMemo(() => {
    const c = new THREE.Color('#FFFDF8');
    if (sunsetAmount > 0.2) c.lerp(new THREE.Color('#FFE0B8'), sunsetAmount * 0.55);
    if (nightAmount > 0.1) c.lerp(new THREE.Color('#334766'), nightAmount * 0.78);
    return c;
  }, [sunsetAmount, nightAmount]);

  // Valley floor mist strongest at dawn/morning/golden-hour
  const mistOpacity = Math.max(0.06, 0.26 * (1 - nightAmount * 0.4) * (0.4 + sunsetAmount * 0.6));

  return (
    <group>
      {/* Gradient Atmospheric Sky Dome */}
      <mesh material={skyMaterial} raycast={() => null}>
        <sphereGeometry args={[90, 32, 24]} />
      </mesh>

      {/* Soft Low-Poly Drifting Clouds */}
      <group ref={cloudsGroupRef} raycast={() => null}>
        {CLOUD_PUFFS.map((c, idx) => (
          <group key={idx} position={[c.x, c.y, c.z]} scale={c.scale}>
            <mesh position={[0, 0, 0]}>
              <icosahedronGeometry args={[1.6, 1]} />
              <meshStandardMaterial color={cloudColor} roughness={0.95} flatShading />
            </mesh>
            <mesh position={[1.45, -0.25, 0.2]}>
              <icosahedronGeometry args={[1.15, 1]} />
              <meshStandardMaterial color={cloudColor} roughness={0.95} flatShading />
            </mesh>
            <mesh position={[-1.35, -0.2, -0.1]}>
              <icosahedronGeometry args={[1.2, 1]} />
              <meshStandardMaterial color={cloudColor} roughness={0.95} flatShading />
            </mesh>
          </group>
        ))}
      </group>

      {/* Valley Morning Mist Planes drifting gently along distant floor */}
      <group ref={mistGroupRef} raycast={() => null}>
        {[
          { y: 1.5, z: -15.5, w: 38 },
          { y: 2.1, z: -20.5, w: 46 },
          { y: 1.2, z: -10.5, w: 30 },
        ].map((m, idx) => (
          <mesh key={idx} position={[0, m.y, m.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[m.w, 6.5]} />
            <meshBasicMaterial
              color={nightAmount > 0.5 ? '#5E7896' : '#FFF7E8'}
              transparent
              opacity={mistOpacity}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
};
