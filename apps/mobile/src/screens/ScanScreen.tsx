import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { mockVinyls, MockVinylData } from '@vinyla/shared-types';
import { DetailModal } from '../components/Modal/DetailModal';

export const ScanScreen = () => {
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);
  const [scannedAlbum, setScannedAlbum] = useState<MockVinylData | null>(null);

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.guideText}>We need your permission to show the camera</Text>
        <TouchableOpacity style={styles.btnPrimary} onPress={requestPermission}>
          <Text style={styles.btnPrimaryText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      const randomAlbum = mockVinyls[Math.floor(Math.random() * mockVinyls.length)];
      setScannedAlbum(randomAlbum);
    }, 1000);
  };

  return (
    <View style={styles.container}>
      <CameraView style={StyleSheet.absoluteFillObject} facing="back">
        <View style={styles.overlay}>
          <View style={styles.topDim} />
          <View style={styles.middleRow}>
            <View style={styles.sideDim} />
            <View style={styles.frame}>
              <Text style={styles.guideText}>Point at a record</Text>
              {isScanning && <ActivityIndicator size="large" color="#e9c349" style={styles.spinner} />}
            </View>
            <View style={styles.sideDim} />
          </View>
          <View style={styles.bottomDim}>
            <View style={styles.controls}>
              <TouchableOpacity style={styles.controlBtn}><Text style={styles.controlText}>⚡</Text></TouchableOpacity>
              <TouchableOpacity style={styles.shutterBtn} onPress={handleScan}>
                <View style={styles.shutterInner} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.controlBtn}><Text style={styles.controlText}>🖼️</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </CameraView>
      
      <DetailModal 
        album={scannedAlbum} 
        visible={!!scannedAlbum} 
        onClose={() => setScannedAlbum(null)} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    flex: 1,
  },
  topDim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  middleRow: {
    flexDirection: 'row',
    height: 300,
  },
  sideDim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  frame: {
    width: 300,
    height: 300,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  guideText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    position: 'absolute',
    top: 20,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  spinner: {
    position: 'absolute',
  },
  bottomDim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    paddingBottom: 120,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  controlBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlText: {
    fontSize: 24,
  },
  shutterBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'transparent',
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
  },
  btnPrimary: {
    backgroundColor: '#e9c349',
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
  },
  btnPrimaryText: {
    color: '#000',
    fontWeight: 'bold',
  }
});
