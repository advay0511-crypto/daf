import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface WeatherFXProps {
  rainFactor: number; // 0..1
  reducedMotion: boolean;
}

const RAIN_COUNT = 550;

export const WeatherFX: React.FC<WeatherFXProps> = ({ rainFactor, reducedMotion }) => {
  const pointsRef = useRef<THREE.Points | null>(null);

  const rainGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(RAIN_COUNT * 3);
    for (let i = 0; i < RAIN_COUNT; i++) {
      positions[i * 3] = (((i * 73) % 100) / 100 - 0.5) * 38;
      positions[i * 3 + 1] = ((i * 29) % 100) / 100 * 18 + 0.5;
      positions[i * 3 + 2] = (((i * 113) % 100) / 100 - 0.5) * 34;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  useEffect(() => {
    return () => {
      rainGeo.dispose();
    };
  }, [rainGeo]);

  useFrame((_, delta) => {
    if (!pointsRef.current || rainFactor <= 0.1 || reducedMotion) return;
    const posAttr = rainGeo.attributes.position as THREE.BufferAttribute;
    const drop = Math.min(delta, 0.05) * (11 + rainFactor * 7);
    for (let i = 0; i < RAIN_COUNT; i++) {
      let y = posAttr.getY(i) - drop;
      if (y < 0.1) y = 18.5;
      posAttr.setY(i, y);
    }
    posAttr.needsUpdate = true;
  });

  if (rainFactor <= 0.1) return null;

  return (
    <points ref={pointsRef} geometry={rainGeo} raycast={() => null}>
      <pointsMaterial
        color="#BAE6FD"
        size={0.14}
        transparent
        opacity={Math.min(0.75, 0.35 + rainFactor * 0.4)}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
};
