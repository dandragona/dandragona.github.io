import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';

const TextGradientMaterial = shaderMaterial(
  {
    color1: new THREE.Color('orange'),
    color2: new THREE.Color('hotpink'),
  },
  // vertex shader
  `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // fragment shader
  `
    uniform vec3 color1;
    uniform vec3 color2;
    varying vec2 vUv;

    void main() {
      gl_FragColor = vec4(mix(color1, color2, vUv.y), 1.0);
    }
  `
);

export default TextGradientMaterial;
