import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useAuth } from '../../contexts/AuthContext';
import { useUnread } from '../../contexts/UnreadContext';
import { FloatingTabBar, type TabIcons } from '../../components/TabBar';
import { BookFab } from '../../components/Fab';

const ICONS: TabIcons = {
  index: ['home-outline', 'home'],
  bookings: ['calendar-outline', 'calendar'],
  messages: ['chatbubbles-outline', 'chatbubbles'],
  account: ['person-circle-outline', 'person-circle'],
};

export default function CustomerLayout() {
  const { user, loading } = useAuth();
  // Chats with cleaners; alerts ring the bell in the top bar instead.
  const { messages: unread } = useUnread();
  // Signed out (or the session expired): back to the shared welcome page.
  if (!loading && !user) return <Redirect href="/welcome" />;

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} icons={ICONS} fab={<BookFab />} />}
      screenOptions={{
        headerShown: false,
        // The keyboard should cover the tab bar, not push it up over the form.
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="bookings" options={{ title: 'Bookings' }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages', tabBarBadge: unread > 0 ? unread : undefined }} />
      <Tabs.Screen name="account" options={{ title: 'Account' }} />
    </Tabs>
  );
}
