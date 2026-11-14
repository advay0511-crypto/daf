import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { applyWindShader, updateWindUniforms } from '../../shaders/wind';
import { FARM_TARGETS_3D, groundHeightAt } from './worldMath';
import { Selectable } from './Selectable';

interface NatureAndAnimalsProps {
  drynessFactor: number;
  nightAmount: number;
  lowQuality: boolean;
  selectedId: string | null;
  focusedId: string | null;
  showAll: boolean;
  isTouchDevice: boolean;
  reducedMotion: boolean;
  onSelect: (id: string) => void;
}

const COW_PATHS = [
  { cx: 1.5, cz: -9.8, rx: 1.1, rz: 0.7, speed: 0.22, phase: 0.2 },
  { cx: 3.4, cz: -10.8, rx: 1.3, rz: 0.8, speed: 0.18, phase: 1.4 },
  { cx: 5.2, cz: -9.4, rx: 1.0, rz: 0.9, speed: 0.2, phase: 2.7 },
  { cx: 2.2, cz: -11.4, rx: 1.2, rz: 0.6, speed: 0.16, phase: 3.9 },
  { cx: 4.8, cz: -11.5, rx: 1.1, rz: 0.7, speed: 0.19, phase: 5.1 },
];

export const NatureAndAnimals: React.FC<NatureAndAnimalsProps> = ({
  drynessFactor,
  nightAmount,
  lowQuality,
  selectedId,
  focusedId,
  showAll,
  isTouchDevice,
  reducedMotion,
  onSelect,
}) => {
  const grassRef = useRef<THREE.InstancedMesh | null>(null);
  const flowerRef = useRef<THREE.InstancedMesh | null>(null);
  const cowsGroupRef = useRef<THREE.Group | null>(null);
  const chickensGroupRef = useRef<THREE.Group | null>(null);
  const butterfliesGroupRef = useRef<THREE.Group | null>(null);
  const birdsGroupRef = useRef<THREE.Group | null>(null);

  const grassMat = useMemo(
    () =>
      applyWindShader(new THREE.MeshStandardMaterial({ roughness: 0.88 }), {
        amplitude: 0.11,
        freq: 2.3,
        gustWeight: 1.8,
        cacheKey: 'wind-pasture-grass',
      }),
    []
  );

  const flowerMat = useMemo(
    () =>
      applyWindShader(new THREE.MeshStandardMaterial({ roughness: 0.75 }), {
        amplitude: 0.08,
        freq: 2.0,
        cacheKey: 'wind-wildflowers',
      }),
    []
  );

  useEffect(() => {
    return () => {
      grassMat.dispose();
      flowerMat.dispose();
    };
  }, [grassMat, flowerMat]);

  const grassCount = lowQuality ? 260 : 520;

  // Populate Pasture Grass InstancedMesh
  useEffect(() => {
    const mesh = grassRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const lush = new THREE.Color('#59A844');
    const dry = new THREE.Color('#C4B15B');
    const tmp = new THREE.Color();

    for (let i = 0; i < grassCount; i++) {
      // Spread across main fenced pasture area [-1.5..9.5, -13..-7.5] relative to meadowTarget
      const gx = (((i * 73) % 100) / 100 - 0.5) * 9.6;
      const gz = (((i * 137) % 100) / 100 - 0.5) * 4.8;
      const h = 0.28 + (i % 5) * 0.07;
      dummy.position.set(gx, h * 0.5, gz);
      dummy.rotation.set(0, i * 0.7, 0);
      dummy.scale.set(1, h / 0.35, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      tmp.copy(lush).offsetHSL(((i % 7) - 3) * 0.012, 0, ((i % 4) - 1.5) * 0.03);
      if (drynessFactor > 0.01) tmp.lerp(dry, drynessFactor * 0.7);
      color.copy(tmp);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [grassCount, drynessFactor]);

  // Populate Wildflowers along fences
  const wildflowerCount = 90;
  useEffect(() => {
    const mesh = flowerRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const palette = ['#FFFFFF', '#FEF08A', '#F9A8D4', '#E0F2FE', '#FDE047'];

    for (let i = 0; i < wildflowerCount; i++) {
      const fx = (((i * 59) % 100) / 100 - 0.5) * 6.5;
      const fz = (((i * 101) % 100) / 100 - 0.5) * 1.4;
      const s = 0.7 + (i % 4) * 0.18;
      dummy.position.set(fx, 0.24 * s, fz);
      dummy.rotation.set(0, i * 0.5, 0);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.set(palette[i % palette.length]);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const cycle = (t % 4.8) / 4.8;
    const gustX = -16 + cycle * 36;
    const gustStrength = Math.sin(cycle * Math.PI);

    updateWindUniforms(grassMat, t, gustX, -10, gustStrength, reducedMotion);
    updateWindUniforms(flowerMat, t, gustX, 9.6, gustStrength * 0.7, reducedMotion);

    // Slow wandering & grazing cows
    if (cowsGroupRef.current && !reducedMotion) {
      cowsGroupRef.current.children.forEach((cow, idx) => {
        const cfg = COW_PATHS[idx];
        if (!cfg) return;
        const ang = t * cfg.speed + cfg.phase;
        const wx = cfg.cx + Math.cos(ang) * cfg.rx;
        const wz = cfg.cz + Math.sin(ang) * cfg.rz;
        const wy = groundHeightAt(wx, wz);
        cow.position.set(wx - 3.4, wy - groundHeightAt(3.4, -9.8), wz - -9.8);
        const dx = -Math.sin(ang) * cfg.rx;
        const dz = Math.cos(ang) * cfg.rz;
        cow.rotation.y = Math.atan2(dx, dz);

        // Head graze dip
        const head = cow.getObjectByName('cow-head');
        if (head) {
          head.rotation.x = 0.25 + Math.max(0, Math.sin(t * 1.1 + idx * 2)) * 0.45;
        }
      });
    }

    // Pecking chickens near barn
    if (chickensGroupRef.current && !reducedMotion) {
      chickensGroupRef.current.children.forEach((ch, idx) => {
        ch.position.y = Math.abs(Math.sin(t * 4.5 + idx * 1.7)) * 0.06;
        ch.rotation.x = Math.max(0, Math.sin(t * 3.2 + idx)) * 0.35;
      });
    }

    // Butterflies / bees by day; fireflies at night
    if (butterfliesGroupRef.current && !reducedMotion) {
      butterfliesGroupRef.current.children.forEach((b, idx) => {
        const ang = t * (0.9 + (idx % 3) * 0.25) + idx * 1.3;
        b.position.x += Math.cos(ang) * 0.008;
        b.position.z += Math.sin(ang * 0.8) * 0.008;
        b.position.y = 0.85 + Math.sin(t * 3.1 + idx) * 0.28;
      });
    }

    // Birds flying in gentle arc across sky
    if (birdsGroupRef.current && !reducedMotion) {
      birdsGroupRef.current.children.forEach((bird, idx) => {
        const ang = t * 0.22 + idx * 0.42;
        bird.position.x = Math.cos(ang) * 14;
        bird.position.z = Math.sin(ang) * 10 - 6;
        bird.position.y = 10.5 + Math.sin(t * 1.5 + idx) * 0.6;
        bird.rotation.y = -ang;
      });
    }
  });

  const meadowTarget = FARM_TARGETS_3D['meadow-grass'];
  const cowsTarget = FARM_TARGETS_3D['cows'];
  const wildTarget = FARM_TARGETS_3D['wildflowers'];
  const barnChickenY = groundHeightAt(-11.2, -8.5);

  return (
    <group>
      {/* CLICKABLE PASTURE GRASS & CLOVER */}
      <Selectable
        id="meadow-grass"
        label="Pasture Grass & Clover"
        emoji="🌿"
        position={meadowTarget.position}
        ringRadius={meadowTarget.highlightRadius}
        labelOffsetY={meadowTarget.labelOffsetY}
        selectedId={selectedId}
        focusedId={focusedId}
        showAll={showAll}
        isTouchDevice={isTouchDevice}
        reducedMotion={reducedMotion}
        onSelect={onSelect}
      >
        <instancedMesh ref={grassRef} args={[undefined, undefined, grassCount]} material={grassMat}>
          <coneGeometry args={[0.04, 0.36, 3]} />
        </instancedMesh>
        {/* Transparent ground hit pad for reliable meadow selection */}
        <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[9.8, 5.2]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
      </Selectable>

      {/* CLICKABLE WHITE WILDFLOWERS */}
      <Selectable
        id="wildflowers"
        label="White Wildflowers"
        emoji="🌼"
        position={wildTarget.position}
        ringRadius={wildTarget.highlightRadius}
        labelOffsetY={wildTarget.labelOffsetY}
        selectedId={selectedId}
        focusedId={focusedId}
        showAll={showAll}
        isTouchDevice={isTouchDevice}
        reducedMotion={reducedMotion}
        onSelect={onSelect}
      >
        <instancedMesh ref={flowerRef} args={[undefined, undefined, wildflowerCount]} material={flowerMat} castShadow>
          <dodecahedronGeometry args={[0.11, 0]} />
        </instancedMesh>
      </Selectable>

      {/* CLICKABLE WANDERING GRAZING COWS */}
      <Selectable
        id="cows"
        label="Grazing Dairy Cattle"
        emoji="🐄"
        position={cowsTarget.position}
        ringRadius={cowsTarget.highlightRadius}
        labelOffsetY={cowsTarget.labelOffsetY}
        selectedId={selectedId}
        focusedId={focusedId}
        showAll={showAll}
        isTouchDevice={isTouchDevice}
        reducedMotion={reducedMotion}
        onSelect={onSelect}
      >
        <group ref={cowsGroupRef}>
          {COW_PATHS.map((cfg, idx) => (
            <group key={idx} position={[cfg.cx - 3.4, 0, cfg.cz - -9.8]}>
              {/* Body */}
              <mesh position={[0, 0.56, 0]} castShadow>
                <boxGeometry args={[0.48, 0.44, 0.85]} />
                <meshStandardMaterial color="#F8FAFC" roughness={0.85} />
              </mesh>
              {/* Cow dark patch */}
              <mesh position={[0.02, 0.58, 0.08]}>
                <boxGeometry args={[0.5, 0.28, 0.36]} />
                <meshStandardMaterial color="#1E293B" roughness={0.85} />
              </mesh>
              {/* Head */}
              <group name="cow-head" position={[0, 0.66, 0.48]}>
                <mesh castShadow>
                  <boxGeometry args={[0.3, 0.28, 0.34]} />
                  <meshStandardMaterial color="#1E293B" roughness={0.85} />
                </mesh>
                <mesh position={[0, -0.06, 0.16]}>
                  <boxGeometry args={[0.24, 0.14, 0.1]} />
                  <meshStandardMaterial color="#FDA4AF" roughness={0.8} />
                </mesh>
              </group>
              {/* 4 Legs */}
              {[
                [-0.15, 0.22, 0.28],
                [0.15, 0.22, 0.28],
                [-0.15, 0.22, -0.28],
                [0.15, 0.22, -0.28],
              ].map(([lx, ly, lz], li) => (
                <mesh key={li} position={[lx, ly, lz]} castShadow>
                  <boxGeometry args={[0.1, 0.44, 0.1]} />
                  <meshStandardMaterial color="#E2E8F0" roughness={0.85} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
        <mesh position={[0, 0.55, 0]}>
          <boxGeometry args={[6.2, 1.2, 4.4]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
      </Selectable>

      {/* CHICKENS NEAR BARN */}
      <group ref={chickensGroupRef} position={[-11.2, barnChickenY, -8.5]}>
        {[
          [0, 0, 0, '#FFFFFF'],
          [0.6, 0, 0.4, '#D97706'],
          [-0.5, 0, 0.6, '#F8FAFC'],
          [0.9, 0, -0.3, '#B45309'],
        ].map(([cx, cy, cz, col], idx) => (
          <group key={idx} position={[cx as number, cy as number, cz as number]} rotation={[0, idx * 1.4, 0]}>
            <mesh position={[0, 0.16, 0]} castShadow>
              <sphereGeometry args={[0.13, 8, 8]} />
              <meshStandardMaterial color={col as string} roughness={0.8} />
            </mesh>
            <mesh position={[0, 0.26, 0.1]}>
              <sphereGeometry args={[0.075, 7, 7]} />
              <meshStandardMaterial color={col as string} roughness={0.8} />
            </mesh>
            <mesh position={[0, 0.25, 0.18]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.03, 0.08, 5]} />
              <meshStandardMaterial color="#F59E0B" />
            </mesh>
          </group>
        ))}
      </group>

      {/* BUTTERFLIES / BEES BY DAY & FIREFLIES AT NIGHT */}
      <group ref={butterfliesGroupRef} raycast={() => null}>
        {[
          [-9.0, 0.9, 6.2, '#FACC15'],
          [-14.0, 0.9, 5.1, '#C084FC'],
          [1.8, 0.8, 9.5, '#F472B6'],
          [11.0, 0.8, -5.5, '#38BDF8'],
          [-3.8, 0.9, 6.7, '#FBBF24'],
          [7.4, 1.0, 7.6, '#FEF08A'],
        ].map(([bx, by, bz, col], idx) => (
          <mesh key={idx} position={[bx as number, by as number, bz as number]}>
            <sphereGeometry args={[nightAmount > 0.35 ? 0.055 : 0.075, 6, 6]} />
            <meshStandardMaterial
              color={nightAmount > 0.35 ? '#FDE047' : (col as string)}
              emissive={nightAmount > 0.35 ? '#FACC15' : '#000000'}
              emissiveIntensity={nightAmount > 0.35 ? 2.4 : 0}
            />
          </mesh>
        ))}
      </group>

      {/* BIRDS FLYING ACROSS VALLEY SKY */}
      <group ref={birdsGroupRef} raycast={() => null}>
        {[0, 1, 2, 3].map((idx) => (
          <group key={idx} position={[idx * 2 - 4, 10.5, -6]}>
            <mesh rotation={[0, 0, 0.35]} position={[-0.18, 0, 0]}>
              <boxGeometry args={[0.38, 0.03, 0.12]} />
              <meshStandardMaterial color="#334155" />
            </mesh>
            <mesh rotation={[0, 0, -0.35]} position={[0.18, 0, 0]}>
              <boxGeometry args={[0.38, 0.03, 0.12]} />
              <meshStandardMaterial color="#334155" />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
};
