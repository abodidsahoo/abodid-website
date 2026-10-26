import * as THREE from "three";
import { advanceSpring } from "../../lib/artist-globe/motion";
import type { MappedArtist as Artist } from "../../lib/artist-globe/data";
import {
  countryAtPoint,
  type CountryRegion,
  formatCoordinates,
  MAX_VIEW_LATITUDE,
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
type Label = [string, number, number, "country" | "region" | "city", number?];
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
  let preferredArtistId = initial.id;
  camera.position.copy(position(initial.latitude, initial.longitude, 4.15));
  let interactionEnabled = true;
  camera.lookAt(0, 0, 0);
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
    seaGeometry.dispose();
    seaMaterial.dispose();
    landGeometry?.dispose();
    landMaterial.dispose();
    surface.remove();
    throw error;
  }
  const locations = artists.map((a) => position(a.latitude, a.longitude));
  const sharedPins = new Map<string, number[]>();
  const sharedKey = (artist: Artist) =>
    `${artist.latitude.toFixed(1)},${artist.longitude.toFixed(1)}`;
  artists.forEach((artist, index) => {
    const key = sharedKey(artist);
    const group = sharedPins.get(key) || [];
    group.push(index);
    sharedPins.set(key, group);
  });
  const siblings = artists.map((artist) => sharedPins.get(sharedKey(artist))!);

  const dotsGeometry = new THREE.BufferGeometry().setFromPoints(locations),
    dotsMaterial = new THREE.PointsMaterial({
      color: 0xffe44f,
      size: 4.5,
      sizeAttenuation: false,
    });
  globe.add(new THREE.Points(dotsGeometry, dotsMaterial));
  const buttons = artists.map((a) =>
    host.querySelector<HTMLButtonElement>(
      `[data-marker="${CSS.escape(a.id)}"]`,
    ),
  );
  const labelLayer = document.createElement("div");
  labelLayer.className = "geo-labels";
  labelLayer.setAttribute("aria-hidden", "true");
  host.append(labelLayer);
  // A place owns its element for its entire lifetime, including its exit fade.
  type Place = { id: number; label: Label; point: THREE.Vector3 };
  const shownLabels = new Map<
    number,
    {
      item: Place;
      element: HTMLSpanElement;
      opacity: number;
      wanted: boolean;
      changeAt: number;
      x: number;
      y: number;
    }
  >();
  let lastLabelLayout = -Infinity,
    labelsAnimating = false;
  let countryRegions: CountryRegion[] = [],
    centralCountry: string | null = null;
  let showCountries = true,
    showPlaces = true;
  let labels: Place[] = [],
    labelsRequested = false,
    countriesRequested = false;
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
    coordinateDestination: { latitude: number; longitude: number } | null =
      null,
    activeId = "",
    reportedArtistId = "",
    spin: {
      start: number;
      elapsed: number;
      from: { lng: number; lat: number; bearing: number };
      target: Artist;
      direction: number;
      radius: number;
      resolve: (value: boolean) => void;
    } | null = null;
  let drag: {
    id: number;
    x: number;
    y: number;
    time: number;
  } | null = null;
  const angularVelocity = new THREE.Vector3();
  const springOffset = new THREE.Vector3(),
    coastVelocity = new THREE.Vector3();
  const springStep = new THREE.Vector3();
  const dragAxis = new THREE.Vector3();
  const orbit = new THREE.Spherical();
  const polarLimit = THREE.MathUtils.degToRad(90 - MAX_VIEW_LATITUDE);
  type CoordinateAxis = "latitude" | "longitude";
  const crowns = (["latitude", "longitude"] as const).map((axis) => ({
    axis,
    element: host.parentElement?.querySelector<HTMLElement>(
      `[data-coordinate="${axis}"]`,
    ),
  }));
  const drumPositions = new Map<HTMLElement, number>();
  // Fixed north-up yaw and pitch, with no roll or edge-specific axis switching.
  function turnCamera(axis: THREE.Vector3, angle: number) {
    if (!angle) return;
    orbit.setFromVector3(camera.position);
    orbit.theta += axis.x * angle;
    orbit.phi = THREE.MathUtils.clamp(
      orbit.phi + axis.y * angle,
      polarLimit,
      Math.PI - polarLimit,
    );
    camera.position.setFromSpherical(orbit);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
  }
  function screenTurn(dx: number, dy: number, immediate = true) {
    const scale = (-2 * Math.PI * 0.6) / height;
    dragAxis.set(dx * scale, dy * scale, 0);
    const angle = dragAxis.length();
    if (angle && immediate)
      turnCamera(dragAxis.clone().divideScalar(angle), angle);
    else if (angle) springOffset.add(dragAxis);
    return angle;
  }
  const projected = new THREE.Vector3(),
    direction = new THREE.Vector3(),
    localDirection = new THREE.Vector3(),
    normal = new THREE.Vector3(),
    towardCamera = new THREE.Vector3(),
    rotation = new THREE.Quaternion(),
    partial = new THREE.Quaternion(),
    from = new THREE.Vector3(),
    to = new THREE.Vector3();
  const requestLabels = (countries = false) => {
    if (countries ? countriesRequested : labelsRequested) return;
    if (countries) countriesRequested = true;
    else labelsRequested = true;
    fetch(`/data/artist-globe/${countries ? "countries" : "labels"}.json`, {
      signal: abort.signal,
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Label[]) => {
        if (disposed) return;
        labels.push(
          ...data.map((label, id) => ({
            id: id + (countries ? 10000 : 0),
            label,
            point: position(label[1], label[2], 1.008),
          })),
        );
        lastLabelLayout = -Infinity;
        wake();
      })
      .catch(() => {});
  };
  const stopSpin = (complete = false) => {
    if (spin) {
      const resolve = spin.resolve;
      spin = null;
      interactionEnabled = true;
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
      const p = Math.min(1, spin.elapsed / 2800),
        pose = spinPose(
          spin.from,
          { lng: spin.target.longitude, lat: spin.target.latitude },
          p,
          spin.direction,
        );
      camera.position.copy(
        position(
          pose.lat,
          pose.lng,
          spin.radius + (4.15 - spin.radius) * Math.min(1, p * 4),
        ),
      );
      targetRadius = camera.position.length();
      camera.up.set(0, 1, 0);
      globe.rotation.z = 0;
      if (p >= 1) {
        camera.position.copy(
          position(spin.target.latitude, spin.target.longitude, 4.15),
        );
        targetRadius = 4.15;
        globe.rotation.z = 0;
        stopSpin(true);
        force = true;
      }
    } else if (coordinateDestination) {
      const radius = camera.position.length();
      const lat = THREE.MathUtils.radToDeg(
        Math.asin(THREE.MathUtils.clamp(camera.position.y / radius, -1, 1)),
      );
      const lon = THREE.MathUtils.radToDeg(
        Math.atan2(-camera.position.z, camera.position.x),
      );
      const dLat = coordinateDestination.latitude - lat;
      const dLon = ((coordinateDestination.longitude - lon + 540) % 360) - 180;
      const amount = reduced.matches ? 1 : 1 - Math.exp(-dt * 14);
      camera.position.copy(
        position(lat + dLat * amount, lon + dLon * amount, radius),
      );
      force = true;
      if (reduced.matches || Math.max(Math.abs(dLat), Math.abs(dLon)) < 0.001) {
        camera.position.copy(
          position(
            coordinateDestination.latitude,
            coordinateDestination.longitude,
            radius,
          ),
        );
        coordinateDestination = null;
      }
    } else if (destination) {
      from.copy(camera.position).normalize();
      to.copy(destination).normalize();
      rotation.setFromUnitVectors(from, to);
      partial
        .identity()
        .slerp(rotation, reduced.matches ? 1 : 1 - Math.exp(-dt * 8));
      camera.position.applyQuaternion(partial);
      camera.up.set(0, 1, 0);
      if (from.angleTo(to) < 0.001) {
        const radius = camera.position.length();
        camera.position.copy(to).setLength(radius);
        destination = null;
        force = true;
      }
    }
    if (reduced.matches) {
      const angle = springOffset.length();
      if (angle) {
        turnCamera(springStep.copy(springOffset).divideScalar(angle), angle);
        force = true;
      }
      springOffset.set(0, 0, 0);
      angularVelocity.set(0, 0, 0);
      coastVelocity.set(0, 0, 0);
    }
    if (!spin && !destination && !coordinateDestination && !reduced.matches) {
      // Continue the target gently after release; the globe follows the same
      // spring throughout dragging and coasting, without a velocity jump.
      const friction = 4.2,
        decay = Math.exp(-friction * dt);
      springOffset.addScaledVector(coastVelocity, (1 - decay) / friction);
      coastVelocity.multiplyScalar(decay);
      for (const axis of ["x", "y", "z"] as const) {
        const next = advanceSpring(
          springOffset[axis],
          angularVelocity[axis],
          dt,
        );
        springOffset[axis] = next.offset;
        angularVelocity[axis] = next.velocity;
        springStep[axis] = next.step;
      }
      const angle = springStep.length();
      if (angle) {
        turnCamera(springStep.divideScalar(angle), angle);
        force = true;
      }
      // Discard subpixel residual energy once settled, so a later wake cannot
      // restart an imperceptible tail or move a globe that was held still.
      if (
        springOffset.length() < 0.00001 &&
        angularVelocity.length() < 0.0001 &&
        coastVelocity.length() < 0.0001
      ) {
        springOffset.set(0, 0, 0);
        angularVelocity.set(0, 0, 0);
        coastVelocity.set(0, 0, 0);
      }
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

    orbit.setFromVector3(camera.position);
    orbit.phi = THREE.MathUtils.clamp(
      orbit.phi,
      polarLimit,
      Math.PI - polarLimit,
    );
    camera.position.setFromSpherical(orbit);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    const moving =
      springOffset.length() > 0.00001 ||
      angularVelocity.length() > 0.0001 ||
      coastVelocity.length() > 0.0001 ||
      !!spin ||
      !!destination ||
      !!coordinateDestination ||
      Math.abs(camera.position.length() - targetRadius) > 0.00001;
    host.dataset.moving = String(moving);
    host.dataset.altitudeKm = (
      (camera.position.length() - 1) *
      EARTH_RADIUS_KM
    ).toFixed(1);
    host.dataset.radius = camera.position.length().toFixed(5);
    if (moving || force || labelsAnimating) {
      force = false;
      globe.updateMatrixWorld(true);
      camera.updateMatrixWorld();
      renderer.render(scene, camera);
      direction.copy(camera.position).normalize();
      localDirection
        .copy(direction)
        .applyQuaternion(globe.quaternion.clone().invert());
      const pointerLatitude = THREE.MathUtils.radToDeg(
        Math.asin(THREE.MathUtils.clamp(localDirection.y, -1, 1)),
      );
      const pointerLongitude = THREE.MathUtils.radToDeg(
        Math.atan2(-localDirection.z, localDirection.x),
      );
      const coordinateText = formatCoordinates(
        pointerLatitude,
        pointerLongitude,
      ).split(" · ");
      crowns.forEach(({ element, axis }, index) => {
        if (!element) return;
        const raw = axis === "latitude" ? pointerLatitude : pointerLongitude;
        const value = Math.sign(raw) * Math.round(Math.abs(raw));
        element.setAttribute("aria-valuenow", String(value));
        element.setAttribute("aria-valuetext", coordinateText[index]);
        const digits = String(Math.abs(value)).padStart(3, "0");
        element
          .querySelectorAll<HTMLElement>("[data-coordinate-drum]")
          .forEach((drum, place) => {
            const nextDigit = Number(digits[place]);
            const previous = drumPositions.get(drum) ?? nextDigit;
            const currentDigit = ((previous % 10) + 10) % 10;
            let change = nextDigit - currentDigit;
            if (change > 5) change -= 10;
            if (change < -5) change += 10;
            const next = previous + change;
            if (!drumPositions.has(drum) || next !== previous) {
              drum.style.transform = `rotateX(${-next * 36}deg)`;
              drumPositions.set(drum, next);
            }
          });
        const hemisphere = element.querySelector<HTMLElement>(
          "[data-coordinate-hemisphere]",
        );
        const suffix = coordinateText[index].slice(-1);
        if (hemisphere && hemisphere.textContent !== suffix)
          hemisphere.textContent = suffix;
      });
      host.dataset.up = camera.up
        .toArray()
        .map((value) => value.toFixed(6))
        .join(",");
      host.dataset.view = localDirection
        .toArray()
        .map((value) => value.toFixed(6))
        .join(",");
      let index = nearestArtistIndex(localDirection, locations);
      const preferred = artists.findIndex(
        (artist) => artist.id === preferredArtistId,
      );
      // Several artists can share a documented city centroid. Preserve the
      // explicitly selected artist when its pin ties the nearest location.
      if (
        preferred >= 0 &&
        index >= 0 &&
        Math.abs(
          locations[preferred].dot(localDirection) -
            locations[index].dot(localDirection),
        ) < 0.000001
      )
        index = preferred;
      const active = artists[index];
      if (active && active.id !== activeId) {
        activeId = active.id;
        host.dataset.spotlight = activeId;
      }
      // A requested artist stays in the card throughout a dot-to-dot flight.
      // Resume nearest-artist updates only once the camera has arrived.
      if (
        active &&
        !destination &&
        !coordinateDestination &&
        !spin &&
        active.id !== reportedArtistId
      ) {
        reportedArtistId = active.id;
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
        if (!button.hidden) {
          let markerX = x,
            markerY = y;
          const group = siblings[i];
          if (group.length > 1 && artists[i].id !== activeId) {
            const others = group.filter(
              (index) => artists[index].id !== activeId,
            );
            const slot = others.indexOf(i);
            const theta = (slot * Math.PI * 2) / others.length;
            const spread =
              (group.length > 7 ? 30 : 24) *
              THREE.MathUtils.smoothstep(normal.dot(towardCamera), 0.02, 0.3);
            markerX += Math.cos(theta) * spread;
            markerY += Math.sin(theta) * spread;
          }
          button.style.transform = `translate(${markerX}px,${markerY}px) translate(-50%,-50%)`;
        }
      });
      const radius = camera.position.length();
      if (countryRegions.length && (now - lastLabelLayout > 160 || !moving)) {
        const lat =
          (Math.asin(THREE.MathUtils.clamp(localDirection.y, -1, 1)) * 180) /
          Math.PI;
        const lon =
          (Math.atan2(-localDirection.z, localDirection.x) * 180) / Math.PI;
        centralCountry = countryAtPoint(lon, lat, countryRegions);
        host.dataset.centralCountry = centralCountry || "";
      }
      if (radius < 2.9) requestLabels();
      // Retain existing placements first. Admission has a wider edge/zoom margin
      // than retention, preventing labels from oscillating around a boundary.
      if (now - lastLabelLayout > 160 || (!moving && !labelsAnimating)) {
        const places = labels.map((item) => {
          projected
            .copy(item.point)
            .applyMatrix4(globe.matrixWorld)
            .project(camera);
          return {
            item,
            x:
              item.label[0] === centralCountry && item.label[3] === "country"
                ? width / 2
                : (projected.x * 0.5 + 0.5) * width,
            y:
              item.label[0] === centralCountry && item.label[3] === "country"
                ? height / 2 + 62
                : (-projected.y * 0.5 + 0.5) * height,
            front:
              item.label[0] === centralCountry ||
              item.point.dot(localDirection) / 1.008 > 1 / radius + 0.08,
          };
        });
        lastLabelLayout = now;
        const occupied: { x: number; y: number; half: number }[] = [];
        const candidates = places.sort(
          (a, b) =>
            Number(
              b.item.label[3] === "country" &&
                b.item.label[0] === centralCountry,
            ) -
              Number(
                a.item.label[3] === "country" &&
                  a.item.label[0] === centralCountry,
              ) ||
            Number(b.item.label[3] === "country") -
              Number(a.item.label[3] === "country") ||
            Number(!!shownLabels.get(b.item.id)?.wanted) -
              Number(!!shownLabels.get(a.item.id)?.wanted) ||
            Number(a.item.label[3] === "city") -
              Number(b.item.label[3] === "city") ||
            b.item.point.dot(localDirection) -
              a.item.point.dot(localDirection) ||
            a.item.id - b.item.id,
        );
        const wanted = new Set<number>();
        let entering = 0,
          leaving = 0,
          regions = 0,
          countries = 0,
          cities = 0;
        for (const place of candidates) {
          const { item, x, y, front } = place;
          const retained = !!shownLabels.get(item.id)?.wanted;
          const edge = retained ? 24 : 50;
          const country = item.label[3] === "country";
          const zoomLimit = country
            ? 4.75
            : item.label[3] === "city"
              ? 2.65
              : 2.85;
          const half = Math.min(
            110,
            item.label[0].length * (country ? 4 : 3.1) + 8,
          );
          if (
            wanted.size >= 20 ||
            (country ? !showCountries : !showPlaces) ||
            (country && countries >= 12) ||
            (item.label[3] === "region" && regions >= 5) ||
            (item.label[3] === "city" && cities >= 4) ||
            (country &&
              item.label[0] !== centralCountry &&
              (item.label[4] ?? 0) > (radius > 3.5 ? 4 : 6)) ||
            !front ||
            radius > zoomLimit + (retained ? 0.15 : 0) ||
            x < edge ||
            x > width - edge ||
            y < 78 ||
            y > height - 70 ||
            occupied.some(
              (p) =>
                Math.abs(p.x - x) < p.half + half + 12 &&
                Math.abs(p.y - y) < 28,
            )
          )
            continue;
          wanted.add(item.id);
          if (country) countries++;
          else if (item.label[3] === "region") regions++;
          else cities++;
          occupied.push({ x, y, half });
          let entry = shownLabels.get(item.id);
          if (!entry) {
            const element = document.createElement("span");
            element.textContent = item.label[0];
            element.className = item.label[3];
            element.dataset.placeId = String(item.id);
            element.style.opacity = "0";
            labelLayer.append(element);
            entry = {
              item,
              element,
              opacity: 0,
              wanted: false,
              changeAt: now,
              x,
              y,
            };
            shownLabels.set(item.id, entry);
          }
          if (!entry.wanted) entry.changeAt = now + entering++ * 24;
          entry.wanted = true;
        }
        for (const [id, entry] of shownLabels) {
          if (!wanted.has(id) && entry.wanted) {
            entry.wanted = false;
            entry.changeAt = now + leaving++ * 18;
          }
        }
      }
      labelsAnimating = false;
      for (const [id, entry] of shownLabels) {
        projected
          .copy(entry.item.point)
          .applyMatrix4(globe.matrixWorld)
          .project(camera);
        const central =
          entry.item.label[3] === "country" &&
          entry.item.label[0] === centralCountry;
        entry.element.dataset.central = String(central);
        const x = central ? width / 2 : (projected.x * 0.5 + 0.5) * width,
          y = central ? height / 2 + 62 : (-projected.y * 0.5 + 0.5) * height;
        entry.element.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
        const target = entry.wanted ? 1 : 0;
        if (now >= entry.changeAt)
          entry.opacity = THREE.MathUtils.clamp(
            entry.opacity +
              (entry.wanted ? 1 : -1) * (reduced.matches ? 1 : dt / 0.24),
            0,
            1,
          );
        entry.element.style.opacity = String(entry.opacity);
        if (entry.opacity !== target) labelsAnimating = true;
        if (!entry.wanted && entry.opacity === 0) {
          entry.element.remove();
          shownLabels.delete(id);
        }
      }
    }
    if (moving || labelsAnimating) {
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
    coordinateDestination = null;
    angularVelocity.set(0, 0, 0);
    springOffset.set(0, 0, 0);
    coastVelocity.set(0, 0, 0);
    wake();
  };
  const moveCoordinate = (
    axis: CoordinateAxis,
    amount: number,
    absolute = false,
  ) => {
    const radius = camera.position.length();
    const current = coordinateDestination || {
      latitude: THREE.MathUtils.radToDeg(
        Math.asin(THREE.MathUtils.clamp(camera.position.y / radius, -1, 1)),
      ),
      longitude: THREE.MathUtils.radToDeg(
        Math.atan2(-camera.position.z, camera.position.x),
      ),
    };
    const next = { ...current };
    next[axis] = absolute ? amount : next[axis] + amount;
    next.latitude = THREE.MathUtils.clamp(
      next.latitude,
      -MAX_VIEW_LATITUDE,
      MAX_VIEW_LATITUDE,
    );
    if (next.longitude > 180 || next.longitude < -180)
      next.longitude = ((next.longitude + 540) % 360) - 180;
    interrupt();
    coordinateDestination = next;
    wake();
  };
  const crownCleanups: (() => void)[] = [];
  crowns.forEach(({ element, axis }) => {
    if (!element) return;
    let pointer: { id: number; x: number; y: number } | null = null;
    const scroll = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.ctrlKey) return;
      const delta =
        axis === "longitude" && Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? -event.deltaX
          : event.deltaY;
      const units =
        event.deltaMode === 1
          ? delta / 3
          : event.deltaMode === 2
            ? delta * 10
            : delta / 100;
      if (units) moveCoordinate(axis, THREE.MathUtils.clamp(-units, -10, 10));
    };
    const keyboard = (event: KeyboardEvent) => {
      const minimum = axis === "latitude" ? -MAX_VIEW_LATITUDE : -180;
      const maximum = -minimum;
      let amount = 0,
        absolute = false;
      if (event.key === "ArrowUp" || event.key === "ArrowRight") amount = 1;
      else if (event.key === "ArrowDown" || event.key === "ArrowLeft")
        amount = -1;
      else if (event.key === "PageUp") amount = 10;
      else if (event.key === "PageDown") amount = -10;
      else if (event.key === "Home") {
        amount = minimum;
        absolute = true;
      } else if (event.key === "End") {
        amount = maximum;
        absolute = true;
      } else return;
      event.preventDefault();
      event.stopPropagation();
      moveCoordinate(axis, amount, absolute);
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      element.focus({ preventScroll: true });
      element.setPointerCapture(event.pointerId);
      element.dataset.dragging = "true";
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    };
    const move = (event: PointerEvent) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const amount =
        (axis === "longitude"
          ? event.clientX - pointer.x
          : pointer.y - event.clientY) * 0.15;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      if (amount) moveCoordinate(axis, amount);
    };
    const up = () => {
      pointer = null;
      delete element.dataset.dragging;
    };
    element.addEventListener("wheel", scroll, { passive: false });
    element.addEventListener("keydown", keyboard);
    element.addEventListener("pointerdown", down);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", up);
    element.addEventListener("pointercancel", up);
    element.addEventListener("lostpointercapture", up);
    crownCleanups.push(() => {
      up();
      element.removeEventListener("wheel", scroll);
      element.removeEventListener("keydown", keyboard);
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", up);
      element.removeEventListener("pointercancel", up);
      element.removeEventListener("lostpointercapture", up);
    });
  });
  const pointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || !interactionEnabled) return;
    if (drag) {
      drag = null;
      angularVelocity.set(0, 0, 0);
      return;
    }
    interrupt();
    canvas.setPointerCapture(event.pointerId);
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
    };
  };
  const pointerMove = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return;
    const now = performance.now();
    screenTurn(event.clientX - drag.x, event.clientY - drag.y, reduced.matches);
    wake();
    drag = { ...drag, x: event.clientX, y: event.clientY, time: now };
  };
  const pointerEnd = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return;
    const cancelled =
      event.type === "pointercancel" || event.type === "lostpointercapture";
    if (cancelled || reduced.matches) {
      springOffset.set(0, 0, 0);
      angularVelocity.set(0, 0, 0);
      coastVelocity.set(0, 0, 0);
    } else if (performance.now() - drag.time < 90) {
      coastVelocity
        .copy(angularVelocity)
        .multiplyScalar(0.85)
        .clampLength(0, 3.5);
    }
    drag = null;
    wake();
  };
  canvas.addEventListener("pointerdown", pointerDown, true);
  window.addEventListener("pointermove", pointerMove);
  window.addEventListener("pointerup", pointerEnd);
  window.addEventListener("pointercancel", pointerEnd);
  canvas.addEventListener("lostpointercapture", pointerEnd);
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
      drag = null;
      pinching = true;
      pinchDistance = distance(event.touches);
      pinchRadius = targetRadius;
      interactionEnabled = false;
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
      interactionEnabled = true;
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
    const step = (height * 0.16) / (2 * Math.PI * 0.6);
    let dx = 0,
      dy = 0;
    if (event.key === "ArrowLeft") dx = step;
    else if (event.key === "ArrowRight") dx = -step;
    else if (event.key === "ArrowUp") dy = step;
    else if (event.key === "ArrowDown") dy = -step;
    else return;
    event.preventDefault();
    interrupt();
    screenTurn(dx, dy);
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
  fetch("/data/artist-globe/country-regions.json", { signal: abort.signal })
    .then((r) => (r.ok ? r.json() : []))
    .then((data) => {
      if (!disposed) {
        countryRegions = data;
        lastLabelLayout = -Infinity;
        wake();
      }
    })
    .catch(() => {});
  requestLabels(true);
  wake();
  onReady();
  return {
    labels(options: { countries: boolean; places: boolean }) {
      showCountries = options.countries;
      showPlaces = options.places;
      lastLabelLayout = -Infinity;
      wake();
    },
    focus(artist: Artist) {
      preferredArtistId = artist.id;
      interrupt();
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
    async discover(artist: Artist, direction?: number) {
      preferredArtistId = artist.id;
      interrupt();
      destination = null;
      camera.up.set(0, 1, 0);
      const current = camera.position.clone().normalize();
      if (reduced.matches) {
        camera.position.copy(position(artist.latitude, artist.longitude, 4.15));
        camera.up.set(0, 1, 0);
        targetRadius = 4.15;
        force = true;
        wake();
        return true;
      }
      interactionEnabled = false;
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
          direction: direction || (Math.random() < 0.5 ? -1 : 1),
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
      crownCleanups.forEach((cleanup) => cleanup());
      drumPositions.clear();
      document.removeEventListener("visibilitychange", visibility);
      canvas.removeEventListener("keydown", key);
      canvas.removeEventListener("pointerdown", pointerDown, true);
      canvas.removeEventListener("lostpointercapture", pointerEnd);
      window.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("pointerup", pointerEnd);
      window.removeEventListener("pointercancel", pointerEnd);
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
