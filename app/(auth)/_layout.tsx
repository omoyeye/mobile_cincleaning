import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';

export default function AuthLayout() {
  const { user, loading } = useAuth();
  // Signed in: straight to the right portal.
  if (!loading && user) return <Redirect href={user.role === 'staff' ? '/(staff)' : '/(customer)'} />;
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
  );
}
