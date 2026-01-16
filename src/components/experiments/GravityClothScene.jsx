
import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function Particles() {
  const countX = 100;
  const countY = 60;
  const numParticles = countX * countY;

  // Store initial positions to calculate waves from
  const initialPositions = useMemo(() => {
    const pos = new Float32Array(numParticles * 3);
    let i = 0;
    for (let iy = 0; iy < countY; iy++) {
      for (let ix = 0; ix < countX; ix++) {
        const u = ix / countX;
        const v = iy / countY;
        // Center grid
        const x = (u * 2 - 1) * 12;
        const y = (v * 2 - 1) * 8;
        const z = 0;

        pos[i * 3] = x;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = z;
        i++;
      }
    }
    return pos;
  }, []);

  // The geometry reference to update positions
  const geomRef = useRef();

  // Mouse position in world coordinates (approximate)
  const mouse = useRef(new THREE.Vector3(1000, 1000, 0));

  useFrame((state) => {
    if (!geomRef.current) return;

    const positions = geomRef.current.attributes.position.array;
    const time = state.clock.getElapsedTime();

    // Update mouse vector
    // Simple projection: map normalized -1..1 pointer to approx world units
    // At z=0, with camera z=8, width approx 18.
    const { width, height } = state.viewport;
    const targetX = (state.pointer.x * width) / 2;
    const targetY = (state.pointer.y * height) / 2;

    // Smooth mouse
    mouse.current.lerp(new THREE.Vector3(targetX, targetY, 0), 0.1);

    for (let i = 0; i < numParticles; i++) {
      const ix = i * 3;
      const initialX = initialPositions[ix];
      const initialY = initialPositions[ix + 1];
      const initialZ = initialPositions[ix + 2];

      // 1. Wave Motion
      // Combine sines for "flutter"
      const wave = Math.sin(initialX * 0.5 + time * 0.5) * 0.2 +
        Math.sin(initialY * 0.5 + time * 0.5) * 0.2;

      let x = initialX;
      let y = initialY;
      let z = initialZ + wave;

      // 2. Mouse Repulsion
      const dx = x - mouse.current.x;
      const dy = y - mouse.current.y;
      // Approximate 2D distance for z-plane interaction
      const distSq = dx * dx + dy * dy;
      const radius = 2.0;
      const radiusSq = radius * radius;

      if (distSq < radiusSq) {
        const dist = Math.sqrt(distSq);
        const force = (1.0 - dist / radius) * 2.5; // Strength

        // Push away from mouse center
        const angle = Math.atan2(dy, dx);
        x += Math.cos(angle) * force;
        y += Math.sin(angle) * force;
      }

      positions[ix] = x;
      positions[ix + 1] = y;
      positions[ix + 2] = z;
    }

    geomRef.current.attributes.position.needsUpdate = true;
  });

  // Generate a simple circular texture
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');

    // Radial gradient
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }, []);

  return (
    <points>
      <bufferGeometry ref={geomRef}>
        <bufferAttribute
          attach="attributes-position"
          count={numParticles}
          array={new Float32Array(initialPositions)} // Clone initial
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.15}
        map={texture}
        transparent={true}
        opacity={0.8}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation={true}
      />
    </points>
  );
}

export default function GravityClothScene() {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 8], fov: 60 }}
        style={{ background: '#000' }}
      >
        <Particles />
      </Canvas>
    </div>
  );
}
