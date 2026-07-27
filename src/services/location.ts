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

export async function getCurrentLocation(): Promise<UserLocation> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    throw new LocationError('unavailable', '위치 서비스가 꺼져 있습니다. 설정에서 GPS를 켜 주세요.');
  }

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new LocationError('denied', '위치 권한이 필요합니다. 설정에서 허용해 주세요.');
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
  };
}
