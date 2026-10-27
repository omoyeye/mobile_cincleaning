import { useCallback, useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Short enough to feel instant, long enough that the spinner doesn't flash on a fast connection.
const MIN_SPIN_MS = 450;

/**
 * Pull-to-refresh state for a screen. The spinner always stops, even when the request fails,
 * and a light tap confirms the pull on phones.
 */
export function usePullRefresh(load: () => unknown) {
  const [refreshing, setRefreshing] = useState(false);
  const loadRef = useRef(load);
  loadRef.current = load;
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const onRefresh = useCallback(async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setRefreshing(true);
    const started = Date.now();
    try {
      await loadRef.current();
    } catch {
      // Screens show their own error states; the spinner just needs to stop.
    } finally {
      const wait = MIN_SPIN_MS - (Date.now() - started);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      if (mounted.current) setRefreshing(false);
    }
  }, []);

  return { refreshing, onRefresh };
}
