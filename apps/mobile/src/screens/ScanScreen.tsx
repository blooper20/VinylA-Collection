import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, FlatList, Image } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { mockVinyls, MockVinylData } from '@vinyla/shared-types';
import { DetailModal } from '../components/Modal/DetailModal';
import { detectVinylCover } from '../utils/visionAPI';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
export const ScanScreen = () => {
  const navigation = useNavigation<any>();
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);
  const [scannedAlbum, setScannedAlbum] = useState<MockVinylData | null>(null);
  const [imageSearchResults, setImageSearchResults] = useState<MockVinylData[] | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const [flash, setFlash] = useState<'on' | 'off'>('off');

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

      // 유틸: 숫자/특수문자가 대부분인 쓰레기 문자열인지 판별
      const isGarbage = (s: string) => {
        const letters = s.replace(/[^a-zA-Z가-힣]/g, '');
        return letters.length < 2; // 알파벳/한글이 2자 미만이면 쓰레기
      };

      // ===== 1순위: Discogs URL 직접 추출 (역이미지 검색) =====
      // 구글이 이 사진을 Discogs에서 찾았다면, URL 자체에 정답이 있음! (가장 정확)
      if (visionResult.webDetection?.pagesWithMatchingImages?.length > 0) {
        for (const page of visionResult.webDetection.pagesWithMatchingImages) {
          if (page.url && page.url.includes('discogs.com/')) {
            const match = page.url.match(/(?:release|master)\/\d+-([^/?]+)/);
            if (match && match[1]) {
              const exactAlbumName = match[1].replace(/-/g, ' ').replace(/_/g, ' ');
              if (!isGarbage(exactAlbumName)) queries.push(exactAlbumName);
            }
          }
        }
      }

      // ===== 2순위: LLM 유추 결과 (VLM 성공 시) =====
      if (visionResult.textAnnotations?.[0]?.description?.includes(' - ')) {
        const llmGuess = visionResult.textAnnotations[0].description;
        if (!queries.includes(llmGuess)) queries.unshift(llmGuess);
      }

      // ===== 3순위: OCR Text (커버에 적힌 글씨) =====
      // 주의: 첫 N단어만 보지 않고, 모든 줄을 스캔하여 "의미 있는 텍스트"만 추출
      if (visionResult.textAnnotations?.length > 0) {
        const fullText = visionResult.textAnnotations[0].description || '';
        const lines = fullText.split('\n')
          .map((l: string) => l.replace(/[^a-zA-Z0-9가-힣\s.]/g, '').trim())
          .filter((l: string) => l.length > 2 && !isGarbage(l));
        
        // 의미 있는 줄들 중 앞에서부터 최대 3줄을 검색어 후보로 추가
        for (const line of lines.slice(0, 3)) {
          if (!queries.includes(line)) queries.push(line);
        }
      }

      // ===== 4순위: Web Entities (구글 비전이 인식한 키워드) =====
      // OCR이 숫자 쓰레기만 읽었을 때 "wave to earth" 같은 핵심 키워드를 구해줌!
      if (visionResult.webDetection?.webEntities?.length > 0) {
        const ignoreList = ['book cover', 'album cover', 'vinyl', 'record', 'album', 'music', 'lp', 'phonograph record', 'rectangle', 'font', 'poster', 'art', 'illustration', 'graphic design', 'book', 'text', 'paper', 'document', 'black', 'white', 'compact disc', 'top', 'important', 'vintage', 'retro', 'woman', 'face', 'photography', 'photo', 'youtube', 'video', 'cover', 'design', 'painting', 'modern art', 'picture'];
        const validEntities = visionResult.webDetection.webEntities
          .filter((e: any) => e.score > 0.5) // 신뢰도 50% 이상만
          .map((e: any) => e.description)
          .filter((desc: string) => desc && !ignoreList.includes(desc.toLowerCase()) && !isGarbage(desc));
          
        // 가장 신뢰도 높은 entity 2개를 합친 것과 개별 1개를 후보에 추가
        if (validEntities.length >= 2) {
          const combined = validEntities.slice(0, 2).join(' ');
          if (!queries.includes(combined)) queries.push(combined);
        }
        if (validEntities.length >= 1 && !queries.includes(validEntities[0])) {
          queries.push(validEntities[0]);
        }
      }

      // 중복 제거 + 쓰레기 필터링 + 최대 5개 (Rate Limit 방지하되 충분한 재시도 보장)
      queries = [...new Set(queries)].filter(q => q && q.length > 2 && !isGarbage(q)).slice(0, 5);
      
      console.log('Final search queries (ordered by priority):', JSON.stringify(queries));

      if (queries.length === 0) {
         throw new Error("Could not visually identify the album from the image.");
      }

      const { searchDiscogsLazy } = await import('@vinyla/core-api');
      
      const results: any[] = [];
      
      // 검색어가 여러 개일 경우, 메인 앨범을 찾을 때까지 순차적으로 시도 (Fallback 로직)
      for (let i = 0; i < queries.length; i++) {
        const q = queries[i];
        console.log(`Trying Discogs search for MAIN album with query: "${q}"`);
        let foundMain = false;
        await searchDiscogsLazy(q, (album: any) => {
            if (results.some((a) => a.ALBUM_ID === Number(album.id))) return;
            
            results.push({
              ALBUM_ID: Number(album.id) || Date.now() + Math.random(),
              TITLE: album.title || 'Unknown Title',
              ARTIST: album.artist || 'Unknown Artist',
              RELEASE_YEAR: parseInt(album.year) || 2024,
              IMAGE_URL: album.thumb || 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=400&q=80',
              VINYL_IMAGE_URL: '',
              CUSTOM_COLOR_HEX: '#111',
              CUSTOM_STYLE_TYPE: 'SOLID',
              GENRES: album.genre || ['Vinyl']
            });
            foundMain = true;
        });

        // 하나라도 결과가 나왔다면 성공! 메인 앨범 찾기 종료
        if (foundMain) {
          console.log(`Success! Found main album results using query: "${q}"`);
          break;
        }

        // 실패 후 다음 검색어로 넘어가기 전에 1.5초 대기 (Discogs 429 Rate Limit 방지)
        if (i < queries.length - 1) {
          console.log('Sleeping 1.5s to prevent Rate Limit...');
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
      
      // VLM이 추천해준 "시각적으로 유사한 앨범들"이 있다면 병렬로 검색하여 덧붙임
      if (visionResult.similarAlbums && visionResult.similarAlbums.length > 0) {
         console.log(`Found ${visionResult.similarAlbums.length} similar albums from VLM! Fetching...`);
         for (const simQuery of visionResult.similarAlbums) {
            await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit 방지용 딜레이
            console.log(`Trying Discogs search for SIMILAR album: "${simQuery}"`);
            let added = false;
            await searchDiscogsLazy(simQuery, (album: any) => {
               // 유사 앨범당 딱 1개(가장 정확한 것)만 결과에 추가합니다.
               if (added || results.some((a) => a.ALBUM_ID === Number(album.id))) return;
               
               results.push({
                 ALBUM_ID: Number(album.id) || Date.now() + Math.random(),
                 TITLE: album.title || 'Unknown Title',
                 ARTIST: album.artist || 'Unknown Artist',
                 RELEASE_YEAR: parseInt(album.year) || 2024,
                 IMAGE_URL: album.thumb || 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=400&q=80',
                 VINYL_IMAGE_URL: '',
                 CUSTOM_COLOR_HEX: '#111',
                 CUSTOM_STYLE_TYPE: 'SOLID',
                 GENRES: album.genre || ['Vinyl']
               });
               added = true;
            });
         }
      }
      
      if (results.length === 0) {
        Alert.alert('검색 결과 없음', '해당 앨범과 일치하는 후보를 찾지 못했습니다.');
        setImageSearchResults([]);
      } else {
        setImageSearchResults(results);
      }

    } catch (error) {
      console.error('Failed to process image:', error);
      Alert.alert('인식 실패', '앨범 커버를 인식하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleScan = async () => {
    if (!cameraRef.current) return;
    try {
      setIsScanning(true);
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });
      if (photo && photo.base64) {
        await processImageBase64(photo.base64);
      } else {
        setIsScanning(false);
      }
    } catch (error) {
      console.error('Failed to take picture:', error);
      Alert.alert('촬영 실패', '사진 촬영에 실패했습니다.');
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
      Alert.alert('오류', '이미지를 불러오는데 실패했습니다.');
    }
  };

  if (imageSearchResults) {
    return (
      <View style={styles.resultsContainer}>
        <View style={styles.resultsHeader}>
           <Text style={styles.resultsTitle}>스캔 검색 결과 ({imageSearchResults.length})</Text>
           <TouchableOpacity onPress={() => setImageSearchResults(null)}>
             <Feather name="x" size={28} color="#fff" />
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
        <DetailModal 
          album={scannedAlbum} 
          visible={!!scannedAlbum} 
          onClose={() => setScannedAlbum(null)} 
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView 
        style={StyleSheet.absoluteFillObject} 
        facing="back" 
        ref={cameraRef}
        flash={flash}
      >
        <View style={styles.overlay}>
          <View style={[styles.topDim, { justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 24 }]}>
            <Text style={styles.guideText}>사각형 안에 앨범을 맞춰주세요</Text>
          </View>
          <View style={styles.middleRow}>
            <View style={styles.sideDim} />
            <View style={styles.frame}>
              {isScanning && <ActivityIndicator size="large" color="#e9c349" style={styles.spinner} />}
            </View>
            <View style={styles.sideDim} />
          </View>
          <View style={styles.bottomDim}>
            <View style={styles.controls}>
              <TouchableOpacity style={[styles.controlBtn, flash === 'on' && styles.controlBtnActive]} onPress={toggleFlash}>
                <Feather name={flash === 'on' ? 'zap' : 'zap-off'} size={24} color={flash === 'on' ? '#000' : '#fff'} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.shutterBtn} onPress={handleScan} disabled={isScanning}>
                <View style={[styles.shutterInner, isScanning && { backgroundColor: '#ccc' }]} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.controlBtn} onPress={handlePickImage}>
                <Feather name="image" size={24} color="#fff" />
              </TouchableOpacity>
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
  permissionContainer: {
    flex: 1,
    backgroundColor: '#0e0e0e',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  permissionTitle: {
    color: '#e9c349',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  permissionDesc: {
    color: '#fff',
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
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlBtnActive: {
    backgroundColor: '#e9c349',
    borderColor: '#e9c349',
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
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  btnPrimaryText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: 60,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  resultsTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  listContent: {
    paddingHorizontal: 10,
    paddingBottom: 100,
  },
  resultCard: {
    flex: 1,
    margin: 10,
    backgroundColor: '#161616',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  resultImage: {
    width: '100%',
    aspectRatio: 1,
  },
  resultTextContainer: {
    padding: 12,
  },
  resultTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  resultArtist: {
    color: '#8e9192',
    fontSize: 12,
  },
});
