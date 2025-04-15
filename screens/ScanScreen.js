import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  Alert,
  SafeAreaView,
  StatusBar
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import BarcodeScanner from '../components/BarcodeScanner';
import { useAuth } from '../utils/AuthContext';
import { supabase } from '../utils/supabase';

const ScanScreen = ({ route, navigation }) => {
  const { user, userRole } = useAuth();
  const [showScanner, setShowScanner] = useState(true);
  const [attendance, setAttendance] = useState([]);
  const [employees, setEmployees] = useState({});
  const [clockMode, setClockMode] = useState(route.params?.mode || 'in');
  const [currentDate, setCurrentDate] = useState('');
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [scannedIdToRegister, setScannedIdToRegister] = useState('');
  const isAdminScan = route.params?.adminScan || false;
  const [scannedEmployee, setScannedEmployee] = useState(null);
  const [attendanceResult, setAttendanceResult] = useState(null);
  
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
    
    // Set clock mode from route params whenever it changes
    if (route.params?.mode) {
      setClockMode(route.params.mode);
      console.log('Clock mode set from params:', route.params.mode);
    }
  }, [route.params?.mode]);

  const loadSavedData = async () => {
    try {
      // Load attendance records
      const savedAttendance = await AsyncStorage.getItem('attendance');
      if (savedAttendance) {
        const parsedAttendance = JSON.parse(savedAttendance);
        console.log('Loaded attendance records:', parsedAttendance.length);
        setAttendance(parsedAttendance);
      }

      // Fetch employees from Supabase
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, department, position, custom_id')
        .eq('role', 'employee');
      
      if (error) {
        console.error('Error fetching employees from Supabase:', error);
      } else if (data) {
        // Convert to our format for easier lookup
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
        
        console.log('Loaded employees from Supabase:', Object.keys(employeesObj).length);
        setEmployees(employeesObj);
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

  const handleScan = async ({ type, data }) => {
    console.log('Scanned QR code data:', data);
    
    // First try to parse the data as JSON (for the new QR format)
    try {
      const qrData = JSON.parse(data);
      
      // Check if this is an attendance QR code
      if (qrData.type === 'attendance_qr' && qrData.employee_id) {
        // Verify if QR code is still valid (not expired)
        const now = new Date();
        const expiryDate = new Date(qrData.expires);
        
        if (expiryDate < now) {
          Alert.alert(
            'Expired QR Code',
            'This attendance QR code has expired. Please ask the admin to generate a new one.',
            [{ text: 'OK', onPress: () => setShowScanner(false) }]
          );
          return;
        }
        
        // Verify the secret key
        const today = new Date().toISOString().split('T')[0];
        const storedSecret = await AsyncStorage.getItem(`qr_secret_${today}`);
        
        if (!storedSecret || storedSecret !== qrData.secret) {
          Alert.alert(
            'Invalid QR Code',
            'This QR code is not valid for today or has been tampered with.',
            [{ text: 'OK', onPress: () => setShowScanner(false) }]
          );
          return;
        }
        
        // Check if current time is within allowed check-in/out period
        const [checkInHour, checkInMin] = qrData.check_in.split(':').map(Number);
        const [checkOutHour, checkOutMin] = qrData.check_out.split(':').map(Number);
        
        const currentHour = now.getHours();
        const currentMin = now.getMinutes();
        
        // For clock-in mode, verify it's not too early or too late
        if (clockMode === 'in') {
          // Allow check-in starting from 1 hour before configured time
          const earliestHour = checkInHour - 1;
          
          // Convert to minutes since midnight for easier comparison
          const currentTimeInMinutes = currentHour * 60 + currentMin;
          const earliestTimeInMinutes = Math.max(0, earliestHour * 60 + checkInMin);
          const latestTimeInMinutes = (checkOutHour * 60 + checkOutMin);
          
          if (currentTimeInMinutes < earliestTimeInMinutes) {
            Alert.alert(
              'Too Early',
              `You cannot check in before ${Math.max(0, earliestHour)}:${checkInMin.toString().padStart(2, '0')}`,
              [{ text: 'OK', onPress: () => setShowScanner(false) }]
            );
            return;
          }
          
          if (currentTimeInMinutes > latestTimeInMinutes) {
            Alert.alert(
              'Too Late',
              `You cannot check in after ${checkOutHour}:${checkOutMin.toString().padStart(2, '0')}`,
              [{ text: 'OK', onPress: () => setShowScanner(false) }]
            );
            return;
          }
        } 
        // For clock-out mode, verify it's not too early
        else if (clockMode === 'out') {
          // Convert to minutes since midnight for easier comparison
          const currentTimeInMinutes = currentHour * 60 + currentMin;
          const earliestTimeInMinutes = (checkInHour * 60 + checkInMin);
          
          if (currentTimeInMinutes < earliestTimeInMinutes) {
            Alert.alert(
              'Too Early',
              `You cannot check out before ${checkInHour}:${checkInMin.toString().padStart(2, '0')}`,
              [{ text: 'OK', onPress: () => setShowScanner(false) }]
            );
            return;
          }
        }
        
        // All validations passed, proceed with attendance
        // Get employee details from employee_id
        const employeeId = qrData.employee_id;
        
        // Check if employee exists in our database
        // First check in our local cache
        if (employees[employeeId]) {
          processEmployeeId(employeeId);
          return;
        }
        
        // If not in cache, try to fetch from Supabase
        try {
          const { data: profileData, error } = await supabase
            .from('profiles')
            .select('id, full_name, email, department, custom_id')
            .eq('id', employeeId)
            .single();
          
          if (error) {
            // Try looking up by custom_id instead
            const { data: customIdData, error: customIdError } = await supabase
              .from('profiles')
              .select('id, full_name, email, department, custom_id')
              .eq('custom_id', employeeId);
              
            if (customIdError || !customIdData || customIdData.length === 0) {
              Alert.alert(
                'Unknown Employee',
                'This QR code contains an unknown employee ID.',
                [{ text: 'OK', onPress: () => setShowScanner(false) }]
              );
              return;
            }
            
            // Use the first result from custom ID search
            const firstProfileData = customIdData[0];
            
            // Add to our local cache
            employees[firstProfileData.id] = {
              name: firstProfileData.full_name || firstProfileData.email.split('@')[0],
              department: firstProfileData.department || 'General',
              position: firstProfileData.position || '',
              email: firstProfileData.email,
              id: firstProfileData.id,
              custom_id: firstProfileData.custom_id
            };
            
            // Process attendance with UUID (id) rather than custom_id
            processEmployeeId(firstProfileData.id);
            return;
          }
          
          // Add to our local cache
          employees[employeeId] = {
            name: profileData.full_name || profileData.email.split('@')[0],
            department: profileData.department || 'General',
            position: profileData.position || '',
            email: profileData.email,
            id: profileData.id,
            custom_id: profileData.custom_id
          };
          
          // Process attendance
          processEmployeeId(employeeId);
          return;
        } catch (error) {
          console.error('Error fetching profile:', error);
          Alert.alert(
            'Error',
            'There was an error processing the employee ID.',
            [{ text: 'OK', onPress: () => setShowScanner(false) }]
          );
          return;
        }
      }
    } catch (e) {
      // Not a JSON or not the expected format, continue with legacy format handling
      console.log('Not a JSON QR code or parsing error, trying legacy format', e);
    }
    
    // If admin is scanning, handle differently
    if (isAdminScan || userRole === 'admin') {
      try {
        console.log('Admin scanning QR code with data:', data);
        
        // First check if the data is a JSON string (new QR format)
        let employeeId = data;
        try {
          const parsedData = JSON.parse(data);
          if (parsedData.type === 'employee_qr' && parsedData.employee_id) {
            console.log('Found employee_qr type with ID:', parsedData.employee_id);
            employeeId = parsedData.employee_id;
          }
        } catch (parseError) {
          // Not JSON, continue with the original data
          console.log('Not JSON data, using as-is');
        }
        
        // Try to find the employee first - could be UUID or old ID format
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('id, full_name, email, role, department, position, custom_id')
          .eq('id', employeeId)
          .maybeSingle();  // Use maybeSingle() instead of single() to avoid errors when no results

        console.log('Scan result - profile data:', profileData, 'error:', error);

        if (error || !profileData) {
          // If not found by direct ID, check if it's a custom_id
          const { data: customIdResults, error: customIdError } = await supabase
            .from('profiles')
            .select('id, full_name, email, role, department, position, custom_id')
            .eq('custom_id', data);
            
          if (!customIdError && customIdResults && customIdResults.length > 0) {
            const foundProfile = customIdResults[0];
            // Show employee details in alert instead of navigating to a non-existent screen
            Alert.alert(
              'Employee Found',
              `Name: ${foundProfile.full_name || foundProfile.email}\nID: ${foundProfile.custom_id || foundProfile.id}\nDepartment: ${foundProfile.department || 'Not specified'}`,
              [
                { 
                  text: 'Cancel', 
                  style: 'cancel', 
                  onPress: () => navigation.goBack() 
                },
                { 
                  text: `Confirm ${clockMode === 'in' ? 'Check In' : 'Check Out'}`, 
                  onPress: () => {
                    // Add to employees cache first
                    const updatedEmployees = {
                      ...employees,
                      [foundProfile.id]: {
                        name: foundProfile.full_name || foundProfile.email.split('@')[0],
                        department: foundProfile.department || 'General',
                        position: foundProfile.position || '',
                        email: foundProfile.email,
                        id: foundProfile.id,
                        custom_id: foundProfile.custom_id
                      }
                    };
                    setEmployees(updatedEmployees);
                    processEmployeeId(foundProfile.id);
                  }
                }
              ]
            );
            return;
          }
        
          // If not found by UUID or custom ID, check our local cache
          if (employees[data]) {
            // We found it in our local employees object
            const employeeId = data;
            const employee = employees[employeeId];
            
            console.log('Found employee in local cache:', employee);
            
            // Check if it's an admin
            const { data: roleData, error: roleError } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', employeeId)
              .maybeSingle();  // Use maybeSingle instead
              
            if (!roleError && roleData && roleData.role === 'admin') {
              Alert.alert(
                'Admin Profile',
                'Admins do not have attendance records.',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
              );
              return;
            }
            
            // Show employee details in alert instead of navigating to a non-existent screen
            Alert.alert(
              'Employee Found',
              `Name: ${employee.name}\nID: ${employee.custom_id || employee.id}\nDepartment: ${employee.department || 'Not specified'}`,
              [
                { 
                  text: 'Cancel', 
                  style: 'cancel', 
                  onPress: () => navigation.goBack() 
                },
                { 
                  text: `Confirm ${clockMode === 'in' ? 'Check In' : 'Check Out'}`, 
                  onPress: () => {
                    // Add to employees cache first
                    const updatedEmployees = {
                      ...employees,
                      [employeeId]: {
                        name: employee.name,
                        department: employee.department || 'General',
                        position: employee.position || '',
                        email: employee.email,
                        id: employee.id,
                        custom_id: employee.custom_id
                      }
                    };
                    setEmployees(updatedEmployees);
                    processEmployeeId(employeeId);
                  }
                }
              ]
            );
            return;
          }
          
          // Not found in either database
          console.error('Employee not found with ID:', data);
          Alert.alert(
            'Error',
            'Could not find employee with this ID.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
          return;
        }

        // Found the employee in Supabase
        if (profileData) {
          // If it's an admin scanning another admin, show notification
          if (profileData.role === 'admin') {
            Alert.alert(
              'Admin Profile',
              'Admins do not have attendance records.',
              [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
            return;
          }

          // Show employee details in alert instead of navigating to a non-existent screen
          Alert.alert(
            'Employee Found',
            `Name: ${profileData.full_name || profileData.email}\nID: ${profileData.custom_id || profileData.id}\nDepartment: ${profileData.department || 'Not specified'}`,
            [
              { 
                text: 'Cancel', 
                style: 'cancel', 
                onPress: () => navigation.goBack() 
              },
              { 
                text: `Confirm ${clockMode === 'in' ? 'Check In' : 'Check Out'}`, 
                onPress: () => {
                  // Add to employees cache first if needed
                  if (!employees[profileData.id]) {
                    const updatedEmployees = {
                      ...employees,
                      [profileData.id]: {
                        name: profileData.full_name || profileData.email.split('@')[0],
                        department: profileData.department || 'General',
                        position: profileData.position || '',
                        email: profileData.email,
                        id: profileData.id,
                        custom_id: profileData.custom_id
                      }
                    };
                    setEmployees(updatedEmployees);
                  }
                  // Force clock mode to 'in' and process
                  setClockMode('in');
                  processEmployeeId(profileData.id);
                }
              }
            ]
          );
          return;
        }
      } catch (err) {
        console.error('Error during admin scan:', err);
        Alert.alert(
          'Error',
          'An error occurred while processing the QR code.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
      return;
    }

    // Legacy format: Normal employee attendance flow
    if (employees[data]) {
      // It's an existing employee ID
      processEmployeeId(data);
      return;
    }
    
    // Check if the data is a JSON string that we didn't handle earlier
    try {
      const parsedData = JSON.parse(data);
      if (parsedData.type === 'employee_qr' && parsedData.employee_id) {
        console.log('Found employee_qr in legacy format handling with ID:', parsedData.employee_id);
        if (employees[parsedData.employee_id]) {
          processEmployeeId(parsedData.employee_id);
          return;
        }
        
        // Check with Supabase directly
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, email, department, position, custom_id')
          .eq('id', parsedData.employee_id)
          .single();
        
        if (!profileError && profileData) {
          // Found the employee in Supabase, update local cache
          employees[parsedData.employee_id] = {
            name: profileData.full_name || profileData.email.split('@')[0],
            department: profileData.department || 'General',
            position: profileData.position || '',
            email: profileData.email,
            id: profileData.id,
            custom_id: profileData.custom_id
          };
          
          // Process attendance with the extracted ID
          processEmployeeId(parsedData.employee_id);
          return;
        }
      }
    } catch (parseError) {
      // Not JSON or parsing error, continue with normal flow
      console.log('Not a JSON string or already handled');
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
            setScannedIdToRegister(data);
            setShowScanner(false);
            navigation.navigate('EmployeeList', { newEmployeeId: data });
          }
        }
      ]
    );
  };

  // Process scanned employee ID
  const processEmployeeId = async (employeeId) => {
    console.log('Processing Employee ID:', employeeId);
    const now = new Date();
    const timestamp = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila' });
    
    // Check if employee exists in our database
    let employee = employees[employeeId];
    console.log('Employee lookup from cache:', employeeId, employee);
    
    // Validate that employeeId is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(employeeId)) {
      console.error('Invalid UUID format for employee ID:', employeeId);
      Alert.alert(
        'Invalid Employee ID',
        'The scanned employee ID is not in a valid format.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
      return;
    }
    
    // If not in local cache, try to fetch directly from Supabase
    if (!employee) {
      console.log('Employee not found in cache, checking Supabase directly');
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, department, position, custom_id')
        .eq('id', employeeId)
        .single();
      
      if (!profileError && profileData) {
        // Found the employee in Supabase, create a record for local cache
        employee = {
          name: profileData.full_name || profileData.email.split('@')[0],
          department: profileData.department || 'General',
          position: profileData.position || '',
          email: profileData.email || '',
          id: profileData.id,
          custom_id: profileData.custom_id
        };
        
        // Update local cache
        const updatedEmployees = {...employees, [employeeId]: employee};
        setEmployees(updatedEmployees);
        console.log('Added employee to local cache:', employee);
      }
    }
    
    // If still not found in either cache or Supabase direct lookup
    if (!employee) {
      Alert.alert(
        'Unknown Employee ID',
        `No employee found with ID: ${employeeId}`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => navigation.goBack() },
          { 
            text: 'Register New Employee', 
            onPress: () => {
              navigation.navigate('EmployeeList', { newEmployeeId: employeeId });
            }
          }
        ]
      );
      return;
    }

    // For Supabase implementation, check if the scanned ID belongs to an admin
    if (userRole === 'admin') {
      // If admin is scanning, check if they're scanning their own badge
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', employeeId)
        .single();
      
      if (!error && data && data.role === 'admin') {
        Alert.alert(
          'Admin Attendance Restriction',
          'Admin users do not need to record attendance. This feature is only for employees.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }
    }

    // Update UI with employee info
    setScannedEmployee({
      name: employee.name,
      department: employee.department || 'General',
      employeeId: employee.custom_id || employeeId, // Show custom ID if available
      time: timestamp
    });

    // Check if they already have attendance recorded today
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(new Date(today).getTime() + 86400000).toISOString().split('T')[0];
    
    console.log('Checking attendance between', today, 'and', tomorrow);
    
    const { data: existingAttendance, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('check_in', today)
      .lt('check_in', tomorrow)
      .order('check_in', { ascending: false });
    
    if (error) {
      console.error('Error checking attendance:', error);
      setAttendanceResult({
        status: 'error',
        message: 'Error checking attendance records'
      });
      return;
    }

    console.log('Existing attendance records:', existingAttendance);

    // Check if we found an existing record for today
    const existingToday = existingAttendance && existingAttendance.length > 0;
    
    if (clockMode === 'in') {
      // For clock-in, find if they already checked in
      const alreadyCheckedIn = existingToday && existingAttendance.some(record => !record.check_out);
      
      if (alreadyCheckedIn) {
        const latestRecord = existingAttendance.find(record => !record.check_out);
        const time = new Date(latestRecord.check_in).toLocaleTimeString('en-US', { 
          timeZone: 'Asia/Manila',
          hour: '2-digit', 
          minute: '2-digit'
        });
        
        setAttendanceResult({
          status: 'warning',
          message: `Already checked in at ${time}`
        });
        return;
      }
      
      // Determine status based on time
      const hour = now.getHours();
      const minute = now.getMinutes();
      const isLate = (hour > 9) || (hour === 9 && minute > 0);
      const status = isLate ? 'late' : 'present';
      
      // Record check-in
      try {
        const { data: insertData, error: insertError } = await supabase
          .from('attendance')
          .insert([{
            employee_id: employeeId,
            check_in: now.toISOString(),
            status: status,
            recorded_by: user?.id || null
          }])
          .select();
        
        if (insertError) {
          console.error('Error recording attendance for check-in:', insertError);
          setAttendanceResult({
            status: 'error',
            message: 'Error recording check-in: ' + insertError.message
          });
          
          Alert.alert(
            'Check-In Failed',
            `Failed to record check-in: ${insertError.message}`,
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
          return;
        }
        
        console.log('Check-in recorded successfully:', insertData);
        
        setAttendanceResult({
          status: 'success',
          message: isLate ? 'Checked in (Late)' : 'Checked in successfully'
        });
        
        // Alert the user about successful check-in
        Alert.alert(
          'Check-In Successful',
          `${employee.name} has been checked in at ${now.toLocaleTimeString()}`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } catch (exception) {
        console.error('Exception during check-in process:', exception);
        setAttendanceResult({
          status: 'error',
          message: 'An unexpected error occurred during check-in'
        });
        
        Alert.alert(
          'Check-In Error',
          'An unexpected error occurred while recording your check-in. Please try again or contact support.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
      
    } else {
      // Clock-out mode
      // Find records that don't have a check-out time
      const recordsWithoutCheckout = existingAttendance.filter(record => !record.check_out);
      
      console.log('Records without checkout:', recordsWithoutCheckout.length, recordsWithoutCheckout);
      
      if (recordsWithoutCheckout.length === 0) {
        Alert.alert(
          'No Active Check-In',
          existingToday 
            ? 'All check-ins today already have check-outs recorded.' 
            : 'You must check in before checking out.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        setAttendanceResult({
          status: 'warning',
          message: existingToday ? 'Already checked out for all sessions today' : 'Must check in before checking out'
        });
        return;
      }
      
      // Update the most recent record with check-out time
      const latestRecord = recordsWithoutCheckout[0];
      console.log('Updating attendance record with check-out:', latestRecord.id);
      
      const updatePayload = {
        check_out: now.toISOString(),
        updated_at: now.toISOString()
      };
      
      console.log('Update payload:', updatePayload);
      
      try {
        const { data: updateData, error: updateError } = await supabase
          .from('attendance')
          .update(updatePayload)
          .eq('id', latestRecord.id)
          .select();
        
        if (updateError) {
          console.error('Error updating attendance for check-out:', updateError);
          setAttendanceResult({
            status: 'error',
            message: 'Error recording check-out: ' + updateError.message
          });
          
          Alert.alert(
            'Check-Out Failed',
            `Failed to record check-out: ${updateError.message}`,
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
          return;
        }
        
        console.log('Check-out recorded successfully. Updated record:', updateData);
        
        setAttendanceResult({
          status: 'success',
          message: 'Checked out successfully'
        });
        
        // Alert the user about successful check-out
        Alert.alert(
          'Check-Out Successful',
          `${employee.name} has been checked out at ${now.toLocaleTimeString()}`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } catch (exception) {
        console.error('Exception during check-out process:', exception);
        setAttendanceResult({
          status: 'error',
          message: 'An unexpected error occurred during check-out'
        });
        
        Alert.alert(
          'Check-Out Error',
          'An unexpected error occurred while recording your check-out. Please try again or contact support.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    }
  };

  const toggleClockMode = () => {
    setClockMode(clockMode === 'in' ? 'out' : 'in');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {showScanner ? (
        <BarcodeScanner
          onScan={handleScan}
          onClose={() => navigation.goBack()}
          clockMode={clockMode}
          isAdminScan={isAdminScan}
        />
      ) : (
        <>
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {isAdminScan ? 'Scan Employee ID' : `Clock ${clockMode.toUpperCase()}`}
            </Text>
            {!isAdminScan && (
              <TouchableOpacity 
                style={styles.modeButton}
                onPress={toggleClockMode}
              >
                <Text style={styles.modeButtonText}>
                  Switch to Clock {clockMode === 'in' ? 'OUT' : 'IN'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.messageContainer}>
            <Text style={styles.messageText}>Scanner paused</Text>
            <TouchableOpacity 
              style={styles.resumeButton}
              onPress={() => setShowScanner(true)}
            >
              <Text style={styles.resumeButtonText}>Resume Scanning</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#FFF',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
  },
  modeButton: {
    padding: 5,
  },
  modeButtonText: {
    color: '#2196F3',
    fontSize: 16,
  },
  messageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  messageText: {
    color: '#333',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  resumeButton: {
    padding: 10,
    backgroundColor: '#2196F3',
    borderRadius: 5,
  },
  resumeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ScanScreen; 