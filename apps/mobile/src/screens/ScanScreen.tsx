import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, FlatList, Image } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { mockVinyls, MockVinylData } from '@vinyla/shared-types';
import { DetailModal } from '../components/Modal/DetailModal';
import { detectVinylCover } from '../utils/visionAPI';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useNavigation } from '@react-navigation/native';
import { Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, shadows, shape } from '@vinyla/ui';
import { useAlert } from '../providers/AlertProvider';
import { getApiBaseUrl } from '../utils/apiConfig';
import { logEvent, supabase } from '@vinyla/core-api';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
// listContent has 10px horizontal padding and each card has 10px margin on
// all sides, so two columns must divide (screenWidth - 10*2 - 10*4) evenly —
// flex:1 would otherwise stretch a lone odd-count last card to full width.
const RESULT_CARD_WIDTH = (screenWidth - 60) / 2;
export const ScanScreen = () => {
  const { themeColors } = useTheme();
  const { showAlert } = useAlert();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);
  const [scannedAlbum, setScannedAlbum] = useState<MockVinylData | null>(null);
  const [imageSearchResults, setImageSearchResults] = useState<MockVinylData[] | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const [flash, setFlash] = useState<'on' | 'off'>('off');
  const styles = getStyles(themeColors, shadows, shape);

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>카메라 권한 안내</Text>
        <Text style={styles.permissionDesc}>
          LP 앨범 커버를 인식하여 프라이빗 컬렉션에 추가하기 위해 카메라 권한이 필요합니다.
        </Text>
        <TouchableOpacity style={styles.btnPrimary} onPress={requestPermission}>
          <Text style={styles.btnPrimaryText}>권한 허용하기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const toggleFlash = () => {
    setFlash((prev) => (prev === 'off' ? 'on' : 'off'));
  };

  const processImageBase64 = async (base64Str: string) => {
    try {
      setIsScanning(true);
      const visionResult = await detectVinylCover(base64Str);
      console.log('Vision API result extracted');
      let queries: string[] = [];

      // 1순위: "아티스트 - 앨범명" 전체 조합
      if (visionResult.artist && visionResult.album) {
        queries.push(`${visionResult.artist} - ${visionResult.album}`);
        queries.push(`${visionResult.artist} ${visionResult.album}`);
      }

      // 2순위: 앨범명 단독
      if (visionResult.album) {
        queries.push(visionResult.album);
      }

      // 3순위: 아티스트 단독
      if (visionResult.artist) {
        queries.push(visionResult.artist);
      }

      // 4순위: 앨범 커버에서 읽어낸 트랙 제목들
      if (visionResult.tracks && Array.isArray(visionResult.tracks)) {
        queries.push(...visionResult.tracks);
      }

      // 5순위: 시각적 분위기나 피사체 키워드
      if (visionResult.keywords && Array.isArray(visionResult.keywords)) {
        queries.push(...visionResult.keywords);
      }

      // 중복 제거 및 너무 짧은 텍스트 제외 (최대 8개로 넉넉하게 검색 시도)
      queries = [...new Set(queries)].filter(q => q && q.trim().length > 1).slice(0, 8);
      
      console.log('Final search queries (ordered by priority):', JSON.stringify(queries));

      if (queries.length === 0) {
         throw new Error("Could not visually identify the album from the image. Gemini returned no data.");
      }

      // 3. 서버(Next.js API route)로 이미지와 검색어 전달하여 VLM 매칭
      //    (비용이 드는 Gemini 호출이라 로그인 세션 토큰이 필수)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('로그인이 필요합니다.');
      }
      const apiBaseUrl = getApiBaseUrl();
      console.log(`Sending request to scan server (${apiBaseUrl}/api/scan)...`);
      const response = await fetch(`${apiBaseUrl}/api/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ base64Image: base64Str, queries })
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      console.log('Received response from Middle Server:', data.matchedIndex);

      if (data.candidates && data.candidates.length > 0) {
        // AI가 완벽하게 찾았든 못 찾았든, 무조건 후보군 리스트를 먼저 보여줍니다.
        // 사용자가 직접 리스트에서 클릭하여 상세 페이지로 진입하도록 유도합니다.
        setImageSearchResults(data.candidates);
        logEvent('SCAN', { result: 'success', candidates: data.candidates.length });
      } else {
        showAlert('검색 결과 없음', '해당 앨범과 일치하는 후보를 찾지 못했습니다.');
        setImageSearchResults(null);
        cameraRef.current?.resumePreview();
        logEvent('SCAN', { result: 'no_match' });
      }

    } catch (error: any) {
      console.error('Failed to process image:', error);
      const statusMatch = String(error?.message || '').match(/Server returned (\d+)/);
      logEvent('SCAN', {
        result: 'error',
        status: statusMatch ? Number(statusMatch[1]) : undefined,
        message: String(error?.message || '').slice(0, 120),
      });
      showAlert('인식 실패', '앨범 커버를 인식하지 못했습니다. 서버가 켜져 있는지 확인해 주세요.');
      cameraRef.current?.resumePreview();
    } finally {
      setIsScanning(false);
    }
  };

  const handleScan = async () => {
    if (!cameraRef.current) return;
    try {
      setIsScanning(true);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.3 });
      cameraRef.current.pausePreview();
      
      if (photo) {
        // 화면의 가이드 프레임(300x300) 영역만큼만 크롭
        const frameSize = 300;
        const scale = Math.min(photo.width / screenWidth, photo.height / screenHeight);
        const cropSize = frameSize * scale;
        
        const originX = (photo.width - cropSize) / 2;
        const originY = (photo.height - cropSize) / 2;
        
        // 크롭 후 800픽셀로 대폭 리사이즈하여 인코딩 속도 최적화
        const manipResult = await ImageManipulator.manipulateAsync(
          photo.uri,
          [
            { crop: { originX, originY, width: cropSize, height: cropSize } },
            { resize: { width: 800 } }
          ],
          { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        
        if (manipResult.base64) {
          await processImageBase64(manipResult.base64);
        } else {
          cameraRef.current.resumePreview();
          setIsScanning(false);
        }
      } else {
        cameraRef.current.resumePreview();
        setIsScanning(false);
      }
    } catch (error) {
      console.error('Failed to take picture:', error);
      showAlert('촬영 실패', '사진 촬영에 실패했습니다.');
      cameraRef.current?.resumePreview();
      setIsScanning(false);
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        base64: true,
        quality: 0.5,
      });

      if (!result.canceled && result.assets[0].base64) {
        await processImageBase64(result.assets[0].base64);
      }
    } catch (error) {
      console.error('Failed to pick image:', error);
      showAlert('오류', '이미지를 불러오는데 실패했습니다.');
    }
  };

  return (
    <View style={styles.container}>
      <CameraView 
        style={StyleSheet.absoluteFillObject} 
        facing="back" 
        ref={cameraRef}
        flash={flash}
      >
        {!imageSearchResults && (
          <View style={styles.overlay}>
            <View style={[styles.topDim, { justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 24 }]}>
              <Text style={styles.guideText}>사각형 안에 앨범을 맞춰주세요</Text>
            </View>
            <View style={styles.middleRow}>
              <View style={styles.sideDim} />
              <View style={styles.frame}>
                {isScanning && <ActivityIndicator size="large" color={themeColors.accent} style={styles.spinner} />}
              </View>
              <View style={styles.sideDim} />
            </View>
            <View style={styles.bottomDim}>
              <View style={styles.controls}>
                <TouchableOpacity style={[styles.controlBtn, flash === 'on' && styles.controlBtnActive]} onPress={toggleFlash}>
                  <Feather name={flash === 'on' ? 'zap' : 'zap-off'} size={24} color={flash === 'on' ? '#000' : '#fff'} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.shutterBtn} onPress={handleScan} disabled={isScanning}>
                  <View style={[styles.shutterInner, isScanning && { backgroundColor: themeColors.accent }]} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.controlBtn} onPress={handlePickImage}>
                  <Feather name="image" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </CameraView>
      
      {imageSearchResults && (
        <View style={[StyleSheet.absoluteFillObject, styles.resultsContainer, { paddingTop: insets.top + 12 }]}>
          <View style={styles.resultsHeader}>
             <Text style={styles.resultsTitle}>스캔 검색 결과 ({imageSearchResults.length})</Text>
             <TouchableOpacity onPress={() => {
               setImageSearchResults(null);
               cameraRef.current?.resumePreview();
             }}>
               <Feather name="x" size={28} color={themeColors.textPrimary} />
             </TouchableOpacity>
          </View>
          <FlatList 
            data={imageSearchResults}
            keyExtractor={(item, index) => item.ALBUM_ID.toString() + index}
            numColumns={2}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
               <TouchableOpacity style={styles.resultCard} onPress={() => setScannedAlbum(item)}>
                 <Image source={{ uri: item.IMAGE_URL }} style={styles.resultImage} />
                 <View style={styles.resultTextContainer}>
                   <Text style={styles.resultTitle} numberOfLines={1}>{item.TITLE}</Text>
                   <Text style={styles.resultArtist} numberOfLines={1}>{item.ARTIST}</Text>
                 </View>
               </TouchableOpacity>
            )}
          />
        </View>
      )}

      <DetailModal 
        album={scannedAlbum} 
        visible={!!scannedAlbum} 
        onClose={() => setScannedAlbum(null)} 
      />
    </View>
  );
};

const getStyles = (themeColors: any, shadows: any, shape: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeColors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: themeColors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  permissionTitle: {
    color: themeColors.accent,
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  permissionDesc: {
    color: themeColors.textPrimary,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  overlay: {
    flex: 1,
  },
  topDim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  middleRow: {
    flexDirection: 'row',
    height: 300,
  },
  sideDim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  frame: {
    width: 300,
    height: 300,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197, 160, 89, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  guideText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
    paddingBottom: 120,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  controlBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(197, 160, 89, 0.15)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: themeColors.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.soft,
  },
  controlBtnActive: {
    backgroundColor: themeColors.accent,
    borderColor: themeColors.accent,
  },
  shutterBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#C5A059',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.glow,
  },
  shutterInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#C5A059',
  },
  btnPrimary: {
    backgroundColor: themeColors.accent,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: shape.md,
    ...shadows.soft,
  },
  btnPrimaryText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: themeColors.background,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  resultsTitle: {
    color: themeColors.textPrimary,
    fontSize: 22,
    fontWeight: 'bold',
  },
  listContent: {
    paddingHorizontal: 10,
    paddingBottom: 100,
  },
  resultCard: {
    width: RESULT_CARD_WIDTH,
    margin: 10,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: shape.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: themeColors.border,
    ...shadows.soft,
  },
  resultImage: {
    width: '100%',
    aspectRatio: 1,
  },
  resultTextContainer: {
    padding: 12,
  },
  resultTitle: {
    color: themeColors.textPrimary,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  resultArtist: {
    color: themeColors.textSecondary,
    fontSize: 12,
  },
});
