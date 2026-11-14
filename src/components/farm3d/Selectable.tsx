import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface SelectableProps {
  id: string;
  label: string;
  emoji: string;
  position: [number, number, number];
  ringRadius?: number;
  labelOffsetY?: number;
  selectedId: string | null;
  focusedId: string | null;
  showAll: boolean;
  isTouchDevice: boolean;
  reducedMotion: boolean;
  onSelect: (id: string) => void;
  children: React.ReactNode;
}

const SPARK_COUNT = 16;

export const Selectable: React.FC<SelectableProps> = ({
  id,
  label,
  emoji,
  position,
  ringRadius = 2.2,
  labelOffsetY = 2.2,
  selectedId,
  focusedId,
  showAll,
  isTouchDevice,
  reducedMotion,
  onSelect,
  children,
}) => {
  const [hovered, setHovered] = useState(false);
  const groupRef = useRef<THREE.Group | null>(null);
  const ringRef = useRef<THREE.Mesh | null>(null);
  const bounceStartRef = useRef<number | null>(null);
  const sparkStartRef = useRef<number | null>(null);
  const sparkRef = useRef<THREE.Points | null>(null);

  const isSelected = selectedId === id;
  const isFocused = focusedId === id;
  const showOutline = hovered || isSelected || isFocused || showAll;
  const showLabel = hovered || isFocused;

  // Sparkle burst geometry & initial velocity directions
  const { sparkGeo, sparkVelocities } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(SPARK_COUNT * 3);
    const velocities: [number, number, number][] = [];
    for (let i = 0; i < SPARK_COUNT; i++) {
      const a = (i / SPARK_COUNT) * Math.PI * 2;
      const spd = 1.1 + (i % 3) * 0.45;
      velocities.push([Math.cos(a) * spd, 1.8 + (i % 4) * 0.45, Math.sin(a) * spd]);
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0.6;
      positions[i * 3 + 2] = 0;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return { sparkGeo: geo, sparkVelocities: velocities };
  }, []);

  useEffect(() => {
    return () => {
      sparkGeo.dispose();
    };
  }, [sparkGeo]);

  useEffect(() => {
    if (hovered) {
      document.body.style.cursor = 'pointer';
    }
    return () => {
      if (hovered) document.body.style.cursor = 'auto';
    };
  }, [hovered]);

  const triggerFeedback = () => {
    if (!reducedMotion) {
      bounceStartRef.current = performance.now();
      sparkStartRef.current = performance.now();
    }
  };

  useEffect(() => {
    if (isSelected) {
      triggerFeedback();
    }
  }, [isSelected]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Spring bounce animation on click
    if (groupRef.current) {
      if (bounceStartRef.current !== null && !reducedMotion) {
        const dt = (performance.now() - bounceStartRef.current) / 1000;
        if (dt < 0.65) {
          const s = 1 + Math.sin(dt * Math.PI * 4.5) * Math.exp(-dt * 4.2) * 0.14;
          groupRef.current.scale.set(s, 1 + (s - 1) * 1.4, s);
        } else {
          groupRef.current.scale.set(1, 1, 1);
          bounceStartRef.current = null;
        }
      } else {
        groupRef.current.scale.set(1, 1, 1);
      }
    }

    // Glowing ground outline ring
    if (ringRef.current) {
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      if (showOutline) {
        const pulse = showAll ? 0.55 + Math.sin(t * 6.5) * 0.35 : isSelected ? 0.92 : 0.72;
        mat.opacity = pulse;
        const scalePulse = showAll ? 1 + Math.sin(t * 5.0) * 0.06 : 1;
        ringRef.current.scale.set(scalePulse, scalePulse, 1);
      } else {
        mat.opacity = 0;
      }
    }

    // Click sparkle burst particles
    if (sparkRef.current) {
      const mat = sparkRef.current.material as THREE.PointsMaterial;
      if (sparkStartRef.current !== null && !reducedMotion) {
        const dt = (performance.now() - sparkStartRef.current) / 1000;
        if (dt < 0.85) {
          sparkRef.current.visible = true;
          mat.opacity = Math.max(0, 1 - dt / 0.85);
          const posAttr = sparkGeo.attributes.position as THREE.BufferAttribute;
          for (let i = 0; i < SPARK_COUNT; i++) {
            const [vx, vy, vz] = sparkVelocities[i];
            posAttr.setXYZ(i, vx * dt, 0.55 + vy * dt - 1.6 * dt * dt, vz * dt);
          }
          posAttr.needsUpdate = true;
        } else {
          sparkRef.current.visible = false;
          sparkStartRef.current = null;
        }
      } else {
        sparkRef.current.visible = false;
      }
    }
  });

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
  };

  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(false);
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return; // Ignore camera orbit drags
    e.stopPropagation();
    triggerFeedback();
    onSelect(id);
  };

  return (
    <group
      ref={groupRef}
      position={position}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      {children}

      {/* Glowing white/emerald outline halo ring */}
      <mesh
        ref={ringRef}
        position={[0, 0.14, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        raycast={() => null}
      >
        <ringGeometry args={[ringRadius * 0.88, ringRadius, 40]} />
        <meshBasicMaterial
          color={isSelected ? '#4CC26E' : '#FFFFFF'}
          transparent
          opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Sparkle burst on click */}
      <points ref={sparkRef} geometry={sparkGeo} visible={false} raycast={() => null}>
        <pointsMaterial
          color="#FFF3A1"
          size={0.22}
          transparent
          opacity={0}
          depthWrite={false}
          sizeAttenuation
        />
      </points>

      {/* Mobile pulsing marker or Show All badge */}
      {(isTouchDevice || showAll) && !showLabel && (
        <Html
          position={[0, labelOffsetY * 0.72, 0]}
          center
          distanceFactor={20}
          style={{ pointerEvents: 'auto' }}
        >
          <button
            type="button"
            onClick={(ev) => {
              ev.stopPropagation();
              onSelect(id);
            }}
            aria-label={`Inspect ${label}`}
            className={`px-2 py-0.5 rounded-full text-[11px] font-medium shadow-md border border-[#CFE3C0] bg-white/90 text-[#1F2E1A] whitespace-nowrap cursor-pointer ${
              showAll ? 'animate-pulse ring-2 ring-[#2E9E4F]' : ''
            }`}
          >
            {emoji}
          </button>
        </Html>
      )}

      {/* Desktop Hover / Keyboard Focus floating tooltip */}
      {showLabel && (
        <Html
          position={[0, labelOffsetY, 0]}
          center
          distanceFactor={18}
          style={{ pointerEvents: 'none' }}
        >
          <div className="px-3 py-1 rounded-xl bg-[#1F2E1A]/92 text-[#F3F8EE] border border-[#CFE3C0]/50 shadow-xl text-xs font-medium whitespace-nowrap backdrop-blur-sm">
            <span>{emoji} {label}</span>
            <span className="text-[#86EFAC] ml-1.5">— click to explore</span>
          </div>
        </Html>
      )}
    </group>
  );
};
