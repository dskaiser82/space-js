"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, useGLTF, useTexture } from "@react-three/drei";
import { Suspense, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import styles from "./page.module.css";

type Planet = {
  name: string;
  color: string;
  size: number;
  distance: number;
  speed: number;
  angle: number;
  detail: string;
  texture?: string;
  moons?: Moon[];
  ring?: boolean;
};

type Moon = { name: string; distance: number; size: number; color: string; speed: number; angle: number; texture: string };
type Destination = { kind: "planet"; planet: Planet } | { kind: "moon"; planet: Planet; moon: Moon };

const planets: Planet[] = [
  { name: "Mercury", color: "#a69a8c", size: .28, distance: 4.2, speed: .24, angle: .2, detail: "The swiftest world, baked by the Sun.", texture: "/textures/mercury.jpg" },
  { name: "Venus", color: "#d8a85d", size: .48, distance: 5.7, speed: .18, angle: 2.45, detail: "A world wrapped in golden clouds.", texture: "/textures/venus.jpg" },
  { name: "Earth", color: "#3987e7", size: .55, distance: 7.35, speed: .14, angle: .95, detail: "Our blue home, with one bright companion.", moons: [{ name: "Moon", distance: 1.1, size: .14, color: "#c9c5ba", speed: .32, angle: 1.3, texture: "/textures/moon.jpg" }] },
  { name: "Mars", color: "#c45b3e", size: .38, distance: 8.9, speed: .11, angle: 4.1, detail: "The rust-red frontier.", texture: "/textures/mars.jpg", moons: [{ name: "Phobos", distance: .72, size: .07, color: "#9e8879", speed: .44, angle: .6, texture: "/textures/phobos.jpg" }] },
  { name: "Jupiter", color: "#d69b70", size: 1.15, distance: 11.7, speed: .06, angle: 2.9, detail: "The giant planet and its stormy bands.", texture: "/textures/jupiter.jpg", moons: [{ name: "Europa", distance: 1.75, size: .12, color: "#d8ccb2", speed: .28, angle: .8, texture: "/textures/europa.jpg" }, { name: "Ganymede", distance: 2.15, size: .18, color: "#a99b84", speed: .2, angle: 3.6, texture: "/textures/ganymede.jpg" }] },
  { name: "Saturn", color: "#e1c082", size: .95, distance: 15.3, speed: .04, angle: 5.2, detail: "The ringed jewel of the solar system.", texture: "/textures/saturn.jpg", ring: true, moons: [{ name: "Titan", distance: 1.85, size: .16, color: "#c7985a", speed: .19, angle: 2.1, texture: "/textures/titan.jpg" }] },
  { name: "Uranus", color: "#82d0db", size: .7, distance: 18.6, speed: .03, angle: 1.75, detail: "A cool blue ice giant, tilted sideways.", texture: "/textures/uranus.jpg" },
  { name: "Neptune", color: "#417bd8", size: .68, distance: 21.7, speed: .02, angle: 3.85, detail: "A deep-blue world at the edge of our tour.", texture: "/textures/neptune.jpg" },
];

function Dust() {
  const points = useMemo(() => {
    const positions = new Float32Array(1600 * 3);
    for (let i = 0; i < positions.length; i += 3) {
      const radius = 13 + Math.random() * 52;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i + 1] = radius * Math.cos(phi);
      positions[i + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    return positions;
  }, []);
  return <points><bufferGeometry><bufferAttribute attach="attributes-position" args={[points, 3]} /></bufferGeometry><pointsMaterial color="#d9e6ff" size={.035} sizeAttenuation transparent opacity={.75} /></points>;
}

function Sun() {
  const corona = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const plasma = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame(({ clock }) => {
    const pulse = Math.sin(clock.getElapsedTime() * 1.4) * .025;
    plasma.uTime.value = clock.getElapsedTime();
    if (corona.current) corona.current.scale.setScalar(1 + pulse);
    if (halo.current) halo.current.scale.setScalar(1 - pulse * .5);
  });
  return <group>
    <mesh><sphereGeometry args={[2.3, 96, 72]} /><shaderMaterial uniforms={plasma} vertexShader={sunVertexShader} fragmentShader={sunFragmentShader} /></mesh>
    <mesh ref={corona} scale={1.13}><sphereGeometry args={[2.3, 64, 48]} /><meshBasicMaterial color="#ff6b1a" transparent opacity={.13} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
    <mesh ref={halo} scale={1.42}><sphereGeometry args={[2.3, 64, 48]} /><meshBasicMaterial color="#ff9a31" transparent opacity={.035} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
    <mesh scale={1.28}><sphereGeometry args={[2.3, 96, 72]} /><shaderMaterial uniforms={plasma} vertexShader={coronaVertexShader} fragmentShader={coronaFragmentShader} transparent side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
    <pointLight color="#ffb15d" intensity={220} distance={42} decay={1.5} />
  </group>;
}

const sunVertexShader = `
  varying vec3 vPosition;
  void main() {
    vPosition = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const sunFragmentShader = `
  uniform float uTime;
  varying vec3 vPosition;

  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123); }
  float noise(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1.,0.,0.)), f.x), mix(hash(i + vec3(0.,1.,0.)), hash(i + vec3(1.,1.,0.)), f.x), f.y), mix(mix(hash(i + vec3(0.,0.,1.)), hash(i + vec3(1.,0.,1.)), f.x), mix(hash(i + vec3(0.,1.,1.)), hash(i + vec3(1.,1.,1.)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) {
    float value = 0.; float amplitude = .55;
    for (int i = 0; i < 5; i++) { value += amplitude * noise(p); p = p * 2.05 + 11.3; amplitude *= .5; }
    return value;
  }
  void main() {
    vec3 drift = vec3(uTime * .055, -uTime * .025, uTime * .035);
    float broad = fbm(vPosition * 3.2 + drift);
    float grain = fbm(vPosition * 15. + drift * 2.4);
    float plasma = smoothstep(.18, .86, broad * .72 + grain * .48);
    float filament = smoothstep(.62, .9, fbm(vPosition * 7. + vec3(-uTime * .09, uTime * .04, 0.)));
    vec3 deep = vec3(.72, .055, .002);
    vec3 hot = vec3(1., .29, .008);
    vec3 bright = vec3(1., .82, .22);
    vec3 color = mix(deep, hot, plasma);
    color = mix(color, bright, filament * .58);
    gl_FragColor = vec4(color * 1.35, 1.0);
  }
`;

const coronaVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const coronaFragmentShader = `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vPosition;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123); }
  float noise(vec3 p) {
    vec3 i=floor(p); vec3 f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(mix(hash(i),hash(i+vec3(1.,0.,0.)),f.x),mix(hash(i+vec3(0.,1.,0.)),hash(i+vec3(1.,1.,0.)),f.x),f.y),mix(mix(hash(i+vec3(0.,0.,1.)),hash(i+vec3(1.,0.,1.)),f.x),mix(hash(i+vec3(0.,1.,1.)),hash(i+vec3(1.,1.,1.)),f.x),f.y),f.z);
  }
  float fbm(vec3 p) { float value=0.; float amount=.6; for(int i=0;i<4;i++){value+=amount*noise(p);p=p*2.1+7.4;amount*=.5;} return value; }
  void main() {
    float edge=pow(1.-abs(dot(normalize(vNormal),vec3(0.,0.,1.))),2.);
    float turbulence=fbm(vPosition*5.2+vec3(uTime*.045,-uTime*.03,0.));
    float wisps=smoothstep(.42,.82,turbulence)*edge;
    vec3 color=mix(vec3(1.,.16,.005),vec3(1.,.76,.16),turbulence);
    gl_FragColor=vec4(color,wisps*.58);
  }
`;

function Moon({ moon, planet, onSelect }: { moon: Moon; planet: Planet; onSelect: (destination: Destination) => void }) {
  const texture = useTexture(moon.texture);
  texture.colorSpace = THREE.SRGBColorSpace;
  return <mesh position={[Math.cos(moon.angle) * moon.distance, 0, -Math.sin(moon.angle) * moon.distance]} onClick={(event) => { event.stopPropagation(); onSelect({ kind: "moon", planet, moon }); }}><sphereGeometry args={[moon.size, 24, 16]} /><meshStandardMaterial map={texture} color={moon.color} roughness={.9} /></mesh>;
}

function NasaEarth() {
  const { scene } = useGLTF("/models/nasa-earth.glb");
  const earth = useMemo(() => scene.clone(), [scene]);
  return <primitive object={earth} scale={.0011} rotation={[0, Math.PI / 2, 0]} />;
}

function TexturedPlanet({ planet }: { planet: Planet }) {
  const texture = useTexture(planet.texture!);
  texture.colorSpace = THREE.SRGBColorSpace;
  return <mesh castShadow><sphereGeometry args={[planet.size, 40, 28]} /><meshStandardMaterial map={texture} color={planet.color} roughness={.72} metalness={.05} /></mesh>;
}

function PlanetBody({ planet, selected, onSelect }: { planet: Planet; selected: boolean; onSelect: (destination: Destination) => void }) {
  const body = useRef<THREE.Group>(null);
  useFrame(() => {
    if (selected && body.current) body.current.rotation.y += .004;
  });
  return <group position={[Math.cos(planet.angle) * planet.distance, 0, Math.sin(planet.angle) * planet.distance]} onClick={(event) => { event.stopPropagation(); onSelect({ kind: "planet", planet }); }}>
    <group ref={body}>{planet.name === "Earth" ? <NasaEarth /> : <TexturedPlanet planet={planet} />}
    {selected && <mesh scale={1.25}><sphereGeometry args={[planet.size, 32, 20]} /><meshBasicMaterial color={planet.color} transparent opacity={.1} side={THREE.BackSide} /></mesh>}
    {planet.ring && <mesh rotation={[Math.PI / 2.45, 0, 0]}><ringGeometry args={[1.25, 1.8, 80]} /><meshBasicMaterial color="#d9c090" transparent opacity={.65} side={THREE.DoubleSide} /></mesh>}
    {planet.moons?.map((moon) => <Moon key={moon.name} moon={moon} planet={planet} onSelect={onSelect} />)}
    </group>
  </group>;
}

function CameraFlight({ target }: { target: Destination }) {
  const { camera } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const flightPosition = useRef(new THREE.Vector3());
  const flightFocus = useRef(new THREE.Vector3());
  const focus = useRef(new THREE.Vector3());
  const lastTarget = useRef(target);
  const isFlying = useRef(false);
  useFrame(() => {
    if (target !== lastTarget.current) {
      const planet = target.planet;
      focus.current.set(Math.cos(planet.angle) * planet.distance, 0, Math.sin(planet.angle) * planet.distance);
      if (target.kind === "moon") {
        focus.current.add(new THREE.Vector3(Math.cos(target.moon.angle) * target.moon.distance, 0, -Math.sin(target.moon.angle) * target.moon.distance));
      }
      const size = target.kind === "moon" ? target.moon.size : planet.size;
      const viewingDistance = Math.max(2, size * 7);
      const sunward = focus.current.clone().normalize().multiplyScalar(-viewingDistance);
      flightFocus.current.copy(focus.current);
      flightPosition.current.copy(focus.current).add(sunward).add(new THREE.Vector3(0, viewingDistance * .26, 0));
      lastTarget.current = target;
      isFlying.current = true;
    }
    if (isFlying.current) {
      camera.position.lerp(flightPosition.current, .045);
      controls.current?.target.lerp(flightFocus.current, .045);
      const targetArrived = controls.current ? controls.current.target.distanceTo(flightFocus.current) < .03 : false;
      if (camera.position.distanceTo(flightPosition.current) < .03 && targetArrived) isFlying.current = false;
    }
    controls.current?.update();
  });
  return <OrbitControls ref={controls} enableDamping dampingFactor={.07} enablePan zoomToCursor minDistance={.15} maxDistance={70} />;
}

function Nebula() {
  return <group position={[-18, 6, -15]} rotation={[.3, 0, .2]}>
    {[[0, 0, 0, 5.5], [3, 1, -1, 4], [-3, -1, 1, 3.8]].map(([x, y, z, scale], index) => <mesh key={index} position={[x, y, z]} scale={scale}>
      <sphereGeometry args={[1, 32, 24]} /><meshBasicMaterial color={index === 1 ? "#9f80ff" : "#377fce"} transparent opacity={.045} depthWrite={false} />
    </mesh>)}
  </group>;
}

function SolarSystem({ selected, onSelect }: { selected: Destination; onSelect: (destination: Destination) => void }) {
  return <Canvas camera={{ position: [11, 8, 22], fov: 48, near: .01 }} dpr={[1, 1.75]} gl={{ antialias: true }}>
    <color attach="background" args={["#02030b"]} />
    <fog attach="fog" args={["#02030b", 25, 58]} />
    <ambientLight intensity={.32} color="#9bb8ff" />
    <hemisphereLight args={["#b7d1ff", "#162342", .32]} />
    <Stars radius={80} depth={45} count={4000} factor={3} saturation={0} fade speed={0} />
    <Dust />
    <Nebula />
    <Sun />
    <Suspense fallback={null}>{planets.map((planet) => <PlanetBody key={planet.name} planet={planet} selected={selected.planet.name === planet.name} onSelect={onSelect} />)}</Suspense>
    <CameraFlight target={selected} />
  </Canvas>;
}

useGLTF.preload("/models/nasa-earth.glb");

export default function Home() {
  const [selected, setSelected] = useState<Destination>({ kind: "planet", planet: planets[2] });
  const selectedName = selected.kind === "moon" ? selected.moon.name : selected.planet.name;
  const selectedDetail = selected.kind === "moon" ? `${selected.moon.name} travels around ${selected.planet.name}.` : selected.planet.detail;
  return <main className={styles.page}>
    <section className={styles.scene}><SolarSystem selected={selected} onSelect={setSelected} /></section>
    <header className={styles.topbar}><div className={styles.brand}><span className={styles.brandMark}>✦</span><div><b>ORBITAL EXPLORER</b><small>LOCAL STAR SYSTEM</small></div></div><div className={styles.coordinates}>LIVE NAVIGATION<br />DRAG TO ORBIT · SCROLL TO ZOOM</div></header>
    <aside className={styles.panel}><div className={styles.eyebrow}>DESTINATION SELECTED</div><h1>{selectedName}</h1><p>{selectedDetail}</p><div className={styles.planetList}>{planets.map((planet) => <button key={planet.name} className={`${styles.planetButton} ${selected.planet.name === planet.name ? styles.active : ""}`} style={{ "--planet-color": planet.color } as React.CSSProperties} onClick={() => setSelected({ kind: "planet", planet })}>{planet.name}</button>)}</div></aside>
    <div className={styles.hint}><b>Click any planet or moon</b> to begin a flight<br />Drag to orbit · Scroll to zoom</div>
  </main>;
}
