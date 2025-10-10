import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';

const GradientMaterial = shaderMaterial(
  {
    color1: new THREE.Color('#c4b5fd'),
    color2: new THREE.Color('#4f46e5'),
    scale: 1.0,
  },
  // vertex shader
  `
    varying vec2 vUv;
    attribute vec3 barycentric;
    varying vec3 vBarycentric;

    void main() {
      vUv = uv;
      vBarycentric = barycentric;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // fragment shader
  `
    uniform vec3 color1;
    uniform vec3 color2;
    uniform float scale;
    varying vec2 vUv;
    varying vec3 vBarycentric;

    float edgeFactor(){
      vec3 d = fwidth(vBarycentric);
      vec3 a3 = smoothstep(vec3(0.0), d*1.5, vBarycentric);
      return min(min(a3.x, a3.y), a3.z);
    }

    void main() {
      gl_FragColor = vec4(mix(color1, color2, vUv.y * scale), 1.0 - edgeFactor());
    }
  `
);

export default GradientMaterial;
