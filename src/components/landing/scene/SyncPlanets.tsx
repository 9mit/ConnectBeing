"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import type { MutableRefObject } from "react";
import type { MotionValue } from "framer-motion";

export function SyncPlanets({
  progressRef,
  mouse,
}: {
  progressRef: MutableRefObject<number>;
  mouse: MotionValue<{ x: number; y: number }>;
}) {
  const planetA = useRef<THREE.Mesh>(null);
  const planetB = useRef<THREE.Mesh>(null);
  const trailMesh = useRef<THREE.Line>(null);

  // Physics state for Planet B (orbiting Planet A)
  const posB = useRef(new THREE.Vector3(1.3, 0, 0));
  const velB = useRef(new THREE.Vector3(0, 1.8, 0.2));

  // Circular buffer for the glowing orbital trail (60 points)
  const trailPointsCount = 60;
  const trailPositions = useMemo(() => new Float32Array(trailPointsCount * 3), []);
  const trailGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(trailPositions, 3));
    return g;
  }, [trailPositions]);

  // Instantiate Three.js Line object directly to avoid React SVG tag namespace clash
  const trailLine = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({
      color: "#a0bfff",
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return new THREE.Line(trailGeo, mat);
  }, [trailGeo]);

  useFrame((_, delta) => {
    const p = progressRef.current;
    
    // Chapter 3 active range: 0.42 to 0.62
    const local = THREE.MathUtils.clamp((p - 0.42) / 0.16, 0, 1);
    const fade = p < 0.4 ? 0 : p > 0.62 ? Math.max(0, 1 - (p - 0.62) / 0.06) : local;
    
    const dt = Math.min(delta, 0.04);

    const m = mouse.get();
    // Position of Planet A follows the cursor smoothly
    const targetX = (m.x - 0.5) * 2.8;
    const targetY = (m.y - 0.5) * 1.8;
    const targetZ = Math.sin(performance.now() * 0.0008) * 0.4;

    if (planetA.current) {
      planetA.current.position.x = THREE.MathUtils.damp(planetA.current.position.x, targetX, 3.8, dt);
      planetA.current.position.y = THREE.MathUtils.damp(planetA.current.position.y, targetY, 3.8, dt);
      planetA.current.position.z = THREE.MathUtils.damp(planetA.current.position.z, targetZ, 3.8, dt);
      
      const mat = planetA.current.material as THREE.MeshStandardMaterial;
      mat.opacity = fade;
      planetA.current.scale.setScalar(0.24 + Math.sin(performance.now() * 0.0008) * 0.015);
    }

    // 2. Gravitational Physics Integration for Planet B
    const posA = planetA.current?.position ?? new THREE.Vector3();
    
    // Vector pointing from B to A
    const gravityVec = new THREE.Vector3().subVectors(posA, posB.current);
    const distSq = gravityVec.lengthSq() + 0.12; // epsilon to avoid singularity
    
    // F = G * m1 * m2 / r^2. Let G=0.35
    const forceMagnitude = 0.35 / distSq;
    const acceleration = gravityVec.normalize().multiplyScalar(forceMagnitude);

    // Apply central pull to ensure Planet B doesn't escape the viewport completely
    const centerPull = new THREE.Vector3(0, 0, 0).sub(posB.current).multiplyScalar(0.12);
    acceleration.add(centerPull);

    // Update velocity and position (Euler integration)
    velB.current.addScaledVector(acceleration, dt);
    
    // Small velocity dampening/drag to maintain orbital stability
    velB.current.multiplyScalar(0.99); 
    posB.current.addScaledVector(velB.current, dt);

    if (planetB.current) {
      planetB.current.position.copy(posB.current);
      const mat = planetB.current.material as THREE.MeshStandardMaterial;
      mat.opacity = fade;
      planetB.current.scale.setScalar(0.16 + Math.cos(performance.now() * 0.001) * 0.012);
    }

    // 3. Update the Orbital Trail Line
    // Shift positions array to make room for new point
    for (let i = trailPointsCount - 1; i > 0; i--) {
      trailPositions[i * 3] = trailPositions[(i - 1) * 3]!;
      trailPositions[i * 3 + 1] = trailPositions[(i - 1) * 3 + 1]!;
      trailPositions[i * 3 + 2] = trailPositions[(i - 1) * 3 + 2]!;
    }
    // Set first point to Planet B's current position
    trailPositions[0] = posB.current.x;
    trailPositions[1] = posB.current.y;
    trailPositions[2] = posB.current.z;

    const trailPosAttr = trailGeo.getAttribute("position") as THREE.BufferAttribute;
    trailPosAttr.needsUpdate = true;

    if (trailMesh.current) {
      const mat = trailMesh.current.material as THREE.LineBasicMaterial;
      mat.opacity = fade * 0.32;
    }
  });

  return (
    <group>
      {/* Light Source for standards materials */}
      <ambientLight intensity={0.65} />
      <pointLight position={[3, 3, 5]} intensity={1.5} color="#fffcf0" />
      
      {/* Planet A: User Controlled (Warm Sun Rose Glow) */}
      <mesh ref={planetA}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial
          color="#ff7b60"
          emissive="#aa3020"
          emissiveIntensity={0.65}
          transparent
          opacity={0}
          roughness={0.3}
          metalness={0.2}
        />
      </mesh>

      {/* Planet B: Gravitational Orbiting (Cool Blue Orbit Glow) */}
      <mesh ref={planetB}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial
          color="#60a8ff"
          emissive="#2040aa"
          emissiveIntensity={0.65}
          transparent
          opacity={0}
          roughness={0.3}
          metalness={0.2}
        />
      </mesh>

      {/* Glowing Orbital Trail Ribbon */}
      <primitive object={trailLine} ref={trailMesh} />
    </group>
  );
}
