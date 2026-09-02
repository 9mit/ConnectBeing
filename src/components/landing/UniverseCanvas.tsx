"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import type { MutableRefObject } from "react";
import type { MotionValue } from "framer-motion";

import { AiConstellation } from "./scene/AiConstellation";
import { DistanceParticles } from "./scene/DistanceParticles";
import { MemoryFragments } from "./scene/MemoryFragments";
import { MouseWarp } from "./scene/MouseWarp";
import { SpiritPet } from "./scene/SpiritPet";
import { Starfield } from "./scene/Starfield";
import { SyncPlanets } from "./scene/SyncPlanets";
import { TwinStars } from "./scene/TwinStars";

// Define the emotional color timeline based on scroll progress
const COLOR_STOPS = [
  { p: 0.0, color: new THREE.Color("#03010a") }, // Deep Black
  { p: 0.12, color: new THREE.Color("#081026") }, // Cold Blue
  { p: 0.28, color: new THREE.Color("#19134a") }, // Violet
  { p: 0.44, color: new THREE.Color("#4a0e36") }, // Magenta
  { p: 0.60, color: new THREE.Color("#881337") }, // Rose
  { p: 0.76, color: new THREE.Color("#c48434") }, // Warm Amber / Gold
  { p: 0.88, color: new THREE.Color("#ffe5ca") }, // Sunrise
  { p: 0.96, color: new THREE.Color("#fffaf2") }, // Soft White
  { p: 1.0, color: new THREE.Color("#ffffff") },  // Ending Infinity Fading
];

const LERPED_COLOR = new THREE.Color();
function getTimelineColor(p: number): THREE.Color {
  if (p <= COLOR_STOPS[0]!.p) return COLOR_STOPS[0]!.color;
  if (p >= COLOR_STOPS[COLOR_STOPS.length - 1]!.p) return COLOR_STOPS[COLOR_STOPS.length - 1]!.color;
  
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const start = COLOR_STOPS[i]!;
    const end = COLOR_STOPS[i + 1]!;
    if (p >= start.p && p <= end.p) {
      const localProgress = (p - start.p) / (end.p - start.p);
      LERPED_COLOR.copy(start.color).lerp(end.color, localProgress);
      return LERPED_COLOR;
    }
  }
  return COLOR_STOPS[0]!.color;
}

function CinematicCamera({ progressRef }: { progressRef: MutableRefObject<number> }) {
  const { camera } = useThree();
  const currentPos = useRef(new THREE.Vector3(0, 0, 6));
  const currentLookAt = useRef(new THREE.Vector3(0, 0.3, 0));

  useFrame((_, delta) => {
    const p = progressRef.current;
    const dt = Math.min(delta, 0.05);

    const targetPos = new THREE.Vector3();
    const targetLookAt = new THREE.Vector3();

    // Cinematic path calculations for camera position and lookAt target
    if (p <= 0.08) {
      // Intro & Hero: slow zoom in
      const t = p / 0.08;
      targetPos.set(0, 0, THREE.MathUtils.lerp(6.5, 5.5, t));
      targetLookAt.set(0, 0.3, 0);
    } else if (p <= 0.25) {
      // Chapter 1 (Distance): orbit slightly
      const t = (p - 0.08) / 0.17;
      targetPos.set(
        THREE.MathUtils.lerp(0, 1.1, t),
        THREE.MathUtils.lerp(0, 0.2, t),
        THREE.MathUtils.lerp(5.5, 4.6, t)
      );
      targetLookAt.set(0, 0.1, 0);
    } else if (p <= 0.44) {
      // Chapter 2 (Memories): slide to fly through fragments
      const t = (p - 0.25) / 0.19;
      targetPos.set(
        THREE.MathUtils.lerp(1.1, -1.0, t),
        THREE.MathUtils.lerp(0.2, 0.1, t),
        THREE.MathUtils.lerp(4.6, 2.2, t)
      );
      targetLookAt.set(
        THREE.MathUtils.lerp(0, 0.4, t),
        0,
        THREE.MathUtils.lerp(0, -1.5, t)
      );
    } else if (p <= 0.60) {
      // Chapter 3 (Presence): planet close-up view
      const t = (p - 0.44) / 0.16;
      targetPos.set(
        THREE.MathUtils.lerp(-1.0, 0, t),
        THREE.MathUtils.lerp(0.1, 0.4, t),
        THREE.MathUtils.lerp(2.2, 3.8, t)
      );
      targetLookAt.set(
        THREE.MathUtils.lerp(0.4, 0, t),
        THREE.MathUtils.lerp(0, 0.1, t),
        THREE.MathUtils.lerp(-1.5, 0, t)
      );
    } else if (p <= 0.76) {
      // Chapter 4 (Constellation): wide, low angle looking up
      const t = (p - 0.60) / 0.16;
      targetPos.set(
        THREE.MathUtils.lerp(0, -1.5, t),
        THREE.MathUtils.lerp(0.4, 1.5, t),
        THREE.MathUtils.lerp(3.8, 5.5, t)
      );
      targetLookAt.set(0, THREE.MathUtils.lerp(0.1, 0.5, t), 0);
    } else if (p <= 0.88) {
      // Chapter 5 (Spirit): zoom in on center wisp
      const t = (p - 0.76) / 0.12;
      targetPos.set(
        THREE.MathUtils.lerp(-1.5, 0, t),
        THREE.MathUtils.lerp(1.5, 0.2, t),
        THREE.MathUtils.lerp(5.5, 3.4, t)
      );
      targetLookAt.set(0, THREE.MathUtils.lerp(0.5, 0, t), 0);
    } else if (p <= 0.96) {
      // CTA (Sunrise): clean wide framing
      const t = (p - 0.88) / 0.08;
      targetPos.set(0, 0.3, THREE.MathUtils.lerp(3.4, 5.0, t));
      targetLookAt.set(0, 0.3, 0);
    } else {
      // Ending: zoom away to infinity
      const t = (p - 0.96) / 0.04;
      targetPos.set(0, 0.3 + t * 0.4, THREE.MathUtils.lerp(5.0, 16.0, t));
      targetLookAt.set(0, 0.3, 0);
    }

    // Interpolate camera using frame-rate independent lerp
    currentPos.current.lerp(targetPos, dt * 3.5);
    currentLookAt.current.lerp(targetLookAt, dt * 3.5);

    camera.position.copy(currentPos.current);
    camera.lookAt(currentLookAt.current);
  });

  return null;
}

function CinematicPostEffect({ progressRef }: { progressRef: MutableRefObject<number> }) {
  const mesh = useRef<THREE.Mesh>(null);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
      uniforms: {
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
        uniform float uTime;
        uniform float uWarmth;
        varying vec2 vUv;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        void main() {
          vec2 uv = vUv;
          vec2 dist = uv - 0.5;
          
          // Subtle chromatic aberration at corners
          float abAmount = 0.003 * length(dist) * (1.0 - uWarmth * 0.6); 
          
          // Cinematic Vignette: darker borders that lighten up near sunrise
          float vign = length(dist);
          float vigStrength = mix(0.55, 0.15, uWarmth);
          vign = smoothstep(0.8, 0.35, vign * vigStrength);

          // Fine film grain noise overlay
          float noise = hash(uv + fract(uTime)) * 0.035;
          noise *= (1.0 - uWarmth * 0.65);

          // Soft volumetric mist glow (magenta and orange hues)
          vec3 bloomColor = mix(vec3(0.08, 0.04, 0.16), vec3(0.98, 0.72, 0.52), uWarmth);
          float glow = (1.0 - length(dist * 1.4)) * 0.12 * uWarmth;
          glow = max(0.0, glow);

          vec3 finalOverlay = bloomColor * glow;
          float alpha = (1.0 - vign) * 0.65 + noise; 
          
          gl_FragColor = vec4(finalOverlay, alpha);
        }
      `,
    });
  }, []);

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uWarmth.value = progressRef.current;

    if (mesh.current) {
      // Position the overlay quad exactly in front of the camera (depth 0.1)
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(state.camera.quaternion);
      mesh.current.position.copy(state.camera.position).addScaledVector(dir, 0.1);
      mesh.current.quaternion.copy(state.camera.quaternion);
      
      // Calculate dynamic scale matching viewport frustum at depth 0.1
      const distance = 0.1;
      const fovRad = ((state.camera as THREE.PerspectiveCamera).fov * Math.PI) / 180;
      const height = 2 * Math.tan(fovRad / 2) * distance;
      const width = height * (state.size.width / state.size.height);
      
      mesh.current.scale.set(width, height, 1);
    }
  });

  return (
    <mesh ref={mesh} material={material}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}

function Scene({
  progressRef,
  mouse,
  starCount,
  memoryCount,
  onHeroComplete,
}: {
  progressRef: MutableRefObject<number>;
  mouse: MotionValue<{ x: number; y: number }>;
  starCount: number;
  memoryCount: number;
  onHeroComplete: () => void;
}) {
  useFrame(({ scene }) => {
    const p = progressRef.current;
    
    // Smoothly update fog matches
    if (scene.fog) {
      const targetBg = getTimelineColor(p);
      scene.fog.color.copy(targetBg);
      if (p > 0.82) {
        (scene.fog as THREE.FogExp2).density = THREE.MathUtils.lerp(0.015, 0.045, (p - 0.82) / 0.18);
      } else {
        (scene.fog as THREE.FogExp2).density = 0.015 + p * 0.01;
      }
    }
  });

  return (
    <>
      <fogExp2 attach="fog" args={["#03010a", 0.015]} />
      <Starfield progressRef={progressRef} count={starCount} />
      <MouseWarp mouse={mouse} progressRef={progressRef} />
      <TwinStars progressRef={progressRef} onSequenceComplete={onHeroComplete} />
      <DistanceParticles progressRef={progressRef} />
      <MemoryFragments
        progressRef={progressRef}
        mouse={mouse}
        count={memoryCount}
      />
      <SyncPlanets progressRef={progressRef} mouse={mouse} />
      <AiConstellation progressRef={progressRef} />
      <SpiritPet progressRef={progressRef} />
      <CinematicCamera progressRef={progressRef} />
      <CinematicPostEffect progressRef={progressRef} />
    </>
  );
}

function canCreateWebGL(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl")
    );
  } catch {
    return false;
  }
}

export default function UniverseCanvas({
  progressRef,
  mouse,
  onHeroComplete,
}: {
  progressRef: MutableRefObject<number>;
  mouse: MotionValue<{ x: number; y: number }>;
  onHeroComplete: () => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [failed, setFailed] = useState(false);
  const [frameloop, setFrameloop] = useState<"always" | "demand">("always");
  const [budget, setBudget] = useState({ stars: 250, memories: 8, dpr: 1 });

  useEffect(() => {
    if (!canCreateWebGL()) return;
    const mobile = window.matchMedia("(max-width: 768px)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    setBudget({
      stars: mobile ? 180 : 500,
      memories: mobile ? 6 : 14,
      dpr: Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.25),
    });
    setEnabled(true);

    const onVisibility = () => {
      setFrameloop(document.hidden ? "demand" : "always");
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  if (!enabled || failed) return null;

  return (
    <div className="landing-canvas" aria-hidden>
      <Canvas
        dpr={budget.dpr}
        camera={{ position: [0, 0, 6], fov: 50 }}
        frameloop={frameloop}
        gl={{
          antialias: false,
          alpha: true,
          powerPreference: "default",
          failIfMajorPerformanceCaveat: false,
          stencil: false,
          depth: true,
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);

          const canvas = gl.domElement;
          const onLost = (event: Event) => {
            event.preventDefault();
            console.warn("Landing WebGL context lost — falling back to static sky.");
            setFailed(true);
            setEnabled(false);
          };
          const onRestored = () => {
            // Prefer static fallback after loss; remounting often re-trips GPUs.
          };
          canvas.addEventListener("webglcontextlost", onLost, false);
          canvas.addEventListener("webglcontextrestored", onRestored, false);
        }}
        style={{ width: "100%", height: "100%", background: "transparent" }}
      >
        <Suspense fallback={null}>
          <Scene
            progressRef={progressRef}
            mouse={mouse}
            starCount={budget.stars}
            memoryCount={budget.memories}
            onHeroComplete={onHeroComplete}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
