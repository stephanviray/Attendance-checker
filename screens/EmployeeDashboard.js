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
  Platform
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

  useEffect(() => {
    fetchEmployeeData();
  }, []);

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

  return (
    <View style={styles.container}>
      {/*<View style={styles.header}>
        <Text style={styles.headerTitle}>Employee Dashboard</Text>
        <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
          <Ionicons name="log-out-outline" size={24} color="#666" />
        </TouchableOpacity>
      </View>*/}

      <ScrollView>
        <View style={styles.profileSection}>
          <View style={styles.profileTextContainer}>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.nameText}>{userProfile?.full_name || user?.email}</Text>
            <Text style={styles.emailText}>{user?.email}</Text>
          </View>

        <View style={styles.logoutButton}>
          <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
            <Ionicons name="log-out-outline" size={24} color="#666" />
          </TouchableOpacity>
        </View>
          
          {/* Sync status indicator */}
          {/*<View style={styles.syncStatus}>
            <Ionicons 
              name={syncStatus === 'synced' ? 'cloud-done' : 
                    syncStatus === 'syncing' ? 'cloud-upload' : 
                    syncStatus === 'error' ? 'cloud-offline' : 'cloud'} 
              size={20} 
              color={syncStatus === 'synced' ? '#4CAF50' : 
                     syncStatus === 'error' ? '#F44336' : '#2196F3'} 
            />
            <Text style={styles.syncStatusText}>
              {syncStatus === 'synced' ? 'Web Synced' : 
               syncStatus === 'syncing' ? 'Syncing...' : 
               syncStatus === 'error' ? 'Sync Error' : 'Not Synced'}
            </Text>
          </View>*/}
        </View>

        {/* QR Code Section */}
        <View style={styles.qrSection}>
          <Text style={styles.qrTitle}>Your ID QR Code</Text>
          <View style={styles.qrContainer}>
            {qrValue ? (
              <QRCode
                value={qrValue}
                size={QR_SIZE}
                color="#000"
                backgroundColor="#fff"
              />
            ) : (
              <View style={styles.qrPlaceholder}>
                <Ionicons name="qr-code-outline" size={60} color="#ccc" />
              </View>
            )}
          </View>
          <Text style={styles.qrInstructions}>
            Show this QR code to the company for attendance check-in and check-out
          </Text>
          
          {syncUrl && (
            <TouchableOpacity onPress={shareSyncLink} style={styles.syncButton}>
              <Ionicons name="share-outline" size={16} color="#fff" style={styles.syncIcon} />
              <Text style={styles.syncButtonText}>Share Web Sync Link</Text>
            </TouchableOpacity>
          )}

          <View style={styles.syncStatus}>
            <Ionicons 
              name={syncStatus === 'synced' ? 'cloud-done' : 
                    syncStatus === 'syncing' ? 'cloud-upload' : 
                    syncStatus === 'error' ? 'cloud-offline' : 'cloud'} 
              size={20} 
              color={syncStatus === 'synced' ? '#4CAF50' : 
                     syncStatus === 'error' ? '#F44336' : '#2196F3'} 
            />
            <Text style={styles.syncStatusText}>
              {syncStatus === 'synced' ? 'Web Synced' : 
               syncStatus === 'syncing' ? 'Syncing...' : 
               syncStatus === 'error' ? 'Sync Error' : 'Not Synced'}
            </Text>
          </View>
          
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{present}</Text>
            <Text style={styles.statLabel}>Present</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{late}</Text>
            <Text style={styles.statLabel}>Late</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{absent}</Text>
            <Text style={styles.statLabel}>Absent</Text>
          </View>
        </View>

        <View style={styles.historyContainer}>
          <Text style={styles.sectionTitle}>Recent Attendance</Text>
          
          <FlatList
            data={attendanceHistory}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <View style={styles.historyItem}>
                <View style={styles.historyDate}>
                  <Text style={styles.dateText}>{formatDate(item.check_in)}</Text>
                </View>
                <View style={[
                  styles.statusBadge, 
                  item.status === 'present' 
                    ? styles.presentBadge 
                    : item.status === 'late' 
                      ? styles.lateBadge 
                      : styles.absentBadge
                ]}>
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>
              </View>
            )}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#4285F4']}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyList}>
                <Text style={styles.emptyText}>
                  {loading ? 'Loading...' : 'No attendance records found'}
                </Text>
              </View>
            }
            nestedScrollEnabled={true}
            scrollEnabled={false}
            style={styles.flatList}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e1eae3',
    padding: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'white',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0b3a32',
  },
  signOutButton: {
    padding: 8,
  },
  profileSection: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
    marginTop: 50,
    borderRadius: 10,
  },
  profileTextContainer: {
    flex: 1,
    marginLeft: 15,
  },
  logoutButton: {
    marginTop: 15,
  },
  welcomeText: { 
    fontSize: 14,
    color: '#666',
  },
  nameText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 4,
  },
  emailText: {
    fontSize: 14,
    color: '#666',
  },
  // QR Code Styles
  qrSection: {
    padding: 20,
    backgroundColor: 'white',
    marginTop: 15,
    alignItems: 'center',
    borderRadius: 10,
  },
  qrTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  qrContainer: {
    padding: 15,
    backgroundColor: 'white',
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
  qrPlaceholder: {
    height: QR_SIZE,
    width: QR_SIZE,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrInstructions: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 15,
    paddingHorizontal: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    marginTop: 15,
    backgroundColor: 'white',
    borderRadius: 10,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 15,
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    marginHorizontal: 5,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  historyContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: 'white',
    marginTop: 15,
    marginBottom: 20,
    borderRadius: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
  },
  historyDate: {
    flex: 1,
  },
  dateText: {
    fontSize: 14,
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  presentBadge: {
    backgroundColor: '#e6f7ed',
  },
  lateBadge: {
    backgroundColor: '#fff3e0',
  },
  absentBadge: {
    backgroundColor: '#feeef0',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  emptyList: {
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
  },
  actionButtonContainer: {
    padding: 20,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4',
    paddingVertical: 15,
    borderRadius: 8,
    elevation: 2,
  },
  scanButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  flatList: {
    maxHeight: 300,
  },
  syncStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    marginTop: 8,
  },
  syncStatusText: {
    fontSize: 12,
    marginLeft: 4,
    color: '#555'
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0b3a32',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginTop: 16,
  },
  syncButtonText: {
    color: 'white',
    fontWeight: '500',
  },
  syncIcon: {
    marginRight: 8,
  },
}); 