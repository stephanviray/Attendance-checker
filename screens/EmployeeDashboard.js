import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList,
  RefreshControl,
  Alert,
  ScrollView,
  Dimensions,
  Share,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView
} from 'react-native';
import { useAuth } from '../utils/AuthContext';
import { supabase } from '../utils/supabase';
import { ProfileSync } from '../utils/ProfileSync';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';

const { width } = Dimensions.get('window');
const QR_SIZE = Math.min(width * 0.6, 200);

export default function EmployeeDashboard({ navigation }) {
  const { user, signOut } = useAuth();
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [qrValue, setQrValue] = useState('');
  const [syncStatus, setSyncStatus] = useState('');
  const [syncUrl, setSyncUrl] = useState('');
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editedProfile, setEditedProfile] = useState({});
  const [changePasswordModal, setChangePasswordModal] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [activeSection, setActiveSection] = useState('attendance');

  useEffect(() => {
    fetchEmployeeData();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchEmployeeData();
      return () => {};
    }, [])
  );

  const fetchEmployeeData = async () => {
    try {
      setLoading(true);
      
      // Fetch profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (profileError) throw profileError;
      setUserProfile(profileData);
      
      // Sync profile data for web dashboard
      await syncProfileWithWebDashboard(profileData);
      
      // Generate QR code value
      generateQrCode(profileData);
      
      // Fetch attendance history
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', user.id)
        .order('check_in', { ascending: false })
        .limit(20);
      
      if (attendanceError) throw attendanceError;
      setAttendanceHistory(attendanceData || []);
    } catch (error) {
      console.error('Error fetching data:', error.message);
      Alert.alert('Error', 'Failed to load attendance data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  // Sync profile data with web dashboard
  const syncProfileWithWebDashboard = async (profileData) => {
    try {
      // Set syncing status
      setSyncStatus('syncing');
      
      // Check if we can reach the Supabase API at all
      const { data: connectionTest, error: connectionError } = await supabase
        .from('profiles')
        .select('count', { count: 'exact', head: true })
        .limit(1);
      
      if (connectionError) {
        console.log('Unable to connect to Supabase, will use local storage only:', connectionError);
        setSyncStatus('offline');
        generateQrCode(profileData); // Generate QR without sync token
        return;
      }
      
      // Store profile data in shared storage
      const { data, error } = await ProfileSync.storeProfileData(user, profileData);
      
      if (error) {
        console.error('Error syncing profile:', error);
        setSyncStatus('error');
        generateQrCode(profileData); // Generate basic QR without sync data
        return;
      }
      
      // Generate a sync token (will work even if the token table doesn't exist yet)
      const { token, error: tokenError } = await ProfileSync.generateSyncToken(user);
      
      if (tokenError) {
        console.error('Error generating sync token:', tokenError);
        setSyncStatus('partial');
        generateQrCode(profileData); // Generate basic QR without sync token
        return;
      }
      
      // Create sync URL for the web dashboard
      // Use a URL that will work even when hosted on different domains
      let webDashboardUrl;
      try {
        // Try to get actual project URL from Supabase config
        const projectRef = supabase.supabaseUrl.split('.')[0].split('//')[1];
        webDashboardUrl = `https://${projectRef}.supabase.co/storage/v1/object/public/app/sync.html?token=${token}`;
      } catch (urlError) {
        // Fallback to example URL if we can't parse project ref
        webDashboardUrl = `https://example.com/sync.html?token=${token}`;
      }
      
      setSyncUrl(webDashboardUrl);
      setSyncStatus('synced');
      
      // Update QR code to contain sync link as well
      generateQrCode(profileData, token);
      
    } catch (error) {
      setSyncStatus('error');
      console.error('Error in syncProfileWithWebDashboard:', error);
      // Still generate a basic QR code without sync info
      generateQrCode(profileData);
    }
  };
  
  const generateQrCode = (profile, syncToken = null) => {
    if (!profile) return;
    
    // Create QR data with employee information
    const qrData = {
      type: 'employee_qr',
      employee_id: user.id,
      name: profile.full_name || user.email.split('@')[0],
      email: user.email,
      generated_at: new Date().toISOString()
    };
    
    // Add sync data if available
    if (syncToken) {
      qrData.sync_token = syncToken;
    }
    
    setQrValue(JSON.stringify(qrData));
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchEmployeeData();
  };

  const handleScanQR = () => {
    navigation.navigate('ScanScreen');
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      Alert.alert('Error signing out', error.message);
    }
  };
  
  const shareSyncLink = async () => {
    if (!syncUrl) {
      Alert.alert('Error', 'Sync link not available. Please try refreshing.');
      return;
    }
    
    try {
      await Share.share({
        message: 'Use this link to sync your attendance profile with the web dashboard: ' + syncUrl,
        url: Platform.OS === 'ios' ? syncUrl : undefined
      });
    } catch (error) {
      console.error('Error sharing sync link:', error);
      Alert.alert('Error', 'Could not share sync link.');
    }
  };

  // Calculate statistics
  const getAttendanceStats = () => {
    if (!attendanceHistory.length) return { present: 0, absent: 0, late: 0 };
    
    const present = attendanceHistory.filter(item => item.status === 'present').length;
    const absent = attendanceHistory.filter(item => item.status === 'absent').length;
    const late = attendanceHistory.filter(item => item.status === 'late').length;
    
    return { present, absent, late };
  };

  const { present, absent, late } = getAttendanceStats();

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  const handleViewProfile = () => {
    setProfileModalVisible(true);
  };
  
  const handleEditProfile = () => {
    setEditingProfile(true);
    setEditedProfile({
      first_name: userProfile?.first_name || '',
      last_name: userProfile?.last_name || '',
      middle_initial: userProfile?.middle_initial || '',
      address: userProfile?.address || '',
      phone_number: userProfile?.phone_number || ''
    });
  };
  
  const handleSaveProfile = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: editedProfile.first_name,
          last_name: editedProfile.last_name,
          middle_initial: editedProfile.middle_initial,
          address: editedProfile.address,
          phone_number: editedProfile.phone_number,
          updated_at: new Date()
        })
        .eq('id', user.id);
        
      if (error) throw error;
      
      Alert.alert('Success', 'Your profile has been updated successfully.');
      setEditingProfile(false);
      fetchEmployeeData(); // Refresh data
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile: ' + error.message);
    }
  };
  
  const handleChangePassword = () => {
    setChangePasswordModal(true);
    setPasswords({ current: '', new: '', confirm: '' });
  };
  
  const handleUpdatePassword = async () => {
    try {
      // Validate inputs
      if (!passwords.current || !passwords.new || !passwords.confirm) {
        Alert.alert('Validation Error', 'All password fields are required');
        return;
      }
      
      if (passwords.new !== passwords.confirm) {
        Alert.alert('Validation Error', 'New passwords do not match');
        return;
      }
      
      if (passwords.new.length < 6) {
        Alert.alert('Validation Error', 'Password must be at least 6 characters');
        return;
      }
      
      // Update password
      const { error } = await supabase.auth.updateUser({
        password: passwords.new
      });
      
      if (error) throw error;
      
      Alert.alert('Success', 'Your password has been updated successfully.');
      setChangePasswordModal(false);
    } catch (error) {
      console.error('Error updating password:', error);
      Alert.alert('Error', 'Failed to update password: ' + error.message);
    }
  };
  
  const switchSection = (section) => {
    setActiveSection(section);
  };

  return (
    <View style={styles.container}>
      {/* Header with user info */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{userProfile?.full_name || 'Employee'}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      
      {/* Section navigation */}
      <View style={styles.sectionNav}>
        <TouchableOpacity 
          style={[styles.sectionTab, activeSection === 'attendance' && styles.activeTab]}
          onPress={() => switchSection('attendance')}
        >
          <Ionicons name="calendar-outline" size={22} color={activeSection === 'attendance' ? '#1a73e8' : '#666'} />
          <Text style={[styles.sectionText, activeSection === 'attendance' && styles.activeText]}>Attendance</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.sectionTab, activeSection === 'profile' && styles.activeTab]}
          onPress={() => switchSection('profile')}
        >
          <Ionicons name="person-outline" size={22} color={activeSection === 'profile' ? '#1a73e8' : '#666'} />
          <Text style={[styles.sectionText, activeSection === 'profile' && styles.activeText]}>Profile</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        style={styles.scrollView}
      >
        {activeSection === 'attendance' ? (
          /* Attendance Section */
          <View style={styles.contentContainer}>
            {/* QR Code Section */}
            <View style={styles.qrSection}>
              <Text style={styles.sectionTitle}>Your Attendance QR Code</Text>
              <View style={styles.qrContainer}>
                {qrValue ? (
                  <QRCode
                    value={qrValue}
                    size={QR_SIZE}
                    color="#000"
                    backgroundColor="#fff"
                  />
                ) : (
                  <View style={[styles.qrPlaceholder, {width: QR_SIZE, height: QR_SIZE}]}>
                    <Ionicons name="qr-code" size={QR_SIZE/2} color="#ccc" />
                  </View>
                )}
              </View>
              <Text style={styles.qrInstructions}>
                Show this QR code to check in or out of work
              </Text>
            </View>
            
            {/* Attendance History */}
            <View style={styles.historySection}>
              <Text style={styles.sectionTitle}>Recent Attendance</Text>
              {attendanceHistory.length > 0 ? (
                <FlatList
                  data={attendanceHistory}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={({item}) => (
                    <View style={styles.historyItem}>
                      <View style={styles.historyDate}>
                        <Text style={styles.dateText}>{formatDate(item.check_in)}</Text>
                        <View style={[styles.statusBadge, {backgroundColor: item.status === 'present' ? '#4CAF50' : '#FF9800'}]}>
                          <Text style={styles.statusText}>{item.status}</Text>
                        </View>
                      </View>
                      <View style={styles.historyTime}>
                        <View style={styles.timeRow}>
                          <Ionicons name="enter-outline" size={16} color="#4CAF50" />
                          <Text style={styles.timeText}>
                            {new Date(item.check_in).toLocaleTimeString()}
                          </Text>
                        </View>
                        {item.check_out && (
                          <View style={styles.timeRow}>
                            <Ionicons name="exit-outline" size={16} color="#F44336" />
                            <Text style={styles.timeText}>
                              {new Date(item.check_out).toLocaleTimeString()}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}
                  style={styles.historyList}
                />
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="calendar-outline" size={40} color="#ccc" />
                  <Text style={styles.emptyText}>No attendance records yet</Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          /* Profile Section */
          <View style={styles.contentContainer}>
            <View style={styles.profileSection}>
              <Text style={styles.sectionTitle}>Personal Information</Text>
              <View style={styles.profileCard}>
                <View style={styles.profileHeader}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>
                      {userProfile?.first_name?.[0] || ''}
                      {userProfile?.last_name?.[0] || ''}
                    </Text>
                  </View>
                  <View style={styles.profileHeaderText}>
                    <Text style={styles.profileName}>{userProfile?.full_name}</Text>
                    <Text style={styles.profilePosition}>{userProfile?.position || 'No Position'}</Text>
                  </View>
                </View>
                
                <View style={styles.profileFields}>
                  <View style={styles.profileField}>
                    <Text style={styles.fieldLabel}>Employee ID</Text>
                    <Text style={styles.fieldValue}>{userProfile?.custom_id || 'Not assigned'}</Text>
                  </View>
                  
                  <View style={styles.profileField}>
                    <Text style={styles.fieldLabel}>Email</Text>
                    <Text style={styles.fieldValue}>{userProfile?.email || user?.email}</Text>
                  </View>
                  
                  <View style={styles.profileField}>
                    <Text style={styles.fieldLabel}>Department</Text>
                    <Text style={styles.fieldValue}>{userProfile?.department || 'Not assigned'}</Text>
                  </View>
                  
                  <View style={styles.profileField}>
                    <Text style={styles.fieldLabel}>Position</Text>
                    <Text style={styles.fieldValue}>{userProfile?.position || 'Not assigned'}</Text>
                  </View>
                  
                  <View style={styles.profileField}>
                    <Text style={styles.fieldLabel}>Phone Number</Text>
                    <Text style={styles.fieldValue}>{userProfile?.phone_number || 'Not provided'}</Text>
                  </View>
                  
                  <View style={styles.profileField}>
                    <Text style={styles.fieldLabel}>Address</Text>
                    <Text style={styles.fieldValue}>{userProfile?.address || 'Not provided'}</Text>
                  </View>
                </View>
                
                <View style={styles.profileActions}>
                  <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
                    <Ionicons name="create-outline" size={20} color="#fff" />
                    <Text style={styles.editButtonText}>Edit Profile</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.passwordButton} onPress={handleChangePassword}>
                    <Ionicons name="key-outline" size={20} color="#fff" />
                    <Text style={styles.passwordButtonText}>Change Password</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
      
      {/* Edit Profile Modal */}
      <Modal
        visible={editingProfile}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEditingProfile(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <View style={styles.editModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditingProfile(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.editForm}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>First Name</Text>
                <TextInput
                  style={styles.input}
                  value={editedProfile.first_name}
                  onChangeText={(text) => setEditedProfile({...editedProfile, first_name: text})}
                  placeholder="First Name"
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Middle Initial</Text>
                <TextInput
                  style={styles.input}
                  value={editedProfile.middle_initial}
                  onChangeText={(text) => setEditedProfile({...editedProfile, middle_initial: text})}
                  placeholder="M.I."
                  maxLength={1}
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Last Name</Text>
                <TextInput
                  style={styles.input}
                  value={editedProfile.last_name}
                  onChangeText={(text) => setEditedProfile({...editedProfile, last_name: text})}
                  placeholder="Last Name"
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                  style={styles.input}
                  value={editedProfile.phone_number}
                  onChangeText={(text) => setEditedProfile({...editedProfile, phone_number: text})}
                  placeholder="Phone Number"
                  keyboardType="phone-pad"
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Address</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={editedProfile.address}
                  onChangeText={(text) => setEditedProfile({...editedProfile, address: text})}
                  placeholder="Address"
                  multiline={true}
                  numberOfLines={3}
                />
              </View>
            </ScrollView>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setEditingProfile(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]} 
                onPress={handleSaveProfile}
              >
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      
      {/* Change Password Modal */}
      <Modal
        visible={changePasswordModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setChangePasswordModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <View style={styles.editModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setChangePasswordModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.editForm}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Current Password</Text>
                <TextInput
                  style={styles.input}
                  value={passwords.current}
                  onChangeText={(text) => setPasswords({...passwords, current: text})}
                  placeholder="Current Password"
                  secureTextEntry={true}
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>New Password</Text>
                <TextInput
                  style={styles.input}
                  value={passwords.new}
                  onChangeText={(text) => setPasswords({...passwords, new: text})}
                  placeholder="New Password"
                  secureTextEntry={true}
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Confirm New Password</Text>
                <TextInput
                  style={styles.input}
                  value={passwords.confirm}
                  onChangeText={(text) => setPasswords({...passwords, confirm: text})}
                  placeholder="Confirm New Password"
                  secureTextEntry={true}
                />
              </View>
              
              <Text style={styles.passwordNote}>
                Password must be at least 6 characters long.
              </Text>
            </ScrollView>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setChangePasswordModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]} 
                onPress={handleUpdatePassword}
              >
                <Text style={styles.saveButtonText}>Update Password</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#1a73e8',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  userEmail: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  signOutButton: {
    padding: 8,
  },
  sectionNav: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#1a73e8',
  },
  sectionText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
  },
  activeText: {
    color: '#1a73e8',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  qrSection: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  qrContainer: {
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  qrInstructions: {
    textAlign: 'center',
    marginTop: 15,
    color: '#666',
  },
  historySection: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  historyList: {
    maxHeight: 350,
  },
  historyItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 12,
  },
  historyDate: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  historyTime: {
    marginLeft: 10,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  timeText: {
    marginLeft: 8,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyText: {
    marginTop: 10,
    color: '#888',
    textAlign: 'center',
  },
  // Profile styles
  profileSection: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  profileCard: {
    backgroundColor: '#fff',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1a73e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  profileHeaderText: {
    marginLeft: 15,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  profilePosition: {
    fontSize: 14,
    color: '#666',
  },
  profileFields: {
    marginBottom: 20,
  },
  profileField: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 16,
    color: '#333',
  },
  profileActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a73e8',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    flex: 1,
    marginRight: 8,
  },
  editButtonText: {
    color: '#fff',
    fontWeight: '500',
    marginLeft: 8,
  },
  passwordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34A853',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    flex: 1,
    marginLeft: 8,
  },
  passwordButtonText: {
    color: '#fff',
    fontWeight: '500',
    marginLeft: 8,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  editModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingBottom: 30,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  editForm: {
    marginTop: 15,
  },
  formGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    color: '#555',
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  passwordNote: {
    fontSize: 12,
    color: '#888',
    marginTop: 5,
    marginBottom: 15,
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    marginRight: 10,
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#1a73e8',
    marginLeft: 10,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
}); 