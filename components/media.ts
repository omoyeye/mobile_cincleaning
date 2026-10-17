import type { ImageSourcePropType } from 'react-native';

/**
 * Brand photos bundled with the app (the same shots the website uses), resized for phones.
 * Keep this the only place that requires image files, so screens just ask by meaning.
 */
export const PHOTOS = {
  standard: require('../assets/images/service-standard.jpg'),
  deep: require('../assets/images/service-deep.jpg'),
  tenancy: require('../assets/images/service-tenancy.jpg'),
  airbnb: require('../assets/images/service-airbnb.jpg'),
  commercial: require('../assets/images/service-commercial.jpg'),
  general: require('../assets/images/service-general.jpg'),
  towels: require('../assets/images/hero-towels.jpg'),
  trolley: require('../assets/images/hero-trolley.jpg'),
  lounge: require('../assets/images/hero-lounge.jpg'),
  office: require('../assets/images/hero-office.jpg'),
} satisfies Record<string, ImageSourcePropType>;

export type PhotoKey = keyof typeof PHOTOS;

/** Photo for a service, matched on its name (same rules as the booking form's service triggers). */
export function servicePhoto(serviceName?: string | null): ImageSourcePropType {
  const n = String(serviceName || '').toLowerCase();
  if (n.includes('airbnb') || n.includes('short')) return PHOTOS.airbnb;
  if (n.includes('commercial') || n.includes('office')) return PHOTOS.commercial;
  if (n.includes('tenancy') || n.includes('move')) return PHOTOS.tenancy;
  if (n.includes('deep')) return PHOTOS.deep;
  if (n.includes('standard') || n.includes('general') || n.includes('regular')) return PHOTOS.standard;
  return PHOTOS.general;
}

/** Lets names like "General/Standard Cleaning" wrap after the slash instead of mid-word on small tiles. */
export function wrapName(name: string): string {
  return name.replace(/\//g, '/​');
}
