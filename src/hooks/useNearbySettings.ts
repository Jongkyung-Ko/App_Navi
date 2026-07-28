import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  DEFAULT_NEARBY_SETTINGS,
  loadNearbySettings,
  saveNearbySettings,
} from '../services/nearbySettings';
import type { NearbySearchSettings } from '../types';

export function useNearbySettings() {
  const [settings, setSettings] = useState<NearbySearchSettings>(DEFAULT_NEARBY_SETTINGS);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    const loaded = await loadNearbySettings();
    setSettings(loaded);
    setReady(true);
    return loaded;
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Pick up changes made on the settings screen when returning.
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const update = useCallback(async (patch: Partial<NearbySearchSettings>) => {
    const current = await loadNearbySettings();
    const next = await saveNearbySettings({
      ...current,
      ...patch,
    });
    setSettings(next);
    return next;
  }, []);

  return { settings, ready, update, reload };
}
