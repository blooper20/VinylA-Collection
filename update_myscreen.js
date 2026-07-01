const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps/mobile/src/screens/MyScreen.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add Share and ActivityIndicator to imports
code = code.replace(/import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions, Animated, Easing, RefreshControl } from 'react-native';/, 
  "import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions, Animated, Easing, RefreshControl, Share, ActivityIndicator } from 'react-native';");

// 2. Add onPress to AnalyticsCard
code = code.replace(/const AnalyticsCard = \({ title, value, unit, sub, themeColors, isSpent, isSpentPublic, onToggleSpent, glassIntensity }: any\) => \(/,
  "const AnalyticsCard = ({ title, value, unit, sub, themeColors, isSpent, isSpentPublic, onToggleSpent, glassIntensity, onPress }: any) => {\n  const content = (");
code = code.replace(/<\/BlurView>\n\);/, "  </BlurView>\n  );\n  if (onPress) return <TouchableOpacity onPress={onPress} activeOpacity={0.8}>{content}</TouchableOpacity>;\n  return content;\n};");

// 3. Add isUploading state
code = code.replace(/const \[isSpentPublic, setIsSpentPublic\] = React.useState\(false\);/,
  "const [isSpentPublic, setIsSpentPublic] = React.useState(false);\n  const [isUploading, setIsUploading] = React.useState(false);");

// 4. Update image upload logic
const oldUpload = `                if (!result.canceled && result.assets && result.assets.length > 0) {
                  setToastMessage('프로필 이미지를 업로드하는 중입니다...');
                  setIsToastVisible(true);
                  
                  const uri = result.assets[0].uri;
                  const fileExt = uri.split('.').pop() || 'jpeg';
                  const filePath = \`\${user?.id}-\${Date.now()}.\${fileExt}\`;
                  
                  const formData = new FormData();
                  formData.append('file', {
                    uri: uri,
                    name: filePath,
                    type: \`image/\${fileExt}\`
                  } as any);
                  
                  const { error } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, formData);
                    
                  if (error) throw error;
                  
                  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
                  
                  const { updateProfile } = useAuthStore.getState();
                  await updateProfile(
                    user?.user_metadata?.displayName || '컬렉터', 
                    user?.user_metadata?.interests || [], 
                    data.publicUrl
                  );
                  
                  setToastMessage('프로필 사진이 변경되었습니다.');
                  setIsToastVisible(true);
                }`;

const newUpload = `                if (!result.canceled && result.assets && result.assets.length > 0) {
                  setIsUploading(true);
                  try {
                    const uri = result.assets[0].uri;
                    const fileExt = uri.split('.').pop() || 'jpeg';
                    const filePath = \`\${user?.id}-\${Date.now()}.\${fileExt}\`;
                    
                    const formData = new FormData();
                    formData.append('file', {
                      uri: uri,
                      name: filePath,
                      type: \`image/\${fileExt}\`
                    } as any);
                    
                    const { error } = await supabase.storage
                      .from('avatars')
                      .upload(filePath, formData);
                      
                    if (error) throw error;
                    
                    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
                    
                    const { updateProfile } = useAuthStore.getState();
                    await updateProfile(
                      user?.user_metadata?.displayName || '컬렉터', 
                      user?.user_metadata?.interests || [], 
                      data.publicUrl
                    );
                    
                    setToastMessage('프로필 사진이 변경되었습니다.');
                    setIsToastVisible(true);
                  } finally {
                    setIsUploading(false);
                  }
                }`;
code = code.replace(oldUpload, newUpload);

// 5. Add ActivityIndicator to Avatar
code = code.replace(/<Image \n              source={{ uri: user\?\.user_metadata\?\.avatar_url \|\| 'https:\/\/i.pravatar.cc\/150\?img=32' }} \n              style={styles.avatar} \n            \/>/,
  `<Image 
              source={{ uri: user?.user_metadata?.avatar_url || 'https://i.pravatar.cc/150?img=32' }} 
              style={styles.avatar} 
            />
            {isUploading && (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={themeColors.accent} />
              </View>
            )}`);

// 6. Update handleShare
const oldHandleShare = `  const handleShare = async () => {
    setFlashVisible(true);
    await shareToInstagramStory(viewRef);
  };`;
const newHandleShare = `  const handleShare = async () => {
    if (user?.id) {
      const name = encodeURIComponent(user.user_metadata?.displayName || 'Collector');
      const avatar = encodeURIComponent(user.user_metadata?.avatar_url || '/logo.png');
      const badge = encodeURIComponent(user.user_metadata?.selected_badge || '');
      const genre = encodeURIComponent(topGenre || '');
      const featured = encodeURIComponent(user.user_metadata?.featured_album_id || '');
      const sp = isSpentPublic ? '1' : '0';
      
      const link = \`https://vinyl-a.vercel.app/user/\${user.id}/dashboard?n=\${name}&a=\${avatar}&b=\${badge}&g=\${genre}&f=\${featured}&sp=\${sp}\`;
      
      try {
        await Share.share({
          message: \`🎧 \${user.user_metadata?.displayName || '컬렉터'}님의 레코드 컬렉션을 확인해보세요!\\n\\n\${link}\`,
        });
      } catch (error) {
        console.error(error);
      }
    }
  };`;
code = code.replace(oldHandleShare, newHandleShare);

// 7. Extract Share and Logout UI
const shareSectionMatch = code.match(/<View style={styles\.section}>\s*<Text style={\[styles\.sectionTitle, { color: themeColors\.textPrimary }\]}>공유하기<\/Text>[\s\S]*?<\/View>/);
let shareSection = shareSectionMatch ? shareSectionMatch[0] : '';
code = code.replace(shareSection, '');

const logoutSectionMatch = code.match(/<View style={styles\.section}>\s*<TouchableOpacity \s*style={\[styles\.logoutBtn, { borderColor: themeColors\.border }\]}[\s\S]*?<\/TouchableOpacity>\s*<\/View>/);
let logoutSection = logoutSectionMatch ? logoutSectionMatch[0] : '';
code = code.replace(logoutSection, '');

// Fix share button text
shareSection = shareSection.replace('인스타그램 스토리에 공유하기', '컬렉션 링크 공유하기');
shareSection = shareSection.replace(/backgroundColor: themeColors\.accent/, 'backgroundColor: "transparent"');
shareSection = shareSection.replace(/color: '#000'/, 'color: themeColors.textPrimary');

// Replace positions
// Share goes under Glass Intensity
code = code.replace(/<\/View>\n\n      {\/\* Analytics \*\/}/, `</View>\n\n      {/* Share Button */}\n      ${shareSection}\n\n      {/* Analytics */}`);

// Logout goes to the very bottom
code = code.replace(/<\/ScrollView>/, `  {/* Logout Button */}\n      ${logoutSection}\n      </ScrollView>`);

// Add onPress to 관심 장르
code = code.replace(/<AnalyticsCard title="관심 장르" value={topGenre} sub="프로필 설정 기준" themeColors={themeColors} glassIntensity={glassIntensity} \/>/,
  `<AnalyticsCard title="관심 장르" value={topGenre} sub="프로필 설정 기준" themeColors={themeColors} glassIntensity={glassIntensity} onPress={() => navigation.navigate('ProfileSetup')} />`);

fs.writeFileSync(filePath, code);
