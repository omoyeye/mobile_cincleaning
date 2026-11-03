import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useAuth } from '../../contexts/AuthContext';
import { useUnread } from '../../contexts/UnreadContext';
import { FloatingTabBar, type TabIcons } from '../../components/TabBar';
import { StaffActionsFab } from '../../components/Fab';

const ICONS: TabIcons = {
  index: ['home-outline', 'home'],
  rota: ['calendar-outline', 'calendar'],
  inbox: ['chatbubbles-outline', 'chatbubbles'],
  profile: ['person-circle-outline', 'person-circle'],
};

/** Four tabs (Home, Rota, Messages, Account) with quick actions in the middle. Earnings opens from Home, Account and quick actions. */
export default function StaffLayout() {
  const { user, loading } = useAuth();
  // Chats and office messages; alerts ring the bell in the top bar instead.
  const { messages: unread } = useUnread();
  // Signed out (or the session expired): back to the shared welcome page.
  if (!loading && !user) return <Redirect href="/welcome" />;

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} icons={ICONS} fab={<StaffActionsFab />} />}
      screenOptions={{
        headerShown: false,
        // The keyboard should cover the tab bar, not push it up over the form.
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="rota" options={{ title: 'Rota' }} />
      <Tabs.Screen name="inbox" options={{ title: 'Messages', tabBarBadge: unread > 0 ? unread : undefined }} />
      <Tabs.Screen name="profile" options={{ title: 'Account' }} />
      <Tabs.Screen name="earnings" options={{ title: 'Earnings', href: null }} />
    </Tabs>
  );
}
