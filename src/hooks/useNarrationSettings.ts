import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  DEFAULT_NARRATION_SETTINGS,
  loadNarrationSettings,
  saveNarrationSettings,
} from '../services/narrationSettings';
import type { NarrationSettings } from '../types';

export function useNarrationSettings() {
  const [settings, setSettings] = useState<NarrationSettings>(DEFAULT_NARRATION_SETTINGS);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    const loaded = await loadNarrationSettings();
    setSettings(loaded);
    setReady(true);
    return loaded;
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const update = useCallback(async (patch: Partial<NarrationSettings>) => {
    const current = await loadNarrationSettings();
    const next = await saveNarrationSettings({
      ...current,
      ...patch,
    });
    setSettings(next);
    return next;
  }, []);

  return { settings, ready, update, reload };
}
