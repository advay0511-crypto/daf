import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GrowthStageKey } from '../../types';
import { applyWindShader, updateWindUniforms } from '../../shaders/wind';
import { createWaterMaterial } from '../../shaders/water';
import { FARM_TARGETS_3D, groundHeightAt } from './worldMath';
import { Selectable } from './Selectable';

interface CropFieldsProps {
  cropStages: Record<string, GrowthStageKey>;
  sunDir: THREE.Vector3;
  sunColor: string;
  skyHorizonColor: string;
  rainFactor: number;
  selectedId: string | null;
  focusedId: string | null;
  showAll: boolean;
  isTouchDevice: boolean;
  reducedMotion: boolean;
  onSelect: (id: string) => void;
}

function stageHeightScale(stage: GrowthStageKey): number {
  switch (stage) {
    case 'seed':
      return 0.14;
    case 'sprout':
      return 0.36;
    case 'vegetative':
      return 0.78;
    case 'flowering':
      return 0.96;
    case 'harvest':
      return 1.05;
  }
}

export const CropFields: React.FC<CropFieldsProps> = ({
  cropStages,
  sunDir,
  sunColor,
  skyHorizonColor,
  rainFactor,
  selectedId,
  focusedId,
  showAll,
  isTouchDevice,
  reducedMotion,
  onSelect,
}) => {
  // Materials with wind shader
  const cornMat = useMemo(
    () => applyWindShader(new THREE.MeshStandardMaterial({ roughness: 0.8 }), { amplitude: 0.14, freq: 1.7, cacheKey: 'wind-corn' }),
    []
  );
  const wheatMat = useMemo(
    () => applyWindShader(new THREE.MeshStandardMaterial({ roughness: 0.78 }), { amplitude: 0.18, freq: 2.2, gustWeight: 2.4, cacheKey: 'wind-wheat' }),
    []
  );
  const sunStemMat = useMemo(
    () => applyWindShader(new THREE.MeshStandardMaterial({ color: '#4A8C38', roughness: 0.82 }), { amplitude: 0.08, freq: 1.5, cacheKey: 'wind-sun' }),
    []
  );
  const genericFoliageMat = useMemo(
    () => applyWindShader(new THREE.MeshStandardMaterial({ roughness: 0.82 }), { amplitude: 0.09, freq: 2.0, gustWeight: 1.3, cacheKey: 'wind-foliage' }),
    []
  );
  const paddyWaterMat = useMemo(() => createWaterMaterial(true), []);

  useEffect(() => {
    return () => {
      cornMat.dispose();
      wheatMat.dispose();
      sunStemMat.dispose();
      genericFoliageMat.dispose();
      paddyWaterMat.dispose();
    };
  }, [cornMat, wheatMat, sunStemMat, genericFoliageMat, paddyWaterMat]);

  // Refs for InstancedMeshes
  const cornStalkRef = useRef<THREE.InstancedMesh | null>(null);
  const cornCobRef = useRef<THREE.InstancedMesh | null>(null);
  const wheatRef = useRef<THREE.InstancedMesh | null>(null);
  const sunflowerStalkRef = useRef<THREE.InstancedMesh | null>(null);
  const sunflowerHeadGroupRef = useRef<THREE.Group | null>(null);
  const tomatoBushRef = useRef<THREE.InstancedMesh | null>(null);
  const tomatoStakeRef = useRef<THREE.InstancedMesh | null>(null);
  const tomatoFruitRef = useRef<THREE.InstancedMesh | null>(null);
  const pumpkinLeafRef = useRef<THREE.InstancedMesh | null>(null);
  const pumpkinFruitRef = useRef<THREE.InstancedMesh | null>(null);
  const carrotTopRef = useRef<THREE.InstancedMesh | null>(null);
  const lavenderBushRef = useRef<THREE.InstancedMesh | null>(null);
  const lavenderSpikeRef = useRef<THREE.InstancedMesh | null>(null);
  const strawLeafRef = useRef<THREE.InstancedMesh | null>(null);
  const strawBerryRef = useRef<THREE.InstancedMesh | null>(null);
  const riceTuftRef = useRef<THREE.InstancedMesh | null>(null);

  // Sunflower azimuth tracking + rolling wind gusts every few seconds
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // Rolling gust wave sweeps across the wheat & crop valley every ~4.8 seconds
    const cycle = (t % 4.8) / 4.8;
    const gustX = -16 + cycle * 36;
    const gustZ = 2 + Math.sin(t * 0.4) * 3;
    const gustStrength = Math.sin(cycle * Math.PI);

    updateWindUniforms(cornMat, t, gustX, gustZ, gustStrength, reducedMotion);
    updateWindUniforms(wheatMat, t, gustX, gustZ, gustStrength, reducedMotion, 1.25);
    updateWindUniforms(sunStemMat, t, gustX, gustZ, gustStrength * 0.6, reducedMotion);
    updateWindUniforms(genericFoliageMat, t, gustX, gustZ, gustStrength * 0.9, reducedMotion);

    paddyWaterMat.uniforms.uTime.value = t;
    (paddyWaterMat.uniforms.uSunDir.value as THREE.Vector3).copy(sunDir).normalize();
    (paddyWaterMat.uniforms.uSunColor.value as THREE.Color).set(sunColor);
    (paddyWaterMat.uniforms.uSkyColor.value as THREE.Color).set(skyHorizonColor);
    paddyWaterMat.uniforms.uRainIntensity.value = rainFactor;

    // Slowly turn sunflower heads toward the sun direction
    if (sunflowerHeadGroupRef.current) {
      const targetYaw = Math.atan2(sunDir.x, sunDir.z);
      sunflowerHeadGroupRef.current.children.forEach((head, idx) => {
        const sway = reducedMotion ? 0 : Math.sin(t * 1.4 + idx) * 0.05;
        head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, targetYaw * 0.55 + sway, 0.05);
      });
    }
  });

  // 1. CORN (56 stalks)
  const cornStage = cropStages['maize'] ?? 'harvest';
  useEffect(() => {
    const stalks = cornStalkRef.current;
    const cobs = cornCobRef.current;
    if (!stalks || !cobs) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const hScale = stageHeightScale(cornStage);
    const showCobs = cornStage === 'flowering' || cornStage === 'harvest';
    const isHarvest = cornStage === 'harvest';

    let i = 0;
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 8; c++) {
        const x = (c - 3.5) * 0.62 + ((r % 2) - 0.5) * 0.1;
        const z = (r - 3) * 0.6;
        const h = hScale * (1.55 + ((i * 7) % 5) * 0.1);
        dummy.position.set(x, h * 0.5, z);
        dummy.rotation.set(0, (i * 0.9) % Math.PI, 0);
        dummy.scale.set(1, h, 1);
        dummy.updateMatrix();
        stalks.setMatrixAt(i, dummy.matrix);
        color.set(cornStage === 'seed' ? '#8B5E3C' : isHarvest ? '#6EA83C' : '#3E8E3A');
        stalks.setColorAt(i, color);

        if (showCobs) {
          dummy.position.set(x + 0.11, h * 0.58, z + 0.05);
          dummy.rotation.set(0.3, 0, -0.35);
          dummy.scale.setScalar(isHarvest ? 1.0 : 0.65);
        } else {
          dummy.scale.setScalar(0.001);
        }
        dummy.updateMatrix();
        cobs.setMatrixAt(i, dummy.matrix);
        i++;
      }
    }
    stalks.instanceMatrix.needsUpdate = true;
    if (stalks.instanceColor) stalks.instanceColor.needsUpdate = true;
    cobs.instanceMatrix.needsUpdate = true;
  }, [cornStage]);

  // 2. WHEAT (180 golden stalks)
  const wheatStage = cropStages['wheat'] ?? 'harvest';
  useEffect(() => {
    const mesh = wheatRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const hScale = stageHeightScale(wheatStage);
    let idx = 0;
    for (let r = 0; r < 12; r++) {
      for (let c = 0; c < 15; c++) {
        const x = (c - 7) * 0.39 + Math.sin(idx * 2.1) * 0.08;
        const z = (r - 5.5) * 0.36 + Math.cos(idx * 1.7) * 0.08;
        const h = hScale * (0.85 + (idx % 4) * 0.08);
        dummy.position.set(x, h * 0.5, z);
        dummy.rotation.set(0, idx * 0.4, 0);
        dummy.scale.set(1, h, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx, dummy.matrix);
        if (wheatStage === 'harvest') {
          color.set(idx % 3 === 0 ? '#E8B84B' : '#F4C95D');
        } else if (wheatStage === 'flowering') {
          color.set('#B4BE52');
        } else if (wheatStage === 'seed') {
          color.set('#8B5E3C');
        } else {
          color.set('#5BA64B');
        }
        mesh.setColorAt(idx, color);
        idx++;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [wheatStage]);

  // 3. SUNFLOWERS (24 blooms tracking sun)
  const sunflowerStage = cropStages['sunflowers'] ?? 'flowering';
  const sunflowerGrid = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 6; c++) {
        pts.push([(c - 2.5) * 0.72, 0.9 + ((r + c) % 3) * 0.16, (r - 1.5) * 0.85]);
      }
    }
    return pts;
  }, []);

  useEffect(() => {
    const stems = sunflowerStalkRef.current;
    if (!stems) return;
    const dummy = new THREE.Object3D();
    const hScale = stageHeightScale(sunflowerStage);
    sunflowerGrid.forEach(([x, baseH, z], i) => {
      const h = baseH * hScale;
      dummy.position.set(x, h * 0.5, z);
      dummy.scale.set(1, h, 1);
      dummy.updateMatrix();
      stems.setMatrixAt(i, dummy.matrix);
    });
    stems.instanceMatrix.needsUpdate = true;
  }, [sunflowerGrid, sunflowerStage]);

  // 4. TOMATOES (16 staked bushes with red fruit)
  const tomatoStage = cropStages['tomatoes'] ?? 'harvest';
  useEffect(() => {
    const bushes = tomatoBushRef.current;
    const stakes = tomatoStakeRef.current;
    const fruits = tomatoFruitRef.current;
    if (!bushes || !stakes || !fruits) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const hScale = stageHeightScale(tomatoStage);
    const showFruit = tomatoStage === 'flowering' || tomatoStage === 'harvest';

    let i = 0;
    let fIdx = 0;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const x = (c - 1.5) * 0.92;
        const z = (r - 1.5) * 0.82;
        dummy.position.set(x + 0.08, 0.65, z);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        stakes.setMatrixAt(i, dummy.matrix);

        const bushScale = Math.max(0.18, hScale * 0.9);
        dummy.position.set(x, 0.45 * bushScale, z);
        dummy.scale.setScalar(bushScale);
        dummy.updateMatrix();
        bushes.setMatrixAt(i, dummy.matrix);
        color.set('#3E8E41');
        bushes.setColorAt(i, color);

        for (let k = 0; k < 3; k++) {
          if (showFruit) {
            const ang = k * 2.1 + i;
            dummy.position.set(x + Math.cos(ang) * 0.22, 0.35 + k * 0.14, z + Math.sin(ang) * 0.22);
            dummy.scale.setScalar(tomatoStage === 'harvest' ? 1.0 : 0.48);
          } else {
            dummy.scale.setScalar(0.001);
          }
          dummy.updateMatrix();
          fruits.setMatrixAt(fIdx, dummy.matrix);
          color.set(tomatoStage === 'harvest' ? '#EF4444' : '#FACC15');
          fruits.setColorAt(fIdx, color);
          fIdx++;
        }
        i++;
      }
    }
    stakes.instanceMatrix.needsUpdate = true;
    bushes.instanceMatrix.needsUpdate = true;
    if (bushes.instanceColor) bushes.instanceColor.needsUpdate = true;
    fruits.instanceMatrix.needsUpdate = true;
    if (fruits.instanceColor) fruits.instanceColor.needsUpdate = true;
  }, [tomatoStage]);

  // 5. PUMPKINS (12 ribbed orange pumpkins on vines)
  const pumpkinStage = cropStages['pumpkins'] ?? 'harvest';
  useEffect(() => {
    const leaves = pumpkinLeafRef.current;
    const pumpkins = pumpkinFruitRef.current;
    if (!leaves || !pumpkins) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const hScale = stageHeightScale(pumpkinStage);
    const showFruit = pumpkinStage === 'flowering' || pumpkinStage === 'harvest';

    let i = 0;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        const x = (c - 1.5) * 0.95 + (r % 2) * 0.18;
        const z = (r - 1) * 1.02;
        dummy.position.set(x - 0.18, 0.16, z + 0.12);
        dummy.rotation.set(0, i * 1.1, 0);
        dummy.scale.set(hScale * 0.95, hScale * 0.55, hScale * 0.95);
        dummy.updateMatrix();
        leaves.setMatrixAt(i, dummy.matrix);
        color.set('#3E8E3A');
        leaves.setColorAt(i, color);

        if (showFruit) {
          const pScale = pumpkinStage === 'harvest' ? 1.0 : 0.55;
          dummy.position.set(x + 0.12, 0.26 * pScale, z);
          dummy.rotation.set(0, i * 0.7, 0);
          dummy.scale.set(pScale * 1.15, pScale * 0.85, pScale * 1.15);
        } else {
          dummy.scale.setScalar(0.001);
        }
        dummy.updateMatrix();
        pumpkins.setMatrixAt(i, dummy.matrix);
        color.set(pumpkinStage === 'harvest' ? '#F97316' : '#FACC15');
        pumpkins.setColorAt(i, color);
        i++;
      }
    }
    leaves.instanceMatrix.needsUpdate = true;
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
    pumpkins.instanceMatrix.needsUpdate = true;
    if (pumpkins.instanceColor) pumpkins.instanceColor.needsUpdate = true;
  }, [pumpkinStage]);

  // 6. CARROTS (35 feathery tops in rows)
  const carrotStage = cropStages['carrots'] ?? 'harvest';
  useEffect(() => {
    const tops = carrotTopRef.current;
    if (!tops) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const hScale = stageHeightScale(carrotStage);
    let i = 0;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 7; c++) {
        const x = (c - 3) * 0.48;
        const z = (r - 2) * 0.54;
        dummy.position.set(x, 0.24 * hScale, z);
        dummy.rotation.set(0, i * 0.8, 0);
        dummy.scale.set(0.85 * hScale, hScale, 0.85 * hScale);
        dummy.updateMatrix();
        tops.setMatrixAt(i, dummy.matrix);
        color.set(carrotStage === 'seed' ? '#7A5434' : '#4ADE80');
        tops.setColorAt(i, color);
        i++;
      }
    }
    tops.instanceMatrix.needsUpdate = true;
    if (tops.instanceColor) tops.instanceColor.needsUpdate = true;
  }, [carrotStage]);

  // 7. LAVENDER (24 aromatic mounds with purple flower spikes)
  const lavenderStage = cropStages['lavender'] ?? 'flowering';
  useEffect(() => {
    const bushes = lavenderBushRef.current;
    const spikes = lavenderSpikeRef.current;
    if (!bushes || !spikes) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const hScale = stageHeightScale(lavenderStage);
    const showSpikes = lavenderStage === 'flowering' || lavenderStage === 'harvest';
    let i = 0;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 6; c++) {
        const x = (c - 2.5) * 0.56;
        const z = (r - 1.5) * 0.64;
        dummy.position.set(x, 0.18 * hScale, z);
        dummy.scale.setScalar(0.85 * hScale);
        dummy.updateMatrix();
        bushes.setMatrixAt(i, dummy.matrix);
        color.set('#6E9B77'); // Silvery-green foliage
        bushes.setColorAt(i, color);

        if (showSpikes) {
          dummy.position.set(x, 0.42 * hScale, z);
          dummy.scale.set(0.8, hScale * 0.9, 0.8);
        } else {
          dummy.scale.setScalar(0.001);
        }
        dummy.updateMatrix();
        spikes.setMatrixAt(i, dummy.matrix);
        color.set(lavenderStage === 'harvest' ? '#7C3AED' : '#9333EA');
        spikes.setColorAt(i, color);
        i++;
      }
    }
    bushes.instanceMatrix.needsUpdate = true;
    if (bushes.instanceColor) bushes.instanceColor.needsUpdate = true;
    spikes.instanceMatrix.needsUpdate = true;
    if (spikes.instanceColor) spikes.instanceColor.needsUpdate = true;
  }, [lavenderStage]);

  // 8. STRAWBERRIES (24 low bushes + berries)
  const strawStage = cropStages['strawberries'] ?? 'harvest';
  useEffect(() => {
    const leaves = strawLeafRef.current;
    const berries = strawBerryRef.current;
    if (!leaves || !berries) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const hScale = stageHeightScale(strawStage);
    const showFruit = strawStage === 'flowering' || strawStage === 'harvest';
    let i = 0;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 6; c++) {
        const x = (c - 2.5) * 0.55;
        const z = (r - 1.5) * 0.62;
        dummy.position.set(x, 0.14 * hScale, z);
        dummy.scale.set(1.0 * hScale, 0.6 * hScale, 1.0 * hScale);
        dummy.updateMatrix();
        leaves.setMatrixAt(i, dummy.matrix);
        color.set('#388E3C');
        leaves.setColorAt(i, color);

        if (showFruit) {
          dummy.position.set(x + 0.1, 0.18, z + 0.1);
          dummy.scale.setScalar(strawStage === 'harvest' ? 1.0 : 0.65);
        } else {
          dummy.scale.setScalar(0.001);
        }
        dummy.updateMatrix();
        berries.setMatrixAt(i, dummy.matrix);
        color.set(strawStage === 'harvest' ? '#F43F5E' : '#FFFFFF');
        berries.setColorAt(i, color);
        i++;
      }
    }
    leaves.instanceMatrix.needsUpdate = true;
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
    berries.instanceMatrix.needsUpdate = true;
    if (berries.instanceColor) berries.instanceColor.needsUpdate = true;
  }, [strawStage]);

  // 9. RICE PADDY (72 flooded tufts)
  const riceStage = cropStages['rice'] ?? 'vegetative';
  useEffect(() => {
    const tufts = riceTuftRef.current;
    if (!tufts) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const hScale = stageHeightScale(riceStage);
    let i = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 9; c++) {
        const x = (c - 4) * 0.44;
        const z = (r - 3.5) * 0.42;
        dummy.position.set(x, 0.24 * hScale + 0.08, z);
        dummy.rotation.set(0, i * 0.6, 0);
        dummy.scale.set(0.85, hScale, 0.85);
        dummy.updateMatrix();
        tufts.setMatrixAt(i, dummy.matrix);
        color.set(riceStage === 'harvest' ? '#D4B44A' : riceStage === 'flowering' ? '#95C656' : '#43A047');
        tufts.setColorAt(i, color);
        i++;
      }
    }
    tufts.instanceMatrix.needsUpdate = true;
    if (tufts.instanceColor) tufts.instanceColor.needsUpdate = true;
  }, [riceStage]);

  const cornT = FARM_TARGETS_3D['corn-row'];
  const wheatT = FARM_TARGETS_3D['wheat-patch'];
  const sunT = FARM_TARGETS_3D['sunflowers'];
  const tomatoT = FARM_TARGETS_3D['tomatoes'];
  const pumpkinT = FARM_TARGETS_3D['pumpkin-patch'];
  const carrotT = FARM_TARGETS_3D['carrot-rows'];
  const lavT = FARM_TARGETS_3D['lavender'];
  const strawT = FARM_TARGETS_3D['strawberries'];
  const riceT = FARM_TARGETS_3D['rice-paddy'];

  return (
    <group>
      {/* CORN */}
      <Selectable
        id="corn-row"
        label="Maize (Corn)"
        emoji="🌽"
        position={cornT.position}
        ringRadius={cornT.highlightRadius}
        labelOffsetY={cornT.labelOffsetY}
        selectedId={selectedId}
        focusedId={focusedId}
        showAll={showAll}
        isTouchDevice={isTouchDevice}
        reducedMotion={reducedMotion}
        onSelect={onSelect}
      >
        <instancedMesh ref={cornStalkRef} args={[undefined, undefined, 56]} material={cornMat} castShadow>
          <cylinderGeometry args={[0.04, 0.08, 1.0, 6]} />
        </instancedMesh>
        <instancedMesh ref={cornCobRef} args={[undefined, undefined, 56]} castShadow>
          <capsuleGeometry args={[0.065, 0.22, 4, 6]} />
          <meshStandardMaterial color="#FACC15" roughness={0.6} />
        </instancedMesh>
      </Selectable>

      {/* WHEAT */}
      <Selectable
        id="wheat-patch"
        label="Winter Wheat"
        emoji="🌾"
        position={wheatT.position}
        ringRadius={wheatT.highlightRadius}
        labelOffsetY={wheatT.labelOffsetY}
        selectedId={selectedId}
        focusedId={focusedId}
        showAll={showAll}
        isTouchDevice={isTouchDevice}
        reducedMotion={reducedMotion}
        onSelect={onSelect}
      >
        <instancedMesh ref={wheatRef} args={[undefined, undefined, 180]} material={wheatMat} castShadow>
          <coneGeometry args={[0.075, 1.0, 5]} />
        </instancedMesh>
      </Selectable>

      {/* SUNFLOWERS */}
      <Selectable
        id="sunflowers"
        label="Sunflowers"
        emoji="🌻"
        position={sunT.position}
        ringRadius={sunT.highlightRadius}
        labelOffsetY={sunT.labelOffsetY}
        selectedId={selectedId}
        focusedId={focusedId}
        showAll={showAll}
        isTouchDevice={isTouchDevice}
        reducedMotion={reducedMotion}
        onSelect={onSelect}
      >
        <instancedMesh ref={sunflowerStalkRef} args={[undefined, undefined, sunflowerGrid.length]} material={sunStemMat} castShadow>
          <cylinderGeometry args={[0.035, 0.055, 1.0, 6]} />
        </instancedMesh>
        <group ref={sunflowerHeadGroupRef}>
          {sunflowerGrid.map(([x, baseH, z], i) => {
            const h = baseH * stageHeightScale(sunflowerStage);
            const showFlower = sunflowerStage === 'vegetative' || sunflowerStage === 'flowering' || sunflowerStage === 'harvest';
            if (!showFlower) return null;
            const headScale = sunflowerStage === 'vegetative' ? 0.45 : 1.0;
            return (
              <group key={i} position={[x, h, z]} scale={headScale}>
                <mesh castShadow>
                  <cylinderGeometry args={[0.25, 0.25, 0.06, 10]} />
                  <meshStandardMaterial color="#FACC15" roughness={0.65} />
                </mesh>
                <mesh position={[0, 0.04, 0]}>
                  <cylinderGeometry args={[0.14, 0.14, 0.04, 10]} />
                  <meshStandardMaterial color="#4B2E19" roughness={0.9} />
                </mesh>
              </group>
            );
          })}
        </group>
      </Selectable>

      {/* TOMATOES */}
      <Selectable
        id="tomatoes"
        label="Heirloom Tomatoes"
        emoji="🍅"
        position={tomatoT.position}
        ringRadius={tomatoT.highlightRadius}
        labelOffsetY={tomatoT.labelOffsetY}
        selectedId={selectedId}
        focusedId={focusedId}
        showAll={showAll}
        isTouchDevice={isTouchDevice}
        reducedMotion={reducedMotion}
        onSelect={onSelect}
      >
        <instancedMesh ref={tomatoStakeRef} args={[undefined, undefined, 16]} castShadow>
          <cylinderGeometry args={[0.028, 0.032, 1.3, 5]} />
          <meshStandardMaterial color="#8B5E3C" roughness={0.9} />
        </instancedMesh>
        <instancedMesh ref={tomatoBushRef} args={[undefined, undefined, 16]} material={genericFoliageMat} castShadow>
          <dodecahedronGeometry args={[0.42, 0]} />
        </instancedMesh>
        <instancedMesh ref={tomatoFruitRef} args={[undefined, undefined, 48]} castShadow>
          <sphereGeometry args={[0.09, 8, 8]} />
          <meshStandardMaterial roughness={0.45} />
        </instancedMesh>
      </Selectable>

      {/* PUMPKINS */}
      <Selectable
        id="pumpkin-patch"
        label="Farm Pumpkins"
        emoji="🎃"
        position={pumpkinT.position}
        ringRadius={pumpkinT.highlightRadius}
        labelOffsetY={pumpkinT.labelOffsetY}
        selectedId={selectedId}
        focusedId={focusedId}
        showAll={showAll}
        isTouchDevice={isTouchDevice}
        reducedMotion={reducedMotion}
        onSelect={onSelect}
      >
        <instancedMesh ref={pumpkinLeafRef} args={[undefined, undefined, 12]} material={genericFoliageMat} castShadow>
          <dodecahedronGeometry args={[0.38, 0]} />
        </instancedMesh>
        <instancedMesh ref={pumpkinFruitRef} args={[undefined, undefined, 12]} castShadow>
          <sphereGeometry args={[0.3, 10, 8]} />
          <meshStandardMaterial roughness={0.62} />
        </instancedMesh>
      </Selectable>

      {/* CARROTS */}
      <Selectable
        id="carrot-rows"
        label="Nantes Carrot Rows"
        emoji="🥕"
        position={carrotT.position}
        ringRadius={carrotT.highlightRadius}
        labelOffsetY={carrotT.labelOffsetY}
        selectedId={selectedId}
        focusedId={focusedId}
        showAll={showAll}
        isTouchDevice={isTouchDevice}
        reducedMotion={reducedMotion}
        onSelect={onSelect}
      >
        <instancedMesh ref={carrotTopRef} args={[undefined, undefined, 35]} material={genericFoliageMat} castShadow>
          <coneGeometry args={[0.16, 0.48, 6]} />
        </instancedMesh>
      </Selectable>

      {/* LAVENDER */}
      <Selectable
        id="lavender"
        label="English Lavender"
        emoji="🪻"
        position={lavT.position}
        ringRadius={lavT.highlightRadius}
        labelOffsetY={lavT.labelOffsetY}
        selectedId={selectedId}
        focusedId={focusedId}
        showAll={showAll}
        isTouchDevice={isTouchDevice}
        reducedMotion={reducedMotion}
        onSelect={onSelect}
      >
        <instancedMesh ref={lavenderBushRef} args={[undefined, undefined, 24]} material={genericFoliageMat} castShadow>
          <dodecahedronGeometry args={[0.26, 0]} />
        </instancedMesh>
        <instancedMesh ref={lavenderSpikeRef} args={[undefined, undefined, 24]} material={genericFoliageMat} castShadow>
          <coneGeometry args={[0.12, 0.36, 5]} />
        </instancedMesh>
      </Selectable>

      {/* STRAWBERRIES */}
      <Selectable
        id="strawberries"
        label="Garden Strawberries"
        emoji="🍓"
        position={strawT.position}
        ringRadius={strawT.highlightRadius}
        labelOffsetY={strawT.labelOffsetY}
        selectedId={selectedId}
        focusedId={focusedId}
        showAll={showAll}
        isTouchDevice={isTouchDevice}
        reducedMotion={reducedMotion}
        onSelect={onSelect}
      >
        <instancedMesh ref={strawLeafRef} args={[undefined, undefined, 24]} material={genericFoliageMat} castShadow>
          <dodecahedronGeometry args={[0.25, 0]} />
        </instancedMesh>
        <instancedMesh ref={strawBerryRef} args={[undefined, undefined, 24]} castShadow>
          <sphereGeometry args={[0.075, 7, 7]} />
          <meshStandardMaterial roughness={0.45} />
        </instancedMesh>
      </Selectable>

      {/* RICE PADDY (Flooded terrace near pond) */}
      <Selectable
        id="rice-paddy"
        label="Rice Paddy Terrace"
        emoji="🌾"
        position={riceT.position}
        ringRadius={riceT.highlightRadius}
        labelOffsetY={riceT.labelOffsetY}
        selectedId={selectedId}
        focusedId={focusedId}
        showAll={showAll}
        isTouchDevice={isTouchDevice}
        reducedMotion={reducedMotion}
        onSelect={onSelect}
      >
        {/* Flooded shimmering paddy water */}
        <mesh position={[0, 0.14, 0]} rotation={[-Math.PI / 2, 0, 0]} material={paddyWaterMat}>
          <planeGeometry args={[4.4, 3.6]} />
        </mesh>
        <instancedMesh ref={riceTuftRef} args={[undefined, undefined, 72]} material={genericFoliageMat} castShadow>
          <coneGeometry args={[0.09, 0.56, 5]} />
        </instancedMesh>
      </Selectable>
    </group>
  );
};
