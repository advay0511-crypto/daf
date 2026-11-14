import React, { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { FARM_TARGETS_3D } from './worldMath';

interface CameraRigProps {
  selectedId: string | null;
  reducedMotion: boolean;
}

const OVERVIEW_POS = new THREE.Vector3(0.5, 13.5, 22.8);
const OVERVIEW_TARGET = new THREE.Vector3(0.0, 0.9, -1.5);
const INTRO_START_POS = new THREE.Vector3(-4.0, 26.0, 40.0);

export const CameraRig: React.FC<CameraRigProps> = ({ selectedId, reducedMotion }) => {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const { camera } = useThree();

  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const idleTimerRef = useRef<number | null>(null);

  // Intro swoop state (2.5s down from the clouds)
  const introStartRef = useRef<number | null>(reducedMotion ? null : performance.now());

  // Target transition animation (~800ms fly-to or return to overview)
  const flyRef = useRef<{
    active: boolean;
    startTime: number;
    duration: number;
    fromPos: THREE.Vector3;
    toPos: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
  }>({
    active: false,
    startTime: 0,
    duration: 820,
    fromPos: new THREE.Vector3(),
    toPos: new THREE.Vector3(),
    fromTarget: new THREE.Vector3(),
    toTarget: new THREE.Vector3(),
  });

  const prevSelectedRef = useRef<string | null>(null);

  // Position camera up in clouds on mount if motion is allowed
  useEffect(() => {
    if (reducedMotion) {
      camera.position.copy(OVERVIEW_POS);
      if (controlsRef.current) {
        controlsRef.current.target.copy(OVERVIEW_TARGET);
        controlsRef.current.update();
      }
    } else {
      camera.position.copy(INTRO_START_POS);
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 4.5, -4);
        controlsRef.current.update();
      }
    }
    return () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, [camera, reducedMotion]);

  // Trigger fly-to when selectedId changes
  useEffect(() => {
    if (prevSelectedRef.current === selectedId) return;
    prevSelectedRef.current = selectedId;

    // Cancel intro swoop if user picks a plant immediately
    introStartRef.current = null;

    const currentTarget = controlsRef.current
      ? controlsRef.current.target.clone()
      : OVERVIEW_TARGET.clone();

    if (selectedId && FARM_TARGETS_3D[selectedId]) {
      const t = FARM_TARGETS_3D[selectedId];
      const nextPos = new THREE.Vector3(...t.cameraPos);
      const nextTarget = new THREE.Vector3(...t.cameraTarget);

      if (reducedMotion) {
        camera.position.copy(nextPos);
        if (controlsRef.current) {
          controlsRef.current.target.copy(nextTarget);
          controlsRef.current.update();
        }
        return;
      }

      flyRef.current = {
        active: true,
        startTime: performance.now(),
        duration: 820,
        fromPos: camera.position.clone(),
        toPos: nextPos,
        fromTarget: currentTarget,
        toTarget: nextTarget,
      };
    } else {
      if (reducedMotion) {
        camera.position.copy(OVERVIEW_POS);
        if (controlsRef.current) {
          controlsRef.current.target.copy(OVERVIEW_TARGET);
          controlsRef.current.update();
        }
        return;
      }

      flyRef.current = {
        active: true,
        startTime: performance.now(),
        duration: 800,
        fromPos: camera.position.clone(),
        toPos: OVERVIEW_POS.clone(),
        fromTarget: currentTarget,
        toTarget: OVERVIEW_TARGET.clone(),
      };
    }
  }, [selectedId, camera, reducedMotion]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    // 2.5s Cloud-to-Valley Intro Swoop
    if (introStartRef.current !== null && !reducedMotion) {
      const elapsed = (performance.now() - introStartRef.current) / 2500;
      if (elapsed >= 1) {
        camera.position.copy(OVERVIEW_POS);
        controls.target.copy(OVERVIEW_TARGET);
        introStartRef.current = null;
      } else {
        const ease = 1 - Math.pow(1 - elapsed, 3);
        camera.position.lerpVectors(INTRO_START_POS, OVERVIEW_POS, ease);
        controls.target.lerpVectors(new THREE.Vector3(0, 4.5, -4), OVERVIEW_TARGET, ease);
      }
      controls.update();
      return;
    }

    // Smooth ~800ms Plant Fly-To
    if (flyRef.current.active) {
      const t = Math.min(1, (performance.now() - flyRef.current.startTime) / flyRef.current.duration);
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      camera.position.lerpVectors(flyRef.current.fromPos, flyRef.current.toPos, ease);
      controls.target.lerpVectors(flyRef.current.fromTarget, flyRef.current.toTarget, ease);
      controls.update();
      if (t >= 1) flyRef.current.active = false;
    }
  });

  const handleInteractionStart = () => {
    introStartRef.current = null;
    flyRef.current.active = false;
    setIsUserInteracting(true);
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
  };

  const handleInteractionEnd = () => {
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      setIsUserInteracting(false);
    }, 4500);
  };

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping={!reducedMotion}
      dampingFactor={0.06}
      rotateSpeed={0.65}
      zoomSpeed={0.8}
      panSpeed={0.65}
      minDistance={5.5}
      maxDistance={36}
      minPolarAngle={0.22}
      maxPolarAngle={Math.PI / 2 - 0.14}
      autoRotate={!reducedMotion && !isUserInteracting && !selectedId && introStartRef.current === null}
      autoRotateSpeed={0.35}
      onStart={handleInteractionStart}
      onEnd={handleInteractionEnd}
    />
  );
};
