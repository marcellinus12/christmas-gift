'use client';

import { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import type { PerspectiveCamera } from 'three';
import Particles from './Particles';

/** Mundurkan kamera di layar sempit (HP portrait) supaya teks "Merry Christmas" tetap muat. */
function CameraFit() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  useEffect(() => {
    const aspect = size.width / size.height;
    const z = aspect >= 1.35 ? 14 : (14 * 1.35) / aspect;
    camera.position.set(0, 0, z);
    camera.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

export default function Scene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 14], fov: 50, near: 0.1, far: 100 }}
      dpr={[1, 1.5]}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={['#050816']} />
      <CameraFit />
      <Particles />
    </Canvas>
  );
}
