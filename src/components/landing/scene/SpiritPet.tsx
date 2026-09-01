"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import type { MutableRefObject } from "react";

export function SpiritPet({
  progressRef,
}: {
  progressRef: MutableRefObject<number>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const coreMesh = useRef<THREE.Mesh>(null);
  const auraMesh = useRef<THREE.Mesh>(null);
  const eyeL = useRef<THREE.Mesh>(null);
  const eyeR = useRef<THREE.Mesh>(null);

  // Proximity smooth tracker
  const smoothProximity = useRef(0);

  // Custom shader for procedural wisp body (Fluid simplex noise + fresnel glow)
  const petShader = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uProximity: { value: 0 },
        uOpacity: { value: 0 },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uProximity;
        varying vec3 vNormal;
        varying vec3 vViewPosition;

        // Description : Array and textureless GLSL 2D/3D/4D simplex 
        //               noise functions.
        //      Author : Ian McEwan, Ashima Arts.
        vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
        vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
        float snoise(vec3 v){ 
          const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
          const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
          vec3 i  = floor(v + dot(v, C.yyy) );
          vec3 x0 =   v - i + dot(i, C.xxx) ;
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min( g.xyz, l.zxy );
          vec3 i2 = max( g.xyz, l.zxy );
          vec3 x1 = x0 - i1 + 1.0 * C.xxx;
          vec3 x2 = x0 - i2 + 2.0 * C.xxx;
          vec3 x3 = x0 - D.yyy;
          i = mod(i, 289.0 ); 
          vec4 p = permute( permute( permute( 
                     i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                   + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                   + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
          float n_ = 1.0/7.0;
          vec3  ns = n_ * D.wyz - D.xzx;
          vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_ );
          vec4 x = x_ *ns.x + ns.yyyy;
          vec4 y = y_ *ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);
          vec4 b0 = vec4( x.xy, y.xy );
          vec4 b1 = vec4( x.zw, y.zw );
          vec4 s0 = floor(b0)*2.0 + 1.0;
          vec4 s1 = floor(b1)*2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
          vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
          vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
          vec3 p0 = vec3(a0.xy,h.x);
          vec3 p1 = vec3(a0.zw,h.y);
          vec3 p2 = vec3(a1.xy,h.z);
          vec3 p3 = vec3(a1.zw,h.w);
          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
          p0 *= norm.x;
          p1 *= norm.y;
          p2 *= norm.z;
          p3 *= norm.w;
          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                        dot(p2,x2), dot(p3,x3) ) );
        }

        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec3 pos = position;

          // Faster pulsing and morphing when awake (uProximity > 0)
          float speed = 0.95 + uProximity * 2.0;
          float amp = 0.08 + uProximity * 0.16;

          // Displace vertex coordinate along normals with simplex noise
          float noise = snoise(pos * 2.0 + uTime * speed);
          pos += normal * noise * amp;

          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uProximity;
        uniform float uOpacity;
        varying vec3 vNormal;
        varying vec3 vViewPosition;

        void main() {
          vec3 normalVec = normalize(vNormal);
          vec3 viewDir = normalize(vViewPosition);

          // Translucent rim edge-glow (fresnel factor)
          float rim = pow(1.0 - max(0.0, dot(normalVec, viewDir)), 2.0);

          // Color shifts: cold starry blue when asleep, glowing amber gold when awake
          vec3 asleepColor = vec3(0.35, 0.45, 0.98);
          vec3 awakeColor = vec3(0.98, 0.72, 0.35);
          vec3 finalColor = mix(asleepColor, awakeColor, uProximity);

          gl_FragColor = vec4(finalColor, rim * uOpacity * (0.35 + uProximity * 0.55));
        }
      `,
    });
  }, []);

  useFrame((state, delta) => {
    const p = progressRef.current;
    const dt = Math.min(delta, 0.05);

    // Chapter 5 active range: 0.68 to 0.88
    const local = THREE.MathUtils.clamp((p - 0.68) / 0.12, 0, 1);
    const fade = p < 0.65 ? 0 : p > 0.84 ? Math.max(0, 1 - (p - 0.84) / 0.06) : local;

    // Wake up/engage proximity based on cursor coordinates
    const pointer = state.pointer;
    const cursorDist = Math.sqrt(pointer.x * pointer.x + pointer.y * pointer.y);
    const userClose = cursorDist < 0.8 && fade > 0.1;
    
    // Lerp proximity value
    smoothProximity.current = THREE.MathUtils.damp(
      smoothProximity.current,
      userClose ? 1.0 : 0.0,
      2.8,
      dt
    );

    const proximity = smoothProximity.current;

    // Organic breathing frequency
    const breathe = 0.88 + Math.sin(state.clock.elapsedTime * (1.1 + proximity * 1.5)) * 0.07;
    const scaleFactor = breathe * (0.58 + proximity * 0.35);

    // Group updates
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.85) * 0.14;
      
      // Face towards cursor when awake (notices the visitor)
      const targetRotY = pointer.x * 0.45;
      const targetRotX = -pointer.y * 0.35;
      groupRef.current.rotation.y = THREE.MathUtils.damp(groupRef.current.rotation.y, targetRotY, 3.2, dt);
      groupRef.current.rotation.x = THREE.MathUtils.damp(groupRef.current.rotation.x, targetRotX, 3.2, dt);
    }

    // Body Mesh (core)
    if (coreMesh.current) {
      coreMesh.current.scale.setScalar(scaleFactor);
      
      // Update shader uniforms
      petShader.uniforms.uTime.value = state.clock.elapsedTime;
      petShader.uniforms.uProximity.value = proximity;
      petShader.uniforms.uOpacity.value = fade;
    }

    // Outer Aura mesh
    if (auraMesh.current) {
      auraMesh.current.scale.setScalar(scaleFactor * 1.6);
      const mat = auraMesh.current.material as THREE.MeshBasicMaterial;
      mat.opacity = fade * 0.15 * (0.4 + proximity * 0.6);
      mat.color.set(userClose ? "#ffdca8" : "#9ab4ff");
    }

    // Interactive glowing eyes (scale and glow based on awake state)
    const eyeScale = THREE.MathUtils.lerp(0.0, 0.016, proximity);
    
    if (eyeL.current) {
      eyeL.current.scale.setScalar(eyeScale);
      (eyeL.current.material as THREE.MeshBasicMaterial).opacity = fade * proximity;
    }
    if (eyeR.current) {
      eyeR.current.scale.setScalar(eyeScale);
      (eyeR.current.material as THREE.MeshBasicMaterial).opacity = fade * proximity;
    }
  });

  return (
    <group position={[0, 0, 0]}>
      <group ref={groupRef}>
        {/* Outer Aura */}
        <mesh ref={auraMesh}>
          <sphereGeometry args={[1, 24, 24]} />
          <meshBasicMaterial
            color="#9ab4ff"
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        
        {/* Procedural Deforming Core Body */}
        <mesh ref={coreMesh} material={petShader}>
          <sphereGeometry args={[0.38, 48, 48]} />
        </mesh>

        {/* Floating Glowing Eyes */}
        <mesh ref={eyeL} position={[-0.09, 0.05, 0.32]}>
          <sphereGeometry args={[1, 12, 12]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} />
        </mesh>
        <mesh ref={eyeR} position={[0.09, 0.05, 0.32]}>
          <sphereGeometry args={[1, 12, 12]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}
