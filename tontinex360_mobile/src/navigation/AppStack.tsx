import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AppStackParamList } from './types';
import AppTabs from './AppTabs';
import BureauStack from './BureauStack';
import NotificationsScreen from '../screens/app/NotificationsScreen';
import AnnouncementDetailScreen from '../screens/app/AnnouncementDetailScreen';
import EventDetailScreen from '../screens/app/EventDetailScreen';
import SessionDetailScreen from '../screens/app/SessionDetailScreen';
import PollDetailScreen from '../screens/app/PollDetailScreen';
import ChatListScreen from '../screens/app/ChatListScreen';
import ChatNewPrivateScreen from '../screens/app/ChatNewPrivateScreen';
import ChatNewGroupScreen from '../screens/app/ChatNewGroupScreen';
import ConversationScreen from '../screens/app/ConversationScreen';
import ProxiesScreen from '../screens/app/ProxiesScreen';
import TontinesScreen from '../screens/app/TontinesScreen';
import MesEncheresScreen from '../screens/app/MesEncheresScreen';
import MesVersementsScreen from '../screens/app/MesVersementsScreen';
import CotiserScreen from '../screens/app/CotiserScreen';
import { colors } from '../theme/colors';
import { font } from '../theme/typography';

const Stack = createNativeStackNavigator<AppStackParamList>();

/** Shared native header style for pushed detail screens. */
const detailHeader = {
  headerTintColor: colors.primary,
  headerTitleStyle: { color: colors.text, fontWeight: font.bold },
  headerStyle: { backgroundColor: colors.bg },
  headerShadowVisible: false,
} as const;

/** Member app shell: the 5 tabs + pushable detail screens (Notifications, …). */
export default function AppStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Tabs" component={AppTabs} options={{ headerShown: false }} />
      <Stack.Screen name="Bureau" component={BureauStack} options={{ headerShown: false }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications', ...detailHeader }} />
      <Stack.Screen name="AnnouncementDetail" component={AnnouncementDetailScreen} options={{ title: 'Annonce', ...detailHeader }} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Événement', ...detailHeader }} />
      <Stack.Screen name="SessionDetail" component={SessionDetailScreen} options={{ title: 'Séance', ...detailHeader }} />
      <Stack.Screen name="PollDetail" component={PollDetailScreen} options={{ title: 'Détails du vote', ...detailHeader }} />
      <Stack.Screen name="Chat" component={ChatListScreen} options={{ title: 'Discussions', ...detailHeader }} />
      <Stack.Screen name="ChatNewPrivate" component={ChatNewPrivateScreen} options={{ title: 'Discuter avec un membre', ...detailHeader }} />
      <Stack.Screen name="ChatNewGroup" component={ChatNewGroupScreen} options={{ title: 'Créer un groupe', ...detailHeader }} />
      <Stack.Screen
        name="Conversation"
        component={ConversationScreen}
        options={({ route }) => ({ title: route.params.title || 'Conversation', ...detailHeader })}
      />
      <Stack.Screen name="Procurations" component={ProxiesScreen} options={{ title: 'Procurations', ...detailHeader }} />
      <Stack.Screen name="MesTontines" component={TontinesScreen} options={{ title: 'Mes tontines', ...detailHeader }} />
      <Stack.Screen name="MesEncheres" component={MesEncheresScreen} options={{ title: 'Mes enchères', ...detailHeader }} />
      <Stack.Screen name="MesVersements" component={MesVersementsScreen} options={{ title: 'Mes versements', ...detailHeader }} />
      <Stack.Screen name="Cotiser" component={CotiserScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
