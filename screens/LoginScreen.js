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
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

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
        </View>
        
        <Text style={styles.title}>{isLogin ? 'Welcome Back' : 'Create account'}</Text>
        {isLogin ? (
          <Text style={styles.subtitle}>Login to your account</Text>
        ) : (
          <Text style={styles.subtitle}>Register an account</Text>
        )}
        
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
          
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons name="email-outline" size={20} color="#0b3a32" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          
          <View style={styles.passwordContainer}>
            <MaterialCommunityIcons name="lock-outline" size={20} color="#0b3a32" style={styles.inputIcon} />
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
              <MaterialCommunityIcons 
                name={showPassword ? "eye-off" : "eye"} 
                size={20} 
                color="#0b3a32" 
              />
            </TouchableOpacity>
          </View>
          
          {!isLogin && (
            <View style={styles.roleSelection}>
              <View style={styles.roleOptions}>
                <TouchableOpacity 
                  style={[
                    styles.roleButton, 
                    role === 'employee' && styles.roleButtonActive
                  ]}
                  onPress={() => setRole('employee')}
                >
                  <MaterialCommunityIcons 
                    name="account-outline" 
                    size={20} 
                    color={role === 'employee' ? 'white' : '#0b3a32'} 
                    style={styles.roleIcon}
                  />
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
                  <MaterialCommunityIcons 
                    name="office-building-outline" 
                    size={20} 
                    color={role === 'company' ? 'white' : '#0b3a32'} 
                    style={styles.roleIcon}
                  />
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
                ? <Text><Text style={styles.switchModeQuestion}>Don't have an account? </Text><Text style={styles.switchModeAction}>Sign up</Text></Text>
                : <Text><Text style={styles.switchModeQuestion}>Already have an account? </Text><Text style={styles.switchModeAction}>Login</Text></Text>}
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
    backgroundColor: 'white',
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
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'center',
    color: '#0b3a32',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 60,
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e1eae3',
    borderRadius: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  inputIcon: {
    marginLeft: 15,
    color: '#0b3a32',
  },
  input: {
    flex: 1,
    padding: 15,
    fontSize: 16,
    backgroundColor: 'transparent',
    color: undefined,
  },
  passwordContainer: {
    flexDirection: 'row',
    backgroundColor: '#e1eae3',
    borderRadius: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    padding: 15,
    fontSize: 16,
    backgroundColor: 'transparent',
    color: undefined,
  },
  showPasswordButton: {
    padding: 15,
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
    borderRadius: 20,
    alignItems: 'center',
    marginHorizontal: 5,
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: undefined,
  },
  roleButtonActive: {
    backgroundColor: '#0b3a32',
    borderColor: '#0b3a32',
  },
  roleButtonText: {
    color: '#0b3a32',
    fontWeight: '600',
  },
  roleButtonTextActive: {
    color: 'white',
  },
  roleIcon: {
    marginRight: 8,
  },
  button: {
    backgroundColor: '#0b3a32',
    borderRadius: 30,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
    opacity: undefined,
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
    fontSize: 16,
  },
  switchModeQuestion: {
    color: '#666',
  },
  switchModeAction: {
    color: '#0b3a32',
    fontWeight: '600',
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