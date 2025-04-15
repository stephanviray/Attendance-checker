import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

// Auth Screen
import LoginScreen from '../screens/LoginScreen';

// Employee Screens
import EmployeeDashboard from '../screens/EmployeeDashboard.js';
import ScanScreen from '../screens/ScanScreen';

// Company Screen
import CompanyScreen from '../screens/CompanyScreen';
import QRGeneratorScreen from '../screens/QRGeneratorScreen';

// Auth Context
import { useAuth } from '../utils/AuthContext';

const Stack = createStackNavigator();

// Auth Navigator
const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
  </Stack.Navigator>
);

// Employee Navigator
const EmployeeStack = () => (
  <Stack.Navigator 
    initialRouteName="EmployeeDashboard"
    screenOptions={{ 
      headerShown: false,
      gestureEnabled: true,
    }}
  >
    <Stack.Screen name="EmployeeDashboard" component={EmployeeDashboard} />
    <Stack.Screen name="ScanScreen" component={ScanScreen} />
  </Stack.Navigator>
);

// Company Navigator
const CompanyStack = () => (
  <Stack.Navigator 
    initialRouteName="CompanyScreen"
    screenOptions={{ 
      headerShown: false,
      gestureEnabled: true,
    }}
  >
    <Stack.Screen name="CompanyScreen" component={CompanyScreen} />
    <Stack.Screen 
      name="ScanScreen" 
      component={ScanScreen} 
      initialParams={{ companyScan: true }}
    />
    <Stack.Screen name="QRGeneratorScreen" component={QRGeneratorScreen} />
  </Stack.Navigator>
);

// Root Navigator
export default function AppNavigator() {
  const { user, loading, userRole } = useAuth();

  // Show loading screen while determining authentication status
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4285F4" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!user ? (
        <AuthStack />
      ) : userRole === 'company' ? (
        <CompanyStack />
      ) : (
        <EmployeeStack />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
  },
}); 