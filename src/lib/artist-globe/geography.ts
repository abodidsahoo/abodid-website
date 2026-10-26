export const EARTH_RADIUS_KM = 6371;
export const MIN_ALTITUDE_KM = 500;
export const MIN_CAMERA_RADIUS = 1 + MIN_ALTITUDE_KM / EARTH_RADIUS_KM;
export const MAX_CAMERA_RADIUS = 4.8;
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
    lng: start.lng + (delta + direction * 1080) * eased,
    lat:
      start.lat +
      (target.lat - start.lat) * eased +
      Math.sin(eased * Math.PI * 5) * Math.sin(Math.PI * eased) * 28,
    bearing:
      start.bearing * (1 - eased) +
      direction * 65 * Math.sin(eased * Math.PI * 4) * (1 - eased),
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
