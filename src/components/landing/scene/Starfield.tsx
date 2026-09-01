"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import type { MutableRefObject } from "react";

function seeded(i: number) {
  const x = Math.sin(i * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

export function Starfield({
  progressRef,
  count,
}: {
  progressRef: MutableRefObject<number>;
  count: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const { positions, phases, sizes } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      const r = 18 + seeded(i) * 42;
      const theta = seeded(i + 1) * Math.PI * 2;
      const phi = Math.acos(2 * seeded(i + 2) - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.55;
      positions[i * 3 + 2] = r * Math.cos(phi) - 8;
      phases[i] = seeded(i + 3) * Math.PI * 2;
      sizes[i] = 0.6 + seeded(i + 4) * 1.8;
    }
    return { positions, phases, sizes };
  }, [count]);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    g.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    return g;
  }, [positions, phases, sizes]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uWarmth: { value: 0 },
          uOpacity: { value: 1 },
        },
        vertexShader: `
          attribute float aPhase;
          attribute float aSize;
          uniform float uTime;
          varying float vAlpha;
          void main() {
            float breathe = 0.65 + 0.35 * sin(uTime * (0.4 + aPhase * 0.15) + aPhase);
            vAlpha = breathe;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aSize * breathe * (180.0 / -mv.z);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          uniform float uWarmth;
          uniform float uOpacity;
          varying float vAlpha;
          void main() {
            vec2 c = gl_PointCoord - 0.5;
            float d = length(c);
            if (d > 0.5) discard;
            float glow = smoothstep(0.5, 0.0, d);
            vec3 cold = vec3(0.72, 0.82, 1.0);
            vec3 warm = vec3(1.0, 0.82, 0.62);
            vec3 col = mix(cold, warm, uWarmth);
            float fade = mix(1.0, 0.08, smoothstep(0.55, 0.95, uWarmth));
            gl_FragColor = vec4(col, glow * vAlpha * fade * uOpacity);
          }
        `,
      }),
    [],
  );

  useFrame((state) => {
    const warmth = progressRef.current;
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uWarmth.value = warmth;
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.008;
      pointsRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.05) * 0.03;
    }
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}
