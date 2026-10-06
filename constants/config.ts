// The API (backend on DirectAdmin) is on its own subdomain; the website itself is on Vercel.
export const API_BASE_URL = 'https://api.cleanitneatly.com';

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
  background: '#f7fafc',
  surface: '#ffffff',
  surfaceAlt: '#eef5fa',
  text: '#0c1f33',
  textSecondary: '#506a83',
  textTertiary: '#8da4b8',
  border: '#d5e3ef',
  borderLight: '#eef5fa',
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
