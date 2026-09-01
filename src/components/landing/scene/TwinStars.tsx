"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";

import type { MutableRefObject } from "react";

type Phase = "alone" | "notice" | "orbit" | "collide" | "galaxy";

export function TwinStars({
  progressRef,
  onSequenceComplete,
  footerMode,
}: {
  progressRef: MutableRefObject<number>;
  onSequenceComplete?: () => void;
  footerMode?: boolean;
}) {
  const a = useRef<THREE.Mesh>(null);
  const b = useRef<THREE.Mesh>(null);
  const galaxy = useRef<THREE.Points>(null);
  const phaseRef = useRef<Phase>(footerMode ? "galaxy" : "alone");
  const tRef = useRef(0);
  const done = useRef(false);
  const [showGalaxy, setShowGalaxy] = useState(footerMode ?? false);

  // Procedural spiral galaxy particles geometry
  const galaxyGeo = useMemo(() => {
    const n = 350; // More particles for a richer feel
    const pos = new Float32Array(n * 3);
    
    for (let i = 0; i < n; i += 1) {
      // Golden ratio spiral distribution
      const angle = (i / n) * Math.PI * 12 + Math.sin(i * 0.5) * 0.3;
      const radius = (i / n) * 1.85 + (Math.random() - 0.5) * 0.12;
      
      // Elliptical distribution
      pos[i * 3] = Math.cos(angle) * radius;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 0.08;
      pos[i * 3 + 2] = Math.sin(angle) * radius * 0.6;
    }
    
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  useFrame((state, delta) => {
    tRef.current += delta;
    const t = tRef.current;
    const warmth = progressRef.current;
    const heroFade = footerMode ? 1 : Math.max(0, 1 - warmth * 4.5);

    // Expand intro pacing for a deeply emotional, cinematic transition
    if (!footerMode) {
      if (phaseRef.current === "alone" && t > 3.8) {
        phaseRef.current = "notice";
      }
      if (phaseRef.current === "notice" && t > 6.8) {
        phaseRef.current = "orbit";
      }
      if (phaseRef.current === "orbit" && t > 11.5) {
        phaseRef.current = "collide";
      }
      if (phaseRef.current === "collide" && t > 12.8) {
        phaseRef.current = "galaxy";
        setShowGalaxy(true);
        if (!done.current) {
          done.current = true;
          onSequenceComplete?.();
        }
      }
    }

    const phase = phaseRef.current;
    let ax = -2.8;
    let ay = 0.45;
    let bx = 2.8;
    let by = -0.45;
    let scale = 1.0;
    
    // Smooth pulse rates for organic star glow
    const pulseA = 1.0 + Math.sin(state.clock.elapsedTime * 2.8) * 0.06;
    const pulseB = 1.0 + Math.sin(state.clock.elapsedTime * 2.2 + 0.8) * 0.07;

    if (footerMode || warmth > 0.90) {
      // Re-converge for final CTA & Zoom away
      ax = -0.15;
      ay = -0.04;
      bx = 0.15;
      by = 0.04;
      scale = 0.48;
    } else if (phase === "alone") {
      // Star A exists, Star B is hidden/appears very slowly
      ax = -1.8;
      ay = 0.15;
      bx = 2.0;
      by = -0.15;
    } else if (phase === "notice") {
      // Slow gravitational drift closer
      const k = Math.min(1, (t - 3.8) / 3.0);
      ax = THREE.MathUtils.lerp(-1.8, -1.3, k);
      ay = THREE.MathUtils.lerp(0.15, 0.1, k);
      bx = THREE.MathUtils.lerp(2.0, 1.4, k);
      by = THREE.MathUtils.lerp(-0.15, -0.1, k);
    } else if (phase === "orbit") {
      const ot = t - 6.8;
      // Inward spiraling orbital radius
      const r = THREE.MathUtils.lerp(1.3, 0.5, Math.min(1, ot / 4.7));
      const speed = 1.1 + ot * 0.28; // Speed up as gravity pulls them in
      const angle = ot * speed;
      
      ax = Math.cos(angle) * r;
      ay = Math.sin(angle) * r * 0.45;
      bx = Math.cos(angle + Math.PI) * r;
      by = Math.sin(angle + Math.PI) * r * 0.45;
    } else if (phase === "collide") {
      const k = Math.min(1, (t - 11.5) / 1.3);
      // Merge into barycenter
      ax = THREE.MathUtils.lerp(Math.cos(11.5 * 2.4) * 0.5, 0, k);
      ay = THREE.MathUtils.lerp(Math.sin(11.5 * 2.4) * 0.22, 0, k);
      bx = THREE.MathUtils.lerp(Math.cos(11.5 * 2.4 + Math.PI) * 0.5, 0, k);
      by = THREE.MathUtils.lerp(Math.sin(11.5 * 2.4 + Math.PI) * 0.22, 0, k);
      scale = 1.0 + k * 1.5; // Grow/flash on merge
    } else if (phase === "galaxy") {
      // Small orbit separation inside galaxy
      const gt = state.clock.elapsedTime * 0.8;
      ax = Math.cos(gt) * 0.12;
      ay = Math.sin(gt) * 0.04;
      bx = Math.cos(gt + Math.PI) * 0.12;
      by = Math.sin(gt + Math.PI) * 0.04;
      scale = 0.65;
    }

    // Mid-scroll: hide twin stars during Chapters 1-4, show only in intro and final CTA
    const midHide = warmth > 0.10 && warmth < 0.86 && !footerMode;
    const opacity = midHide ? 0 : heroFade;

    // Slow appearance of star B in intro
    let opacityB = opacity;
    if (phase === "alone" && !footerMode) {
      const bAppear = THREE.MathUtils.clamp((t - 1.8) / 2.0, 0, 1);
      opacityB *= bAppear;
    }

    if (a.current) {
      a.current.position.set(ax, ay, 0);
      a.current.scale.setScalar(scale * 0.12 * pulseA);
      (a.current.material as THREE.MeshBasicMaterial).opacity = opacity;
    }
    if (b.current) {
      b.current.position.set(bx, by, 0);
      b.current.scale.setScalar(scale * 0.11 * pulseB);
      (b.current.material as THREE.MeshBasicMaterial).opacity = opacityB;
    }
    if (galaxy.current) {
      galaxy.current.visible = showGalaxy && !midHide;
      galaxy.current.rotation.z = state.clock.elapsedTime * 0.18;
      galaxy.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.12) * 0.15;
      
      const mat = galaxy.current.material as THREE.PointsMaterial;
      const fadeProgress = (1.0 - Math.max(0, warmth - 0.68) * 3);
      mat.opacity = opacity * (footerMode ? 0.32 : 0.88) * Math.max(0, fadeProgress);
    }
  });

  return (
    <group position={[0, 0.25, 0]}>
      {/* Star A: Cold pastel blue */}
      <mesh ref={a}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color="#bfe0ff" transparent opacity={1} />
      </mesh>
      {/* Star B: Warm rose/gold */}
      <mesh ref={b}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color="#ffd8c4" transparent opacity={0} />
      </mesh>
      {/* Birth of Galaxy Particle System */}
      <points ref={galaxy} geometry={galaxyGeo} visible={showGalaxy}>
        <pointsMaterial
          size={0.038}
          color="#ffebcf"
          transparent
          opacity={0.88}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>
    </group>
  );
}
