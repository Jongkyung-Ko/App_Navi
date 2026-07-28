import * as Location from 'expo-location';
import type { UserLocation } from '../types';

export type LocationErrorCode = 'denied' | 'unavailable' | 'unknown';

export class LocationError extends Error {
  code: LocationErrorCode;
  constructor(code: LocationErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

async function ensureForegroundPermission(): Promise<void> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    throw new LocationError('unavailable', '위치 서비스가 꺼져 있습니다. 설정에서 GPS를 켜 주세요.');
  }

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new LocationError('denied', '위치 권한이 필요합니다. 설정에서 허용해 주세요.');
  }
}

function toUserLocation(position: Location.LocationObject): UserLocation {
  const heading = position.coords.heading;
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    heading:
      heading == null || Number.isNaN(heading) || heading < 0 ? null : heading,
  };
}

export async function getCurrentLocation(): Promise<UserLocation> {
  await ensureForegroundPermission();

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  return toUserLocation(position);
}

export interface WatchLocationOptions {
  /** Minimum movement in meters before an update (platform-dependent). */
  distanceInterval?: number;
  /** Minimum time between updates in ms (Android; platform-dependent). */
  timeInterval?: number;
  /** GPS accuracy tier. Use BestForNavigation for nav-style live tracking. */
  accuracy?: Location.Accuracy;
}

/** Watch GPS; default ~100m / 30s. Pass tighter intervals for live map following. */
export async function watchLocationChanges(
  onChange: (loc: UserLocation) => void,
  opts?: WatchLocationOptions,
): Promise<Location.LocationSubscription> {
  await ensureForegroundPermission();
  return Location.watchPositionAsync(
    {
      accuracy: opts?.accuracy ?? Location.Accuracy.Balanced,
      distanceInterval: opts?.distanceInterval ?? 100,
      timeInterval: opts?.timeInterval ?? 30_000,
    },
    (position) => {
      onChange(toUserLocation(position));
    },
  );
}

/**
 * High-frequency GPS for nav-style map tracking (~1s / 1m, BestForNavigation).
 */
export async function watchLiveLocation(
  onChange: (loc: UserLocation) => void,
): Promise<Location.LocationSubscription> {
  return watchLocationChanges(onChange, {
    accuracy: Location.Accuracy.BestForNavigation,
    distanceInterval: 1,
    timeInterval: 1_000,
  });
}
