import 'expo-dev-client';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TouchableWithoutFeedback, View } from 'react-native';
import AppNavigator from './navigation/AppNavigator';
import { AuthProvider, useAuth } from './utils/AuthContext';

// Component to track user activity and reset the inactivity timer
const ActivityTracker = ({ children }) => {
  const { user } = useAuth();

  const handleUserInteraction = () => {
    if (user) {
      // resetInactivityTimer();
    }
  };

  return (
    <TouchableWithoutFeedback onPress={handleUserInteraction}>
      <View style={{ flex: 1 }}>
        {children}
      </View>
    </TouchableWithoutFeedback>
  );
};

// Wrapper for the app content with authentication
const AppContent = () => {
  return (
    <ActivityTracker>
      <AppNavigator />
      <StatusBar style="auto" />
    </ActivityTracker>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
