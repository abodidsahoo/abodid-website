import {
  Map,
  ScaleControl,
  setWorkerUrl,
  type StyleSpecification,
} from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Artist } from "../../lib/artist-globe/data";
import {
  angularVisibility,
  altitudeKm,
  maxRegionalZoom,
  spinPose,
} from "../../lib/artist-globe/geography";
setWorkerUrl(workerUrl);
const style: StyleSpecification = {
  version: 8,
  projection: { type: "globe" },
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    world: {
      type: "vector",
      url: "https://tiles.openfreemap.org/planet",
      attribution:
        '<a href="https://openfreemap.org">OpenFreeMap</a> · © <a href="https://www.openmaptiles.org/">OpenMapTiles</a> · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  layers: [
    {
      id: "land",
      type: "background",
      paint: { "background-color": "#fff8e8" },
    },
    {
      id: "water",
      type: "fill",
      source: "world",
      "source-layer": "water",
      paint: { "fill-color": "#2444ca" },
    },
    {
      id: "green",
      type: "fill",
      source: "world",
      "source-layer": "park",
      minzoom: 8,
      paint: { "fill-color": "#caff48", "fill-opacity": 0.25 },
    },
    {
      id: "rivers",
      type: "line",
      source: "world",
      "source-layer": "waterway",
      minzoom: 7,
      paint: { "line-color": "#2444ca", "line-width": 1 },
    },
    {
      id: "boundaries",
      type: "line",
      source: "world",
      "source-layer": "boundary",
      minzoom: 4,
      paint: {
        "line-color": "#15130f",
        "line-opacity": 0.18,
        "line-width": 0.6,
      },
    },
    {
      id: "roads",
      type: "line",
      source: "world",
      "source-layer": "transportation",
      minzoom: 9,
      paint: {
        "line-color": "#15130f",
        "line-opacity": 0.18,
        "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.4, 14, 1.5],
      },
    },
    {
      id: "places",
      type: "symbol",
      source: "world",
      "source-layer": "place",
      minzoom: 5,
      layout: {
        "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 5, 11, 12, 14],
        "text-max-width": 10,
      },
      paint: {
        "text-color": "#15130f",
        "text-halo-color": "#fff8e8",
        "text-halo-width": 2,
      },
    },
  ],
};
export async function createGlobe(
  host: HTMLElement,
  artists: Artist[],
  onReady: () => void,
  onStop: () => void = () => {},
) {
  const surface = document.createElement("div");
  surface.className = "map-surface";
  host.prepend(surface);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const worldZoom = () =>
    Math.log2(Math.min(host.clientWidth, host.clientHeight) / 512) + 1.42;
  const map = new Map({
    container: surface,
    style,
    center: [Math.random() * 360 - 180, Math.random() * 50 - 25],
    zoom: worldZoom(),
    minZoom: worldZoom() - 0.1,
    maxZoom: 15,
    maxPitch: 0,
    pitch: 0,
    attributionControl: { compact: true },
    renderWorldCopies: false,
    pixelRatio: Math.min(devicePixelRatio, 1.75),
    canvasContextAttributes: { antialias: true },
    fadeDuration: reduced.matches ? 0 : 180,
  });
  map.dragRotate.disable();
  map.touchZoomRotate.disable();
  map.touchPitch.disable();
  map.addControl(
    new ScaleControl({ maxWidth: 90, unit: "metric" }),
    "bottom-left",
  );
  const canvas = map.getCanvas();
  canvas.setAttribute(
    "aria-label",
    "Interactive artist globe. Drag to rotate, pinch or scroll to zoom into regional detail. Arrow keys move; plus and minus zoom.",
  );
  // Handle two-finger zoom on the entire viewport, including marker hit areas.
  // Keeping touch-action scoped here preserves normal scrolling outside the globe.
  let pinching = false,
    pinchStart = 0,
    pinchZoom = 0,
    gestureZoom = 0;
  const distance = (touches: TouchList) =>
    Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY,
    );
  const touchStart = (event: TouchEvent) => {
    if (event.touches.length !== 2) return;
    event.preventDefault();
    event.stopPropagation();
    pinching = true;
    pinchStart = distance(event.touches);
    pinchZoom = map.getZoom();
    map.stop();
    map.dragPan.disable();
  };
  const touchMove = (event: TouchEvent) => {
    if (!pinching) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.touches.length === 2 && pinchStart > 0)
      map.jumpTo({
        zoom: pinchZoom + Math.log2(distance(event.touches) / pinchStart),
      });
  };
  const touchEnd = (event: TouchEvent) => {
    if (event.touches.length < 2 && pinching) {
      pinching = false;
      map.dragPan.enable();
    }
  };
  const gestureStart = (event: Event) => {
    event.preventDefault();
    gestureZoom = map.getZoom();
  };
  const gestureChange = (event: Event) => {
    event.preventDefault();
    const scale = (event as Event & { scale: number }).scale;
    if (scale > 0) map.jumpTo({ zoom: gestureZoom + Math.log2(scale) });
  };
  host.addEventListener("touchstart", touchStart, {
    passive: false,
    capture: true,
  });
  host.addEventListener("touchmove", touchMove, {
    passive: false,
    capture: true,
  });
  host.addEventListener("touchend", touchEnd);
  host.addEventListener("touchcancel", touchEnd);
  host.addEventListener("gesturestart", gestureStart, { passive: false });
  host.addEventListener("gesturechange", gestureChange, { passive: false });
  const buttons = artists.map((a) =>
    host.querySelector<HTMLButtonElement>(
      `[data-marker="${CSS.escape(a.id)}"]`,
    ),
  );
  let focusId: string | null = null;
  let destroyed = false,
    spinning = false,
    spinFrame = 0,
    spinElapsed = 0,
    spinLast = 0;
  let spinResolve: ((done: boolean) => void) | undefined;
  const stopSpin = (done = false) => {
    if (!spinning) return;
    spinning = false;
    cancelAnimationFrame(spinFrame);
    map.dragPan.enable();
    map.scrollZoom.enable();
    map.touchZoomRotate.disable();
    spinResolve?.(done);
    spinResolve = undefined;
  };
  const update = () => {
    if (destroyed) return;
    const center = map.getCenter(),
      zoom = map.getZoom(),
      width = host.clientWidth,
      height = host.clientHeight;
    const occupied: [number, number][] = [];
    const maximum = maxRegionalZoom(center.lat, height);
    if (Math.abs(map.getMaxZoom() - maximum) > 0.1) map.setMaxZoom(maximum);
    host.dataset.zoom = zoom.toFixed(3);
    host.dataset.altitudeKm = altitudeKm(zoom, center.lat, height).toFixed(1);
    const ordered = artists
      .map((a, i) => ({ a, i }))
      .sort((x, y) => Number(y.a.id === focusId) - Number(x.a.id === focusId));
    ordered.forEach(({ a, i }) => {
      const button = buttons[i];
      if (!button) return;
      const p = map.project([a.longitude, a.latitude]);
      const hidden =
        (zoom < 5 &&
          angularVisibility(a.latitude, a.longitude, center.lat, center.lng) <
            0.08) ||
        p.x < 0 ||
        p.y < 0 ||
        p.x > width ||
        p.y > height ||
        (a.id !== focusId &&
          occupied.some(([x, y]) => Math.hypot(x - p.x, y - p.y) < 36));
      button.hidden = hidden;
      if (!hidden) {
        occupied.push([p.x, p.y]);
        button.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-50%)`;
      }
    });
  };
  map.on("render", update);
  const loadPromise = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(Error("Map loading timed out")),
      18000,
    );
    map.once("load", () => {
      clearTimeout(timeout);
      map.once("idle", () => {
        update();
        onReady();
        resolve();
      });
      map.triggerRepaint();
    });
    map.once("error", (event) => {
      if (!map.isStyleLoaded()) {
        clearTimeout(timeout);
        reject(event.error);
      }
    });
  });
  try {
    await loadPromise;
  } catch (error) {
    map.remove();
    surface.remove();
    throw error;
  }
  const resize = new ResizeObserver(() => {
    const before = map.getMinZoom();
    map.resize();
    map.setMinZoom(worldZoom() - 0.1);
    if (map.getZoom() < before + 0.25) map.setZoom(worldZoom());
    update();
  });
  resize.observe(host);
  const stopFromInput = () => {
    stopSpin();
    onStop();
  };
  canvas.addEventListener("pointerdown", stopFromInput);
  const visibility = () => {
    if (document.hidden) {
      map.stop();
      cancelAnimationFrame(spinFrame);
    } else if (spinning) {
      spinLast = performance.now();
      spinFrame = requestAnimationFrame(animateSpin);
    }
  };
  let animateSpin: (now: number) => void = () => {};
  document.addEventListener("visibilitychange", visibility);
  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) map.stop();
  });
  observer.observe(host);
  return {
    prioritize(artist: Artist) {
      focusId = artist.id;
      update();
    },
    focus(artist: Artist) {
      focusId = artist.id;
      stopSpin();
      map.easeTo({
        center: [artist.longitude, artist.latitude],
        bearing: 0,
        zoom: Math.min(map.getZoom(), 5),
        duration: reduced.matches ? 0 : 650,
      });
    },
    zoom(direction: number) {
      stopSpin();
      map.zoomTo(map.getZoom() - direction * 0.8, {
        duration: reduced.matches ? 0 : 300,
      });
    },
    reset() {
      stopSpin();
      map.easeTo({
        zoom: worldZoom(),
        bearing: 0,
        duration: reduced.matches ? 0 : 700,
      });
    },
    async discover(artist: Artist) {
      focusId = artist.id;
      stopSpin();
      map.stop();
      const start = {
        lng: map.getCenter().lng,
        lat: map.getCenter().lat,
        bearing: map.getBearing(),
      };
      const target = { lng: artist.longitude, lat: artist.latitude };
      if (reduced.matches) {
        map.jumpTo({
          center: [target.lng, target.lat],
          zoom: worldZoom(),
          bearing: 0,
        });
        return true;
      }
      const direction = Math.random() < 0.5 ? -1 : 1;
      spinning = true;
      spinElapsed = 0;
      spinLast = performance.now();
      map.dragPan.disable();
      map.scrollZoom.disable();
      map.touchZoomRotate.disable();
      const initialZoom = map.getZoom();
      const promise = new Promise<boolean>((resolve) => {
        spinResolve = resolve;
      });
      animateSpin = (now: number) => {
        if (destroyed || !spinning) return;
        spinElapsed += Math.min(now - spinLast, 64);
        spinLast = now;
        const p = Math.min(1, spinElapsed / 3000),
          pose = spinPose(start, target, p, direction);
        map.jumpTo({
          center: [pose.lng, Math.max(-80, Math.min(80, pose.lat))],
          bearing: pose.bearing,
          zoom: initialZoom + (worldZoom() - initialZoom) * Math.min(1, p * 5),
        });
        if (p < 1) spinFrame = requestAnimationFrame(animateSpin);
        else {
          map.jumpTo({
            center: [target.lng, target.lat],
            bearing: 0,
            zoom: worldZoom(),
          });
          stopSpin(true);
        }
      };
      spinFrame = requestAnimationFrame(animateSpin);
      return promise;
    },
    dispose() {
      destroyed = true;
      stopSpin();
      resize.disconnect();
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      canvas.removeEventListener("pointerdown", stopFromInput);
      host.removeEventListener("touchstart", touchStart, true);
      host.removeEventListener("touchmove", touchMove, true);
      host.removeEventListener("touchend", touchEnd);
      host.removeEventListener("touchcancel", touchEnd);
      host.removeEventListener("gesturestart", gestureStart);
      host.removeEventListener("gesturechange", gestureChange);
      map.off("render", update);
      map.remove();
      surface.remove();
    },
  };
}
