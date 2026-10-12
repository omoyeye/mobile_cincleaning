import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../contexts/AuthContext';
import { ToastProvider } from '../components/Toast';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { COLORS } from '../constants/config';
// Registers the live-location task at start-up (the OS can wake the app just to run it).
import '../services/liveTracking';

export { ErrorBoundary } from '../components/ErrorScreen';

function AppInner() {
  usePushNotifications();
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.background },
          animation: 'slide_from_right',
        }}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </AuthProvider>
  );
}
