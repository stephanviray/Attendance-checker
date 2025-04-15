import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Modal,
  Dimensions,
  Switch,
  Platform,
  StatusBar,
  Linking
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '../utils/supabase';
import { useFocusEffect } from '@react-navigation/native';

const { width } = Dimensions.get('window');
const QR_SIZE = Math.min(width * 0.6, 200);

export default function QRGeneratorScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [qrValue, setQrValue] = useState('');
  
  // Remove check-in/check-out specific states and keep only what's needed
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showEmployeeList, setShowEmployeeList] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // New state variables for web display
  const [isDisplayedOnWeb, setIsDisplayedOnWeb] = useState(false);
  const [webDisplayLoading, setWebDisplayLoading] = useState(false);
  const [webServerUrl, setWebServerUrl] = useState('http://127.0.0.1:5500/web/index.html');

  useEffect(() => {
    // Load employees
    loadEmployees();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      // Refresh employee list when screen gains focus
      loadEmployees();
      return () => {};
    }, [])
  );

  const loadEmployees = async () => {
    try {
      setLoading(true);
      
      // Fetch employees from Supabase
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, department, position, custom_id')
        .eq('role', 'employee');
        
      if (error) {
        console.error('Error fetching employees:', error);
        Alert.alert('Error', 'Failed to load employee data');
        return;
      }
      
      if (data) {
        // Format the employee data
        const formattedEmployees = data.map(emp => ({
          id: emp.id,
          custom_id: emp.custom_id,
          name: emp.full_name || emp.email.split('@')[0],
          email: emp.email,
          department: emp.department || 'General',
          position: emp.position || ''
        }));
        
        setEmployees(formattedEmployees);
      }
    } catch (error) {
      console.error('Error in loadEmployees:', error);
      Alert.alert('Error', 'Failed to load employee data');
    } finally {
      setLoading(false);
    }
  };

  const generateQRCode = (employee) => {
    if (!employee) {
      Alert.alert('Error', 'Please select an employee first');
      return;
    }
    
    // Create simplified QR data with just employee info
    const qrData = {
      type: 'employee_qr',
      employee_id: employee.id,
      custom_id: employee.custom_id,
      name: employee.name,
      email: employee.email,
      generated_at: new Date().toISOString()
    };
    
    const qrDataString = JSON.stringify(qrData);
    setQrValue(qrDataString);
    setSelectedEmployee(employee);
  };

  const handleEmployeeSelect = (employee) => {
    setSelectedEmployee(employee);
    setShowEmployeeList(false);
    generateQRCode(employee);
  };

  const copyToClipboard = async () => {
    try {
      await Clipboard.setStringAsync(qrValue);
      Alert.alert('Success', 'QR data copied to clipboard');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  const getCurrentDate = () => {
    const now = new Date();
    return now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const displayQrOnWeb = async () => {
    try {
      setWebDisplayLoading(true);
      
      // First, check if webServerUrl is reachable
      try {
        if (webServerUrl) {
          const response = await fetch(webServerUrl.replace('/index.html', '/ping'), {
            method: 'GET',
            headers: {
              'Cache-Control': 'no-cache'
            }
          });
          
          if (!response.ok) {
            throw new Error('Server not reachable');
          }
        }
      } catch (error) {
        console.error('Web server not reachable:', error);
        Alert.alert(
          'Web Server Not Found',
          'The web display server is not running or not reachable. Would you like to configure it?',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => setWebDisplayLoading(false)
            },
            {
              text: 'Configure',
              onPress: () => {
                setWebDisplayLoading(false);
                configureWebServer();
              }
            }
          ]
        );
        return;
      }
      
      // If we get here, server is reachable
      // Send the QR data to the web display
      const response = await fetch(webServerUrl.replace('/index.html', '/update-qr'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({ qrData: qrValue })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update web QR');
      }
      
      setIsDisplayedOnWeb(true);
      Alert.alert('Success', 'QR code is now displayed on the web server');
      
      // Open the web page
      Linking.openURL(webServerUrl);
    } catch (error) {
      console.error('Error displaying QR on web:', error);
      Alert.alert('Error', 'Failed to display QR code on web');
    } finally {
      setWebDisplayLoading(false);
    }
  };

  const configureWebServer = () => {
    Alert.alert(
      'Configure Web Server',
      'Enter the URL for your web display server:',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Save',
          onPress: async (serverUrl) => {
            if (serverUrl) {
              // Save the server URL
              setWebServerUrl(serverUrl);
              await AsyncStorage.setItem('web_server_url', serverUrl);
              Alert.alert('Success', 'Web server URL saved');
            }
          }
        }
      ],
      {
        cancelable: true,
        defaultValue: webServerUrl,
        type: 'plain-text'
      }
    );
  };

  useEffect(() => {
    // Load saved web server URL
    const loadWebServerUrl = async () => {
      try {
        const savedUrl = await AsyncStorage.getItem('web_server_url');
        if (savedUrl) {
          setWebServerUrl(savedUrl);
        }
      } catch (error) {
        console.error('Error loading web server URL:', error);
      }
    };
    
    loadWebServerUrl();
  }, []);

  const filterEmployees = () => {
    if (!searchQuery.trim()) return employees;
    
    const query = searchQuery.toLowerCase();
    return employees.filter(
      emp => 
        emp.name.toLowerCase().includes(query) || 
        emp.email.toLowerCase().includes(query) ||
        emp.department.toLowerCase().includes(query)
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Employee QR Generator</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Employee</Text>
          <TouchableOpacity 
            style={styles.employeeSelector}
            onPress={() => setShowEmployeeList(true)}
          >
            <Text style={styles.selectorText}>
              {selectedEmployee ? selectedEmployee.name : 'Select an employee'}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#666" />
          </TouchableOpacity>
        </View>
        
        {selectedEmployee && (
          <View style={styles.qrContainer}>
            <Text style={styles.employeeName}>{selectedEmployee.name}</Text>
            <Text style={styles.employeeInfo}>{selectedEmployee.email}</Text>
            {selectedEmployee.department && (
              <Text style={styles.employeeInfo}>{selectedEmployee.department}</Text>
            )}
            
            <View style={styles.qrWrapper}>
              {qrValue ? (
                <QRCode
                  value={qrValue}
                  size={QR_SIZE}
                  color="#000"
                  backgroundColor="#fff"
                />
              ) : (
                <ActivityIndicator size="large" color="#4285F4" />
              )}
            </View>
            
            <Text style={styles.qrInstructions}>
              This QR code contains the employee's identification information.
              Scan with the Company app to record attendance.
            </Text>
            
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={copyToClipboard}
              >
                <Ionicons name="copy-outline" size={20} color="#4285F4" />
                <Text style={styles.actionButtonText}>Copy</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={displayQrOnWeb}
                disabled={webDisplayLoading}
              >
                <Ionicons name="globe-outline" size={20} color="#4285F4" />
                <Text style={styles.actionButtonText}>
                  {webDisplayLoading ? 'Loading...' : 'Web Display'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
      
      {/* Employee Selection Modal */}
      <Modal
        visible={showEmployeeList}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Employee</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowEmployeeList(false)}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name, email, or department"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
              />
              {searchQuery ? (
                <TouchableOpacity 
                  style={styles.clearButton}
                  onPress={() => setSearchQuery('')}
                >
                  <Ionicons name="close-circle" size={18} color="#999" />
                </TouchableOpacity>
              ) : null}
            </View>
            
            <ScrollView style={styles.employeeList}>
              {loading ? (
                <ActivityIndicator size="large" color="#4285F4" style={styles.loadingIndicator} />
              ) : filterEmployees().length > 0 ? (
                filterEmployees().map(emp => (
                  <TouchableOpacity 
                    key={emp.id}
                    style={styles.employeeItem}
                    onPress={() => handleEmployeeSelect(emp)}
                  >
                    <View style={styles.employeeInfo}>
                      <Text style={styles.employeeItemName}>{emp.name}</Text>
                      <Text style={styles.employeeItemEmail}>{emp.email}</Text>
                      {emp.department && (
                        <Text style={styles.employeeItemDepartment}>{emp.department}</Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#ccc" />
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.noResults}>No employees found</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  backButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 20,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  employeeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    backgroundColor: '#f9f9f9',
  },
  selectorText: {
    fontSize: 16,
    color: '#333',
  },
  qrContainer: {
    padding: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    marginBottom: 20,
  },
  employeeName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
    textAlign: 'center',
  },
  employeeInfo: {
    fontSize: 16,
    color: '#666',
    marginBottom: 5,
    textAlign: 'center',
  },
  qrWrapper: {
    margin: 20,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    height: QR_SIZE + 30,
    width: QR_SIZE + 30,
  },
  qrInstructions: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#f0f5ff',
    borderRadius: 20,
    minWidth: 120,
  },
  actionButtonText: {
    marginLeft: 8,
    color: '#4285F4',
    fontWeight: '500',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f5f5f5',
    margin: 10,
    borderRadius: 8,
  },
  searchIcon: {
    marginHorizontal: 5,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 16,
  },
  clearButton: {
    padding: 5,
  },
  employeeList: {
    flex: 1,
    paddingHorizontal: 10,
  },
  employeeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  employeeItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  employeeItemEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 3,
  },
  employeeItemDepartment: {
    fontSize: 14,
    color: '#888',
    marginTop: 3,
  },
  noResults: {
    textAlign: 'center',
    padding: 20,
    color: '#999',
  },
  loadingIndicator: {
    padding: 20,
  },
}); 