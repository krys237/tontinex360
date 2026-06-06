import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { IntroStackParamList } from './types';
import SplashScreen from '../screens/intro/SplashScreen';
import WelcomeScreen from '../screens/intro/WelcomeScreen';
import TourScreen from '../screens/intro/TourScreen';

const Stack = createNativeStackNavigator<IntroStackParamList>();

export default function IntroStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Tour" component={TourScreen} />
    </Stack.Navigator>
  );
}
