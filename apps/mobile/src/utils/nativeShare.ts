import { captureRef } from 'react-native-view-shot';
import RNShare, { Social } from 'react-native-share';
import * as Sharing from 'expo-sharing';
import { Linking, Platform } from 'react-native';

// react-native-share의 JS 레이어가 INSTAGRAM_STORIES 소셜에는 appId를
// 요구한다(네이티브에서는 "back to app" 어트리뷰션 표시에만 쓰이고 실제
// 이미지 전달과는 무관 — Facebook 개발자 앱 등록 없이도 공유 자체는 된다).
const INSTAGRAM_ATTRIBUTION_APP_ID = 'com.vinyla.app';

// 인스타그램 스토리 공유는 URL scheme에 이미지 경로를 쿼리 파라미터로 붙이는
// 방식으로는 동작하지 않는다 — 인스타그램은 배경 이미지를 UIPasteboard의
// `com.instagram.sharedSticker.backgroundImage` 키로만 읽는다(iOS 공식 연동
// 방식). react-native-share가 이 pasteboard 계약(및 Android의 동등한 인텐트)을
// 대신 구현해준다.
export const shareToInstagramStory = async (viewRef: any) => {
  // captureRef의 기본(tmpfile) 결과는 file:// 접두사가 없는 순수 경로다
  // (react-native-view-shot README가 명시적으로 경고하는 부분) — 그대로
  // Sharing.shareAsync나 인스타그램 URL로 넘기면 안 되고 직접 붙여줘야 한다.
  const path = await captureRef(viewRef, { format: 'png', quality: 0.9 });
  const fileUri = path.startsWith('file://') ? path : `file://${path}`;

  if (Platform.OS === 'ios') {
    const canOpenInstagram = await Linking.canOpenURL('instagram-stories://share');
    if (canOpenInstagram) {
      // base64로 인코딩해 data: URL로 넘기면 큰 이미지(풀 컬렉션 그리드 등)에서
      // 조용히 실패할 수 있어(비공식 크기 한계), 대신 파일 URI를 그대로
      // 넘긴다 — 네이티브 쪽(NSData dataWithContentsOfURL:)이 file:// URL도
      // 동일하게 지원하고, 그냥 디스크 읽기라 크기 제약이 없다.
      await RNShare.shareSingle({
        social: Social.InstagramStories,
        appId: INSTAGRAM_ATTRIBUTION_APP_ID,
        backgroundImage: fileUri,
      });
      return;
    }
  }

  await Sharing.shareAsync(fileUri);
};
