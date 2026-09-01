"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import type { MutableRefObject } from "react";
import type { MotionValue } from "framer-motion";

export function MouseWarp({
  mouse,
  progressRef,
}: {
  mouse: MotionValue<{ x: number; y: number }>;
  progressRef: MutableRefObject<number>;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const { viewport } = useThree();

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uMouse: { value: new THREE.Vector2(0, 0) },
          uTime: { value: 0 },
          uWarmth: { value: 0 },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec2 uMouse;
          uniform float uTime;
          uniform float uWarmth;
          varying vec2 vUv;
          void main() {
            vec2 p = vUv - 0.5;
            vec2 m = uMouse - 0.5;
            float d = length(p - m);
            float ripple = sin(d * 28.0 - uTime * 2.2) * exp(-d * 6.0);
            float glow = exp(-d * 8.0) * 0.18;
            vec3 col = mix(vec3(0.4, 0.55, 1.0), vec3(1.0, 0.75, 0.55), uWarmth);
            float a = (abs(ripple) * 0.12 + glow) * (1.0 - uWarmth * 0.7);
            gl_FragColor = vec4(col, a);
          }
        `,
      }),
    [],
  );

  useFrame((state) => {
    const m = mouse.get();
    material.uniforms.uMouse.value.set(m.x, m.y);
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uWarmth.value = progressRef.current;
    if (mesh.current) {
      mesh.current.scale.set(viewport.width, viewport.height, 1);
    }
  });

  return (
    <mesh ref={mesh} position={[0, 0, -2]} material={material}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
