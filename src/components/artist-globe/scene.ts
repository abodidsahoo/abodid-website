import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Artist } from "../../lib/artist-globe/data";
export function position(latitude: number, longitude: number, radius = 1.015) {
  const lat = (latitude * Math.PI) / 180,
    lon = (longitude * Math.PI) / 180;
  return new THREE.Vector3(
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.sin(lat),
    -radius * Math.cos(lat) * Math.sin(lon),
  );
}
export async function createGlobe(
  host: HTMLElement,
  artists: Artist[],
  onReady: () => void,
  onStop: () => void = () => {},
) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setClearColor(0, 0);
  host.prepend(renderer.domElement);
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute(
    "aria-label",
    "Interactive Earth. Drag to rotate, pinch or scroll to zoom. Arrow keys rotate; plus and minus zoom. Artist list follows.",
  );
  renderer.domElement.setAttribute("role", "group");
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 30);
  const initial = position(
    10 + Math.random() * 35,
    Math.random() * 360 - 180,
    3.65,
  );
  camera.position.copy(initial);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.minDistance = 3.2;
  controls.maxDistance = 4.6;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.55;
  controls.minPolarAngle = 0.24;
  controls.maxPolarAngle = Math.PI - 0.24;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  controls.autoRotate = !reduced.matches;
  controls.autoRotateSpeed = 0.22;
  scene.add(new THREE.AmbientLight(0xffffff, 2.1));
  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(-3, 5, 4);
  scene.add(light);
  const globe = new THREE.Group();
  scene.add(globe);
  const geometry = new THREE.SphereGeometry(1, 80, 48);
  const material = new THREE.MeshStandardMaterial({
    color: 0x2444ca,
    roughness: 1,
    metalness: 0,
    flatShading: true,
  });
  globe.add(new THREE.Mesh(geometry, material));
  let texture: THREE.CanvasTexture | undefined;
  let disposed = false;
  const abort = new AbortController();
  try {
    const response = await fetch("/data/artist-globe/land.json", {
      signal: AbortSignal.any([abort.signal, AbortSignal.timeout(10000)]),
    });
    if (!response.ok) throw Error("Geography unavailable");
    const polygons: number[][][][] = await response.json();
    if (disposed) return;
    const map = document.createElement("canvas");
    map.width = 2048;
    map.height = 1024;
    const ctx = map.getContext("2d")!;
    ctx.fillStyle = "#2444ca";
    ctx.fillRect(0, 0, map.width, map.height);
    ctx.fillStyle = "#fff8e8";
    for (const polygon of polygons) {
      ctx.beginPath();
      for (const ring of polygon)
        ring.forEach(([lon, lat], i) => {
          const x = ((lon + 180) / 360) * map.width,
            y = ((90 - lat) / 180) * map.height;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
      ctx.closePath();
      ctx.fill("evenodd");
    }
    // SphereGeometry's UV seam is at -X; longitude zero faces +X.
    texture = new THREE.CanvasTexture(map);
    texture.colorSpace = THREE.SRGBColorSpace;
    material.color.set(0xffffff);
    material.map = texture;
    material.needsUpdate = true;
  } catch (error) {
    renderer.dispose();
    controls.dispose();
    geometry.dispose();
    material.dispose();
    renderer.domElement.remove();
    throw error;
  }
  const gridMaterial = new THREE.LineBasicMaterial({
    color: 0xfff8e8,
    transparent: true,
    opacity: 0.13,
  });
  const grid = new THREE.Group();
  globe.add(grid);
  for (let lat = -60; lat <= 60; lat += 30) {
    const points = Array.from({ length: 129 }, (_, i) =>
      position(lat, (i / 128) * 360 - 180, 1.003),
    );
    grid.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        gridMaterial,
      ),
    );
  }
  for (let lon = -180; lon < 180; lon += 30) {
    const points = Array.from({ length: 65 }, (_, i) =>
      position((i / 64) * 180 - 90, lon, 1.003),
    );
    grid.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        gridMaterial,
      ),
    );
  }
  const markerGeometry = new THREE.SphereGeometry(0.009, 8, 6);
  const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xffe44f });
  const markers = new THREE.InstancedMesh(
    markerGeometry,
    markerMaterial,
    artists.length,
  );
  const dummy = new THREE.Object3D();
  const locations = artists.map((a) => position(a.latitude, a.longitude));
  locations.forEach((p, i) => {
    dummy.position.copy(p);
    dummy.updateMatrix();
    markers.setMatrixAt(i, dummy.matrix);
  });
  globe.add(markers);
  const buttons = artists.map((a) =>
    host.querySelector<HTMLButtonElement>(
      `[data-marker="${CSS.escape(a.id)}"]`,
    ),
  );
  let width = 1,
    height = 1,
    visible = true,
    frame = 0,
    last = performance.now(),
    targetZoom = 3.65;
  let destination: THREE.Vector3 | null = null;
  const resize = new ResizeObserver(([entry]) => {
    width = entry.contentRect.width;
    height = entry.contentRect.height;
    if (width && height) {
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
  });
  resize.observe(host);
  let running = true;
  const projection = new THREE.Vector3(),
    normal = new THREE.Vector3(),
    towardCamera = new THREE.Vector3();
  const arc = new THREE.Quaternion(),
    easedArc = new THREE.Quaternion();
  const from = new THREE.Vector3(),
    to = new THREE.Vector3();
  const draw = (now: number) => {
    if (!running || disposed) return;
    const delta = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (destination) {
      // Travel along the sphere instead of cutting through the planet.
      from.copy(camera.position).normalize();
      to.copy(destination).normalize();
      arc.setFromUnitVectors(from, to);
      easedArc
        .identity()
        .slerp(arc, reduced.matches ? 1 : 1 - Math.exp(-delta * 6));
      camera.position.applyQuaternion(easedArc);
      if (from.angleTo(to) < 0.002) destination = null;
    }
    // Interpolate log radius: wheel, buttons and pinch share the same bounded zoom.
    const zoomBlend = reduced.matches ? 1 : 1 - Math.exp(-delta * 12);
    camera.position.setLength(
      Math.exp(
        THREE.MathUtils.lerp(
          Math.log(camera.position.length()),
          Math.log(targetZoom),
          zoomBlend,
        ),
      ),
    );
    controls.update(delta);
    globe.rotation.z =
      reduced.matches || !controls.autoRotate
        ? 0
        : Math.sin(now * 0.00045) * 0.012;
    globe.updateMatrixWorld(true);
    gridMaterial.opacity = camera.position.length() < 3.5 ? 0.19 : 0.09;
    renderer.render(scene, camera);
    const occupied: [number, number][] = [];
    locations.forEach((point, i) => {
      const button = buttons[i];
      if (!button) return;
      projection.copy(point).applyMatrix4(globe.matrixWorld);
      normal.copy(projection).normalize();
      towardCamera.copy(camera.position).sub(projection).normalize();
      projection.project(camera);
      const x = (projection.x * 0.5 + 0.5) * width,
        y = (-projection.y * 0.5 + 0.5) * height;
      const hidden =
        normal.dot(towardCamera) < 0.12 ||
        projection.z > 1 ||
        occupied.some(([px, py]) => Math.hypot(px - x, py - y) < 30);
      button.hidden = hidden;
      if (!hidden) {
        occupied.push([x, y]);
        button.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
      }
    });
    frame = requestAnimationFrame(draw);
  };
  const start = () => {
    if (!running) {
      running = true;
      last = performance.now();
      frame = requestAnimationFrame(draw);
    }
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(frame);
  };
  const visibility = () => {
    if (document.hidden || !visible) stop();
    else start();
  };
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    visibility();
  });
  intersection.observe(host);
  document.addEventListener("visibilitychange", visibility);
  const motion = () => {
    controls.enableDamping = !reduced.matches;
    controls.autoRotate = !reduced.matches;
    if (reduced.matches) onStop();
  };
  motion();
  reduced.addEventListener("change", motion);
  const interact = () => {
    destination = null;
    controls.autoRotate = false;
    onStop();
  };
  controls.addEventListener("start", interact);
  const wheel = (event: WheelEvent) => {
    event.preventDefault();
    interact();
    const pixels =
      event.deltaY *
      (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1);
    targetZoom = THREE.MathUtils.clamp(
      targetZoom * Math.exp(THREE.MathUtils.clamp(pixels * 0.001, -0.5, 0.5)),
      3.2,
      4.6,
    );
  };
  const touches = new Map<number, THREE.Vector2>();
  let pinchDistance = 0;
  const pointerDown = (event: PointerEvent) => {
    if (event.pointerType !== "touch") return;
    touches.set(
      event.pointerId,
      new THREE.Vector2(event.clientX, event.clientY),
    );
    if (touches.size === 2) {
      const [a, b] = [...touches.values()];
      pinchDistance = a.distanceTo(b);
    }
  };
  const pointerMove = (event: PointerEvent) => {
    if (!touches.has(event.pointerId)) return;
    touches.get(event.pointerId)!.set(event.clientX, event.clientY);
    if (touches.size === 2) {
      const [a, b] = [...touches.values()],
        distance = a.distanceTo(b);
      if (pinchDistance > 0 && distance > 0)
        targetZoom = THREE.MathUtils.clamp(
          (targetZoom * pinchDistance) / distance,
          3.2,
          4.6,
        );
      pinchDistance = distance;
    }
  };
  const pointerUp = (event: PointerEvent) => {
    touches.delete(event.pointerId);
    pinchDistance = 0;
  };
  renderer.domElement.addEventListener("wheel", wheel, { passive: false });
  renderer.domElement.addEventListener("pointerdown", pointerDown);
  renderer.domElement.addEventListener("pointermove", pointerMove);
  renderer.domElement.addEventListener("pointerup", pointerUp);
  renderer.domElement.addEventListener("pointercancel", pointerUp);
  const key = (event: KeyboardEvent) => {
    const spherical = new THREE.Spherical().setFromVector3(camera.position);
    if (event.key === "ArrowLeft") spherical.theta -= 0.12;
    else if (event.key === "ArrowRight") spherical.theta += 0.12;
    else if (event.key === "ArrowUp")
      spherical.phi = Math.max(0.24, spherical.phi - 0.12);
    else if (event.key === "ArrowDown")
      spherical.phi = Math.min(Math.PI - 0.24, spherical.phi + 0.12);
    else if (event.key === "+" || event.key === "=")
      spherical.radius = Math.max(3.2, spherical.radius * 0.9);
    else if (event.key === "-")
      spherical.radius = Math.min(4.6, spherical.radius / 0.9);
    else return;
    event.preventDefault();
    interact();
    targetZoom = spherical.radius;
    destination = new THREE.Vector3().setFromSpherical(spherical);
  };
  renderer.domElement.addEventListener("keydown", key);
  frame = requestAnimationFrame(draw);
  onReady();
  return {
    focus(artist: Artist) {
      controls.autoRotate = false;
      destination = position(
        artist.latitude,
        artist.longitude,
        camera.position.length(),
      );
    },
    zoom(direction: number) {
      targetZoom = THREE.MathUtils.clamp(
        targetZoom * Math.exp(direction * 0.14),
        3.2,
        4.6,
      );
    },
    spin(enabled: boolean) {
      controls.autoRotate = enabled;
    },
    dispose() {
      disposed = true;
      abort.abort();
      stop();
      resize.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      reduced.removeEventListener("change", motion);
      controls.dispose();
      renderer.domElement.removeEventListener("wheel", wheel);
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("pointercancel", pointerUp);
      renderer.domElement.removeEventListener("keydown", key);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Line)
          o.geometry.dispose();
      });
      texture?.dispose();
      material.dispose();
      gridMaterial.dispose();
      markers.dispose();
      markerMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
