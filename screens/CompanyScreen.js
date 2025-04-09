import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  Alert,
  SafeAreaView,
  StatusBar,
  ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import BarcodeScanner from '../components/BarcodeScanner';
import { useAuth } from '../utils/AuthContext';
import { supabase } from '../utils/supabase';

const CompanyScreen = ({ navigation }) => {
  const { user, signOut } = useAuth();
  const [showScanner, setShowScanner] = useState(false);
  const [employees, setEmployees] = useState({});
  const [scannedEmployees, setScannedEmployees] = useState([]);
  const [currentDate, setCurrentDate] = useState('');
  
  useEffect(() => {
    // Set current date
    const date = new Date();
    const formattedDate = date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Manila'
    });
    setCurrentDate(formattedDate);
    
    // Load employee data
    loadEmployees();
    
    // Load today's scanned employees
    loadScannedEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, department, position, custom_id')
        .eq('role', 'employee');
      
      if (error) {
        console.error('Error fetching employees from Supabase:', error);
        Alert.alert('Error', 'Failed to load employee data');
        return;
      }
      
      if (data) {
        // Convert the array to an object format for easier lookup
        const employeesObj = {};
        data.forEach(emp => {
          employeesObj[emp.id] = {
            name: emp.full_name || emp.email.split('@')[0],
            department: emp.department || 'General',
            position: emp.position || '',
            email: emp.email,
            id: emp.id,
            custom_id: emp.custom_id
          };
        });
        
        setEmployees(employeesObj);
      }
    } catch (error) {
      console.error('Error loading employees:', error);
      Alert.alert('Error', 'Failed to load employee data');
    }
  };

  const loadScannedEmployees = async () => {
    try {
      // Get today's date in YYYY-MM-DD format for filtering
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .gte('check_in', today)
        .lt('check_in', new Date(new Date(today).getTime() + 86400000).toISOString())
        .order('check_in', { ascending: false });
      
      if (error) {
        console.error('Error fetching scanned employees:', error);
        Alert.alert('Error', 'Failed to load attendance data');
        return;
      }
      
      setScannedEmployees(data || []);
    } catch (error) {
      console.error('Error loading scanned employees:', error);
      Alert.alert('Error', 'Failed to load attendance data');
    }
  };

  const handleScan = async ({ type, data }) => {
    try {
      console.log('Scanned QR code data:', data);
      
      // Try to parse the data as JSON
      const qrData = JSON.parse(data);
      
      // Check if this is an employee ID QR code (new format)
      if (qrData.type === 'employee_qr' && qrData.employee_id && qrData.name) {
        await processEmployeeAttendance(qrData.employee_id, qrData.name);
        return;
      }
      
      Alert.alert(
        'Invalid QR Code',
        'This QR code is not a valid employee attendance QR code.',
        [{ text: 'OK', onPress: () => setShowScanner(false) }]
      );
    } catch (error) {
      console.error('Error processing scan:', error);
      Alert.alert(
        'Invalid QR Code',
        'Could not process this QR code. Please try again.',
        [{ text: 'OK', onPress: () => setShowScanner(false) }]
      );
    }
  };

  const processEmployeeAttendance = async (employeeId, employeeName) => {
    try {
      const now = new Date();
      const currentTime = now.toISOString();
      
      // Log user information for debugging
      console.log('Current user:', user);
      console.log('Processing attendance for employee:', employeeId);
      
      // First check if there's an existing record for today
      const { data: existingRecord, error: fetchError } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employeeId)
        .gte('check_in', new Date(now.setHours(0,0,0,0)).toISOString())
        .lte('check_in', new Date(now.setHours(23,59,59,999)).toISOString())
        .order('check_in', { ascending: false });
      
      if (fetchError) {
        console.error('Error fetching existing attendance:', fetchError);
        Alert.alert(
          'Error',
          'Failed to check existing attendance records.',
          [{ text: 'OK', onPress: () => setShowScanner(false) }]
        );
        return;
      }
      
      // If no record exists for today, create a check-in record
      if (!existingRecord || existingRecord.length === 0) {
        // Check-in
        const attendanceData = {
          employee_id: employeeId,
          check_in: currentTime,
          status: 'present',
          recorded_by: user?.id || null
        };
        
        console.log('Inserting attendance record:', attendanceData);
        
        const { data: insertData, error: insertError } = await supabase
          .from('attendance')
          .insert([attendanceData])
          .select();
        
        if (insertError) {
          console.error('Error recording check-in:', insertError);
          Alert.alert(
            'Error',
            `Failed to record check-in: ${insertError.message}`,
            [{ text: 'OK', onPress: () => setShowScanner(false) }]
          );
          return;
        }
        
        console.log('Check-in recorded successfully:', insertData);
        
        Alert.alert(
          'Check-In Successful',
          `${employeeName} has been checked in at ${now.toLocaleTimeString()}`,
          [{ text: 'OK', onPress: () => {
            setShowScanner(false);
            loadScannedEmployees(); // Refresh the list
          }}]
        );
      }
      // If record exists but no check-out time, update with check-out
      else if (existingRecord[0] && !existingRecord[0].check_out) {
        // Check-out
        const updateData = {
          check_out: currentTime,
          updated_at: currentTime
        };
        
        console.log('Updating attendance record:', updateData);
        
        const { data: updateResult, error: updateError } = await supabase
          .from('attendance')
          .update(updateData)
          .eq('id', existingRecord[0].id)
          .select();
        
        if (updateError) {
          console.error('Error recording check-out:', updateError);
          Alert.alert(
            'Error',
            `Failed to record check-out: ${updateError.message}`,
            [{ text: 'OK', onPress: () => setShowScanner(false) }]
          );
          return;
        }
        
        console.log('Check-out recorded successfully:', updateResult);
        
        Alert.alert(
          'Check-Out Successful',
          `${employeeName} has been checked out at ${now.toLocaleTimeString()}`,
          [{ text: 'OK', onPress: () => {
            setShowScanner(false);
            loadScannedEmployees(); // Refresh the list
          }}]
        );
      }
      // If record exists with check-out, create a new check-in
      else {
        // Another check-in for the same day
        const attendanceData = {
          employee_id: employeeId,
          check_in: currentTime,
          status: 'present',
          recorded_by: user?.id || null
        };
        
        console.log('Inserting new attendance record:', attendanceData);
        
        const { data: insertData, error: insertError } = await supabase
          .from('attendance')
          .insert([attendanceData])
          .select();
        
        if (insertError) {
          console.error('Error recording new check-in:', insertError);
          Alert.alert(
            'Error',
            `Failed to record new check-in: ${insertError.message}`,
            [{ text: 'OK', onPress: () => setShowScanner(false) }]
          );
          return;
        }
        
        console.log('New check-in recorded successfully:', insertData);
        
        Alert.alert(
          'New Check-In Successful',
          `${employeeName} has been checked in again at ${now.toLocaleTimeString()}`,
          [{ text: 'OK', onPress: () => {
            setShowScanner(false);
            loadScannedEmployees(); // Refresh the list
          }}]
        );
      }
    } catch (error) {
      console.error('Error processing attendance:', error);
      Alert.alert(
        'Error',
        `Failed to process attendance: ${error.message}`,
        [{ text: 'OK', onPress: () => setShowScanner(false) }]
      );
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      Alert.alert('Error signing out', error.message);
    }
  };

  const navigateToQRGenerator = () => {
    navigation.navigate('QRGeneratorScreen');
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getEmployeeName = (employeeId) => {
    return employees[employeeId]?.name || 'Unknown';
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {showScanner ? (
        <BarcodeScanner
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
        />
      ) : (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Company Dashboard</Text>
              <Text style={styles.dateText}>{currentDate}</Text>
            </View>
            <TouchableOpacity 
              style={styles.headerSignOutButton} 
              onPress={handleSignOut}
            >
              <Ionicons name="log-out-outline" size={24} color="#0b3a32" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => setShowScanner(true)}
              activeOpacity={0.8}
            >
              <View style={styles.actionButtonInner}>
                <View style={[styles.actionIconContainer, styles.scanActionButtonIcon]}>
                  <Ionicons name="qr-code-outline" size={28} color="#FFF" />
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionButtonText}>Scan Attendance</Text>
                  <Text style={styles.actionButtonSubtext}>Record employee check-in/out</Text>
                </View>
                <View style={styles.actionArrow}>
                  <Ionicons name="chevron-forward" size={20} color="#0b3a32" />
                </View>
              </View>
            </TouchableOpacity>
          </View>
          
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{scannedEmployees.length}</Text>
              <Text style={styles.statLabel}>Check-ins Today</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>
                {scannedEmployees.filter(record => record.check_out).length}
              </Text>
              <Text style={styles.statLabel}>Check-outs</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>
                {Object.keys(employees).length}
              </Text>
              <Text style={styles.statLabel}>Employees</Text>
            </View>
          </View>
          
          <View style={styles.attendanceCard}>
            <View style={styles.attendanceCardHeader}>
              <Text style={styles.sectionTitle}>Today's Attendance</Text>
              <Text style={styles.attendanceCount}>{scannedEmployees.length} records</Text>
            </View>
            
            {scannedEmployees.length > 0 ? (
              scannedEmployees.map((record, index) => (
                <View key={record.id} style={[
                  styles.attendanceItem,
                  index === scannedEmployees.length - 1 && styles.lastAttendanceItem
                ]}>
                  <View style={styles.attendanceItemHeader}>
                    <Text style={styles.employeeName}>{getEmployeeName(record.employee_id)}</Text>
                    <View style={[
                      styles.statusBadge, 
                      record.status === 'present' ? styles.presentBadge : 
                      record.status === 'late' ? styles.lateBadge : styles.absentBadge
                    ]}>
                      <Text style={[
                        styles.statusText,
                        record.status === 'present' ? styles.presentText : 
                        record.status === 'late' ? styles.lateText : styles.absentText
                      ]}>{record.status}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.timeContainer}>
                    <View style={styles.timeBlock}>
                      <View style={styles.timeRow}>
                        <Ionicons name="time-outline" size={16} color="#4CAF50" style={styles.timeIcon} />
                        <Text style={styles.timeLabel}>Check In:</Text>
                      </View>
                      <Text style={styles.timeValue}>
                        {new Date(record.check_in).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </Text>
                    </View>
                    
                    {record.check_out ? (
                      <View style={styles.timeBlock}>
                        <View style={styles.timeRow}>
                          <Ionicons name="exit-outline" size={16} color="#F44336" style={styles.timeIcon} />
                          <Text style={styles.timeLabel}>Check Out:</Text>
                        </View>
                        <Text style={styles.timeValue}>
                          {new Date(record.check_out).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.timeBlock}>
                        <View style={styles.timeRow}>
                          <Ionicons name="exit-outline" size={16} color="#9E9E9E" style={styles.timeIcon} />
                          <Text style={styles.timeLabel}>Check Out:</Text>
                        </View>
                        <Text style={styles.pendingTimeValue}>Pending</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="calendar-outline" size={48} color="#DDD" />
                <Text style={styles.emptyText}>No attendance records for today</Text>
                <Text style={styles.emptySubText}>Scan employee QR codes to record attendance</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: '#FFF',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    width: '90%',
    marginLeft: 20, 
    marginTop: 20,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  dateText: {
    fontSize: 16,
    color: '#666',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 24,
  },
  actionButton: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: '#0b3a32',
  },
  scanActionButton: {
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#e1eae3',
  },
  generateActionButton: {
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  scanActionButtonIcon: {
    backgroundColor: '#0b3a32',
  },
  generateActionButtonIcon: {
    backgroundColor: '#2196F3',
  },
  actionButtonText: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  actionButtonSubtext: {
    fontSize: 12,
    color: '#666',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    width: '31%',
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  attendanceCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 100,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  attendanceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  attendanceCount: {
    fontSize: 14,
    color: '#666',
  },
  attendanceItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingVertical: 16,
  },
  lastAttendanceItem: {
    borderBottomWidth: 0,
  },
  attendanceItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeBlock: {
    flex: 1,
    marginLeft: 30,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  timeIcon: {
    marginRight: 4,
  },
  timeLabel: {
    fontSize: 14,
    color: '#666',
  },
  timeValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginLeft: 20,
  },
  pendingTimeValue: {
    fontSize: 16,
    fontStyle: 'italic',
    color: '#9E9E9E',
    marginLeft: 20,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  presentBadge: {
    backgroundColor: '#E8F5E9',
  },
  lateBadge: {
    backgroundColor: '#FFF3E0',
  },
  absentBadge: {
    backgroundColor: '#FFEBEE',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  presentText: {
    color: '#4CAF50',
  },
  lateText: {
    color: '#FF9800',
  },
  absentText: {
    color: '#F44336',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 30,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    marginTop: 10,
  },
  emptySubText: {
    textAlign: 'center',
    color: '#BBB',
    fontSize: 14,
    marginTop: 5,
  },
  headerSignOutButton: {
    padding: 10,
  },
  actionButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  actionTextContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  actionArrow: {
    padding: 8,
  },
});

export default CompanyScreen; 