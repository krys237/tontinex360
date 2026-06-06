import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { AppTabsParamList } from './types';
import HomeScreen from '../screens/app/HomeScreen';
import TontineHubScreen from '../screens/app/TontineHubScreen';
import CommunityScreen from '../screens/app/CommunityScreen';
import FinancesScreen from '../screens/app/FinancesScreen';
import ProfileScreen from '../screens/app/ProfileScreen';
import { colors } from '../theme/colors';
import { font } from '../theme/typography';

const Tab = createBottomTabNavigator<AppTabsParamList>();

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(base: IoniconName, outline: IoniconName) {
  return ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
    <Ionicons name={focused ? base : outline} size={size} color={color} />
  );
}

export default function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
        tabBarStyle: { borderTopColor: colors.border, backgroundColor: colors.white },
        tabBarLabelStyle: { fontSize: 11, fontWeight: font.medium },
      }}>
      <Tab.Screen
        name="Accueil"
        component={HomeScreen}
        options={{ title: 'Accueil', tabBarIcon: tabIcon('home', 'home-outline') }}
      />
      <Tab.Screen
        name="Tontines"
        component={TontineHubScreen}
        options={{ title: 'Tontines', tabBarIcon: tabIcon('albums', 'albums-outline') }}
      />
      <Tab.Screen
        name="Communaute"
        component={CommunityScreen}
        options={{ title: 'Communauté', tabBarIcon: tabIcon('people', 'people-outline') }}
      />
      <Tab.Screen
        name="Finances"
        component={FinancesScreen}
        options={{ title: 'Finances', tabBarIcon: tabIcon('wallet', 'wallet-outline') }}
      />
      <Tab.Screen
        name="Profil"
        component={ProfileScreen}
        options={{ title: 'Profil', tabBarIcon: tabIcon('person', 'person-outline') }}
      />
    </Tab.Navigator>
  );
}
