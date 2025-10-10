
import React, { useRef } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { OrbitControls, Sphere, Text } from '@react-three/drei';
import * as THREE from 'three';
import GradientMaterial from './GradientMaterial';

extend({ GradientMaterial });

function BlochSphere() {
  const meshRef = useRef();

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.005;
    }
  });

  return (
    <mesh ref={meshRef}>
      <Sphere args={[2, 32, 32]}>
        <gradientMaterial color1="#7456eb" color2="red" scale={0.75} wireframe />
      </Sphere>
      {/* Axes */}
      {/* <axesHelper args={[2.5]} /> */}
      {/* Labels */}
      <Text position={[0, 2.2, 0]} fontSize={0.3} color="#7456eb">
        |0⟩
      </Text>
      <Text position={[0, -2.2, 0]} fontSize={0.3} color="#7456eb">
        |1⟩
      </Text>
      <Text position={[2.2, 0, 0]} fontSize={0.3} color="#7456eb">
        |+⟩
      </Text>
      <Text position={[-2.2, 0, 0]} fontSize={0.3} color="#7456eb">
        |-⟩
      </Text>
      <Text position={[0, 0, 2.2]} fontSize={0.3} color="#7456eb">
        |+i⟩
      </Text>
      <Text position={[0, 0, -2.2]} fontSize={0.3} color="#7456eb">
        |-i⟩
      </Text>
    </mesh>
  );
}

export default function App() {
  return (
    <Canvas camera={{ fov: 65 }}>
      <ambientLight />
      <pointLight position={[10, 10, 10]} />
      <BlochSphere />
      <OrbitControls />
    </Canvas>
  );
}
