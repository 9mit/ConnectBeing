"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import type { MutableRefObject } from "react";
import type { MotionValue } from "framer-motion";

function hash(i: number) {
  return (Math.sin(i * 91.17) * 43758.5453) % 1;
}

export function MemoryFragments({
  progressRef,
  mouse,
  count,
}: {
  progressRef: MutableRefObject<number>;
  mouse: MotionValue<{ x: number; y: number }>;
  count: number;
}) {
  const meshesRef = useRef<THREE.Points[]>([]);

  // Build the particle positions for each memory fragment
  const fragments = useMemo(() => {
    return Array.from({ length: count }, (_, idx) => {
      // General fragment properties
      const x = (hash(idx) - 0.5) * 8.5;
      const y = (hash(idx + 2) - 0.5) * 5.0;
      const z = -1.5 - hash(idx + 3) * 3.5;
      const speed = 0.12 + hash(idx + 4) * 0.28;
      const phase = hash(idx + 5) * Math.PI * 2;
      const kind = idx % 3; // 0 = Letter, 1 = Audio Wave, 2 = Reflection Frame

      // 45 particles per fragment to form shapes/dust
      const pCount = 45;
      const basePos = new Float32Array(pCount * 3);
      const dustPos = new Float32Array(pCount * 3);

      for (let i = 0; i < pCount; i++) {
        // Assembled base shape positions
        if (kind === 0) {
          // 1. Letters (simulating cursive curves/letter lines)
          const t = i / pCount;
          // Loop curves representing letters
          basePos[i * 3] = Math.sin(t * Math.PI * 2.5) * 0.35;
          basePos[i * 3 + 1] = (t - 0.5) * 0.8 + Math.cos(t * Math.PI * 2.0) * 0.12;
          basePos[i * 3 + 2] = 0;
        } else if (kind === 1) {
          // 2. Audio Waveforms (sine wave lines)
          const t = (i / pCount) - 0.5; // -0.5 to 0.5
          basePos[i * 3] = t * 1.0;
          // Dampen sine wave at ends
          const envelope = Math.cos(t * Math.PI);
          basePos[i * 3 + 1] = Math.sin(t * Math.PI * 9.0) * 0.22 * envelope;
          basePos[i * 3 + 2] = 0;
        } else {
          // 3. Floating Reflection Frames (delicate boxes)
          const side = i % 4;
          const t = (i % (pCount / 4)) / (pCount / 4) - 0.5;
          if (side === 0) { // Top
            basePos[i * 3] = t * 0.8;
            basePos[i * 3 + 1] = 0.4;
          } else if (side === 1) { // Bottom
            basePos[i * 3] = t * 0.8;
            basePos[i * 3 + 1] = -0.4;
          } else if (side === 2) { // Left
            basePos[i * 3] = -0.4;
            basePos[i * 3 + 1] = t * 0.8;
          } else { // Right
            basePos[i * 3] = 0.4;
            basePos[i * 3 + 1] = t * 0.8;
          }
          basePos[i * 3 + 2] = 0;
        }

        // Random dispersed dust positions
        const angle = Math.random() * Math.PI * 2;
        const radius = 0.45 + Math.random() * 0.85; // Dispersed radius
        dustPos[i * 3] = Math.cos(angle) * radius + (Math.random() - 0.5) * 0.2;
        dustPos[i * 3 + 1] = Math.sin(angle) * radius + (Math.random() - 0.5) * 0.2;
        dustPos[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
      }

      // Buffer attributes
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pCount * 3), 3));

      // Color mapping
      let color = "#e8d8c8"; // soft warm gold/paper
      if (kind === 1) color = "#dcd2ff"; // soft violet
      if (kind === 2) color = "#ffd8d2"; // soft rose

      return { x, y, z, speed, phase, kind, basePos, dustPos, geo, color };
    });
  }, [count]);

  useFrame((state) => {
    const p = progressRef.current;
    
    // Chapter 2 range: 0.25 to 0.48
    const local = THREE.MathUtils.clamp((p - 0.25) / 0.18, 0, 1);
    const fade = p < 0.22 ? 0 : p > 0.48 ? Math.max(0, 1 - (p - 0.48) / 0.08) : local;

    const m = mouse.get();
    // Translate mouse 0..1 to screen coordinates
    const mx = (m.x - 0.5) * 8.0;
    const my = (m.y - 0.5) * 5.0;

    fragments.forEach((frag, idx) => {
      const points = meshesRef.current[idx];
      if (!points) return;

      const t = state.clock.elapsedTime * frag.speed + frag.phase;
      
      // Floating motion
      const fx = frag.x + Math.sin(t) * 0.35;
      const fy = frag.y + Math.cos(t * 0.7) * 0.25;

      // Distance from cursor to fragment center
      const dx = fx - mx;
      const dy = fy - my;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Assembly factor: 1.0 (fully assembled) close to mouse, 0.0 (dispersed) far away
      const assembly = THREE.MathUtils.clamp(1.0 - dist / 1.7, 0, 1);

      // Update positions buffer
      const posAttr = frag.geo.getAttribute("position") as THREE.BufferAttribute;
      const positions = posAttr.array as Float32Array;

      for (let i = 0; i < 45; i++) {
        // Interpolate individual particles between dust and shape
        const bx = frag.basePos[i * 3]!;
        const by = frag.basePos[i * 3 + 1]!;
        const bz = frag.basePos[i * 3 + 2]!;

        const dxVal = frag.dustPos[i * 3]!;
        const dyVal = frag.dustPos[i * 3 + 1]!;
        const dzVal = frag.dustPos[i * 3 + 2]!;

        // Lerp
        positions[i * 3] = THREE.MathUtils.lerp(dxVal, bx, assembly);
        positions[i * 3 + 1] = THREE.MathUtils.lerp(dyVal, by, assembly);
        positions[i * 3 + 2] = THREE.MathUtils.lerp(dzVal, bz, assembly);
      }
      posAttr.needsUpdate = true;

      // Positioning fragment group
      points.position.set(fx, fy, frag.z);
      points.rotation.z = t * 0.1;
      points.rotation.y = Math.sin(t * 0.2) * 0.2;

      // Interactive material adjustments: glow brighter and grow sizes when assembled
      const mat = points.material as THREE.PointsMaterial;
      mat.opacity = fade * (0.35 + assembly * 0.55);
      mat.size = 0.02 + assembly * 0.025;
    });
  });

  return (
    <group>
      {fragments.map((frag, idx) => (
        <points
          key={idx}
          ref={(el) => {
            if (el) meshesRef.current[idx] = el;
          }}
          geometry={frag.geo}
        >
          <pointsMaterial
            color={frag.color}
            transparent
            opacity={0}
            size={0.02}
            sizeAttenuation
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      ))}
    </group>
  );
}
