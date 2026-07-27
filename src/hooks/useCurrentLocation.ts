import { useCallback, useEffect, useState } from 'react';
import { getCurrentLocation, LocationError } from '../services/location';
import { reverseGeocode } from '../services/api';
import type { ReverseGeocodeResult, UserLocation } from '../types';

interface LocationState {
  location: UserLocation | null;
  address: ReverseGeocodeResult | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useCurrentLocation(): LocationState {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [address, setAddress] = useState<ReverseGeocodeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loc = await getCurrentLocation();
      setLocation(loc);
      const geo = await reverseGeocode(loc.lat, loc.lng);
      setAddress(geo);
    } catch (err) {
      const message =
        err instanceof LocationError
          ? err.message
          : err instanceof Error
            ? err.message
            : '위치를 가져오지 못했습니다.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { location, address, loading, error, refresh };
}
