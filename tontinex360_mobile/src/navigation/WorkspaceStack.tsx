import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { WorkspaceStackParamList } from './types';
import NoAssociationScreen from '../screens/workspace/NoAssociationScreen';
import CreateAssociationScreen from '../screens/workspace/CreateAssociationScreen';
import JoinRequestScreen from '../screens/workspace/JoinRequestScreen';

const Stack = createNativeStackNavigator<WorkspaceStackParamList>();

export default function WorkspaceStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="NoAssociation" component={NoAssociationScreen} />
      <Stack.Screen name="CreateAssociation" component={CreateAssociationScreen} />
      <Stack.Screen name="JoinRequest" component={JoinRequestScreen} />
    </Stack.Navigator>
  );
}
