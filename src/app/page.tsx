"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import styles from "./page.module.css";

type Planet = {
  name: string;
  color: string;
  size: number;
  distance: number;
  speed: number;
  detail: string;
  moons?: Moon[];
  ring?: boolean;
};

type Moon = { name: string; distance: number; size: number; color: string; speed: number };
type Destination = { kind: "planet"; planet: Planet } | { kind: "moon"; planet: Planet; moon: Moon };

const planets: Planet[] = [
  { name: "Mercury", color: "#a69a8c", size: .28, distance: 4.2, speed: .24, detail: "The swiftest world, baked by the Sun." },
  { name: "Venus", color: "#d8a85d", size: .48, distance: 5.7, speed: .18, detail: "A world wrapped in golden clouds." },
  { name: "Earth", color: "#3987e7", size: .55, distance: 7.35, speed: .14, detail: "Our blue home, with one bright companion.", moons: [{ name: "Moon", distance: 1.1, size: .14, color: "#c9c5ba", speed: .32 }] },
  { name: "Mars", color: "#c45b3e", size: .38, distance: 8.9, speed: .11, detail: "The rust-red frontier.", moons: [{ name: "Phobos", distance: .72, size: .07, color: "#9e8879", speed: .44 }] },
  { name: "Jupiter", color: "#d69b70", size: 1.15, distance: 11.7, speed: .06, detail: "The giant planet and its stormy bands.", moons: [{ name: "Europa", distance: 1.75, size: .12, color: "#d8ccb2", speed: .28 }, { name: "Ganymede", distance: 2.15, size: .18, color: "#a99b84", speed: .2 }] },
  { name: "Saturn", color: "#e1c082", size: .95, distance: 15.3, speed: .04, detail: "The ringed jewel of the solar system.", ring: true, moons: [{ name: "Titan", distance: 1.85, size: .16, color: "#c7985a", speed: .19 }] },
  { name: "Uranus", color: "#82d0db", size: .7, distance: 18.6, speed: .03, detail: "A cool blue ice giant, tilted sideways." },
  { name: "Neptune", color: "#417bd8", size: .68, distance: 21.7, speed: .02, detail: "A deep-blue world at the edge of our tour." },
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

function Moon({ moon, planet, onSelect }: { moon: Moon; planet: Planet; onSelect: (destination: Destination) => void }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (group.current) group.current.rotation.y = clock.getElapsedTime() * moon.speed;
  });
  return <group ref={group}><mesh position={[moon.distance, 0, 0]} onClick={(event) => { event.stopPropagation(); onSelect({ kind: "moon", planet, moon }); }}><sphereGeometry args={[moon.size, 24, 16]} /><meshStandardMaterial color={moon.color} roughness={.9} /></mesh></group>;
}

function PlanetBody({ planet, selected, onSelect }: { planet: Planet; selected: boolean; onSelect: (destination: Destination) => void }) {
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * planet.speed;
    if (group.current) group.current.position.set(Math.cos(t) * planet.distance, Math.sin(t * .45) * .22, Math.sin(t) * planet.distance);
    if (mesh.current) mesh.current.rotation.y += .004;
  });
  return <group ref={group} onClick={(event) => { event.stopPropagation(); onSelect({ kind: "planet", planet }); }}>
    <mesh ref={mesh} castShadow><sphereGeometry args={[planet.size, 40, 28]} /><meshStandardMaterial color={planet.color} roughness={.72} metalness={.05} emissive={planet.color} emissiveIntensity={selected ? .25 : .04} /></mesh>
    {selected && <mesh scale={1.25}><sphereGeometry args={[planet.size, 32, 20]} /><meshBasicMaterial color={planet.color} transparent opacity={.1} side={THREE.BackSide} /></mesh>}
    {planet.ring && <mesh rotation={[Math.PI / 2.45, 0, 0]}><ringGeometry args={[1.25, 1.8, 80]} /><meshBasicMaterial color="#d9c090" transparent opacity={.65} side={THREE.DoubleSide} /></mesh>}
    {planet.moons?.map((moon) => <Moon key={moon.name} moon={moon} planet={planet} onSelect={onSelect} />)}
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
  useFrame(({ clock }) => {
    if (target !== lastTarget.current) {
      const planet = target.planet;
      const t = clock.getElapsedTime() * planet.speed;
      focus.current.set(Math.cos(t) * planet.distance, Math.sin(t * .45) * .22, Math.sin(t) * planet.distance);
      if (target.kind === "moon") {
        const moonT = clock.getElapsedTime() * target.moon.speed;
        focus.current.add(new THREE.Vector3(Math.cos(moonT) * target.moon.distance, 0, -Math.sin(moonT) * target.moon.distance));
      }
      const size = target.kind === "moon" ? target.moon.size : planet.size;
      flightFocus.current.copy(focus.current);
      flightPosition.current.copy(focus.current).add(new THREE.Vector3(Math.max(2, size * 7), 1.7, Math.max(2, size * 7)));
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
  return <OrbitControls ref={controls} enableDamping dampingFactor={.07} minDistance={2.2} maxDistance={45} />;
}

function Nebula() {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => { if (group.current) group.current.rotation.y += delta * .012; });
  return <group ref={group} position={[-18, 6, -15]} rotation={[.3, 0, .2]}>
    {[[0, 0, 0, 5.5], [3, 1, -1, 4], [-3, -1, 1, 3.8]].map(([x, y, z, scale], index) => <mesh key={index} position={[x, y, z]} scale={scale}>
      <sphereGeometry args={[1, 32, 24]} /><meshBasicMaterial color={index === 1 ? "#9f80ff" : "#377fce"} transparent opacity={.045} depthWrite={false} />
    </mesh>)}
  </group>;
}

function SolarSystem({ selected, onSelect }: { selected: Destination; onSelect: (destination: Destination) => void }) {
  return <Canvas camera={{ position: [11, 8, 22], fov: 48 }} dpr={[1, 1.75]} gl={{ antialias: true }}>
    <color attach="background" args={["#02030b"]} />
    <fog attach="fog" args={["#02030b", 25, 58]} />
    <ambientLight intensity={.12} />
    <pointLight position={[0, 0, 0]} color="#ffbf6b" intensity={220} distance={42} decay={1.5} />
    <Stars radius={80} depth={45} count={4000} factor={3} saturation={0} fade speed={.3} />
    <Dust />
    <Nebula />
    <mesh><sphereGeometry args={[2.3, 64, 48]} /><meshBasicMaterial color="#ffb34f" /><pointLight color="#ff8b38" intensity={14} distance={8} /></mesh>
    <mesh scale={1.12}><sphereGeometry args={[2.3, 64, 48]} /><meshBasicMaterial color="#ff8b38" transparent opacity={.12} side={THREE.BackSide} /></mesh>
    {planets.map((planet) => <PlanetBody key={planet.name} planet={planet} selected={selected.planet.name === planet.name} onSelect={onSelect} />)}
    <CameraFlight target={selected} />
  </Canvas>;
}

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
