import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  FARM_TARGETS_3D,
  POND_CENTER,
  getRoofShingleTexture,
  getStoneWallTexture,
  getWoodPlankTexture,
  groundHeightAt,
} from './worldMath';
import { createWaterMaterial } from '../../shaders/water';
import { Selectable } from './Selectable';

interface StructuresProps {
  nightAmount: number;
  rainFactor: number;
  sunDir: THREE.Vector3;
  sunColor: string;
  skyHorizonColor: string;
  selectedId: string | null;
  focusedId: string | null;
  showAll: boolean;
  isTouchDevice: boolean;
  reducedMotion: boolean;
  onSelect: (id: string) => void;
}

export const Structures: React.FC<StructuresProps> = ({
  nightAmount,
  rainFactor,
  sunDir,
  sunColor,
  skyHorizonColor,
  selectedId,
  focusedId,
  showAll,
  isTouchDevice,
  reducedMotion,
  onSelect,
}) => {
  const stoneTex = useMemo(() => getStoneWallTexture(), []);
  const roofTex = useMemo(() => getRoofShingleTexture(), []);
  const woodTex = useMemo(() => getWoodPlankTexture(), []);
  const pondWaterMat = useMemo(() => createWaterMaterial(false), []);

  const bladesRef = useRef<THREE.Group | null>(null);
  const smokeGroupRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    return () => {
      pondWaterMat.dispose();
    };
  }, [pondWaterMat]);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();

    // Update pond water ripples
    pondWaterMat.uniforms.uTime.value = t;
    (pondWaterMat.uniforms.uSunDir.value as THREE.Vector3).copy(sunDir).normalize();
    (pondWaterMat.uniforms.uSunColor.value as THREE.Color).set(sunColor);
    (pondWaterMat.uniforms.uSkyColor.value as THREE.Color).set(skyHorizonColor);
    pondWaterMat.uniforms.uRainIntensity.value = rainFactor;

    // Spin windmill blades
    if (bladesRef.current && !reducedMotion) {
      bladesRef.current.rotation.z -= delta * 0.95;
    }

    // Animate farmhouse chimney smoke puffs
    if (smokeGroupRef.current && !reducedMotion) {
      smokeGroupRef.current.children.forEach((puff, idx) => {
        const cycle = (t * 0.35 + idx * 0.25) % 1;
        puff.position.y = cycle * 2.4;
        puff.position.x = Math.sin(cycle * 5 + idx) * 0.22 + cycle * 0.35;
        puff.scale.setScalar(0.35 + cycle * 0.85);
        const mat = (puff as THREE.Mesh).material as THREE.MeshStandardMaterial;
        mat.opacity = Math.sin(cycle * Math.PI) * 0.55;
      });
    }
  });

  const houseY = groundHeightAt(-10.5, -4.5);
  const barnY = groundHeightAt(-13.8, -10.8);
  const millY = groundHeightAt(-6.4, -10.5);
  const scarecrowY = groundHeightAt(5.6, 3.8);

  const windowGlow = Math.max(0.08, nightAmount * 1.65);

  const solarTarget = FARM_TARGETS_3D['solar-panels'];
  const pondTarget = FARM_TARGETS_3D['farm-pond'];

  // Split-rail fence segments bordering pasture & path
  const fencePosts = useMemo(
    () => [
      { x: -1.6, z: -7.5, rot: 0.08 },
      { x: 1.2, z: -7.2, rot: -0.04 },
      { x: 4.0, z: -7.4, rot: 0.02 },
      { x: 6.8, z: -7.9, rot: -0.15 },
      { x: -1.8, z: -12.6, rot: 0.1 },
      { x: 1.0, z: -13.1, rot: 0.04 },
      { x: 4.0, z: -13.2, rot: -0.06 },
      { x: 7.0, z: -13.1, rot: -0.08 },
      { x: -0.6, z: 9.2, rot: 0.05 },
      { x: 2.2, z: 9.3, rot: -0.04 },
      { x: 4.8, z: 9.1, rot: 0.08 },
    ],
    []
  );

  const cattailPositions: [number, number][] = [
    [-2.8, -1.0],
    [-2.5, 1.3],
    [2.6, -1.4],
    [2.9, 0.9],
    [-0.8, -2.3],
  ];

  return (
    <group>
      {/* ==================== STONE FARMHOUSE + SOLAR ROOF ==================== */}
      <group position={[-10.5, houseY, -4.5]}>
        {/* Main stone body */}
        <mesh position={[0, 1.2, 0]} castShadow receiveShadow>
          <boxGeometry args={[4.0, 2.4, 3.2]} />
          <meshStandardMaterial map={stoneTex} roughness={0.88} />
        </mesh>

        {/* Red gabled pitched roof (two angled slabs) */}
        <mesh position={[0, 2.95, 0.92]} rotation={[0.56, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[4.35, 0.18, 2.25]} />
          <meshStandardMaterial map={roofTex} roughness={0.78} />
        </mesh>
        <mesh position={[0, 2.95, -0.92]} rotation={[-0.56, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[4.35, 0.18, 2.25]} />
          <meshStandardMaterial map={roofTex} roughness={0.78} />
        </mesh>
        {/* Gable stone triangles */}
        <mesh position={[1.98, 2.65, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
          <coneGeometry args={[1.55, 1.25, 3]} />
          <meshStandardMaterial map={stoneTex} roughness={0.88} />
        </mesh>
        <mesh position={[-1.98, 2.65, 0]} rotation={[0, -Math.PI / 2, 0]} castShadow>
          <coneGeometry args={[1.55, 1.25, 3]} />
          <meshStandardMaterial map={stoneTex} roughness={0.88} />
        </mesh>

        {/* Chimney + smoke particles */}
        <mesh position={[-1.25, 3.3, -0.5]} castShadow>
          <boxGeometry args={[0.48, 1.4, 0.48]} />
          <meshStandardMaterial color="#8F4A3B" roughness={0.9} />
        </mesh>
        <group ref={smokeGroupRef} position={[-1.25, 4.1, -0.5]}>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i}>
              <icosahedronGeometry args={[0.32, 1]} />
              <meshStandardMaterial
                color="#F1F5F9"
                transparent
                opacity={0.4}
                depthWrite={false}
                roughness={1}
              />
            </mesh>
          ))}
        </group>

        {/* Wooden Front Door & Porch */}
        <mesh position={[0, 0.85, 1.62]} castShadow>
          <boxGeometry args={[0.72, 1.45, 0.08]} />
          <meshStandardMaterial map={woodTex} color="#7A4E2D" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.08, 1.95]} receiveShadow>
          <boxGeometry args={[2.2, 0.16, 0.72]} />
          <meshStandardMaterial map={woodTex} roughness={0.88} />
        </mesh>

        {/* Windows glowing warm amber at night */}
        {[
          [-1.15, 1.25, 1.62],
          [1.15, 1.25, 1.62],
          [2.02, 1.25, 0.4],
          [-2.02, 1.25, -0.3],
        ].map(([wx, wy, wz], idx) => (
          <mesh
            key={idx}
            position={[wx, wy, wz]}
            rotation={[0, Math.abs(wx) > 1.8 ? Math.PI / 2 : 0, 0]}
          >
            <boxGeometry args={[0.58, 0.62, 0.07]} />
            <meshStandardMaterial
              color="#FFF0BA"
              emissive="#FFB84D"
              emissiveIntensity={windowGlow}
              roughness={0.3}
            />
          </mesh>
        ))}
      </group>

      {/* Clickable Solar Panels mounted on Farmhouse south roof slope */}
      <Selectable
        id="solar-panels"
        label="Rooftop Solar & Sunlight"
        emoji="☀️"
        position={solarTarget.position}
        ringRadius={solarTarget.highlightRadius}
        labelOffsetY={solarTarget.labelOffsetY}
        selectedId={selectedId}
        focusedId={focusedId}
        showAll={showAll}
        isTouchDevice={isTouchDevice}
        reducedMotion={reducedMotion}
        onSelect={onSelect}
      >
        <group rotation={[0.56, 0, 0]}>
          {[-0.85, 0.85].map((sx, idx) => (
            <group key={idx} position={[sx, 0, 0]}>
              <mesh castShadow>
                <boxGeometry args={[1.38, 0.08, 1.05]} />
                <meshStandardMaterial color="#E2E8F0" metalness={0.65} roughness={0.35} />
              </mesh>
              <mesh position={[0, 0.045, 0]}>
                <boxGeometry args={[1.28, 0.02, 0.95]} />
                <meshStandardMaterial
                  color="#16325C"
                  metalness={0.78}
                  roughness={0.18}
                  emissive="#1D4ED8"
                  emissiveIntensity={0.12}
                />
              </mesh>
            </group>
          ))}
        </group>
      </Selectable>

      {/* ==================== SMALL RED WOODEN BARN ==================== */}
      <group position={[-13.8, barnY, -10.8]} rotation={[0, 0.25, 0]}>
        <mesh position={[0, 1.35, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.8, 2.7, 3.2]} />
          <meshStandardMaterial map={woodTex} color="#B83529" roughness={0.85} />
        </mesh>
        {/* Barn gabled roof */}
        <mesh position={[0, 3.2, 0.85]} rotation={[0.52, 0, 0]} castShadow>
          <boxGeometry args={[4.1, 0.16, 2.1]} />
          <meshStandardMaterial color="#68382B" roughness={0.82} />
        </mesh>
        <mesh position={[0, 3.2, -0.85]} rotation={[-0.52, 0, 0]} castShadow>
          <boxGeometry args={[4.1, 0.16, 2.1]} />
          <meshStandardMaterial color="#68382B" roughness={0.82} />
        </mesh>
        {/* Barn white cross doors */}
        <mesh position={[0, 0.95, 1.62]} castShadow>
          <boxGeometry args={[1.45, 1.85, 0.08]} />
          <meshStandardMaterial color="#9E2B22" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.95, 1.67]} rotation={[0, 0, 0.72]}>
          <boxGeometry args={[1.6, 0.1, 0.04]} />
          <meshStandardMaterial color="#F8FAFC" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.95, 1.67]} rotation={[0, 0, -0.72]}>
          <boxGeometry args={[1.6, 0.1, 0.04]} />
          <meshStandardMaterial color="#F8FAFC" roughness={0.6} />
        </mesh>
        {/* Hayloft window */}
        <mesh position={[0, 2.35, 1.62]}>
          <boxGeometry args={[0.58, 0.58, 0.08]} />
          <meshStandardMaterial
            color="#FDE68A"
            emissive="#F59E0B"
            emissiveIntensity={windowGlow * 0.75}
          />
        </mesh>
      </group>

      {/* ==================== WOODEN WINDMILL ==================== */}
      <group position={[-6.4, millY, -10.5]} rotation={[0, -0.25, 0]}>
        <mesh position={[0, 2.2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.35, 0.85, 4.4, 6]} />
          <meshStandardMaterial map={woodTex} color="#A67B53" roughness={0.9} />
        </mesh>
        <mesh position={[0, 4.55, 0]} castShadow>
          <cylinderGeometry args={[0.42, 0.42, 0.65, 8]} />
          <meshStandardMaterial color="#8F4A3B" roughness={0.8} />
        </mesh>
        {/* Rotating 4-blade wheel */}
        <group ref={bladesRef} position={[0, 4.35, 0.48]}>
          {[0, 1, 2, 3].map((i) => (
            <group key={i} rotation={[0, 0, (i * Math.PI) / 2]}>
              <mesh position={[0, 1.05, 0]} castShadow>
                <boxGeometry args={[0.1, 2.0, 0.05]} />
                <meshStandardMaterial color="#6D4C34" roughness={0.85} />
              </mesh>
              <mesh position={[0.2, 1.25, 0.02]} castShadow>
                <boxGeometry args={[0.38, 1.45, 0.02]} />
                <meshStandardMaterial color="#F4ECD8" roughness={0.75} />
              </mesh>
            </group>
          ))}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.2, 10]} />
            <meshStandardMaterial color="#475569" metalness={0.5} roughness={0.4} />
          </mesh>
        </group>
      </group>

      {/* ==================== WOODEN FENCES & SCARECROW ==================== */}
      {fencePosts.map((fp, idx) => {
        const y = groundHeightAt(fp.x, fp.z);
        return (
          <group key={idx} position={[fp.x, y, fp.z]} rotation={[0, fp.rot, 0]}>
            <mesh position={[-1.3, 0.42, 0]} castShadow>
              <cylinderGeometry args={[0.06, 0.07, 0.88, 6]} />
              <meshStandardMaterial color="#7C5638" roughness={0.9} />
            </mesh>
            <mesh position={[1.3, 0.42, 0]} castShadow>
              <cylinderGeometry args={[0.06, 0.07, 0.88, 6]} />
              <meshStandardMaterial color="#7C5638" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.62, 0]} castShadow>
              <boxGeometry args={[2.75, 0.08, 0.06]} />
              <meshStandardMaterial color="#8E6544" roughness={0.88} />
            </mesh>
            <mesh position={[0, 0.34, 0]} castShadow>
              <boxGeometry args={[2.75, 0.08, 0.06]} />
              <meshStandardMaterial color="#8E6544" roughness={0.88} />
            </mesh>
          </group>
        );
      })}

      {/* Charming Scarecrow near Wheat & Corn */}
      <group position={[5.6, scarecrowY, 3.8]} rotation={[0, -0.35, 0]}>
        <mesh position={[0, 0.85, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.07, 1.7, 6]} />
          <meshStandardMaterial color="#6D4C34" roughness={0.9} />
        </mesh>
        <mesh position={[0, 1.25, 0]} castShadow>
          <boxGeometry args={[1.2, 0.08, 0.08]} />
          <meshStandardMaterial color="#6D4C34" roughness={0.9} />
        </mesh>
        {/* Coat */}
        <mesh position={[0, 1.1, 0]} castShadow>
          <boxGeometry args={[0.52, 0.56, 0.24]} />
          <meshStandardMaterial color="#2E6B8E" roughness={0.85} />
        </mesh>
        {/* Head */}
        <mesh position={[0, 1.56, 0]} castShadow>
          <sphereGeometry args={[0.2, 10, 10]} />
          <meshStandardMaterial color="#E6BE8A" roughness={0.85} />
        </mesh>
        {/* Straw Hat */}
        <mesh position={[0, 1.74, 0]} castShadow>
          <cylinderGeometry args={[0.42, 0.42, 0.05, 12]} />
          <meshStandardMaterial color="#D8AD5C" roughness={0.85} />
        </mesh>
        <mesh position={[0, 1.88, 0]} castShadow>
          <coneGeometry args={[0.24, 0.32, 10]} />
          <meshStandardMaterial color="#CFA04E" roughness={0.85} />
        </mesh>
      </group>

      {/* ==================== CLICKABLE FARM POND & IRRIGATION ==================== */}
      <Selectable
        id="farm-pond"
        label="Farm Pond & Irrigation"
        emoji="💧"
        position={pondTarget.position}
        ringRadius={pondTarget.highlightRadius}
        labelOffsetY={pondTarget.labelOffsetY}
        selectedId={selectedId}
        focusedId={focusedId}
        showAll={showAll}
        isTouchDevice={isTouchDevice}
        reducedMotion={reducedMotion}
        onSelect={onSelect}
      >
        {/* Rippling water plane */}
        <mesh
          position={[0, 0.14, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[1, 0.78, 1]}
          material={pondWaterMat}
        >
          <circleGeometry args={[3.15, 36]} />
        </mesh>

        {/* Smooth shoreline stones & cattail reeds */}
        {cattailPositions.map(([cx, cz], idx) => (
          <group key={idx} position={[cx, 0.1, cz]}>
            <mesh position={[0, 0.45, 0]} castShadow>
              <cylinderGeometry args={[0.025, 0.03, 0.9, 5]} />
              <meshStandardMaterial color="#4D7C3C" roughness={0.8} />
            </mesh>
            <mesh position={[0, 0.85, 0]}>
              <capsuleGeometry args={[0.055, 0.18, 4, 6]} />
              <meshStandardMaterial color="#6B3F26" roughness={0.9} />
            </mesh>
            <mesh position={[0.24, 0.05, 0.14]} scale={[1.2, 0.6, 0.9]} castShadow>
              <dodecahedronGeometry args={[0.24, 0]} />
              <meshStandardMaterial color="#9CA3AF" roughness={0.88} />
            </mesh>
          </group>
        ))}

        {/* Small wooden irrigation dock */}
        <mesh position={[-2.9, 0.25, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.35, 0.12, 0.9]} />
          <meshStandardMaterial map={woodTex} roughness={0.85} />
        </mesh>
      </Selectable>
    </group>
  );
};
