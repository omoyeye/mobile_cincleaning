import type { useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;

/**
 * Back button that always does something. Screens opened from a notification or a link have no
 * history, so plain router.back() would do nothing; go to the home tab instead.
 */
export function goBack(router: Router, fallback: Parameters<Router['replace']>[0] = '/') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
