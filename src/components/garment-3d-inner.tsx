"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Float, Line, OrbitControls } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Jersey-knit texture drawn procedurally so it takes the passport's exact dye shade. */
function useKnitTexture(hex: string) {
  return useMemo(() => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const base = new THREE.Color(hex);
    const light = base.clone().lerp(new THREE.Color("#ffffff"), 0.14).getStyle();
    const dark = base.clone().lerp(new THREE.Color("#000000"), 0.22).getStyle();
    ctx.fillStyle = base.getStyle();
    ctx.fillRect(0, 0, size, size);
    const step = 16;
    for (let y = 0; y < size; y += step) {
      for (let x = 0; x < size; x += step) {
        // each knit stitch is a little "V"
        ctx.strokeStyle = light;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + 2, y + 2);
        ctx.quadraticCurveTo(x + 5, y + step - 2, x + step / 2, y + step - 1);
        ctx.stroke();
        ctx.strokeStyle = dark;
        ctx.beginPath();
        ctx.moveTo(x + step - 2, y + 2);
        ctx.quadraticCurveTo(x + step - 5, y + step - 2, x + step / 2, y + step - 1);
        ctx.stroke();
      }
    }
    // slight slub/noise, like natural indigo (seeded so the texture is stable)
    const rand = mulberry32(7);
    for (let i = 0; i < 1800; i++) {
      ctx.fillStyle = rand() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
      ctx.fillRect(rand() * size, rand() * size, rand() * 18, 1.2);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3.2, 3.2);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }, [hex]);
}

const OUTLINE: [number, number][] = [
  [-0.28, 1.0],
  [0.28, 1.0],
  [0.64, 0.9],
  [1.08, 0.52],
  [0.86, 0.26],
  [0.57, 0.45],
  [0.57, -1.0],
  [-0.57, -1.0],
  [-0.57, 0.45],
  [-0.86, 0.26],
  [-1.08, 0.52],
  [-0.64, 0.9],
];

function Tee({ color }: { color: string }) {
  const ref = useRef<THREE.Group>(null);
  const map = useKnitTexture(color);
  const { geometry, depth } = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-0.28, 1.0);
    s.quadraticCurveTo(0, 0.78, 0.28, 1.0); // neckline scoop
    for (const [x, y] of OUTLINE.slice(2)) s.lineTo(x, y);
    s.lineTo(-0.28, 1.0);
    const depth = 0.1;
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 8, curveSegments: 32 });
    g.translate(0, 0, -depth / 2);
    g.computeVertexNormals();
    return { geometry: g, depth };
  }, []);

  useFrame((state) => {
    if (ref.current) ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.6) * 0.04;
  });

  const z = depth / 2 + 0.075;
  const hem: [number, number, number][] = [[-0.5, -0.9, z], [0.5, -0.9, z]];
  const sleeveR: [number, number, number][] = [[0.88, 0.35, z], [1.0, 0.5, z]];
  const sleeveL: [number, number, number][] = sleeveR.map(([x, y, zz]) => [-x, y, zz]);
  const neck: [number, number, number][] = Array.from({ length: 24 }, (_, i) => {
    const t = i / 23;
    const x = -0.24 + 0.48 * t;
    const y = 0.93 - Math.sin(Math.PI * t) * 0.16;
    return [x, y, z];
  });

  return (
    <group ref={ref} scale={1}>
      <mesh geometry={geometry} castShadow>
        <meshStandardMaterial map={map} roughness={0.92} metalness={0} />
      </mesh>
      {[hem, sleeveR, sleeveL, neck].map((pts, i) => (
        <Line key={i} points={pts} color="#f3ede2" lineWidth={1.4} dashed dashSize={0.03} gapSize={0.025} transparent opacity={0.8} />
      ))}
      {/* chest mark */}
      <mesh position={[0.26, 0.5, z + 0.002]}>
        <circleGeometry args={[0.065, 32]} />
        <meshStandardMaterial color="#d6a021" roughness={0.6} />
      </mesh>
    </group>
  );
}

export default function Garment3DInner({ color }: { color: string }) {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0.1, 5.4], fov: 36 }}>
      <ambientLight intensity={0.75} />
      <directionalLight position={[3, 4, 5]} intensity={1.6} castShadow />
      <directionalLight position={[-4, -1, -3]} intensity={0.5} color="#d6a021" />
      <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.6}>
        <Tee color={color} />
      </Float>
      <ContactShadows position={[0, -1.35, 0]} opacity={0.35} scale={6} blur={2.6} far={3} />
      <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={1.6} minPolarAngle={Math.PI / 3} maxPolarAngle={Math.PI / 1.7} />
    </Canvas>
  );
}
