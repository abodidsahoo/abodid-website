import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export type DieFlick = {
  x: number;
  y: number;
  velocity?: { x: number; y: number };
};
export function createDie(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    // Supersample this small canvas instead of resolving transparent MSAA edges.
    antialias: false,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(3, Math.max(2, devicePixelRatio * 1.5)));
  renderer.setSize(112, 112, false);
  renderer.setClearColor(0, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(
    -1.05,
    1.05,
    1.05,
    -1.05,
    0.1,
    12,
  );
  camera.position.set(0, 0, 5);
  const environment = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const lighting = pmrem.fromScene(environment, 0.04);
  scene.environment = lighting.texture;
  environment.dispose();
  pmrem.dispose();
  const key = new THREE.DirectionalLight(0xffffff, 3);
  key.position.set(-3, 5, 4);
  scene.add(key, new THREE.AmbientLight(0xffffff, 0.6));
  const die = new THREE.Group();
  scene.add(die);
  const geometry = new RoundedBoxGeometry(1, 1, 1, 8, 0.14);
  const plastic = new THREE.MeshPhysicalMaterial({
    color: 0xffed8f,
    roughness: 0.2,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    envMapIntensity: 0.75,
  });
  const ink = new THREE.MeshStandardMaterial({
    color: 0x171f48,
    roughness: 0.4,
  });
  die.add(new THREE.Mesh(geometry, plastic));
  const pipGeometry = new THREE.SphereGeometry(0.069, 24, 16);
  const dots = [
    [[0, 0]],
    [
      [-1, 1],
      [1, -1],
    ],
    [
      [-1, 1],
      [0, 0],
      [1, -1],
    ],
    [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ],
    [
      [-1, -1],
      [-1, 1],
      [0, 0],
      [1, -1],
      [1, 1],
    ],
    [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ],
  ];
  // Opposite faces sum to seven; the shallow pips sit flush in each face.
  const faces = [
    { number: 1, normal: [0, 0, 1] },
    { number: 6, normal: [0, 0, -1] },
    { number: 2, normal: [0, 1, 0] },
    { number: 5, normal: [0, -1, 0] },
    { number: 3, normal: [1, 0, 0] },
    { number: 4, normal: [-1, 0, 0] },
  ];
  for (const face of faces) {
    const panel = new THREE.Group();
    panel.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3().fromArray(face.normal),
    );
    for (const [x, y] of dots[face.number - 1]) {
      const pip = new THREE.Mesh(pipGeometry, ink);
      pip.scale.z = 0.12;
      pip.position.set(x * 0.23, y * 0.23, 0.499);
      panel.add(pip);
    }
    die.add(panel);
  }
  const rest = new THREE.Vector3(0.4, -0.58, -0.12);
  let frame = 0,
    disposed = false,
    finish: (() => void) | undefined;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const render = () => {
    die.updateMatrixWorld();
    renderer.render(scene, camera);
  };
  const settle = () => {
    die.rotation.set(rest.x, rest.y, rest.z);
    die.position.set(0, 0, 0);
    render();
  };
  settle();
  return {
    preview({ x, y }: DieFlick) {
      if (disposed || reduced.matches) return;
      die.rotation.set(
        rest.x + y * 0.013,
        rest.y + x * 0.013,
        rest.z + x * 0.002,
      );
      render();
    },
    reset() {
      if (!disposed) settle();
    },
    roll(flick: DieFlick) {
      if (disposed) return Promise.resolve();
      cancelAnimationFrame(frame);
      finish?.();
      const start = new THREE.Vector3(
        die.rotation.x,
        die.rotation.y,
        die.rotation.z,
      );
      const sign = (value: number) =>
        Math.abs(value) > 4 ? Math.sign(value) : Math.random() < 0.5 ? -1 : 1;
      const next = new THREE.Vector3(0.4, -0.58, -0.12).add(
        new THREE.Vector3().fromArray(
          [0, 1, 2].map(() => (Math.floor(Math.random() * 4) * Math.PI) / 2),
        ),
      );
      const velocity = flick.velocity;
      const speed = velocity ? Math.hypot(velocity.x, velocity.y) : 0;
      const revolutions = velocity
        ? Math.min(5, 1 + Math.floor(speed / 300))
        : 3;
      const direction = velocity && speed > 20 ? velocity : flick;
      canvas.dataset.rollTurns = String(revolutions);
      const turns = new THREE.Vector3(
        sign(direction.y) * Math.PI * 2 * revolutions,
        sign(direction.x) * Math.PI * 2 * revolutions,
        sign(direction.x + direction.y) * Math.PI * 2,
      );
      const end = next.clone().add(turns);
      const started = performance.now();
      return new Promise<void>((resolve) => {
        finish = resolve;
        const tick = (now: number) => {
          if (disposed) return;
          const progress = reduced.matches
            ? 1
            : Math.min(1, (now - started) / 2800);
          const ease = 1 - Math.pow(1 - progress, 4);
          const angles = start.clone().lerp(end, ease);
          die.rotation.set(angles.x, angles.y, angles.z);
          const lift = Math.sin(progress * Math.PI) * (1 - progress);
          die.position.set(
            THREE.MathUtils.clamp(flick.x / 500, -0.15, 0.15) * lift,
            lift * (0.2 + revolutions * 0.05),
            0,
          );
          render();
          if (progress < 1) frame = requestAnimationFrame(tick);
          else {
            rest.copy(next);
            settle();
            finish = undefined;
            resolve();
          }
        };
        tick(started);
      });
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      finish?.();
      geometry.dispose();
      pipGeometry.dispose();
      plastic.dispose();
      ink.dispose();
      lighting.dispose();
      renderer.dispose();
    },
  };
}
