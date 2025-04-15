import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  Animated, 
  Vibration,
  Dimensions,
  StatusBar
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCAN_AREA_SIZE = Math.min(SCREEN_WIDTH * 0.75, 280);

const BarcodeScanner = ({ onScan, onClose, clockMode = 'in', isAdminScan = false }) => {
  const [facing, setFacing] = useState('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  
  // Animated values
  const scanLineAnimation = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  
  // Start animations on component mount
  useEffect(() => {
    startScanAnimation();
    startPulseAnimation();
    return () => {
      scanLineAnimation.stopAnimation();
      pulseAnimation.stopAnimation();
    };
  }, []);
  
  // Reset animations when scan state changes
  useEffect(() => {
    if (!scanned) {
      startScanAnimation();
      startPulseAnimation();
    }
  }, [scanned]);
  
  // Scan line moving animation
  const startScanAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnimation, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnimation, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };
  
  // Corner pulse animation
  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.3,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  if (!permission) {
    // Camera permissions are still loading.
    return (
      <View style={styles.loadingContainer}>
        <Animated.View 
          style={[
            styles.loadingIndicator,
            { transform: [{ scale: pulseAnimation }] }
          ]}
        />
        <Text style={styles.loadingText}>Loading camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet.
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.permissionContent}>
          <Ionicons name="camera-outline" size={60} color="#FFF" />
          <Text style={styles.message}>Camera permission is required to scan QR codes</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Camera Access</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleBarCodeScanned = ({ type, data }) => {
    if (scanned) return;
    setScanned(true);
    
    // Vibrate on successful scan
    Vibration.vibrate(200);
    
    // Update scan count for animation key
    setScanCount(prev => prev + 1);
    
    // Pass the scanned data to the parent component
    onScan({ type, data });
  };

  const isClockIn = clockMode === 'in';
  const primaryColor = isAdminScan ? '#4285F4' : (isClockIn ? '#4CAF50' : '#F44336');

  // Calculate the scan line position based on animation value
  const scanLineTranslateY = scanLineAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCAN_AREA_SIZE/2 + 15, SCAN_AREA_SIZE/2 - 15]
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <CameraView 
        style={styles.camera} 
        facing={facing}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'pdf417'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      >
        {/* Semi-transparent overlay with cutout */}
        <View style={styles.overlay}>
          <View style={styles.overlayTop} />
          <View style={styles.middleRow}>
            <View style={styles.overlaySide} />
            {/* This is the "cutout" where our scan area appears */}
            <View style={[styles.scanWindow, { width: SCAN_AREA_SIZE, height: SCAN_AREA_SIZE }]} />
            <View style={styles.overlaySide} />
          </View>
          <View style={styles.overlayBottom} />
        </View>
        
        {/* Header with title and close button */}
        <View style={styles.headerContainer}>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerText}>
              {isClockIn ? 'Record Attendance' : 'Check Out'}
            </Text>
            <Text style={styles.headerSubtitle}>
              Position QR code in the square
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        
        {/* Scan frame with corners */}
        <View style={[
          styles.scanFrame, 
          { width: SCAN_AREA_SIZE, height: SCAN_AREA_SIZE }
        ]}>
          <Animated.View 
            style={[
              styles.cornerTL, 
              { borderColor: primaryColor, 
                transform: [{ scale: pulseAnimation }],
                opacity: pulseAnimation.interpolate({
                  inputRange: [1, 1.3],
                  outputRange: [1, 0.7]
                })
              }
            ]} 
          />
          <Animated.View 
            style={[
              styles.cornerTR, 
              { borderColor: primaryColor, 
                transform: [{ scale: pulseAnimation }],
                opacity: pulseAnimation.interpolate({
                  inputRange: [1, 1.3],
                  outputRange: [1, 0.7]
                })
              }
            ]} 
          />
          <Animated.View 
            style={[
              styles.cornerBL, 
              { borderColor: primaryColor, 
                transform: [{ scale: pulseAnimation }],
                opacity: pulseAnimation.interpolate({
                  inputRange: [1, 1.3],
                  outputRange: [1, 0.7]
                })
              }
            ]} 
          />
          <Animated.View 
            style={[
              styles.cornerBR, 
              { borderColor: primaryColor, 
                transform: [{ scale: pulseAnimation }],
                opacity: pulseAnimation.interpolate({
                  inputRange: [1, 1.3],
                  outputRange: [1, 0.7]
                })
              }
            ]} 
          />
          
          {/* Animated scan line */}
          {!scanned && (
            <Animated.View 
              style={[
                styles.scanLine, 
                { 
                  backgroundColor: primaryColor,
                  transform: [{ translateY: scanLineTranslateY }]
                }
              ]}
            />
          )}
          
          {/* Success indicator when scanned */}
          {scanned && (
            <Animated.View 
              style={styles.successOverlay}
              key={`success-${scanCount}`}
            >
              <View style={styles.successIconContainer}>
                <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
                <Text style={styles.successText}>Scan Successful</Text>
              </View>
            </Animated.View>
          )}
        </View>
        
        {/* Bottom controls */}
        <View style={styles.controlsContainer}>
          {scanned ? (
            <TouchableOpacity 
              style={styles.scanAgainButton} 
              onPress={() => setScanned(false)}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-circle" size={28} color="#FFF" style={styles.scanAgainIcon} />
              <Text style={styles.scanAgainText}>Scan Another Code</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.flipCameraButton} 
              onPress={() => setFacing(current => (current === 'back' ? 'front' : 'back'))}
              activeOpacity={0.7}
            >
              <Ionicons name="camera-reverse" size={24} color="#FFF" />
              <Text style={styles.flipCameraText}>Flip Camera</Text>
            </TouchableOpacity>
          )}
        </View>
      </CameraView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingIndicator: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 20,
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
  },
  permissionContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  message: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    padding: 20,
    marginTop: 20,
  },
  permissionButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    alignSelf: 'center',
    marginTop: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  camera: {
    flex: 1,
  },
  headerContainer: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    marginBottom: 4,
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
  },
  closeButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
    borderRadius: 24,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  middleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  scanWindow: {
    backgroundColor: 'transparent',
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  scanFrame: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -SCAN_AREA_SIZE/2,
    marginLeft: -SCAN_AREA_SIZE/2,
    zIndex: 2,
  },
  scanLine: {
    position: 'absolute',
    height: 2,
    width: '85%',
    left: '7.5%',
    borderRadius: 1,
  },
  cornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 35,
    height: 35,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 10,
  },
  cornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 35,
    height: 35,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 10,
  },
  cornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 35,
    height: 35,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 10,
  },
  cornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 35,
    height: 35,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 10,
  },
  successOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  successIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  successText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
  },
  flipCameraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 30,
  },
  flipCameraText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  scanAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 30,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  scanAgainIcon: {
    marginRight: 8,
  },
  scanAgainText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  }
});

export default BarcodeScanner; 