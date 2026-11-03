// The API (backend on DirectAdmin) is on its own subdomain; the website itself is on Vercel.
// EXPO_PUBLIC_API_URL overrides it for local testing (e.g. http://localhost:3002).
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://api.cleanitneatly.com').replace(/\/+$/, '');

/** The website, for pages the app opens in the browser (e.g. invoice payment). */
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL || 'https://www.cleanitneatly.com').replace(/\/+$/, '');

export const APP_NAME = 'CiN Cleaning';
export const APP_VERSION = '1.0.0';

export const COLORS = {
  primary: '#0c87d6',
  primaryLight: '#4ab8f0',
  primaryDark: '#0a6aab',
  accent: '#e8443a',
  accentGold: '#f5b731',
  secondary: '#059669',
  secondaryLight: '#34d399',
  // A touch darker than white so cards (white + soft shadow) stand out on it.
  background: '#e8eef5',
  surface: '#ffffff',
  surfaceAlt: '#dde7f0',
  text: '#0c1f33',
  textSecondary: '#506a83',
  textTertiary: '#8da4b8',
  border: '#d5e3ef',
  borderLight: '#e6edf4',
  error: '#e8443a',
  errorLight: '#fde8e7',
  warning: '#f5b731',
  warningLight: '#fef6e0',
  success: '#059669',
  successLight: '#d1fae5',
  info: '#0c87d6',
  infoLight: '#e0f0fa',
  white: '#ffffff',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.5)',

  status: {
    pending: '#f5b731',
    pendingBg: '#fef6e0',
    confirmed: '#0c87d6',
    confirmedBg: '#e0f0fa',
    inProgress: '#6d52e8',
    inProgressBg: '#ede9fe',
    completed: '#059669',
    completedBg: '#d1fae5',
    cancelled: '#e8443a',
    cancelledBg: '#fde8e7',
  },
} as const;

export const FONTS = {
  regular: 'System',
  medium: 'System',
  semibold: 'System',
  bold: 'System',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
} as const;

/** Shadows for things that sit on the background: cards, the tab bar, floating buttons. */
export const SHADOW = {
  /** Cards and list rows. */
  card: {
    shadowColor: '#0c1f33',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  /** Small chips, tiles and buttons. */
  soft: {
    shadowColor: '#0c1f33',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  /** Floating tab bar and hero cards. */
  raised: {
    shadowColor: '#0c1f33',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 10,
  },
} as const;
