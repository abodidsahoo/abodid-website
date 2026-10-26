export const EARTH_CIRCUMFERENCE = 40075016.686;
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
// Approximate camera altitude for MapLibre's default vertical field of view.
export function altitudeKm(zoom: number, latitude: number, height: number) {
  return (
    (EARTH_CIRCUMFERENCE *
      Math.cos((latitude * Math.PI) / 180) *
      height *
      1.5) /
    (512 * 2 ** zoom) /
    1000
  );
}
export function maxRegionalZoom(latitude: number, height: number) {
  return Math.max(
    10,
    Math.min(
      16,
      Math.log2(
        (EARTH_CIRCUMFERENCE *
          Math.cos((latitude * Math.PI) / 180) *
          height *
          1.5) /
          (512 * 5000),
      ),
    ),
  );
}
export function spinPose(
  start: { lng: number; lat: number; bearing: number },
  target: { lng: number; lat: number },
  progress: number,
  direction: number,
) {
  const p = Math.max(0, Math.min(1, progress));
  const eased = 1 - (1 - p) ** 4;
  const delta = ((target.lng - start.lng + 540) % 360) - 180;
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

// Globe zoom is latitude-dependent in MapLibre. Normalize it to keep the
// planet at the same apparent size when discovery changes hemispheres.
export function globeZoomAtLatitude(baseZoom: number, latitude: number) {
  return (
    baseZoom +
    Math.log2(Math.cos((Math.min(85, Math.abs(latitude)) * Math.PI) / 180))
  );
}
