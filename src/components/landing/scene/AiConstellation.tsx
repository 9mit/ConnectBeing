"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import type { MutableRefObject } from "react";

export function AiConstellation({
  progressRef,
}: {
  progressRef: MutableRefObject<number>;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const localMouseRef = useRef(new THREE.Vector2());

  // Setup 16 ancient constellation stars
  const { positions, connections } = useMemo(() => {
    const nodesCount = 16;
    const positions = new Float32Array(nodesCount * 3);
    for (let i = 0; i < nodesCount; i += 1) {
      const a = (i / nodesCount) * Math.PI * 2;
      const r = 1.35 + (i % 3) * 0.45;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = Math.sin(a * 1.25) * 0.95;
      positions[i * 3 + 2] = Math.sin(a * 0.8) * 0.55;
    }

    // Connect nodes to neighbors to form ancient cosmic geometry
    const connections: number[] = [];
    for (let i = 0; i < nodesCount; i += 1) {
      const j = (i + 1) % nodesCount;
      const k = (i + 4) % nodesCount;
      const l = (i + 7) % nodesCount;
      connections.push(i, j, i, k, i, l);
    }
    return { positions, connections };
  }, []);

  const pointsGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);

  // Line geometry with dynamic color attribute for interactive glowing threads
  const lineGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(connections.length * 3);
    const cols = new Float32Array(connections.length * 4); // RGBA per vertex
    
    for (let i = 0; i < connections.length; i += 1) {
      const idx = connections[i]!;
      pos[i * 3] = positions[idx * 3]!;
      pos[i * 3 + 1] = positions[idx * 3 + 1]!;
      pos[i * 3 + 2] = positions[idx * 3 + 2]!;
      
      // Default color: dim indigo
      cols[i * 4] = 0.15;
      cols[i * 4 + 1] = 0.08;
      cols[i * 4 + 2] = 0.28;
      cols[i * 4 + 3] = 0.05;
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(cols, 4));
    return g;
  }, [positions, connections]);

  // Catch pointer coordinates from window events for Three.js space mapping
  useFrame((state, delta) => {
    const p = progressRef.current;
    
    // Active range: 0.55 to 0.74
    const local = THREE.MathUtils.clamp((p - 0.55) / 0.14, 0, 1);
    const fade = p < 0.52 ? 0 : p > 0.74 ? Math.max(0, 1 - (p - 0.74) / 0.06) : local;

    // Constellation rotation angles
    const rotZ = state.clock.elapsedTime * 0.06;
    const rotY = Math.sin(state.clock.elapsedTime * 0.12) * 0.18;

    if (pointsRef.current) {
      pointsRef.current.rotation.z = rotZ;
      pointsRef.current.rotation.y = rotY;
      (pointsRef.current.material as THREE.PointsMaterial).opacity = fade * 0.9;
    }

    if (linesRef.current) {
      linesRef.current.rotation.z = rotZ;
      linesRef.current.rotation.y = rotY;
      
      const linePosAttr = lineGeo.getAttribute("position") as THREE.BufferAttribute;
      const lineColAttr = lineGeo.getAttribute("color") as THREE.BufferAttribute;
      
      const posArray = linePosAttr.array as Float32Array;
      const colArray = lineColAttr.array as Float32Array;

      // Extract cursor position in screen space mapped to the rotation
      const pointer = state.pointer; // -1 to 1 coordinates from React Three Fiber
      const targetMouseX = pointer.x * 2.2;
      const targetMouseY = pointer.y * 1.5;
      localMouseRef.current.set(
        THREE.MathUtils.damp(localMouseRef.current.x, targetMouseX, 3.5, Math.min(delta, 0.05)),
        THREE.MathUtils.damp(localMouseRef.current.y, targetMouseY, 3.5, Math.min(delta, 0.05))
      );

      // Rotate lines coordinates manually to calculate distances in world-space
      const rotationMatrix = new THREE.Matrix4()
        .makeRotationY(rotY)
        .multiply(new THREE.Matrix4().makeRotationZ(rotZ));

      for (let i = 0; i < connections.length; i += 2) {
        // segment start
        const x1 = posArray[i * 3]!;
        const y1 = posArray[i * 3 + 1]!;
        const z1 = posArray[i * 3 + 2]!;
        // segment end
        const x2 = posArray[(i + 1) * 3]!;
        const y2 = posArray[(i + 1) * 3 + 1]!;
        const z2 = posArray[(i + 1) * 3 + 2]!;

        // Transform midpoint of segment by constellation rotation
        const mid = new THREE.Vector3((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
        mid.applyMatrix4(rotationMatrix);

        // Distance in 2D space from cursor projection
        const dx = mid.x - localMouseRef.current.x;
        const dy = mid.y - localMouseRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Dynamic glow factor: 0 (dim) to 1 (bright gold)
        const lineGlow = THREE.MathUtils.clamp(1.0 - dist / 1.1, 0, 1);

        // Interpolate line colors: gold (#c4a574) when hovered, dim blue-purple when cold
        const rColor = THREE.MathUtils.lerp(0.12, 0.77, lineGlow); // 0.12 -> 0.77 (gold R)
        const gColor = THREE.MathUtils.lerp(0.08, 0.65, lineGlow); // 0.08 -> 0.65 (gold G)
        const bColor = THREE.MathUtils.lerp(0.25, 0.45, lineGlow); // 0.25 -> 0.45 (gold B)
        const alpha = fade * THREE.MathUtils.lerp(0.06, 0.55, lineGlow);

        // Set colors for both vertices in this segment
        colArray[i * 4] = rColor;
        colArray[i * 4 + 1] = gColor;
        colArray[i * 4 + 2] = bColor;
        colArray[i * 4 + 3] = alpha;

        colArray[(i + 1) * 4] = rColor;
        colArray[(i + 1) * 4 + 1] = gColor;
        colArray[(i + 1) * 4 + 2] = bColor;
        colArray[(i + 1) * 4 + 3] = alpha;
      }
      lineColAttr.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Stars Points */}
      <points ref={pointsRef} geometry={pointsGeo}>
        <pointsMaterial
          size={0.085}
          color="#f5efff"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      {/* Glowing Neural Connection Lines */}
      <lineSegments ref={linesRef} geometry={lineGeo}>
        <lineBasicMaterial
          vertexColors
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
    </group>
  );
}
