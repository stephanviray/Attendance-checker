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
  const [errorMessage, setErrorMessage] = useState('');
  const [autoLogoutMessage, setAutoLogoutMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const { signIn } = useAuth();
  
  useFocusEffect(
    React.useCallback(() => {
      const checkAutoLogout = async () => {
        try {
          const wasAutoLogout = await AsyncStorage.getItem('autoLogout');
          if (wasAutoLogout === 'true') {
            setAutoLogoutMessage('You were logged out automatically due to inactivity.');
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

    setErrorMessage('');
    setAutoLogoutMessage('');

    try {
      setLoading(true);
      const { data, error } = await signIn(email, password);
      if (error) {
        console.log('Login error:', error.message);
        setErrorMessage(error.message || 'Failed to login. Please check your credentials.');
      }
    } catch (error) {
      console.error('Auth error:', JSON.stringify(error));
      setErrorMessage(error.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Login to your account</Text>
        
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
          
          <TouchableOpacity 
            style={styles.button} 
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Login</Text>
            )}
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
    width: 150,
    height: 150,
    marginBottom: 0,
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
  infoContainer: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    marginTop: 20,
  },
  infoText: {
    color: '#1976d2',
    fontSize: 14,
  },
});