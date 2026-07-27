import type { UserLocation } from '../types';

const EARTH_RADIUS_M = 6371000;

/** Great-circle distance in meters between two WGS84 points. */
export function distanceMeters(a: UserLocation, b: UserLocation): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Move a point by east/north meters (approx WGS84). */
export function shiftLocation(
  loc: UserLocation,
  metersEast: number,
  metersNorth = 0,
): UserLocation {
  const dLat = (metersNorth / EARTH_RADIUS_M) * (180 / Math.PI);
  const cosLat = Math.cos((loc.lat * Math.PI) / 180);
  const dLng =
    cosLat === 0 ? 0 : (metersEast / (EARTH_RADIUS_M * cosLat)) * (180 / Math.PI);
  return {
    lat: loc.lat + dLat,
    lng: loc.lng + dLng,
  };
}
