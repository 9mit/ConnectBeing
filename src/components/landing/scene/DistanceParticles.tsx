"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import type { MutableRefObject } from "react";

export function DistanceParticles({
  progressRef,
}: {
  progressRef: MutableRefObject<number>;
}) {
  const a = useRef<THREE.Mesh>(null);
  const b = useRef<THREE.Mesh>(null);
  const gridMesh = useRef<THREE.Mesh>(null);

  // Position trackers for shader warping
  const posA = useRef(new THREE.Vector3());
  const posB = useRef(new THREE.Vector3());

  // Dynamic Spacetime Grid shader material
  const gridMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      wireframe: true, // Grid lines
      uniforms: {
        uPosA: { value: new THREE.Vector3() },
        uPosB: { value: new THREE.Vector3() },
        uOpacity: { value: 0 },
        uSep: { value: 3.2 },
      },
      vertexShader: `
        uniform vec3 uPosA;
        uniform vec3 uPosB;
        uniform float uSep;
        varying vec3 vWorldPosition;
        varying vec2 vUv;

        void main() {
          vUv = uv;
          vec3 pos = position;

          // Gravitational spacetime bending math
          // Vertices pull toward Star A and Star B along the Z axis
          float distA = distance(pos, uPosA);
          float distB = distance(pos, uPosB);

          // Force of gravity: G / (d^2 + epsilon)
          float gravityA = 0.14 / (distA * distA + 0.18);
          float gravityB = 0.14 / (distB * distB + 0.18);

          // Displace vertex position to create gravity wells
          pos.z -= (gravityA + gravityB) * 1.5;

          // Subtle stretch towards the other star
          vec3 dirA = normalize(uPosA - pos);
          vec3 dirB = normalize(uPosB - pos);
          pos += dirA * gravityA * 0.4;
          pos += dirB * gravityB * 0.4;

          vWorldPosition = pos;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        varying vec3 vWorldPosition;
        varying vec2 vUv;

        void main() {
          // Circular fadeout to prevent hard borders
          float distFromCenter = length(vUv - 0.5);
          float fade = smoothstep(0.5, 0.15, distFromCenter);

          // Glowing space-dust grid color (glowing indigo/blue)
          vec3 gridColor = mix(vec3(0.18, 0.35, 0.88), vec3(0.68, 0.42, 0.88), vUv.x);
          
          gl_FragColor = vec4(gridColor, uOpacity * fade * 0.45);
        }
      `,
    });
  }, []);

  useFrame((state) => {
    const p = progressRef.current;
    
    // Chapter 1 active range: 0.08 to 0.28
    const local = THREE.MathUtils.clamp((p - 0.08) / 0.2, 0, 1);
    const visible = p > 0.05 && p < 0.32 ? 1 : 0;
    
    const sep = THREE.MathUtils.lerp(3.2, 0.35, local);
    const opacity = visible * Math.sin(local * Math.PI); // Fades in & out beautifully

    const ax = -sep;
    const ay = Math.sin(state.clock.elapsedTime * 0.55) * 0.12;
    const bx = sep;
    const by = Math.cos(state.clock.elapsedTime * 0.5) * 0.12;

    posA.current.set(ax, ay, 0);
    posB.current.set(bx, by, 0);

    if (a.current) {
      a.current.position.copy(posA.current);
      (a.current.material as THREE.MeshBasicMaterial).opacity = opacity;
      a.current.scale.setScalar(0.12 + Math.sin(state.clock.elapsedTime * 1.5) * 0.01);
    }
    if (b.current) {
      b.current.position.copy(posB.current);
      (b.current.material as THREE.MeshBasicMaterial).opacity = opacity;
      b.current.scale.setScalar(0.1 + Math.cos(state.clock.elapsedTime * 1.6) * 0.008);
    }

    // Update spacetime grid uniforms
    gridMaterial.uniforms.uPosA.value.copy(posA.current);
    gridMaterial.uniforms.uPosB.value.copy(posB.current);
    gridMaterial.uniforms.uOpacity.value = opacity;
    gridMaterial.uniforms.uSep.value = sep;

    if (gridMesh.current) {
      gridMesh.current.position.set(0, 0, -0.4);
      (gridMesh.current.material as THREE.ShaderMaterial).uniforms = gridMaterial.uniforms;
    }
  });

  return (
    <group>
      {/* Space grid mesh background */}
      <mesh ref={gridMesh} material={gridMaterial}>
        <planeGeometry args={[10, 6, 45, 30]} />
      </mesh>

      {/* Two stars in separation */}
      <mesh ref={a}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color="#a0c8ff" transparent opacity={0} />
      </mesh>
      <mesh ref={b}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color="#ffb8a0" transparent opacity={0} />
      </mesh>
    </group>
  );
}
