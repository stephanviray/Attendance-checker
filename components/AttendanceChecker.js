import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  FlatList, 
  Modal, 
  Alert,
  TextInput,
  SafeAreaView,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Image
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import BarcodeScanner from './BarcodeScanner';
import Ionicons from '@expo/vector-icons/Ionicons';

// Company logo - using a placeholder from assets
import companyLogo from '../assets/icon.png';

// Sample employee data - in a real app, this would come from an API or database
const INITIAL_EMPLOYEES = {
  'EMP001': { name: 'John Smith', department: 'HR' },
  'EMP002': { name: 'Sarah Johnson', department: 'Engineering' },
  'EMP003': { name: 'Michael Brown', department: 'Finance' },
  'EMP004': { name: 'Emma Davis', department: 'Marketing' },
  'EMP005': { name: 'Robert Wilson', department: 'IT' },
};

const AttendanceChecker = () => {
  const [showScanner, setShowScanner] = useState(false);
  const [attendance, setAttendance] = useState([]);
  const [currentDate, setCurrentDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [clockMode, setClockMode] = useState('in'); // 'in' or 'out'
  const [employees, setEmployees] = useState(INITIAL_EMPLOYEES);
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  
  // New employee registration
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [newEmployeeId, setNewEmployeeId] = useState('');
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeDepartment, setNewEmployeeDepartment] = useState('');
  const [scannedIdToRegister, setScannedIdToRegister] = useState('');
  
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

    // Load saved data
    loadSavedData();
  }, []);

  useEffect(() => {
    // Persist attendance records whenever they change
    const persistAttendance = async () => {
      if (attendance.length > 0) {
        try {
          console.log('Auto-saving attendance data:', attendance.length, 'records');
          await AsyncStorage.setItem('attendance', JSON.stringify(attendance));
        } catch (error) {
          console.error('Error auto-saving attendance:', error);
        }
      }
    };
    
    persistAttendance();
  }, [attendance]);

  const loadSavedData = async () => {
    try {
      // Load attendance records
      const savedAttendance = await AsyncStorage.getItem('attendance');
      if (savedAttendance) {
        const parsedAttendance = JSON.parse(savedAttendance);
        console.log('Loaded attendance records:', parsedAttendance.length);
        setAttendance(parsedAttendance);
      }

      // Load employee data
      const savedEmployees = await AsyncStorage.getItem('employees');
      if (savedEmployees) {
        const parsedEmployees = JSON.parse(savedEmployees);
        console.log('Loaded employees:', Object.keys(parsedEmployees).length);
        setEmployees(parsedEmployees);
      }
    } catch (error) {
      console.error('Error loading saved data:', error);
      Alert.alert('Error', 'Failed to load saved attendance data');
    }
  };

  const saveAttendance = async (newAttendanceData) => {
    try {
      console.log('Saving attendance data:', newAttendanceData.length, 'records');
      setAttendance(newAttendanceData);
      await AsyncStorage.setItem('attendance', JSON.stringify(newAttendanceData));
    } catch (error) {
      console.error('Error saving attendance:', error);
      Alert.alert('Error', 'Failed to save attendance data');
    }
  };

  const saveEmployees = async (newEmployeeData) => {
    try {
      console.log('Saving employee data:', Object.keys(newEmployeeData).length, 'employees');
      setEmployees(newEmployeeData);
      await AsyncStorage.setItem('employees', JSON.stringify(newEmployeeData));
    } catch (error) {
      console.error('Error saving employees:', error);
      Alert.alert('Error', 'Failed to save employee data');
    }
  };

  const handleScan = ({ type, data }) => {
    // First check if the data could be a valid employee ID
    if (employees[data]) {
      // It's an existing employee ID
      processEmployeeId(data);
      return;
    }
    
    // Not a known employee ID - ask to register
    Alert.alert(
      'Unknown ID',
      `"${data}" is not recognized. Would you like to register a new employee with this ID?`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setShowScanner(false) },
        { 
          text: 'Register', 
          onPress: () => {
            setNewEmployeeId(data);
            setShowScanner(false);
            setShowRegisterModal(true);
          }
        }
      ]
    );
  };

  // Process scanned employee ID
  const processEmployeeId = (employeeId) => {
    console.log('Processing Employee ID:', employeeId);
    const now = new Date();
    const timestamp = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila' });
    
    // Check if employee exists in our database
    const employee = employees[employeeId];
    console.log('Employee lookup:', employeeId, employee);
    
    if (!employee) {
      Alert.alert(
        'Unknown Employee ID',
        `No employee found with ID: ${employeeId}`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setShowScanner(false) },
          { 
            text: 'Register New Employee', 
            onPress: () => {
              setScannedIdToRegister(employeeId);
              setNewEmployeeId(employeeId);
              setShowScanner(false);
              setShowRegisterModal(true);
            }
          }
        ]
      );
      return;
    }

    if (clockMode === 'in') {
      // Check if employee already clocked in today
      const alreadyClockedIn = attendance.some(
        item => item.id === employeeId && item.type === 'in' && item.date === currentDate
      );
      
      if (alreadyClockedIn) {
        Alert.alert(
          'Already Clocked In',
          `${employee.name} has already clocked in today.`,
          [
            { text: 'OK', onPress: () => setShowScanner(false) },
            { 
              text: 'Clock Out Instead', 
              onPress: () => {
                setClockMode('out');
                setShowScanner(true);
              }
            }
          ]
        );
        return;
      }
      
      // Process clock in
      const newAttendance = [
        ...attendance,
        {
          id: employeeId, 
          name: employee.name,
          department: employee.department,
          time: timestamp,
          date: currentDate,
          type: 'in'
        }
      ];
      
      console.log('New attendance record (IN):', newAttendance[newAttendance.length - 1]);
      saveAttendance(newAttendance);
      
      Alert.alert(
        'Clock In Successful',
        `${employee.name} checked in at ${timestamp}`,
        [
          { text: 'Continue Scanning', onPress: () => setShowScanner(true) },
          { text: 'Done', onPress: () => setShowScanner(false), style: 'default' }
        ]
      );
    } else {
      // Check if employee has clocked in today
      const hasClockedIn = attendance.some(
        item => item.id === employeeId && item.type === 'in' && item.date === currentDate
      );
      
      // Check if employee has already clocked out
      const alreadyClockedOut = attendance.some(
        item => item.id === employeeId && item.type === 'out' && item.date === currentDate
      );
      
      if (!hasClockedIn) {
        Alert.alert(
          'No Clock In Record',
          `${employee.name} has not clocked in today.`,
          [
            { text: 'OK', onPress: () => setShowScanner(false) },
            { 
              text: 'Clock In Instead', 
              onPress: () => {
                setClockMode('in');
                setShowScanner(true);
              }
            }
          ]
        );
        return;
      }
      
      if (alreadyClockedOut) {
        Alert.alert(
          'Already Clocked Out',
          `${employee.name} has already clocked out today.`,
          [{ text: 'OK', onPress: () => setShowScanner(false) }]
        );
        return;
      }
      
      // Process clock out
      const newAttendance = [
        ...attendance,
        {
          id: employeeId, 
          name: employee.name,
          department: employee.department,
          time: timestamp,
          date: currentDate,
          type: 'out'
        }
      ];
      
      console.log('New attendance record (OUT):', newAttendance[newAttendance.length - 1]);
      saveAttendance(newAttendance);
      
      Alert.alert(
        'Clock Out Successful',
        `${employee.name} checked out at ${timestamp}`,
        [
          { text: 'Continue Scanning', onPress: () => setShowScanner(true) },
          { text: 'Done', onPress: () => setShowScanner(false), style: 'default' }
        ]
      );
    }
  };

  const registerNewEmployee = () => {
    // Check for required fields
    if (!newEmployeeId.trim()) {
      Alert.alert('Error', 'Employee ID is required');
      return;
    }

    if (!newEmployeeName.trim()) {
      Alert.alert('Error', 'Employee name is required');
      return;
    }

    // Department can be optional, but ensure it has BS prefix if provided
    let departmentToSave = newEmployeeDepartment;
    if (departmentToSave && !departmentToSave.toUpperCase().startsWith('BS')) {
      departmentToSave = `BS${departmentToSave}`;
    } else if (!departmentToSave) {
      departmentToSave = 'General';
    }

    // Check if ID already exists
    if (employees[newEmployeeId]) {
      Alert.alert(
        'Employee ID Already Exists',
        `An employee with ID ${newEmployeeId} is already registered.`,
        [
          { 
            text: 'View Employee', 
            onPress: () => {
              setShowRegisterModal(false);
            }
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      return;
    }

    // Add the new employee to our employee database
    const updatedEmployees = {
      ...employees,
      [newEmployeeId]: {
        name: newEmployeeName,
        department: departmentToSave
      }
    };

    // Use saveEmployees instead of setEmployees
    saveEmployees(updatedEmployees);
    
    // Reset form
    setNewEmployeeId('');
    setNewEmployeeName('');
    setNewEmployeeDepartment('');
    setShowRegisterModal(false);

    Alert.alert(
      'Success',
      'New employee registered successfully',
      [
        { 
          text: 'OK', 
          onPress: () => {
            if (scannedIdToRegister) {
              // If registration was triggered by scan, offer to mark attendance
              Alert.alert(
                'Mark Attendance',
                'Would you like to mark attendance for this employee now?',
                [
                  { text: 'No, Later', style: 'cancel' },
                  { 
                    text: 'Yes', 
                    onPress: () => {
                      setShowScanner(true);
                      setScannedIdToRegister('');
                    }
                  }
                ]
              );
            }
          }
        }
      ]
    );
  };

  // Add a function to get unique departments
  const getUniqueDepartments = useCallback(() => {
    const departments = new Set(['All']);
    
    // Add departments from employees
    Object.values(employees).forEach(employee => {
      if (employee.department) {
        departments.add(employee.department);
      }
    });
    
    return Array.from(departments);
  }, [employees]);

  // Update the filteredAttendance function to include department filtering
  const filteredAttendance = attendance.filter(item => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = (
      item.id.toLowerCase().includes(searchLower) || 
      (item.name && item.name.toLowerCase().includes(searchLower)) ||
      (item.department && item.department.toLowerCase().includes(searchLower))
    );
    
    // Apply department filter if not "All"
    const matchesDepartment = selectedDepartment === 'All' || 
      item.department === selectedDepartment;
    
    return matchesSearch && matchesDepartment;
  });

  // Get unique employee count who clocked in today
  const presentEmployees = [...new Set(
    attendance
      .filter(item => item.type === 'in')
      .map(item => item.id)
  )].length;

  const toggleClockMode = () => {
    setClockMode(current => current === 'in' ? 'out' : 'in');
  };

  // Add these functions for calculating work hours
  const calculateWorkHours = (inTime, outTime) => {
    if (!inTime || !outTime) return 0;
    
    // Parse times (assuming format like "10:30:45 AM")
    const inTimeParts = inTime.match(/(\d+):(\d+):(\d+)\s*([AP]M)?/);
    const outTimeParts = outTime.match(/(\d+):(\d+):(\d+)\s*([AP]M)?/);
    
    if (!inTimeParts || !outTimeParts) return 0;
    
    let inHour = parseInt(inTimeParts[1]);
    const inMinute = parseInt(inTimeParts[2]);
    const inPeriod = inTimeParts[4] || '';
    
    let outHour = parseInt(outTimeParts[1]);
    const outMinute = parseInt(outTimeParts[2]);
    const outPeriod = outTimeParts[4] || '';
    
    // Convert to 24-hour format if needed
    if (inPeriod.toUpperCase() === 'PM' && inHour < 12) inHour += 12;
    if (inPeriod.toUpperCase() === 'AM' && inHour === 12) inHour = 0;
    if (outPeriod.toUpperCase() === 'PM' && outHour < 12) outHour += 12;
    if (outPeriod.toUpperCase() === 'AM' && outHour === 12) outHour = 0;
    
    // Calculate hours worked
    let hours = outHour - inHour;
    let minutes = outMinute - inMinute;
    
    if (minutes < 0) {
      hours--;
      minutes += 60;
    }
    
    if (hours < 0) {
      // Handle overnight shift (assuming no shift is longer than 24 hours)
      hours += 24;
    }
    
    return hours + (minutes / 60);
  };

  // Enhance the viewTodaysAttendance function
  const viewTodaysAttendance = () => {
    const todaysRecords = attendance.filter(item => item.date === currentDate);
    
    if (todaysRecords.length === 0) {
      Alert.alert(
        'No Records Today',
        'No attendance records found for today.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Count unique employees who checked in today
    const uniqueEmployees = [...new Set(todaysRecords.filter(a => a.type === 'in').map(a => a.id))];
    
    // Group by employee for better display
    const byEmployee = {};
    todaysRecords.forEach(record => {
      if (!byEmployee[record.id]) {
        byEmployee[record.id] = {
          name: record.name,
          department: record.department,
          records: []
        };
      }
      byEmployee[record.id].records.push({
        type: record.type,
        time: record.time
      });
    });
    
    // Calculate total hours for today
    let totalHours = 0;
    let employeesWithCompleteRecords = 0;
    
    // Build the summary message
    let message = `Date: ${currentDate}\nTotal Employees: ${uniqueEmployees.length}\n\n`;
    
    Object.keys(byEmployee).forEach(id => {
      const emp = byEmployee[id];
      const inRecord = emp.records.find(r => r.type === 'in')?.time || 'N/A';
      const outRecord = emp.records.find(r => r.type === 'out')?.time || 'N/A';
      
      let hoursWorked = 0;
      if (inRecord !== 'N/A' && outRecord !== 'N/A') {
        hoursWorked = calculateWorkHours(inRecord, outRecord);
        totalHours += hoursWorked;
        employeesWithCompleteRecords++;
      }
      
      message += `${emp.name} (${id})\nDept: ${emp.department}\nIN: ${inRecord} | OUT: ${outRecord}\n`;
      
      if (hoursWorked > 0) {
        message += `Hours: ${hoursWorked.toFixed(2)}\n`;
      }
      
      message += '\n';
    });
    
    if (employeesWithCompleteRecords > 0) {
      message += `Total Hours Worked: ${totalHours.toFixed(2)}\nAvg Hours: ${(totalHours / employeesWithCompleteRecords).toFixed(2)}`;
    }
    
    Alert.alert(
      'Today\'s Attendance',
      message,
      [{ text: 'Close' }]
    );
  };

  // Update the renderAttendanceItem function for a modern look
  const renderAttendanceItem = ({ item, index }) => {
    // Find corresponding clock-out record if this is a clock-in
    let hoursWorked = 0;
    let pairRecord = null;
    
    if (item.type === 'in') {
      // Look for a matching clock-out record on the same day
      pairRecord = attendance.find(a => 
        a.id === item.id && 
        a.type === 'out' && 
        a.date === item.date &&
        a.time > item.time // Make sure it's after the clock-in
      );
      
      if (pairRecord) {
        hoursWorked = calculateWorkHours(item.time, pairRecord.time);
      }
    } else if (item.type === 'out') {
      // Look for a matching clock-in record on the same day
      pairRecord = attendance.find(a => 
        a.id === item.id && 
        a.type === 'in' && 
        a.date === item.date &&
        a.time < item.time // Make sure it's before the clock-out
      );
      
      if (pairRecord) {
        hoursWorked = calculateWorkHours(pairRecord.time, item.time);
      }
    }

    // Define colors for in/out status
    const statusColor = item.type === 'in' ? '#4CAF50' : '#F44336';

    return (
      <View style={[
        styles.attendanceItem, 
        { borderLeftColor: statusColor }
      ]}>
        <View style={styles.attendanceDetails}>
          <Text style={styles.attendanceName}>{item.name}</Text>
          <Text style={styles.attendanceId}>ID: {item.id}</Text>
          <Text style={styles.attendanceDept}>{item.department}</Text>
          <Text style={styles.attendanceDate}>{item.date}</Text>
          {hoursWorked > 0 && (
            <Text style={styles.attendanceHours}>Hours: {hoursWorked.toFixed(2)}</Text>
          )}
        </View>
        <View style={styles.attendanceTimeContainer}>
          <Text style={[
            styles.attendanceType, 
            { color: statusColor }
          ]}>
            {item.type === 'in' ? 'IN' : 'OUT'}
          </Text>
          <Text style={styles.attendanceTime}>{item.time}</Text>
        </View>
      </View>
    );
  };

  // Add a function to export attendance data
  const exportAttendanceData = () => {
    // Create a formatted CSV-style string
    let exportData = 'Employee ID,Name,Department,Date,Clock In,Clock Out,Hours\n';
    
    // Group by employee and date
    const recordsByEmployeeAndDate = {};
    
    attendance.forEach(record => {
      const key = `${record.id}-${record.date}`;
      if (!recordsByEmployeeAndDate[key]) {
        recordsByEmployeeAndDate[key] = {
          id: record.id,
          name: record.name,
          department: record.department,
          date: record.date,
          inTime: null,
          outTime: null
        };
      }
      
      if (record.type === 'in') {
        recordsByEmployeeAndDate[key].inTime = record.time;
      } else if (record.type === 'out') {
        recordsByEmployeeAndDate[key].outTime = record.time;
      }
    });
    
    // Process each record and add to export string
    Object.values(recordsByEmployeeAndDate).forEach(record => {
      const hoursWorked = (record.inTime && record.outTime) 
        ? calculateWorkHours(record.inTime, record.outTime).toFixed(2) 
        : '';
      
      exportData += `${record.id},${record.name},${record.department},${record.date},`;
      exportData += `${record.inTime || ''},${record.outTime || ''},${hoursWorked}\n`;
    });
    
    // For now, just show the data in an alert - in a real app you would save this
    // to a file or share it via email/messaging
    Alert.alert(
      'Export Data',
      'Attendance data ready for export:',
      [
        { 
          text: 'Copy to Clipboard', 
          onPress: async () => {
            try {
              await Clipboard.setStringAsync(exportData);
              Alert.alert('Success', 'Data copied to clipboard');
            } catch (error) {
              Alert.alert('Error', 'Failed to copy data');
            }
          } 
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  // Add a function to clear all attendance data (for administrative purposes)
  const clearAttendanceData = () => {
    Alert.alert(
      'Clear Attendance Data',
      'Are you sure you want to clear all attendance records? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear All Data', 
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear state and storage
              setAttendance([]);
              await AsyncStorage.removeItem('attendance');
              console.log('All attendance data cleared');
              Alert.alert('Success', 'All attendance records have been cleared');
            } catch (error) {
              console.error('Error clearing attendance data:', error);
              Alert.alert('Error', 'Failed to clear attendance data');
            }
          }
        }
      ]
    );
  };

  // Add a function to render the scan button with animation
  const renderScanButton = () => {
    const buttonColor = clockMode === 'in' ? '#4CAF50' : '#F44336';
    
    return (
      <View style={styles.scanButtonWrapper}>
        <TouchableOpacity 
          style={[styles.scanButtonContainer, { backgroundColor: `${buttonColor}CC` }]}
          onPress={() => setShowScanner(true)}
          activeOpacity={0.8}
          onLongPress={toggleClockMode}
        >
          <View style={styles.scanButtonInner}>
            <Ionicons name="scan-outline" size={28} color="white" />
          </View>
        </TouchableOpacity>
        <View style={styles.scanButtonLabel}>
          <Text style={styles.scanButtonLabelText}>
            {clockMode === 'in' ? 'Clock In' : 'Clock Out'}
          </Text>
        </View>
      </View>
    );
  };

  const debugClockInOut = () => {
    // Get all employee IDs
    const allEmployeeIds = Object.keys(employees);
    
    if (allEmployeeIds.length === 0) {
      Alert.alert('No Employees', 'Please register employees first');
      return;
    }
    
    const options = allEmployeeIds.map(id => ({
      id,
      name: employees[id].name
    }));
    
    // Show alert with all employees to select
    Alert.alert(
      'Debug Mode: Manual Clock In/Out',
      'Select an employee to clock in/out:',
      [
        ...options.map(employee => ({
          text: `${employee.name} (${employee.id})`,
          onPress: () => processEmployeeId(employee.id)
        })),
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  // Update the scan button styles to properly appear with the bottom navigation bar
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#f0f5ff',
    },
    header: {
      backgroundColor: '#3f51b5',
      paddingHorizontal: 20,
      paddingTop: Platform.OS === 'android' ? 50 : 35,
      paddingBottom: 20,
      alignItems: 'center',
      position: 'relative',
      borderBottomLeftRadius: 30,
      borderBottomRightRadius: 30,
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
    },
    headerLogoContainer: {
      width: 90,
      height: 90,
      borderRadius: 45,
      backgroundColor: 'white',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 10,
      elevation: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.4,
      shadowRadius: 6,
      borderWidth: 3,
      borderColor: 'rgba(255,255,255,0.8)',
    },
    companyLogo: {
      width: 70,
      height: 70,
      borderRadius: 35,
    },
    welcomeText: {
      fontSize: 18,
      color: 'rgba(255,255,255,0.9)',
      marginBottom: 5,
      textShadowColor: 'rgba(0,0,0,0.3)',
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 2,
    },
    title: {
      fontSize: 30,
      fontWeight: 'bold',
      color: 'white',
      letterSpacing: 0.5,
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 3,
    },
    date: {
      fontSize: 16,
      color: 'rgba(255,255,255,0.9)',
      marginTop: 5,
      textShadowColor: 'rgba(0,0,0,0.3)',
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 2,
    },
    searchContainer: {
      padding: 15,
      marginHorizontal: 15,
      marginTop: 10,
      position: 'relative',
    },
    searchInput: {
      backgroundColor: 'white',
      paddingVertical: 12,
      paddingLeft: 15,
      paddingRight: 40,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: 'rgba(200,220,255,0.8)',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 3,
      fontSize: 15,
    },
    searchIcon: {
      position: 'absolute',
      right: 30,
      top: 26,
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: 25,
      marginHorizontal: 15,
      padding: 20,
      backgroundColor: 'rgba(255,255,255,0.9)',
      borderRadius: 20,
      elevation: 5,
      shadowColor: '#3f51b5',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      borderWidth: 1,
      borderColor: 'rgba(200,220,255,0.7)',
    },
    statItem: {
      alignItems: 'center',
      padding: 10,
    },
    statValue: {
      fontSize: 28,
      fontWeight: 'bold',
      color: '#3f51b5',
      textShadowColor: 'rgba(63,81,181,0.2)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 1,
    },
    statLabel: {
      fontSize: 14,
      color: '#555',
      marginTop: 3,
      fontWeight: '500',
    },
    listContainer: {
      flex: 1,
      paddingHorizontal: 15,
      marginBottom: 20,
    },
    listHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 15,
      paddingHorizontal: 5,
    },
    listTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#333',
      textShadowColor: 'rgba(0,0,0,0.1)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 1,
    },
    list: {
      paddingBottom: 70,
    },
    attendanceItem: {
      backgroundColor: 'rgba(255,255,255,0.9)',
      padding: 18,
      borderRadius: 15,
      marginBottom: 15,
      flexDirection: 'row',
      justifyContent: 'space-between',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 3,
      borderLeftWidth: 5,
      borderWidth: 1,
      borderColor: 'rgba(200,220,255,0.5)',
    },
    attendanceDetails: {
      flex: 1,
    },
    attendanceName: {
      fontSize: 17,
      fontWeight: 'bold',
      color: '#222',
    },
    attendanceId: {
      fontSize: 14,
      color: '#666',
      marginTop: 3,
    },
    attendanceDept: {
      fontSize: 14,
      color: '#666',
      marginTop: 2,
    },
    attendanceDate: {
      fontSize: 14,
      color: '#777',
      marginTop: 3,
    },
    attendanceHours: {
      fontSize: 14,
      color: '#3f51b5',
      marginTop: 3,
      fontWeight: 'bold',
    },
    attendanceTimeContainer: {
      justifyContent: 'center',
      alignItems: 'flex-end',
      minWidth: 75,
    },
    attendanceType: {
      fontSize: 16,
      fontWeight: 'bold',
    },
    attendanceTime: {
      fontSize: 14,
      color: '#666',
      marginTop: 4,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 50,
    },
    emptyText: {
      fontSize: 18,
      color: '#555',
      fontWeight: 'bold',
      textShadowColor: 'rgba(0,0,0,0.1)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 1,
    },
    emptySubText: {
      fontSize: 15,
      color: '#888',
      marginTop: 10,
      textAlign: 'center',
      paddingHorizontal: 30,
    },
    scanButtonWrapper: {
      position: 'absolute',
      alignItems: 'center',
      bottom: 40,
      left: 0,
      right: 0,
      zIndex: 999,
    },
    scanButtonContainer: {
      width: 75,
      height: 75,
      borderRadius: 38,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 15,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      borderWidth: 5,
      borderColor: 'rgba(255,255,255,0.9)',
    },
    scanButtonInner: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    scanButtonLabel: {
      position: 'absolute',
      bottom: -30,
      backgroundColor: 'rgba(0,0,0,0.7)',
      paddingHorizontal: 14,
      paddingVertical: 5,
      borderRadius: 15,
      elevation: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
    },
    scanButtonLabelText: {
      color: 'white',
      fontSize: 13,
      fontWeight: 'bold',
    },
    recordCountText: {
      fontSize: 14,
      color: '#666',
      fontWeight: '500',
    },
    divider: {
      height: 8,
      backgroundColor: 'rgba(200,220,255,0.3)',
      marginVertical: 10,
    },
    bottomBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      height: 70,
      backgroundColor: 'white',
      borderTopWidth: 1,
      borderTopColor: '#f0f0f0',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingHorizontal: 15,
    },
    bottomBarItem: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 70,
    },
    bottomBarItemText: {
      fontSize: 12,
      color: '#777',
      marginTop: 4,
    },
    bottomBarItemTextActive: {
      color: '#3f51b5',
      fontWeight: '500',
    },
    bottomBarSpacer: {
      width: 70,
    },
    // New Employee Registration Modal styles
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    registerModal: {
      backgroundColor: 'white',
      margin: 20,
      borderRadius: 16,
      elevation: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      overflow: 'hidden',
    },
    registerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 18,
      backgroundColor: '#3f51b5',
      borderBottomWidth: 0,
    },
    registerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: 'white',
    },
    closeModalButtonContainer: {
      padding: 5,
    },
    closeModalButton: {
      fontSize: 22,
      color: 'white',
    },
    registerForm: {
      padding: 20,
    },
    registerLabel: {
      fontSize: 16,
      color: '#444',
      marginBottom: 8,
      fontWeight: '500',
    },
    registerFieldContainer: {
      marginBottom: 18,
    },
    registerInput: {
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 10,
      padding: 12,
      backgroundColor: '#f9f9fa',
      fontSize: 15,
    },
    registerButton: {
      backgroundColor: '#4CAF50',
      padding: 15,
      borderRadius: 10,
      alignItems: 'center',
      marginTop: 10,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 1.5,
    },
    registerButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: 'bold',
    },
    // Management button styles
    managementButton: {
      backgroundColor: 'rgba(255,30,30,0.8)',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 1.5,
    },
    managementButtonText: {
      color: 'white',
      fontWeight: 'bold',
      fontSize: 14,
    },
    headerButtons: {
      position: 'absolute',
      right: 15,
      top: Platform.OS === 'android' ? 50 : 35,
      flexDirection: 'row',
    },
    departmentTabsContainer: {
      paddingHorizontal: 15,
      paddingBottom: 10,
    },
    departmentTab: {
      backgroundColor: '#f0f0f0',
      paddingHorizontal: 15,
      paddingVertical: 8,
      borderRadius: 20,
      marginRight: 10,
    },
    departmentTabActive: {
      backgroundColor: '#3f51b5',
    },
    departmentTabText: {
      fontSize: 14,
      color: '#555',
    },
    departmentTabTextActive: {
      color: 'white',
      fontWeight: '500',
    },
    seeAllText: {
      fontSize: 14,
      color: '#3f51b5',
      fontWeight: '500',
    },
    recentList: {
      paddingBottom: 10,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <View style={styles.headerLogoContainer}>
            <Image source={companyLogo} style={styles.companyLogo} />
          </View>
          <Text style={styles.welcomeText}>Welcome to</Text>
          <Text style={styles.title}>Attendance Tracker</Text>
          <Text style={styles.date}>{currentDate}</Text>
        </View>
        
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by ID, name or department..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <View style={styles.searchIcon}>
            <Ionicons name="search-outline" size={22} color="#777" />
          </View>
        </View>
        
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{presentEmployees}</Text>
            <Text style={styles.statLabel}>Present</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{attendance.filter(item => item.type === 'in').length}</Text>
            <Text style={styles.statLabel}>Clock Ins</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{attendance.filter(item => item.type === 'out').length}</Text>
            <Text style={styles.statLabel}>Clock Outs</Text>
          </View>
        </View>
        
        <View style={styles.divider} />
          
        <View style={styles.listContainer}>
          <View style={styles.listHeaderRow}>
            <Text style={styles.listTitle}>
              All Attendance Records
            </Text>
            <Text style={styles.recordCountText}>
              {filteredAttendance.length} {filteredAttendance.length === 1 ? 'record' : 'records'}
            </Text>
          </View>
          
          {filteredAttendance.length > 0 ? (
            <FlatList
              data={filteredAttendance}
              keyExtractor={(item, index) => `${item.id}-${item.time}-${index}`}
              renderItem={renderAttendanceItem}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No attendance records yet</Text>
              <Text style={styles.emptySubText}>Use the scan button below to record employee attendance</Text>
            </View>
          )}
        </View>
      </ScrollView>
      
      {/* Render scan button */}
      {renderScanButton()}

      {/* Scanner Modal */}
      <Modal
        visible={showScanner}
        animationType="slide"
        onRequestClose={() => setShowScanner(false)}
      >
        <BarcodeScanner 
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
          clockMode={clockMode}
        />
      </Modal>

      {/* New Employee Registration Modal */}
      <Modal
        visible={showRegisterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRegisterModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.registerModal}>
            <View style={styles.registerHeader}>
              <Text style={styles.registerTitle}>Register New Employee</Text>
              <TouchableOpacity 
                style={styles.closeModalButtonContainer} 
                onPress={() => setShowRegisterModal(false)}
              >
                <Text style={styles.closeModalButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.registerForm}>
              <View style={styles.registerFieldContainer}>
                <Text style={styles.registerLabel}>Employee ID *</Text>
                <TextInput
                  style={styles.registerInput}
                  placeholder="Enter employee ID"
                  value={newEmployeeId}
                  onChangeText={setNewEmployeeId}
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.registerFieldContainer}>
                <Text style={styles.registerLabel}>Employee Name *</Text>
                <TextInput
                  style={styles.registerInput}
                  placeholder="Enter employee name"
                  value={newEmployeeName}
                  onChangeText={setNewEmployeeName}
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.registerFieldContainer}>
                <Text style={styles.registerLabel}>Department</Text>
                <TextInput
                  style={styles.registerInput}
                  placeholder="Enter department"
                  value={newEmployeeDepartment}
                  onChangeText={setNewEmployeeDepartment}
                  placeholderTextColor="#999"
                />
              </View>

              <TouchableOpacity
                style={styles.registerButton}
                onPress={registerNewEmployee}
              >
                <Text style={styles.registerButtonText}>Register Employee</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

export default AttendanceChecker; 