import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Linking, Platform } from 'react-native';

export const shareToInstagramStory = async (viewRef: any) => {
  try {
    const uri = await captureRef(viewRef, {
      format: 'png',
      quality: 0.9,
    });
    
    const instagramUrl = `instagram-stories://share?backgroundImage=${encodeURIComponent(uri)}`;
    
    if (Platform.OS === 'ios') {
      const canOpen = await Linking.canOpenURL('instagram-stories://share');
      if (canOpen) {
        await Linking.openURL(instagramUrl);
      } else {
        await Sharing.shareAsync(uri);
      }
    } else {
      await Sharing.shareAsync(uri);
    }
  } catch (error) {
    console.error('Error sharing to Instagram', error);
  }
};
