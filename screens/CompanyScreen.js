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
  const [scanMode, setScanMode] = useState('in'); // Default to check-in mode
  const [employees, setEmployees] = useState({});
  const [scannedEmployees, setScannedEmployees] = useState([]);
  const [currentDate, setCurrentDate] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'checked-in', 'checked-out'
  
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
        .select(`
          id,
          employee_id,
          check_in,
          check_out,
          status,
          recorded_by,
          created_at,
          updated_at,
          profiles:employee_id (
            id, 
            full_name,
            email,
            department,
            custom_id
          )
        `)
        .gte('check_in', today)
        .lt('check_in', new Date(new Date(today).getTime() + 86400000).toISOString())
        .order('check_in', { ascending: false });
      
      if (error) {
        console.error('Error fetching scanned employees:', error);
        Alert.alert('Error', 'Failed to load attendance data');
        return;
      }
      
      console.log('Loaded attendance data with profiles:', data);
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
      let qrData;
      try {
        qrData = JSON.parse(data);
      } catch (parseError) {
        console.log('Not a valid JSON in QR code:', parseError.message);
        Alert.alert(
          'Invalid QR Code',
          'This QR code does not contain valid employee data.',
          [{ text: 'OK', onPress: () => setShowScanner(false) }]
        );
        return;
      }
      
      // Check if this is an employee ID QR code (new format)
      if (qrData.type === 'employee_qr' && qrData.employee_id && qrData.name) {
        console.log('Processing employee_qr with ID:', qrData.employee_id);
        
        // Verify the employee exists
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, email, department')
          .eq('id', qrData.employee_id)
          .single();
        
        if (profileError || !profileData) {
          console.error('Error fetching employee profile:', profileError);
          Alert.alert(
            'Employee Not Found',
            `No employee found with ID: ${qrData.employee_id}. Please make sure the employee is registered in the system.`,
            [{ text: 'OK', onPress: () => setShowScanner(false) }]
          );
          return;
        }
        
        // Show action options
        Alert.alert(
          'Employee Found',
          `Name: ${profileData.full_name || qrData.name}\nID: ${qrData.employee_id}\nDepartment: ${profileData.department || 'Not specified'}`,
          [
            { 
              text: 'Cancel', 
              style: 'cancel', 
              onPress: () => setShowScanner(false) 
            },
            { 
              text: `Confirm ${scanMode === 'in' ? 'Check In' : 'Check Out'}`, 
              onPress: () => {
                if (scanMode === 'in') {
                  processEmployeeCheckIn(qrData.employee_id, profileData.full_name || qrData.name);
                } else {
                  processEmployeeCheckOut(qrData.employee_id, profileData.full_name || qrData.name);
                }
              }
            }
          ]
        );
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

  const processEmployeeCheckIn = async (employeeId, employeeName) => {
    try {
      const now = new Date();
      const currentTime = now.toISOString();
      
      // Log user information for debugging
      console.log('Current user:', user);
      console.log('Processing check-in for employee:', employeeId);
      
      // Validate that employeeId is a valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(employeeId)) {
        console.error('Invalid UUID format for employee ID:', employeeId);
        Alert.alert(
          'Invalid Employee ID',
          'The scanned employee ID is not in a valid format.',
          [{ text: 'OK', onPress: () => setShowScanner(false) }]
        );
        return;
      }
      
      // Determine status based on time
      const hour = now.getHours();
      const minute = now.getMinutes();
      const isLate = (hour > 9) || (hour === 9 && minute > 0);
      const isAbsent = hour >= 13;
      const status = isAbsent ? 'absent' : (isLate ? 'late' : 'present');
      
      // Create a check-in record
      const attendanceData = {
        employee_id: employeeId,
        check_in: currentTime,
        status: status,
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
    } catch (error) {
      console.error('Error processing check-in:', error);
      Alert.alert(
        'Error',
        `Failed to process check-in: ${error.message}`,
        [{ text: 'OK', onPress: () => setShowScanner(false) }]
      );
    }
  };

  const processEmployeeCheckOut = async (employeeId, employeeName) => {
    try {
      const now = new Date();
      const currentTime = now.toISOString();
      
      // Log user information for debugging
      console.log('Current user:', user);
      console.log('Processing check-out for employee:', employeeId);
      
      // Validate that employeeId is a valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(employeeId)) {
        console.error('Invalid UUID format for employee ID:', employeeId);
        Alert.alert(
          'Invalid Employee ID',
          'The scanned employee ID is not in a valid format.',
          [{ text: 'OK', onPress: () => setShowScanner(false) }]
        );
        return;
      }
      
      // Find the most recent check-in without a check-out
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      
      console.log('Checking attendance between', today.toISOString(), 'and', todayEnd.toISOString());
      
      const { data: existingRecords, error: fetchError } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employeeId)
        .gte('check_in', today.toISOString())
        .lte('check_in', todayEnd.toISOString())
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
      
      console.log('Found existing records:', existingRecords);
      
      // Find records that don't have a check-out time
      const recordsWithoutCheckout = existingRecords.filter(record => !record.check_out);
      
      if (recordsWithoutCheckout.length === 0) {
        Alert.alert(
          'No Active Check-In',
          'There are no active check-ins to check out from. Please check in first.',
          [{ text: 'OK', onPress: () => setShowScanner(false) }]
        );
        return;
      }
      
      // Update the most recent record with check-out time
      const recordToUpdate = recordsWithoutCheckout[0];
      const updateData = {
        check_out: currentTime,
        updated_at: currentTime
      };
      
      console.log('Updating attendance record:', recordToUpdate.id, 'with data:', updateData);
      
      const { data: updateResult, error: updateError } = await supabase
        .from('attendance')
        .update(updateData)
        .eq('id', recordToUpdate.id)
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
      
      console.log('Check-out recorded successfully. Updated record:', updateResult);
      
      Alert.alert(
        'Check-Out Successful',
        `${employeeName} has been checked out at ${now.toLocaleTimeString()}`,
        [{ text: 'OK', onPress: () => {
          setShowScanner(false);
          loadScannedEmployees(); // Refresh the list
        }}]
      );
    } catch (error) {
      console.error('Error processing check-out:', error);
      Alert.alert(
        'Error',
        `Failed to process check-out: ${error.message}`,
        [{ text: 'OK', onPress: () => setShowScanner(false) }]
      );
    }
  };

  const processEmployeeAttendance = async (employeeId, employeeName) => {
    try {
      // First check if the employee exists
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, department')
        .eq('id', employeeId)
        .single();
      
      if (profileError || !profileData) {
        console.error('Error fetching employee profile:', profileError);
        Alert.alert(
          'Employee Not Found',
          `No employee found with ID: ${employeeId}. Please make sure the employee is registered in the system.`,
          [{ text: 'OK', onPress: () => setShowScanner(false) }]
        );
        return;
      }
      
      // Show action options
      Alert.alert(
        'Employee Found',
        `Name: ${profileData.full_name || employeeName}\nID: ${employeeId}\nDepartment: ${profileData.department || 'Not specified'}`,
        [
          { 
            text: 'Cancel', 
            style: 'cancel', 
            onPress: () => setShowScanner(false) 
          },
          { 
            text: `Confirm ${scanMode === 'in' ? 'Check In' : 'Check Out'}`, 
            onPress: () => {
              if (scanMode === 'in') {
                processEmployeeCheckIn(employeeId, profileData.full_name || employeeName);
              } else {
                processEmployeeCheckOut(employeeId, profileData.full_name || employeeName);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error in processEmployeeAttendance:', error);
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

  // Calculate duration between check-in and check-out times in hours and minutes
  const calculateDuration = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return null;
    
    const checkInTime = new Date(checkIn);
    const checkOutTime = new Date(checkOut);
    
    // Calculate difference in milliseconds
    const diffMs = checkOutTime - checkInTime;
    
    // Convert to hours and minutes
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return { hours: diffHrs, minutes: diffMins };
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
            <View style={styles.headerActions}>
              <TouchableOpacity 
                style={styles.headerButton} 
                onPress={loadScannedEmployees}
              >
                <Ionicons name="refresh-outline" size={22} color="#0b3a32" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.headerSignOutButton} 
                onPress={handleSignOut}
              >
                <Ionicons name="log-out-outline" size={24} color="#0b3a32" />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => {
                Alert.alert(
                  'Scan QR Code',
                  'Are you checking in or checking out?',
                  [
                    {
                      text: 'Check In',
                      onPress: () => {
                        setScanMode('in');
                        setShowScanner(true);
                      }
                    },
                    {
                      text: 'Check Out',
                      onPress: () => {
                        setScanMode('out');
                        setShowScanner(true);
                      }
                    },
                    {
                      text: 'Cancel',
                      style: 'cancel'
                    }
                  ]
                );
              }}
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
              <Text style={styles.statLabel}>Total Records</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>
                {scannedEmployees.filter(record => record.check_out).length}
              </Text>
              <Text style={styles.statLabel}>Checked Out</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>
                {scannedEmployees.filter(record => !record.check_out).length}
              </Text>
              <Text style={styles.statLabel}>Still Present</Text>
            </View>
          </View>
          
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>
                {scannedEmployees.filter(record => record.status === 'present').length}
              </Text>
              <Text style={styles.statLabel}>On Time</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>
                {scannedEmployees.filter(record => record.status === 'late').length}
              </Text>
              <Text style={styles.statLabel}>Late</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>
                {Object.keys(employees).length}
              </Text>
              <Text style={styles.statLabel}>Total Staff</Text>
            </View>
          </View>
          
          <View style={styles.attendanceCard}>
            <View style={styles.attendanceCardHeader}>
              <Text style={styles.sectionTitle}>Today's Attendance</Text>
              <Text style={styles.attendanceCount}>{scannedEmployees.length} records</Text>
            </View>
            
            <View style={styles.filterContainer}>
              <TouchableOpacity
                style={[styles.filterButton, filter === 'all' && styles.activeFilterButton]}
                onPress={() => setFilter('all')}
              >
                <Text style={[styles.filterButtonText, filter === 'all' && styles.activeFilterText]}>All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterButton, filter === 'checked-in' && styles.activeFilterButton]}
                onPress={() => setFilter('checked-in')}
              >
                <Text style={[styles.filterButtonText, filter === 'checked-in' && styles.activeFilterText]}>Checked In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterButton, filter === 'checked-out' && styles.activeFilterButton]}
                onPress={() => setFilter('checked-out')}
              >
                <Text style={[styles.filterButtonText, filter === 'checked-out' && styles.activeFilterText]}>Checked Out</Text>
              </TouchableOpacity>
            </View>
            
            {scannedEmployees.length > 0 ? (
              scannedEmployees
                .filter(record => {
                  if (filter === 'all') return true;
                  if (filter === 'checked-in') return !record.check_out;
                  if (filter === 'checked-out') return record.check_out;
                  return true;
                })
                .map((record, index) => (
                  <View key={record.id} style={[
                    styles.attendanceItem,
                    index === scannedEmployees.length - 1 && styles.lastAttendanceItem
                  ]}>
                    <View style={styles.attendanceItemHeader}>
                      <Text style={styles.employeeName}>
                        {record.profiles ? record.profiles.full_name : getEmployeeName(record.employee_id)}
                      </Text>
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
                    
                    <Text style={styles.employeeDetails}>
                      {record.profiles ? 
                        `${record.profiles.department || 'No Department'} · ID: ${record.profiles.custom_id || 'N/A'}` : 
                        `Employee ID: ${record.employee_id.substring(0, 8)}...`
                      }
                    </Text>
                    
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
                        <>
                          <View style={styles.timeBlock}>
                            <View style={styles.timeRow}>
                              <Ionicons name="exit-outline" size={16} color="#F44336" style={styles.timeIcon} />
                              <Text style={styles.timeLabel}>Check Out:</Text>
                            </View>
                            <Text style={styles.timeValue}>
                              {new Date(record.check_out).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </Text>
                          </View>
                          
                          <View style={styles.timeBlock}>
                            <View style={styles.timeRow}>
                              <Ionicons name="timer-outline" size={16} color="#2196F3" style={styles.timeIcon} />
                              <Text style={styles.timeLabel}>Duration:</Text>
                            </View>
                            {(() => {
                              const duration = calculateDuration(record.check_in, record.check_out);
                              return (
                                <Text style={styles.timeValue}>
                                  {duration ? `${duration.hours}h ${duration.minutes}m` : 'N/A'}
                                </Text>
                              );
                            })()}
                          </View>
                        </>
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
    backgroundColor: '#e1eae3',
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginRight: 8,
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
  employeeDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  filterContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    justifyContent: 'center',
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginHorizontal: 4,
    backgroundColor: '#F0F0F0',
  },
  activeFilterButton: {
    backgroundColor: '#0b3a32',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
  },
  activeFilterText: {
    color: '#FFF',
    fontWeight: '500',
  },
});

export default CompanyScreen;