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

  // `initialRouteName` n'est lu qu'au montage du navigateur. En le clefant sur
  // `hasAssociations`, le passage 0 → ≥1 asso (ex. adhésion approuvée pendant la
  // session) remonte le navigateur à neuf → il repart sur le bon écran initial
  // (ChooseAssociation) au lieu de rester gelé sur NoAssociation.
  return (
    <Stack.Navigator
      key={hasAssociations ? 'has' : 'none'}
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
