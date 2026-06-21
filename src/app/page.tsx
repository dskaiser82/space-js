"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Billboard, Line, OrbitControls, PointerLockControls, Stars, Text, useGLTF, useTexture } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import styles from "./page.module.css";

type Planet = {
  name: string;
  color: string;
  size: number;
  distance: number;
  speed: number;
  angle: number;
  detail: string;
  fact: string;
  texture?: string;
  moons?: Moon[];
  ring?: boolean;
};

type Moon = { name: string; distance: number; size: number; color: string; speed: number; angle: number; texture: string };
type Destination = { kind: "planet"; planet: Planet } | { kind: "moon"; planet: Planet; moon: Moon };

const planets: Planet[] = [
  { name: "Mercury", color: "#a69a8c", size: .38, distance: 34, speed: .24, angle: .2, detail: "The swiftest world, baked by the Sun.", fact: "A year here lasts just 88 Earth days.", texture: "/textures/mercury.jpg" },
  { name: "Venus", color: "#d8a85d", size: .62, distance: 54, speed: .18, angle: 2.45, detail: "A world wrapped in golden clouds.", fact: "Its thick atmosphere makes it the hottest planet.", texture: "/textures/venus.jpg" },
  { name: "Earth", color: "#3987e7", size: .72, distance: 78, speed: .14, angle: .95, detail: "Our blue home, with one bright companion.", fact: "About 71% of its surface is covered by ocean.", moons: [{ name: "Moon", distance: 1.4, size: .18, color: "#c9c5ba", speed: .32, angle: 1.3, texture: "/textures/moon.jpg" }] },
  { name: "Mars", color: "#c45b3e", size: .5, distance: 102, speed: .11, angle: 4.1, detail: "The rust-red frontier.", fact: "Olympus Mons is the largest volcano in the solar system.", texture: "/textures/mars.jpg", moons: [{ name: "Phobos", distance: .9, size: .09, color: "#9e8879", speed: .44, angle: .6, texture: "/textures/phobos.jpg" }] },
  { name: "Jupiter", color: "#d69b70", size: 1.85, distance: 140, speed: .06, angle: 2.9, detail: "The giant planet and its stormy bands.", fact: "Its Great Red Spot is a storm wider than Earth.", texture: "/textures/jupiter.jpg", moons: [{ name: "Europa", distance: 2.65, size: .16, color: "#d8ccb2", speed: .28, angle: .8, texture: "/textures/europa.jpg" }, { name: "Ganymede", distance: 3.25, size: .24, color: "#a99b84", speed: .2, angle: 3.6, texture: "/textures/ganymede.jpg" }] },
  { name: "Saturn", color: "#e1c082", size: 1.55, distance: 180, speed: .04, angle: 5.2, detail: "The ringed jewel of the solar system.", fact: "Its brilliant rings are mostly water-ice particles.", texture: "/textures/saturn.jpg", ring: true, moons: [{ name: "Titan", distance: 2.75, size: .22, color: "#c7985a", speed: .19, angle: 2.1, texture: "/textures/titan.jpg" }] },
  { name: "Uranus", color: "#82d0db", size: 1.1, distance: 220, speed: .03, angle: 1.75, detail: "A cool blue ice giant, tilted sideways.", fact: "It rotates almost on its side, unlike the other planets.", texture: "/textures/uranus.jpg" },
  { name: "Neptune", color: "#417bd8", size: 1.08, distance: 265, speed: .02, angle: 3.85, detail: "A deep-blue world at the edge of our tour.", fact: "It has the fastest winds measured in our solar system.", texture: "/textures/neptune.jpg" },
];

function Dust() {
  const points = useMemo(() => {
    const positions = new Float32Array(1600 * 3);
    for (let i = 0; i < positions.length; i += 3) {
      const radius = 15 + Math.random() * 430;
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
    <pointLight color="#ffb15d" intensity={850} distance={260} decay={1.45} />
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

function ShipControls({ target, onRange }: { target: Destination; onRange: (range: number) => void }) {
  const { camera } = useThree();
  const keys = useRef(new Set<string>());
  const lastRangeUpdate = useRef(0);
  useEffect(() => {
    const down = (event: KeyboardEvent) => { if (["w", "a", "s", "d", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Shift"].includes(event.key)) { keys.current.add(event.key); event.preventDefault(); } };
    const up = (event: KeyboardEvent) => keys.current.delete(event.key);
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);
  useFrame((_, delta) => {
    const targetPosition = new THREE.Vector3(Math.cos(target.planet.angle) * target.planet.distance, 0, Math.sin(target.planet.angle) * target.planet.distance);
    if (target.kind === "moon") targetPosition.add(new THREE.Vector3(Math.cos(target.moon.angle) * target.moon.distance, 0, -Math.sin(target.moon.angle) * target.moon.distance));
    if (lastRangeUpdate.current > .15) { onRange(camera.position.distanceTo(targetPosition)); lastRangeUpdate.current = 0; }
    lastRangeUpdate.current += delta;
    const speed = (keys.current.has("Shift") ? 18 : 5) * delta;
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward); forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
    if (keys.current.has("w") || keys.current.has("ArrowUp")) camera.position.addScaledVector(forward, speed);
    if (keys.current.has("s") || keys.current.has("ArrowDown")) camera.position.addScaledVector(forward, -speed);
    if (keys.current.has("d") || keys.current.has("ArrowRight")) camera.position.addScaledVector(right, speed);
    if (keys.current.has("a") || keys.current.has("ArrowLeft")) camera.position.addScaledVector(right, -speed);
  });
  return <PointerLockControls />;
}

function GuidanceTrail({ destination }: { destination: Destination }) {
  const { camera } = useThree();
  const geometry = useMemo(() => new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3)), []);
  const line = useMemo(() => new THREE.Line(geometry, new THREE.LineDashedMaterial({ color: "#85cbff", transparent: true, opacity: .38, dashSize: 1.6, gapSize: 1.1, depthWrite: false })), [geometry]);
  useFrame(() => {
    const target = new THREE.Vector3(Math.cos(destination.planet.angle) * destination.planet.distance, 0, Math.sin(destination.planet.angle) * destination.planet.distance);
    if (destination.kind === "moon") target.add(new THREE.Vector3(Math.cos(destination.moon.angle) * destination.moon.distance, 0, -Math.sin(destination.moon.angle) * destination.moon.distance));
    const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
    positions.setXYZ(0, camera.position.x, camera.position.y, camera.position.z);
    positions.setXYZ(1, target.x, target.y, target.z);
    positions.needsUpdate = true;
    line.computeLineDistances();
  });
  return <primitive object={line} />;
}

function MapControls() {
  const { camera } = useThree();
  useEffect(() => { camera.position.set(0, 135, 340); camera.lookAt(0, 0, 0); }, [camera]);
  return <OrbitControls target={[0, 0, 0]} enableDamping minDistance={25} maxDistance={650} />;
}

function NavigationTrails() {
  return <group>
    {planets.map((planet) => {
      const end: [number, number, number] = [Math.cos(planet.angle) * planet.distance, 0, Math.sin(planet.angle) * planet.distance];
      return <Line key={planet.name} points={[[0, 0, 0], end]} color="#4a81c7" transparent opacity={.28} dashed dashSize={1.5} gapSize={1.2} lineWidth={.5} />;
    })}
  </group>;
}

function WorldIntel({ destination }: { destination: Destination }) {
  const { camera } = useThree();
  const card = useRef<THREE.Group>(null);
  const planet = destination.planet;
  const name = destination.kind === "moon" ? destination.moon.name : planet.name;
  const fact = destination.kind === "moon" ? `${destination.moon.name} orbits ${planet.name}` : planet.fact;
  useFrame(() => {
    const target = new THREE.Vector3(Math.cos(planet.angle) * planet.distance, 0, Math.sin(planet.angle) * planet.distance);
    if (destination.kind === "moon") target.add(new THREE.Vector3(Math.cos(destination.moon.angle) * destination.moon.distance, 0, -Math.sin(destination.moon.angle) * destination.moon.distance));
    const distance = camera.position.distanceTo(target);
    const cameraFacing = camera.position.clone().sub(target).normalize();
    const hologramPosition = target.clone().addScaledVector(cameraFacing, planet.size + .65).add(new THREE.Vector3(0, planet.size + 1.1, 0));
    const scale = THREE.MathUtils.clamp(distance * .045, 1, 12);
    card.current?.position.copy(hologramPosition);
    card.current?.scale.setScalar(scale);
  });
  return <group ref={card} renderOrder={10}>
    <Billboard follow>
      <mesh position={[0, 0, -.02]} renderOrder={10}><planeGeometry args={[7.4, 2.15]} /><meshBasicMaterial color="#07142b" transparent opacity={.78} side={THREE.DoubleSide} depthTest={false} /></mesh>
      <mesh position={[0, .92, 0]} renderOrder={11}><planeGeometry args={[7.4, .035]} /><meshBasicMaterial color="#73c7ff" transparent opacity={.95} depthTest={false} /></mesh>
      <Text position={[0, .42, 0]} renderOrder={12} fontSize={.46} color="#e8f8ff" anchorX="center" anchorY="middle" letterSpacing={.1} material-depthTest={false}>{name.toUpperCase()}</Text>
      <Text position={[0, -.35, 0]} renderOrder={12} fontSize={.18} maxWidth={6.3} lineHeight={1.35} color="#a6c8ee" anchorX="center" anchorY="middle" material-depthTest={false}>{fact}</Text>
    </Billboard>
  </group>;
}

function Nebula() {
  const clouds: { position: [number, number, number]; color: string; scale: number }[] = [
    { position: [-52, 18, -68], color: "#4e78d5", scale: 18 }, { position: [78, -16, -95], color: "#ad61d6", scale: 23 }, { position: [-118, 26, 84], color: "#287eaa", scale: 27 },
  ];
  return <>{clouds.map((cloud, cloudIndex) => <group key={cloudIndex} position={cloud.position} rotation={[.3, cloudIndex, .2]}>
    {[[0, 0, 0, 1], [3, 1, -1, .72], [-3, -1, 1, .68]].map(([x, y, z, scale], index) => <mesh key={index} position={[x, y, z]} scale={cloud.scale * scale}>
      <sphereGeometry args={[1, 32, 24]} /><meshBasicMaterial color={cloud.color} transparent opacity={.035} depthWrite={false} />
    </mesh>)}
  </group>)}</>;
}

function Comet({ radius, phase, color }: { radius: number; phase: number; color: string }) {
  const comet = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * .045 + phase;
    if (comet.current) { comet.current.position.set(Math.cos(t) * radius, Math.sin(t * 1.7) * 12, Math.sin(t) * radius * .55); comet.current.rotation.y = -t; }
  });
  return <group ref={comet}><Line points={[[-10, 0, 0], [0, 0, 0]]} color={color} transparent opacity={.7} lineWidth={1.2} /><mesh><sphereGeometry args={[.16, 16, 12]} /><meshBasicMaterial color="#ffffff" /></mesh><pointLight color={color} intensity={3} distance={5} /></group>;
}

function NebulaSky() {
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame(({ clock }) => { uniforms.uTime.value = clock.getElapsedTime(); });
  return <mesh scale={430}><sphereGeometry args={[1, 64, 32]} /><shaderMaterial uniforms={uniforms} vertexShader={nebulaVertexShader} fragmentShader={nebulaFragmentShader} transparent side={THREE.BackSide} depthWrite={false} /></mesh>;
}

const nebulaVertexShader = `varying vec3 vPosition; void main(){vPosition=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const nebulaFragmentShader = `
  uniform float uTime; varying vec3 vPosition;
  float h(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
  float n(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}
  float f(vec3 p){float r=0.,a=.6;for(int i=0;i<4;i++){r+=a*n(p);p=p*2.03+5.7;a*=.5;}return r;}
  void main(){float cloud=f(vPosition*3.1+vec3(uTime*.003,0.,0.));float band=pow(max(0.,1.-abs(vPosition.y+.18)),3.);float gas=smoothstep(.52,.82,cloud)*band;vec3 color=mix(vec3(.06,.16,.37),vec3(.08,.72,1.),cloud);color=mix(color,vec3(.95,.15,.62),smoothstep(.7,.94,cloud));gl_FragColor=vec4(color,gas*.48);}
`;

function ShipHeadlight() {
  const { camera } = useThree();
  const light = useRef<THREE.PointLight>(null);
  useFrame(() => { light.current?.position.copy(camera.position); });
  return <pointLight ref={light} color="#cce8ff" intensity={42} distance={65} decay={1.35} />;
}

function SolarSystem({ selected, onSelect, mode, onRange }: { selected: Destination; onSelect: (destination: Destination) => void; mode: "ship" | "map"; onRange: (range: number) => void }) {
  return <Canvas camera={{ position: [0, 3, 16], fov: 62, near: .01 }} dpr={[1, 1.75]} gl={{ antialias: true }}>
    <color attach="background" args={["#02030b"]} />
    <fog attach="fog" args={["#02030b", 80, 470]} />
    <ambientLight intensity={.32} color="#9bb8ff" />
    <hemisphereLight args={["#b7d1ff", "#162342", .32]} />
    <NebulaSky />
    <Stars radius={430} depth={300} count={7000} factor={4} saturation={0} fade speed={0} />
    <Dust />
    <Nebula />
    <Comet radius={112} phase={.6} color="#8ddaff" /><Comet radius={175} phase={3.2} color="#ffbca4" /><Comet radius={245} phase={5.1} color="#d5b6ff" />
    <Sun />
    <NavigationTrails />
    <Suspense fallback={null}>{planets.map((planet) => <PlanetBody key={planet.name} planet={planet} selected={selected.planet.name === planet.name} onSelect={onSelect} />)}</Suspense>
    <WorldIntel destination={selected} />
    {mode === "ship" ? <><ShipHeadlight /><GuidanceTrail destination={selected} /><ShipControls target={selected} onRange={onRange} /></> : <MapControls />}
  </Canvas>;
}

useGLTF.preload("/models/nasa-earth.glb");

export default function Home() {
  const [selected, setSelected] = useState<Destination>({ kind: "planet", planet: planets[2] });
  const [mode, setMode] = useState<"ship" | "map">("ship");
  const [range, setRange] = useState(0);
  const selectedName = selected.kind === "moon" ? selected.moon.name : selected.planet.name;
  const selectedDetail = selected.kind === "moon" ? `${selected.moon.name} travels around ${selected.planet.name}.` : selected.planet.detail;
  const selectedFact = selected.kind === "moon" ? `${selected.moon.name} is currently in orbit around ${selected.planet.name}.` : selected.planet.fact;
  return <main className={styles.page}>
    <section className={styles.scene}><SolarSystem selected={selected} onSelect={setSelected} mode={mode} onRange={setRange} /></section>
    <header className={styles.topbar}><div className={styles.brand}><span className={styles.brandMark}>✦</span><div><b>ORBITAL EXPLORER</b><small>LOCAL STAR SYSTEM</small></div></div><div className={styles.coordinates}>LIVE NAVIGATION<br />DRAG TO ORBIT · SCROLL TO ZOOM</div></header>
    <aside className={styles.panel}><div className={styles.eyebrow}>DESTINATION SELECTED</div><h1>{selectedName}</h1><p>{selectedDetail}</p><div className={styles.planetList}>{planets.map((planet) => <button key={planet.name} className={`${styles.planetButton} ${selected.planet.name === planet.name ? styles.active : ""}`} style={{ "--planet-color": planet.color } as React.CSSProperties} onClick={() => { setMode("ship"); setSelected({ kind: "planet", planet }); }}>{planet.name}</button>)}</div><div className={styles.controls}><button onClick={() => setMode(mode === "ship" ? "map" : "ship")}>{mode === "ship" ? "VIEW SYSTEM MAP" : "ENTER SHIP"}</button><button onClick={() => { setMode("ship"); setSelected({ kind: "planet", planet: planets[2] }); }}>RETURN TO EARTH</button></div></aside>
    <div className={styles.hint}>{mode === "ship" ? <><b>Click canvas to enter cockpit</b><br />WASD / ARROWS: FLY · SHIFT: BOOST</> : <><b>SYSTEM MAP</b><br />DRAG TO ORBIT · SCROLL TO ZOOM</>}</div>
    {mode === "ship" && <div className={styles.cockpit} aria-hidden="true">
      <div className={styles.canopyTop} /><div className={styles.canopyLeft} /><div className={styles.canopyRight} />
      <div className={styles.flightReadout}><span>SHIP // EXPLORER-01</span><b>CRUISE MODE</b><span>DEST: {selectedName.toUpperCase()}</span></div>
      <div className={styles.planetIntel}><span>APPROACHING · RANGE {Math.round(range)} NAV UNITS</span><b>{selectedName.toUpperCase()}</b><p>{selectedFact}</p></div>
      <div className={styles.crosshair}><i /><i /><i /><i /><em>+</em></div>
      <div className={styles.targetBox}><span>◜</span><span>◝</span><span>◟</span><span>◞</span><b>TARGET LOCK</b></div>
      <div className={styles.console}>
        <div className={styles.gauge}><div><b>72</b><small>THRUST</small></div></div>
        <div className={styles.radar}><i /><i /><i /><b>◉</b><small>NAV RADAR</small></div>
        <div className={styles.gauge}><div><b>98</b><small>HULL</small></div></div>
      </div>
      <div className={styles.cockpitLeft}>NAV SYS<br /><b>ONLINE</b></div><div className={styles.cockpitRight}>DRIVE<br /><b>READY</b></div>
    </div>}
  </main>;
}
