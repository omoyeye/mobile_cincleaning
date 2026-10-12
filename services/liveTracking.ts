import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { staffApi } from './api';
import { COLORS } from '../constants/config';

/**
 * Shares the cleaner's position while they travel to a job, including while they use
 * Google Maps or lock the phone. Uses "while using the app" permission only:
 * iOS shows the blue location pill, Android shows a notification while it runs.
 */
const TASK = 'cin-live-location';
const STORE_KEY = 'cin_live_tracking';
const SEND_EVERY_MS = 30000;
/** Safety stop in case a job is never marked as arrived. */
const MAX_TRACKING_MS = 4 * 60 * 60 * 1000;

type ActiveTrip = { bookingId: number; startedAt: number };

const supported = Platform.OS === 'ios' || Platform.OS === 'android';
let lastSent = 0;

async function readTrip(): Promise<ActiveTrip | null> {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as ActiveTrip) : null;
  } catch {
    return null;
  }
}

if (supported && !TaskManager.isTaskDefined(TASK)) {
  TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(TASK, async ({ data, error }) => {
    if (error) return;
    const trip = await readTrip();
    if (!trip) {
      await stopLiveTracking();
      return;
    }
    if (Date.now() - trip.startedAt > MAX_TRACKING_MS) {
      await stopLiveTracking();
      return;
    }
    const latest = data?.locations?.[data.locations.length - 1];
    if (!latest || Date.now() - lastSent < SEND_EVERY_MS) return;
    lastSent = Date.now();
    await staffApi
      .updateLocation(trip.bookingId, { lat: latest.coords.latitude, lng: latest.coords.longitude })
      .catch(() => {});
  });
}

/** Starts sharing for this job. Returns false when location is off or not supported. */
export async function startLiveTracking(bookingId: number): Promise<boolean> {
  if (!supported) return false;
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return false;
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify({ bookingId, startedAt: Date.now() } satisfies ActiveTrip));
    if (await Location.hasStartedLocationUpdatesAsync(TASK)) return true;
    lastSent = 0;
    await Location.startLocationUpdatesAsync(TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: SEND_EVERY_MS,
      distanceInterval: 50,
      activityType: Location.ActivityType.AutomotiveNavigation,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Sharing your location',
        notificationBody: 'The office and your client can see you are on the way. This stops when you arrive.',
        notificationColor: COLORS.primary,
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function stopLiveTracking(): Promise<void> {
  if (!supported) return;
  try {
    await AsyncStorage.removeItem(STORE_KEY);
    if (await Location.hasStartedLocationUpdatesAsync(TASK)) {
      await Location.stopLocationUpdatesAsync(TASK);
    }
  } catch {
    /* already stopped */
  }
}

/** True when this job is the one currently being shared. */
export async function isTrackingJob(bookingId: number): Promise<boolean> {
  if (!supported) return false;
  const trip = await readTrip();
  if (!trip || trip.bookingId !== bookingId) return false;
  try {
    return await Location.hasStartedLocationUpdatesAsync(TASK);
  } catch {
    return false;
  }
}
