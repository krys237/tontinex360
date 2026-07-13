import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { WorkspaceStackParamList } from './types';
import { useAuthStore } from '../lib/stores/auth-store';
import ChooseAssociationScreen from '../screens/workspace/ChooseAssociationScreen';
import NoAssociationScreen from '../screens/workspace/NoAssociationScreen';
import CreateAssociationScreen from '../screens/workspace/CreateAssociationScreen';
import JoinRequestScreen from '../screens/workspace/JoinRequestScreen';
import MyJoinRequestsScreen from '../screens/workspace/MyJoinRequestsScreen';

const Stack = createNativeStackNavigator<WorkspaceStackParamList>();

export default function WorkspaceStack() {
  // S'il appartient déjà à ≥1 asso (sans active) → écran de choix ;
  // sinon → écran de bienvenue (aucune association).
  const hasAssociations = useAuthStore((s) => s.associations.length > 0);

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={hasAssociations ? 'ChooseAssociation' : 'NoAssociation'}
    >
      <Stack.Screen name="ChooseAssociation" component={ChooseAssociationScreen} />
      <Stack.Screen name="NoAssociation" component={NoAssociationScreen} />
      <Stack.Screen name="CreateAssociation" component={CreateAssociationScreen} />
      <Stack.Screen name="JoinRequest" component={JoinRequestScreen} />
      <Stack.Screen name="MyJoinRequests" component={MyJoinRequestsScreen} />
    </Stack.Navigator>
  );
}
