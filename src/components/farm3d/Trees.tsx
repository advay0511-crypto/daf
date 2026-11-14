import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SeasonKey } from '../../types';
import { applyWindShader, updateWindUniforms } from '../../shaders/wind';
import { FARM_TARGETS_3D, getBarkTexture } from './worldMath';
import { Selectable } from './Selectable';

interface TreesProps {
  treeSeasons: Record<string, SeasonKey>;
  selectedId: string | null;
  focusedId: string | null;
  showAll: boolean;
  isTouchDevice: boolean;
  reducedMotion: boolean;
  onSelect: (id: string) => void;
}

function getCanopyPalette(cropId: string, season: SeasonKey): { main: string; sub: string; bare: boolean; snow: boolean } {
  if (cropId === 'pine-trees') {
    return {
      main: season === 'winter' ? '#214E34' : '#265E3B',
      sub: season === 'winter' ? '#D9EAEF' : '#2E6F44',
      bare: false,
      snow: season === 'winter',
    };
  }
  switch (season) {
    case 'spring':
      if (cropId === 'apple-tree') return { main: '#FBCFE8', sub: '#86EFAC', bare: false, snow: false };
      return { main: '#78C864', sub: '#A3E635', bare: false, snow: false };
    case 'autumn':
      if (cropId === 'red-maple') return { main: '#DC2626', sub: '#EA580C', bare: false, snow: false };
      if (cropId === 'sugar-maple') return { main: '#F59E0B', sub: '#EA580C', bare: false, snow: false };
      return { main: '#D97706', sub: '#B45309', bare: false, snow: false };
    case 'winter':
      return { main: '#94A3B8', sub: '#E2E8F0', bare: true, snow: true };
    case 'summer':
    default:
      if (cropId === 'red-maple') return { main: '#387C44', sub: '#B91C1C', bare: false, snow: false };
      if (cropId === 'sugar-maple') return { main: '#4A9946', sub: '#65A30D', bare: false, snow: false };
      return { main: '#3E8E41', sub: '#52A84E', bare: false, snow: false };
  }
}

export const Trees: React.FC<TreesProps> = ({
  treeSeasons,
  selectedId,
  focusedId,
  showAll,
  isTouchDevice,
  reducedMotion,
  onSelect,
}) => {
  const barkTex = useMemo(() => getBarkTexture(), []);
  const swingRef = useRef<THREE.Group | null>(null);

  const treeWindMats = useMemo(() => {
    const mk = (key: string, amplitude: number, pivotY: number, freq: number) =>
      applyWindShader(new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }), {
        amplitude,
        pivotY,
        freq,
        cacheKey: key,
      });

    return {
      oakMain: mk('wind-oak-main', 0.065, 2.0, 1.35),
      oakSub: mk('wind-oak-sub', 0.075, 2.0, 1.45),
      sugarMain: mk('wind-sugar-main', 0.07, 1.8, 1.4),
      sugarSub: mk('wind-sugar-sub', 0.08, 1.8, 1.5),
      redMain: mk('wind-red-main', 0.075, 1.6, 1.45),
      redSub: mk('wind-red-sub', 0.085, 1.6, 1.55),
      appleMain: mk('wind-apple-main', 0.075, 1.3, 1.5),
      appleSub: mk('wind-apple-sub', 0.085, 1.3, 1.6),
      pineMain: mk('wind-pine-main', 0.055, 1.0, 1.25),
      pineSub: mk('wind-pine-sub', 0.065, 1.2, 1.3),
    };
  }, []);

  const oakPal = getCanopyPalette('white-oak', treeSeasons['white-oak'] ?? 'summer');
  const sugarPal = getCanopyPalette('sugar-maple', treeSeasons['sugar-maple'] ?? 'summer');
  const redPal = getCanopyPalette('red-maple', treeSeasons['red-maple'] ?? 'autumn');
  const applePal = getCanopyPalette('apple-tree', treeSeasons['apple-tree'] ?? 'summer');
  const pinePal = getCanopyPalette('pine-trees', treeSeasons['pine-trees'] ?? 'summer');

  useEffect(() => {
    treeWindMats.oakMain.color.set(oakPal.main);
    treeWindMats.oakSub.color.set(oakPal.sub);
    treeWindMats.sugarMain.color.set(sugarPal.main);
    treeWindMats.sugarSub.color.set(sugarPal.sub);
    treeWindMats.redMain.color.set(redPal.main);
    treeWindMats.redSub.color.set(redPal.sub);
    treeWindMats.appleMain.color.set(applePal.main);
    treeWindMats.appleSub.color.set(applePal.sub);
    treeWindMats.pineMain.color.set(pinePal.main);
    treeWindMats.pineSub.color.set(pinePal.snow ? '#E2E8F0' : pinePal.sub);
  }, [
    treeWindMats,
    oakPal.main,
    oakPal.sub,
    sugarPal.main,
    sugarPal.sub,
    redPal.main,
    redPal.sub,
    applePal.main,
    applePal.sub,
    pinePal.main,
    pinePal.sub,
    pinePal.snow,
  ]);

  useEffect(() => {
    return () => {
      Object.values(treeWindMats).forEach((m) => m.dispose());
    };
  }, [treeWindMats]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const cycle = (t % 4.8) / 4.8;
    const gustX = -16 + cycle * 36;
    const gustStrength = Math.sin(cycle * Math.PI);

    Object.values(treeWindMats).forEach((mat) => {
      updateWindUniforms(mat, t, gustX, 0, gustStrength * 0.45, reducedMotion, 0.85);
    });
    if (swingRef.current && !reducedMotion) {
      swingRef.current.rotation.z = Math.sin(t * 1.4) * 0.14;
    }
  });

  const oakTarget = FARM_TARGETS_3D['big-tree'];
  const sugarTarget = FARM_TARGETS_3D['mid-tree'];
  const redTarget = FARM_TARGETS_3D['background-tree'];
  const appleTarget = FARM_TARGETS_3D['apple-tree'];
  const pineTarget = FARM_TARGETS_3D['pine-trees'];

  const appleFruitCoords: [number, number, number][] = [
    [-0.55, 2.35, 0.55],
    [0.65, 2.45, 0.35],
    [0.15, 2.85, -0.55],
    [-0.4, 2.15, -0.45],
    [0.45, 2.15, -0.15],
  ];

  return (
    <group>
      {/* 1. BIG WHITE OAK NEAR HOUSE + ROPE SWING */}
      <Selectable
        id="big-tree"
        label="White Oak"
        emoji="🌳"
        position={oakTarget.position}
        ringRadius={oakTarget.highlightRadius}
        labelOffsetY={oakTarget.labelOffsetY}
        selectedId={selectedId}
        focusedId={focusedId}
        showAll={showAll}
        isTouchDevice={isTouchDevice}
        reducedMotion={reducedMotion}
        onSelect={onSelect}
      >
        {/* Trunk & sturdy main limb */}
        <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.32, 0.52, 3.0, 8]} />
          <meshStandardMaterial map={barkTex} roughness={0.92} />
        </mesh>
        <mesh position={[1.15, 2.5, 0.25]} rotation={[0, 0, -1.15]} castShadow>
          <cylinderGeometry args={[0.14, 0.2, 2.2, 7]} />
          <meshStandardMaterial map={barkTex} roughness={0.92} />
        </mesh>

        {/* Rope swing hanging off the oak branch */}
        <group ref={swingRef} position={[1.75, 2.75, 0.35]}>
          <mesh position={[-0.22, -0.85, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 1.7, 4]} />
            <meshStandardMaterial color="#D6B57B" roughness={0.9} />
          </mesh>
          <mesh position={[0.22, -0.85, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 1.7, 4]} />
            <meshStandardMaterial color="#D6B57B" roughness={0.9} />
          </mesh>
          <mesh position={[0, -1.7, 0]} castShadow>
            <boxGeometry args={[0.6, 0.07, 0.26]} />
            <meshStandardMaterial color="#8B5E3C" roughness={0.85} />
          </mesh>
        </group>

        {/* Layered canopy puffs */}
        {!oakPal.bare && (
          <group>
            <mesh position={[0, 3.7, 0]} material={treeWindMats.oakMain} castShadow>
              <icosahedronGeometry args={[1.65, 1]} />
            </mesh>
            <mesh position={[-1.1, 3.3, 0.5]} material={treeWindMats.oakSub} castShadow>
              <icosahedronGeometry args={[1.2, 1]} />
            </mesh>
            <mesh position={[1.05, 3.45, -0.35]} material={treeWindMats.oakMain} castShadow>
              <icosahedronGeometry args={[1.25, 1]} />
            </mesh>
          </group>
        )}
        {oakPal.snow && (
          <mesh position={[0, 3.1, 0]}>
            <icosahedronGeometry args={[0.9, 1]} />
            <meshStandardMaterial color="#F1F5F9" roughness={0.9} flatShading />
          </mesh>
        )}
      </Selectable>

      {/* 2. SUGAR MAPLE IN SUNLIT PASTURE */}
      <Selectable
        id="mid-tree"
        label="Sugar Maple"
        emoji="🌳"
        position={sugarTarget.position}
        ringRadius={sugarTarget.highlightRadius}
        labelOffsetY={sugarTarget.labelOffsetY}
        selectedId={selectedId}
        focusedId={focusedId}
        showAll={showAll}
        isTouchDevice={isTouchDevice}
        reducedMotion={reducedMotion}
        onSelect={onSelect}
      >
        <mesh position={[0, 1.35, 0]} castShadow>
          <cylinderGeometry args={[0.25, 0.4, 2.7, 8]} />
          <meshStandardMaterial map={barkTex} roughness={0.92} />
        </mesh>
        {!sugarPal.bare && (
          <group>
            <mesh position={[0, 3.35, 0]} material={treeWindMats.sugarMain} castShadow>
              <icosahedronGeometry args={[1.45, 1]} />
            </mesh>
            <mesh position={[-0.85, 2.95, 0.45]} material={treeWindMats.sugarSub} castShadow>
              <icosahedronGeometry args={[1.05, 1]} />
            </mesh>
            <mesh position={[0.85, 3.0, -0.35]} material={treeWindMats.sugarMain} castShadow>
              <icosahedronGeometry args={[1.05, 1]} />
            </mesh>
          </group>
        )}
      </Selectable>

      {/* 3. RED MAPLE ON LOWER HILLSIDE */}
      <Selectable
        id="background-tree"
        label="Red Maple"
        emoji="🍁"
        position={redTarget.position}
        ringRadius={redTarget.highlightRadius}
        labelOffsetY={redTarget.labelOffsetY}
        selectedId={selectedId}
        focusedId={focusedId}
        showAll={showAll}
        isTouchDevice={isTouchDevice}
        reducedMotion={reducedMotion}
        onSelect={onSelect}
      >
        <mesh position={[0, 1.2, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.34, 2.4, 7]} />
          <meshStandardMaterial map={barkTex} roughness={0.92} />
        </mesh>
        {!redPal.bare && (
          <group>
            <mesh position={[0, 2.95, 0]} material={treeWindMats.redMain} castShadow>
              <icosahedronGeometry args={[1.25, 1]} />
            </mesh>
            <mesh position={[0.65, 2.65, 0.4]} material={treeWindMats.redSub} castShadow>
              <icosahedronGeometry args={[0.88, 1]} />
            </mesh>
          </group>
        )}
      </Selectable>

      {/* 4. APPLE TREE WITH RED APPLES */}
      <Selectable
        id="apple-tree"
        label="Honeycrisp Apple Tree"
        emoji="🍎"
        position={appleTarget.position}
        ringRadius={appleTarget.highlightRadius}
        labelOffsetY={appleTarget.labelOffsetY}
        selectedId={selectedId}
        focusedId={focusedId}
        showAll={showAll}
        isTouchDevice={isTouchDevice}
        reducedMotion={reducedMotion}
        onSelect={onSelect}
      >
        <mesh position={[0, 1.0, 0]} castShadow>
          <cylinderGeometry args={[0.18, 0.28, 2.0, 7]} />
          <meshStandardMaterial map={barkTex} roughness={0.92} />
        </mesh>
        {!applePal.bare && (
          <group>
            <mesh position={[0, 2.4, 0]} material={treeWindMats.appleMain} castShadow>
              <icosahedronGeometry args={[1.15, 1]} />
            </mesh>
            <mesh position={[-0.65, 2.15, 0.35]} material={treeWindMats.appleSub} castShadow>
              <icosahedronGeometry args={[0.78, 1]} />
            </mesh>
            {((treeSeasons['apple-tree'] ?? 'summer') === 'summer' ||
              (treeSeasons['apple-tree'] ?? 'summer') === 'autumn') &&
              appleFruitCoords.map(([ax, ay, az], idx) => (
                <mesh key={idx} position={[ax, ay, az]} castShadow>
                  <sphereGeometry args={[0.12, 8, 8]} />
                  <meshStandardMaterial color="#E11D48" roughness={0.35} />
                </mesh>
              ))}
          </group>
        )}
      </Selectable>

      {/* 5. PINE TREES CLUSTER ON HILLSIDE */}
      <Selectable
        id="pine-trees"
        label="Pine Trees (Hill Ridge)"
        emoji="🌲"
        position={pineTarget.position}
        ringRadius={pineTarget.highlightRadius}
        labelOffsetY={pineTarget.labelOffsetY}
        selectedId={selectedId}
        focusedId={focusedId}
        showAll={showAll}
        isTouchDevice={isTouchDevice}
        reducedMotion={reducedMotion}
        onSelect={onSelect}
      >
        {[
          [0, 0, 0, 1.15],
          [-1.5, 0.15, 0.9, 0.95],
          [1.6, -0.1, 0.6, 1.02],
          [0.4, 0.2, -1.3, 1.1],
        ].map(([px, py, pz, s], idx) => (
          <group key={idx} position={[px, py, pz]} scale={s}>
            <mesh position={[0, 0.85, 0]} castShadow>
              <cylinderGeometry args={[0.14, 0.22, 1.7, 6]} />
              <meshStandardMaterial map={barkTex} roughness={0.92} />
            </mesh>
            <mesh position={[0, 1.95, 0]} material={treeWindMats.pineMain} castShadow>
              <coneGeometry args={[1.0, 1.7, 7]} />
            </mesh>
            <mesh position={[0, 2.85, 0]} material={treeWindMats.pineSub} castShadow>
              <coneGeometry args={[0.78, 1.45, 7]} />
            </mesh>
          </group>
        ))}
      </Selectable>
    </group>
  );
};
