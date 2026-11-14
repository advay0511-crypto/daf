import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  CROP_PLOTS,
  FARM_TARGETS_3D,
  POND_CENTER,
  getSoilRowTexture,
  groundHeightAt,
  pathDistance,
} from './worldMath';
import { Selectable } from './Selectable';

interface TerrainProps {
  drynessFactor: number; // 0 = lush green, 1 = golden dry summer
  rainFactor: number; // 0 = dry, 1 = wet puddle gloss
  selectedId: string | null;
  focusedId: string | null;
  showAll: boolean;
  isTouchDevice: boolean;
  reducedMotion: boolean;
  onSelect: (id: string) => void;
}

export const Terrain: React.FC<TerrainProps> = ({
  drynessFactor,
  rainFactor,
  selectedId,
  focusedId,
  showAll,
  isTouchDevice,
  reducedMotion,
  onSelect,
}) => {
  const soilTexture = useMemo(() => getSoilRowTexture(), []);
  const ridgePineRef = useRef<THREE.InstancedMesh | null>(null);
  const ridgeTrunkRef = useRef<THREE.InstancedMesh | null>(null);

  // Rolling valley terrain mesh with vertex colors (grass, path, pond bank, hillside sage)
  const terrainGeometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(92, 92, 112, 112);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);

    const lushGrass = new THREE.Color('#66A649');
    const pastureMeadow = new THREE.Color('#74B453');
    const dryMeadow = new THREE.Color('#B4A458');
    const hillsideGreen = new THREE.Color('#4B8642');
    const dirtPath = new THREE.Color('#C49A6C');
    const pondBank = new THREE.Color('#A98F67');
    const tmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = groundHeightAt(x, z);
      pos.setY(i, y);

      const dist = Math.hypot(x, z);
      const hillMix = Math.min(1, Math.max(0, (dist - 15) / 22));
      const patchNoise = 0.5 + 0.5 * Math.sin(x * 0.35 + z * 0.25);

      tmp.copy(lushGrass).lerp(pastureMeadow, patchNoise * 0.7);
      if (drynessFactor > 0.01) {
        tmp.lerp(dryMeadow, drynessFactor * 0.62);
      }
      tmp.lerp(hillsideGreen, hillMix * 0.65);

      // Blend dirt path through middle (skip pond & crop plots)
      const pDist = pathDistance(x, z);
      if (z > -20 && z < 24 && pDist < 1.35) {
        const pathAlpha = Math.max(0, 1 - Math.max(0, pDist - 0.65) / 0.7);
        tmp.lerp(dirtPath, pathAlpha * 0.92);
      }

      // Pond muddy/sandy rim
      const pondDist = Math.hypot((x - POND_CENTER.x) / POND_CENTER.rx, (z - POND_CENTER.z) / POND_CENTER.rz);
      if (pondDist < 1.28) {
        const bankAlpha = Math.max(0, 1 - Math.max(0, pondDist - 0.8) / 0.48);
        tmp.lerp(pondBank, bankAlpha * 0.85);
      }

      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, [drynessFactor]);

  useEffect(() => {
    return () => {
      terrainGeometry.dispose();
    };
  }, [terrainGeometry]);

  // 2-3 distant rings of forested hill conifers (low-poly instanced trees fading into fog)
  const ridgeTreeTransforms = useMemo(() => {
    const items: { x: number; y: number; z: number; scale: number; tint: number }[] = [];
    for (let i = 0; i < 165; i++) {
      // Seeded deterministic ring distribution around the valley rim
      const angle = (i / 165) * Math.PI * 2 + (i % 7) * 0.04;
      const ring = i % 3;
      const radius = 20.5 + ring * 5.8 + ((i * 19) % 5) * 0.9;
      // Leave open foreground camera corridor (+Z) slightly sparser
      const zBias = Math.sin(angle);
      if (zBias > 0.72 && radius < 26) continue;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius - 3.5;
      const y = groundHeightAt(x, z);
      const scale = 0.85 + ((i * 11) % 10) * 0.07;
      const tint = (i % 5) / 5;
      items.push({ x, y, z, scale, tint });
    }
    return items;
  }, []);

  useEffect(() => {
    const crownMesh = ridgePineRef.current;
    const trunkMesh = ridgeTrunkRef.current;
    if (!crownMesh || !trunkMesh) return;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const greens = ['#2C6B3F', '#347A47', '#245836', '#3D844C', '#2A633C'];

    ridgeTreeTransforms.forEach((item, idx) => {
      dummy.position.set(item.x, item.y + 1.55 * item.scale, item.z);
      dummy.rotation.set(0, idx * 0.8, 0);
      dummy.scale.setScalar(item.scale);
      dummy.updateMatrix();
      crownMesh.setMatrixAt(idx, dummy.matrix);

      color.set(greens[idx % greens.length]);
      crownMesh.setColorAt(idx, color);

      dummy.position.set(item.x, item.y + 0.45 * item.scale, item.z);
      dummy.scale.set(item.scale, item.scale, item.scale);
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(idx, dummy.matrix);
    });

    crownMesh.instanceMatrix.needsUpdate = true;
    if (crownMesh.instanceColor) crownMesh.instanceColor.needsUpdate = true;
    trunkMesh.instanceMatrix.needsUpdate = true;
  }, [ridgeTreeTransforms]);

  const forestTarget = FARM_TARGETS_3D['forest-hills'];

  return (
    <group>
      {/* Rolling valley ground plane */}
      <mesh geometry={terrainGeometry} receiveShadow>
        <meshStandardMaterial
          vertexColors
          roughness={rainFactor > 0.25 ? 0.38 : 0.92}
          metalness={rainFactor > 0.25 ? 0.12 : 0.0}
        />
      </mesh>

      {/* Flat plowed crop soil plots with visible soil rows */}
      {CROP_PLOTS.map((plot) => {
        const py = groundHeightAt(plot.cx, plot.cz);
        return (
          <group key={plot.id} position={[plot.cx, py, plot.cz]}>
            {/* Raised soil bed */}
            <mesh position={[0, 0.03, 0]} receiveShadow>
              <boxGeometry args={[plot.halfW * 2, 0.08, plot.halfD * 2]} />
              <meshStandardMaterial
                map={soilTexture}
                color={plot.isPaddy ? '#4C3B28' : '#8A613E'}
                roughness={0.94}
              />
            </mesh>
            {/* Dike earth rim (4 perimeter berm strips framing the flooded paddy) */}
            {plot.isPaddy && (
              <group>
                <mesh position={[0, 0.12, -plot.halfD - 0.06]} receiveShadow castShadow>
                  <boxGeometry args={[plot.halfW * 2 + 0.3, 0.2, 0.18]} />
                  <meshStandardMaterial color="#6D5037" roughness={0.95} />
                </mesh>
                <mesh position={[0, 0.12, plot.halfD + 0.06]} receiveShadow castShadow>
                  <boxGeometry args={[plot.halfW * 2 + 0.3, 0.2, 0.18]} />
                  <meshStandardMaterial color="#6D5037" roughness={0.95} />
                </mesh>
                <mesh position={[-plot.halfW - 0.06, 0.12, 0]} receiveShadow castShadow>
                  <boxGeometry args={[0.18, 0.2, plot.halfD * 2 + 0.14]} />
                  <meshStandardMaterial color="#6D5037" roughness={0.95} />
                </mesh>
                <mesh position={[plot.halfW + 0.06, 0.12, 0]} receiveShadow castShadow>
                  <boxGeometry args={[0.18, 0.2, plot.halfD * 2 + 0.14]} />
                  <meshStandardMaterial color="#6D5037" roughness={0.95} />
                </mesh>
              </group>
            )}
          </group>
        );
      })}

      {/* Distant forested hillside ridges (clickable Mixed Temperate Forest) */}
      <Selectable
        id="forest-hills"
        label="Mixed Temperate Forest"
        emoji="🌲"
        position={forestTarget.position}
        ringRadius={forestTarget.highlightRadius}
        labelOffsetY={forestTarget.labelOffsetY}
        selectedId={selectedId}
        focusedId={focusedId}
        showAll={showAll}
        isTouchDevice={isTouchDevice}
        reducedMotion={reducedMotion}
        onSelect={onSelect}
      >
        {/* Raycastable invisible ridge hit target for background forest */}
        <mesh position={[0, 1.5, 0]}>
          <boxGeometry args={[12, 4.5, 5]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
      </Selectable>

      <instancedMesh
        ref={ridgePineRef}
        args={[undefined, undefined, ridgeTreeTransforms.length]}
        castShadow
        receiveShadow
      >
        <coneGeometry args={[0.92, 2.5, 7]} />
        <meshStandardMaterial roughness={0.86} />
      </instancedMesh>

      <instancedMesh
        ref={ridgeTrunkRef}
        args={[undefined, undefined, ridgeTreeTransforms.length]}
        castShadow
      >
        <cylinderGeometry args={[0.16, 0.22, 1.0, 6]} />
        <meshStandardMaterial color="#6B4A31" roughness={0.92} />
      </instancedMesh>
    </group>
  );
};
