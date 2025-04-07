import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../utils/AuthContext';
import { useFocusEffect } from '@react-navigation/native';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState('employee');
  const [errorMessage, setErrorMessage] = useState('');
  const [autoLogoutMessage, setAutoLogoutMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const { signIn, signUp } = useAuth();
  
  // Check if the app was in background and user session expired
  useFocusEffect(
    React.useCallback(() => {
      const checkAutoLogout = async () => {
        try {
          // Check if there was an automatic logout
          const wasAutoLogout = await AsyncStorage.getItem('autoLogout');
          if (wasAutoLogout === 'true') {
            setAutoLogoutMessage('You were logged out automatically due to inactivity.');
            // Clear the flag
            await AsyncStorage.setItem('autoLogout', 'false');
          }
        } catch (error) {
          console.error('Error checking auto logout status:', error);
        }
      };
      
      checkAutoLogout();
    }, [])
  );

  const handleSubmit = async () => {
    if (!email || !password) {
      setErrorMessage('Please enter both email and password');
      return;
    }

    // Clear any previous error messages
    setErrorMessage('');
    setAutoLogoutMessage('');

    try {
      setLoading(true);
      
      if (isLogin) {
        // Login
        const { data, error } = await signIn(email, password);
        if (error) {
          console.log('Login error:', error.message);
          setErrorMessage(error.message || 'Failed to login. Please check your credentials.');
          return;
        }
      } else {
        // Signup
        const { data, error, warning } = await signUp(
          email, 
          password, 
          role  // Use the role directly without conversion
        );
        
        if (error) {
          setErrorMessage(error.message || 'Error creating account');
          return;
        }
        
        // Handle warnings (like profile creation issues)
        if (warning) {
          Alert.alert('Success with Warning', warning);
          setIsLogin(true);
          setEmail('');
          setPassword('');
          return;
        }
        
        // Email confirmation flow
        if (data?.user?.identities?.length === 0) {
          setErrorMessage('This email is already registered. Please login or use another email.');
          return;
        }
        
        // Success message
        Alert.alert(
          'Account Created',
          'Your account has been created successfully. You can now log in.',
          [
            {
              text: 'OK',
              onPress: () => {
                setIsLogin(true);
                setEmail('');
                setPassword('');
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Auth error:', JSON.stringify(error));
      setErrorMessage(error.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setErrorMessage(''); // Clear error messages when switching modes
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.logoContainer}>
          <Image 
            source={require('../assets/icon.png')} 
            style={styles.logo} 
            resizeMode="contain"
          />
          <Text style={styles.appTitle}>Smart Attendance</Text>
        </View>
        
        <Text style={styles.title}>{isLogin ? 'Login' : 'Create Account'}</Text>
        
        <View style={styles.formContainer}>
          {errorMessage ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}
          
          {autoLogoutMessage ? (
            <View style={styles.infoContainer}>
              <Text style={styles.infoText}>{autoLogoutMessage}</Text>
            </View>
          ) : null}
          
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity 
              style={styles.showPasswordButton}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Text style={styles.showPasswordText}>
                {showPassword ? 'Hide' : 'Show'}
              </Text>
            </TouchableOpacity>
          </View>
          
          {!isLogin && (
            <View style={styles.roleSelection}>
              <Text style={styles.roleLabel}>Account Type:</Text>
              <View style={styles.roleOptions}>
                <TouchableOpacity 
                  style={[
                    styles.roleButton, 
                    role === 'employee' && styles.roleButtonActive
                  ]}
                  onPress={() => setRole('employee')}
                >
                  <Text 
                    style={[
                      styles.roleButtonText,
                      role === 'employee' && styles.roleButtonTextActive
                    ]}
                  >
                    Employee
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.roleButton, 
                    role === 'company' && styles.roleButtonActive
                  ]}
                  onPress={() => setRole('company')}
                >
                  <Text 
                    style={[
                      styles.roleButtonText,
                      role === 'company' && styles.roleButtonTextActive
                    ]}
                  >
                    Company
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          <TouchableOpacity 
            style={styles.button} 
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {isLogin ? 'Login' : 'Sign Up'}
              </Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity onPress={toggleMode} style={styles.switchModeButton}>
            <Text style={styles.switchModeText}>
              {isLogin 
                ? "Don't have an account? Sign up" 
                : "Already have an account? Login"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 10,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  formContainer: {
    width: '100%',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ef9a9a',
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 16,
  },
  passwordContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    padding: 15,
    fontSize: 16,
  },
  showPasswordButton: {
    padding: 15,
  },
  showPasswordText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  roleSelection: {
    marginBottom: 15,
  },
  roleLabel: {
    fontSize: 16,
    marginBottom: 8,
    color: '#333',
  },
  roleOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  roleButton: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  roleButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  roleButtonText: {
    color: '#333',
    fontWeight: '600',
  },
  roleButtonTextActive: {
    color: 'white',
  },
  button: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  switchModeButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchModeText: {
    color: '#2196F3',
    fontSize: 16,
  },
  infoContainer: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
  },
  infoText: {
    color: '#1976d2',
    fontSize: 14,
  },
}); 