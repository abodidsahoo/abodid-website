import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Artist } from "../../lib/artist-globe/data";
import {
  EARTH_RADIUS_KM,
  MIN_CAMERA_RADIUS,
  MAX_CAMERA_RADIUS,
  nearestArtistIndex,
  spinPose,
} from "../../lib/artist-globe/geography";
export function position(latitude: number, longitude: number, radius = 1.006) {
  const lat = (latitude * Math.PI) / 180,
    lon = (longitude * Math.PI) / 180;
  return new THREE.Vector3(
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.sin(lat),
    -radius * Math.cos(lat) * Math.sin(lon),
  );
}
type Label = [string, number, number, "region" | "city"];
export async function createGlobe(
  host: HTMLElement,
  artists: Artist[],
  onReady: () => void,
  onSpotlight: (artist: Artist) => void = () => {},
) {
  const surface = document.createElement("div");
  surface.className = "globe-surface";
  host.prepend(surface);
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setClearColor(0, 0);
  surface.append(renderer.domElement);
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "group");
  canvas.setAttribute(
    "aria-label",
    "Artist globe. Drag or flick to rotate, pinch or scroll to zoom. Arrow keys rotate; plus and minus zoom.",
  );
  const camera = new THREE.PerspectiveCamera(38, 1, 0.015, 30),
    scene = new THREE.Scene();
  const initial = artists[Math.floor(Math.random() * artists.length)];
  camera.position.copy(position(initial.latitude, initial.longitude, 4.15));
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.rotateSpeed = 0.6;
  controls.minDistance = MIN_CAMERA_RADIUS;
  controls.maxDistance = MAX_CAMERA_RADIUS;
  controls.minPolarAngle = 0.07;
  controls.maxPolarAngle = Math.PI - 0.07;
  scene.add(new THREE.AmbientLight(0xffffff, 1.65));
  const light = new THREE.DirectionalLight(0xffffff, 2.05);
  light.position.set(-3, 5, 4);
  scene.add(light);
  const globe = new THREE.Group();
  scene.add(globe);
  const seaGeometry = new THREE.IcosahedronGeometry(1, 4),
    seaMaterial = new THREE.MeshStandardMaterial({
      color: 0x2444ca,
      roughness: 1,
      flatShading: true,
    });
  globe.add(new THREE.Mesh(seaGeometry, seaMaterial));
  const landMaterial = new THREE.MeshStandardMaterial({
    color: 0xfff8e8,
    roughness: 1,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  const abort = new AbortController();
  let disposed = false;
  let landGeometry: THREE.BufferGeometry | undefined;
  try {
    const response = await fetch("/data/artist-globe/land-mesh.json", {
      signal: AbortSignal.any([abort.signal, AbortSignal.timeout(12000)]),
    });
    if (!response.ok) throw Error("Geography unavailable");
    const data = await response.json();
    landGeometry = new THREE.BufferGeometry();
    landGeometry.setAttribute(
      "position",
      new THREE.Int16BufferAttribute(data.positions, 3, true),
    );
    landGeometry.setIndex(data.indices);
    landGeometry.computeVertexNormals();
    const land = new THREE.Mesh(landGeometry, landMaterial);
    land.scale.setScalar(1.003);
    globe.add(land);
  } catch (error) {
    renderer.dispose();
    controls.dispose();
    seaGeometry.dispose();
    seaMaterial.dispose();
    landGeometry?.dispose();
    landMaterial.dispose();
    surface.remove();
    throw error;
  }
  const locations = artists.map((a) => position(a.latitude, a.longitude));
  const dotsGeometry = new THREE.BufferGeometry().setFromPoints(locations),
    dotsMaterial = new THREE.PointsMaterial({
      color: 0xffe44f,
      size: 4.5,
      sizeAttenuation: false,
    });
  globe.add(new THREE.Points(dotsGeometry, dotsMaterial));
  const radarLine =
    host.parentElement?.querySelector<SVGLineElement>(".radar-link line");
  const buttons = artists.map((a) =>
    host.querySelector<HTMLButtonElement>(
      `[data-marker="${CSS.escape(a.id)}"]`,
    ),
  );
  const labelLayer = document.createElement("div");
  labelLayer.className = "geo-labels";
  labelLayer.setAttribute("aria-hidden", "true");
  host.append(labelLayer);
  const labelPool = Array.from({ length: 28 }, () => {
    const span = document.createElement("span");
    span.hidden = true;
    labelLayer.append(span);
    return span;
  });
  let labels: { label: Label; point: THREE.Vector3 }[] = [],
    labelsRequested = false;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let width = 1,
    height = 1,
    frame = 0,
    running = false,
    visible = true,
    force = true,
    last = performance.now(),
    targetRadius = 4.15,
    destination: THREE.Vector3 | null = null,
    activeId = "",
    spin: {
      start: number;
      elapsed: number;
      from: { lng: number; lat: number; bearing: number };
      target: Artist;
      direction: number;
      radius: number;
      resolve: (value: boolean) => void;
    } | null = null;
  const projected = new THREE.Vector3(),
    direction = new THREE.Vector3(),
    localDirection = new THREE.Vector3(),
    normal = new THREE.Vector3(),
    towardCamera = new THREE.Vector3(),
    rotation = new THREE.Quaternion(),
    partial = new THREE.Quaternion(),
    from = new THREE.Vector3(),
    to = new THREE.Vector3();
  const requestLabels = () => {
    if (labelsRequested) return;
    labelsRequested = true;
    fetch("/data/artist-globe/labels.json", { signal: abort.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Label[]) => {
        if (disposed) return;
        labels = data.map((label) => ({
          label,
          point: position(label[1], label[2], 1.008),
        }));
        wake();
      })
      .catch(() => {});
  };
  const stopSpin = (complete = false) => {
    if (spin) {
      const resolve = spin.resolve;
      spin = null;
      controls.enabled = true;
      resolve(complete);
    }
  };
  function wake() {
    force = true;
    if (!running && visible && !document.hidden && !disposed) {
      running = true;
      last = performance.now();
      frame = requestAnimationFrame(draw);
    }
  }
  function draw(now: number) {
    if (disposed || !visible || document.hidden) {
      running = false;
      return;
    }
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (spin) {
      spin.elapsed += dt * 1000;
      const p = Math.min(1, spin.elapsed / 3000),
        pose = spinPose(
          spin.from,
          { lng: spin.target.longitude, lat: spin.target.latitude },
          p,
          spin.direction,
        );
      camera.position.copy(
        position(
          Math.max(-85, Math.min(85, pose.lat)),
          pose.lng,
          spin.radius + (4.15 - spin.radius) * Math.min(1, p * 4),
        ),
      );
      targetRadius = camera.position.length();
      globe.rotation.z = ((pose.bearing * Math.PI) / 180) * 0.12;
      if (p >= 1) {
        camera.position.copy(
          position(spin.target.latitude, spin.target.longitude, 4.15),
        );
        targetRadius = 4.15;
        globe.rotation.z = 0;
        stopSpin(true);
      }
    } else if (destination) {
      from.copy(camera.position).normalize();
      to.copy(destination).normalize();
      rotation.setFromUnitVectors(from, to);
      partial
        .identity()
        .slerp(rotation, reduced.matches ? 1 : 1 - Math.exp(-dt * 8));
      camera.position.applyQuaternion(partial);
      if (from.angleTo(to) < 0.001) destination = null;
    }
    const oldRadius = camera.position.length(),
      gap = oldRadius - 1,
      targetGap = targetRadius - 1;
    camera.position.setLength(
      1 +
        Math.exp(
          THREE.MathUtils.lerp(
            Math.log(gap),
            Math.log(targetGap),
            reduced.matches ? 1 : 1 - Math.exp(-dt * 12),
          ),
        ),
    );
    controls.enableDamping = !reduced.matches;
    controls.dampingFactor = 1 - Math.exp(-dt * 4.8);
    controls.rotateSpeed =
      0.6 * Math.min(1, Math.max(0.05, (camera.position.length() - 1) / 1.6));
    const changed = controls.update(dt),
      moving =
        changed ||
        !!spin ||
        !!destination ||
        Math.abs(camera.position.length() - targetRadius) > 0.00001;
    host.dataset.moving = String(moving);
    host.dataset.altitudeKm = (
      (camera.position.length() - 1) *
      EARTH_RADIUS_KM
    ).toFixed(1);
    host.dataset.radius = camera.position.length().toFixed(5);
    if (changed || moving || force) {
      force = false;
      globe.updateMatrixWorld(true);
      camera.updateMatrixWorld();
      renderer.render(scene, camera);
      direction.copy(camera.position).normalize();
      localDirection
        .copy(direction)
        .applyQuaternion(globe.quaternion.clone().invert());
      host.dataset.view = localDirection
        .toArray()
        .map((value) => value.toFixed(6))
        .join(",");
      const index = nearestArtistIndex(localDirection, locations),
        active = artists[index];
      if (active && active.id !== activeId) {
        activeId = active.id;
        host.dataset.spotlight = activeId;
        onSpotlight(active);
      }
      const points = locations.map((point) =>
        point.clone().applyMatrix4(globe.matrixWorld),
      );
      points.forEach((point, i) => {
        const button = buttons[i];
        if (!button) return;
        normal.copy(point).normalize();
        towardCamera.copy(camera.position).sub(point).normalize();
        projected.copy(point).project(camera);
        const x = (projected.x * 0.5 + 0.5) * width,
          y = (-projected.y * 0.5 + 0.5) * height;
        button.hidden =
          normal.dot(towardCamera) < 0.02 ||
          projected.z > 1 ||
          x < 0 ||
          y < 0 ||
          x > width ||
          y > height ||
          (x < 168 && y < 74) ||
          y > height - 54;
        button.dataset.spotlight = String(artists[i].id === activeId);
        if (!button.hidden)
          button.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
        if (artists[i].id === activeId && radarLine) {
          radarLine.setAttribute("x1", String(width / 2));
          radarLine.setAttribute("y1", String(height / 2));
          radarLine.setAttribute("x2", String(x));
          radarLine.setAttribute("y2", String(y));
          radarLine.style.opacity = button.hidden ? "0" : "1";
        }
      });
      labelPool.forEach((label) => {
        label.hidden = true;
      });
      if (camera.position.length() < 1.8) {
        requestLabels();
        const candidates = labels
          .filter(
            ({ label, point }) =>
              (label[3] !== "city" || camera.position.length() < 1.3) &&
              point.dot(localDirection) > 0.9 * 1.008,
          )
          .map((item) => ({ ...item, score: item.point.dot(localDirection) }))
          .sort((a, b) => b.score - a.score);
        const occupied: [number, number][] = [];
        let used = 0;
        for (const item of candidates) {
          if (used >= labelPool.length) break;
          projected
            .copy(item.point)
            .applyMatrix4(globe.matrixWorld)
            .project(camera);
          const x = (projected.x * 0.5 + 0.5) * width,
            y = (-projected.y * 0.5 + 0.5) * height;
          if (
            projected.z > 1 ||
            x < 45 ||
            x > width - 45 ||
            y < 74 ||
            y > height - 65 ||
            Math.hypot(x - width / 2, y - height / 2) < 70 ||
            occupied.some(
              ([px, py]) => Math.abs(px - x) < 110 && Math.abs(py - y) < 27,
            )
          )
            continue;
          const label = labelPool[used++];
          label.textContent = item.label[0];
          label.className = item.label[3];
          label.hidden = false;
          label.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
          occupied.push([x, y]);
        }
      }
    }
    if (moving) {
      frame = requestAnimationFrame(draw);
    } else running = false;
  }
  const resize = new ResizeObserver(([entry]) => {
    width = entry.contentRect.width;
    height = entry.contentRect.height;
    if (width && height) {
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      wake();
    }
  });
  resize.observe(host);
  const interrupt = () => {
    stopSpin();
    destination = null;
    wake();
  };
  controls.addEventListener("start", interrupt);
  controls.addEventListener("change", wake);
  controls.addEventListener("end", wake);
  const zoomBy = (amount: number) => {
    stopSpin();
    targetRadius =
      1 +
      THREE.MathUtils.clamp(
        (targetRadius - 1) * Math.exp(amount),
        MIN_CAMERA_RADIUS - 1,
        MAX_CAMERA_RADIUS - 1,
      );
    wake();
  };
  const wheel = (event: WheelEvent) => {
    event.preventDefault();
    zoomBy(
      THREE.MathUtils.clamp(
        event.deltaY * (event.deltaMode === 1 ? 16 : 1) * 0.0018,
        -0.6,
        0.6,
      ),
    );
  };
  host.addEventListener("wheel", wheel, { passive: false });
  let pinchDistance = 0,
    pinchRadius = 0,
    pinching = false;
  const distance = (t: TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const touchStart = (event: TouchEvent) => {
    if (event.touches.length === 2) {
      event.preventDefault();
      event.stopPropagation();
      interrupt();
      pinching = true;
      pinchDistance = distance(event.touches);
      pinchRadius = targetRadius;
      controls.enabled = false;
    }
  };
  const touchMove = (event: TouchEvent) => {
    if (pinching) {
      event.preventDefault();
      event.stopPropagation();
      if (event.touches.length === 2) {
        targetRadius =
          1 +
          THREE.MathUtils.clamp(
            ((pinchRadius - 1) * pinchDistance) / distance(event.touches),
            MIN_CAMERA_RADIUS - 1,
            MAX_CAMERA_RADIUS - 1,
          );
        wake();
      }
    }
  };
  const touchEnd = (event: TouchEvent) => {
    if (pinching && event.touches.length < 2) {
      pinching = false;
      controls.enabled = true;
      wake();
    }
  };
  const gestureStart = (event: Event) => {
    event.preventDefault();
    pinchRadius = targetRadius;
  };
  const gestureChange = (event: Event) => {
    event.preventDefault();
    const scale = (event as Event & { scale: number }).scale;
    if (scale > 0) {
      targetRadius =
        1 +
        THREE.MathUtils.clamp(
          (pinchRadius - 1) / scale,
          MIN_CAMERA_RADIUS - 1,
          MAX_CAMERA_RADIUS - 1,
        );
      wake();
    }
  };
  host.addEventListener("touchstart", touchStart, {
    capture: true,
    passive: false,
  });
  host.addEventListener("touchmove", touchMove, {
    capture: true,
    passive: false,
  });
  host.addEventListener("touchend", touchEnd);
  host.addEventListener("touchcancel", touchEnd);
  host.addEventListener("gesturestart", gestureStart, { passive: false });
  host.addEventListener("gesturechange", gestureChange, { passive: false });
  const key = (event: KeyboardEvent) => {
    const s = new THREE.Spherical().setFromVector3(camera.position);
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoomBy(-0.25);
      return;
    }
    if (event.key === "-") {
      event.preventDefault();
      zoomBy(0.25);
      return;
    }
    if (event.key === "ArrowLeft") s.theta -= 0.16;
    else if (event.key === "ArrowRight") s.theta += 0.16;
    else if (event.key === "ArrowUp") s.phi = Math.max(0.07, s.phi - 0.16);
    else if (event.key === "ArrowDown")
      s.phi = Math.min(Math.PI - 0.07, s.phi + 0.16);
    else return;
    event.preventDefault();
    interrupt();
    destination = new THREE.Vector3().setFromSpherical(s);
    wake();
  };
  canvas.addEventListener("keydown", key);
  const visibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      running = false;
    } else wake();
  };
  document.addEventListener("visibilitychange", visibility);
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (!visible) {
      cancelAnimationFrame(frame);
      running = false;
    } else wake();
  });
  observer.observe(host);
  wake();
  onReady();
  return {
    focus(artist: Artist) {
      stopSpin();
      destination = position(artist.latitude, artist.longitude);
      wake();
    },
    zoom(direction: number) {
      zoomBy(direction * 0.3);
    },
    reset() {
      targetRadius = 4.15;
      wake();
    },
    async discover(artist: Artist) {
      stopSpin();
      destination = null;
      const current = camera.position.clone().normalize();
      if (reduced.matches) {
        camera.position.copy(position(artist.latitude, artist.longitude, 4.15));
        targetRadius = 4.15;
        force = true;
        wake();
        return true;
      }
      controls.enabled = false;
      return new Promise<boolean>((resolve) => {
        spin = {
          start: performance.now(),
          elapsed: 0,
          from: {
            lng: (Math.atan2(-current.z, current.x) * 180) / Math.PI,
            lat: (Math.asin(current.y) * 180) / Math.PI,
            bearing: 0,
          },
          target: artist,
          direction: Math.random() < 0.5 ? -1 : 1,
          radius: camera.position.length(),
          resolve,
        };
        wake();
      });
    },
    dispose() {
      disposed = true;
      abort.abort();
      stopSpin();
      cancelAnimationFrame(frame);
      resize.disconnect();
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      controls.removeEventListener("start", interrupt);
      controls.removeEventListener("change", wake);
      controls.removeEventListener("end", wake);
      controls.dispose();
      canvas.removeEventListener("keydown", key);
      host.removeEventListener("wheel", wheel);
      host.removeEventListener("touchstart", touchStart, true);
      host.removeEventListener("touchmove", touchMove, true);
      host.removeEventListener("touchend", touchEnd);
      host.removeEventListener("touchcancel", touchEnd);
      host.removeEventListener("gesturestart", gestureStart);
      host.removeEventListener("gesturechange", gestureChange);
      seaGeometry.dispose();
      seaMaterial.dispose();
      landGeometry?.dispose();
      landMaterial.dispose();
      dotsGeometry.dispose();
      dotsMaterial.dispose();
      renderer.dispose();
      surface.remove();
      labelLayer.remove();
    },
  };
}
