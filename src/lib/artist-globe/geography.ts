export const EARTH_RADIUS_KM = 6371;
// Bounded zoom: close enough to explore, with a clear whole-planet overview.
export const MIN_CAMERA_RADIUS = 2.13;
export const MAX_CAMERA_RADIUS = 5.4;
export function angularVisibility(
  lat: number,
  lon: number,
  centerLat: number,
  centerLon: number,
) {
  const rad = Math.PI / 180;
  return (
    Math.sin(lat * rad) * Math.sin(centerLat * rad) +
    Math.cos(lat * rad) *
      Math.cos(centerLat * rad) *
      Math.cos((lon - centerLon) * rad)
  );
}
export function spinPose(
  start: { lng: number; lat: number; bearing: number },
  target: { lng: number; lat: number },
  progress: number,
  direction: number,
) {
  const p = Math.max(0, Math.min(1, progress)),
    eased = 1 - (1 - p) ** 4,
    delta = ((target.lng - start.lng + 540) % 360) - 180;
  return {
    lng: start.lng + (delta + direction * 720) * eased,
    lat: start.lat + (target.lat - start.lat) * eased,
    bearing: start.bearing * (1 - eased),
  };
}
export function nearestArtistIndex(
  direction: { x: number; y: number; z: number },
  locations: { x: number; y: number; z: number }[],
) {
  let index = -1,
    best = -Infinity;
  locations.forEach((p, i) => {
    const score =
      (direction.x * p.x + direction.y * p.y + direction.z * p.z) /
      Math.hypot(p.x, p.y, p.z);
    if (score > best) {
      best = score;
      index = i;
    }
  });
  return index;
}

export type CountryRegion = { name: string; polygons: number[][][][] };
function inRing(lon: number, lat: number, ring: number[][]) {
  let inside = false;
  // Natural Earth cuts polygons at the date line; rewrapping individual
  // vertices would stretch remote rings across the opposite hemisphere.
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const ax = ring[i][0],
      ay = ring[i][1],
      bx = ring[j][0],
      by = ring[j][1];
    if (
      ay > lat !== by > lat &&
      lon < ((bx - ax) * (lat - ay)) / (by - ay) + ax
    )
      inside = !inside;
  }
  return inside;
}
type BoundedPolygon = {
  name: string;
  rings: number[][][];
  west: number;
  east: number;
  south: number;
  north: number;
};
const countryBounds = new WeakMap<CountryRegion[], BoundedPolygon[]>();
export function countryAtPoint(
  lon: number,
  lat: number,
  regions: CountryRegion[],
) {
  let polygons = countryBounds.get(regions);
  if (!polygons) {
    polygons = regions.flatMap((region) =>
      region.polygons.map((rings) => {
        const xs = rings[0].map((p) => p[0]),
          ys = rings[0].map((p) => p[1]);
        return {
          name: region.name,
          rings,
          west: Math.min(...xs),
          east: Math.max(...xs),
          south: Math.min(...ys),
          north: Math.max(...ys),
        };
      }),
    );
    countryBounds.set(regions, polygons);
  }
  for (const p of polygons) {
    if (lon < p.west || lon > p.east || lat < p.south || lat > p.north)
      continue;
    if (
      inRing(lon, lat, p.rings[0]) &&
      !p.rings.slice(1).some((hole) => inRing(lon, lat, hole))
    )
      return p.name;
  }
  // City centroids can lie a few kilometres beyond a simplified coastline.
  // Snap only to a very nearby shore, never to a distant country's label anchor.
  let nearest: string | null = null,
    best = 0.06 ** 2;
  const longitudeScale = Math.max(0.01, Math.cos((lat * Math.PI) / 180));
  for (const p of polygons) {
    if (
      lon < p.west - 0.06 / longitudeScale ||
      lon > p.east + 0.06 / longitudeScale ||
      lat < p.south - 0.06 ||
      lat > p.north + 0.06
    )
      continue;
    for (const ring of p.rings)
      for (let i = 1; i < ring.length; i++) {
        const ax = (ring[i - 1][0] - lon) * longitudeScale,
          ay = ring[i - 1][1] - lat;
        const bx = (ring[i][0] - lon) * longitudeScale,
          by = ring[i][1] - lat;
        const dx = bx - ax,
          dy = by - ay;
        const t = Math.max(
          0,
          Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)),
        );
        const distance = (ax + t * dx) ** 2 + (ay + t * dy) ** 2;
        if (distance < best) {
          best = distance;
          nearest = p.name;
        }
      }
  }
  return nearest;
}

export const MAX_VIEW_LATITUDE = 85;
export function formatCoordinates(latitude: number, longitude: number) {
  return `${Math.round(Math.abs(latitude))}° ${latitude < 0 ? "S" : "N"} · ${Math.round(Math.abs(longitude))}° ${longitude < 0 ? "W" : "E"}`;
}
