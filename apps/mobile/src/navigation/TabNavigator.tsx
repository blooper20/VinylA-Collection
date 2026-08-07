import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FloatingScanButton } from '../components/TabBar/FloatingScanButton';
import { TAB_BAR_BASE_HEIGHT } from '../constants/layout';

import { CollectionTabsScreen } from '../screens/CollectionTabsScreen';
import { SocialScreen } from '../screens/SocialScreen';
import { ScanScreen } from '../screens/ScanScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { MyScreen } from '../screens/MyScreen';

const Tab = createBottomTabNavigator();

// avatar_url이 설정돼 있지만 실제로는 만료/삭제된 이미지면 onError 없이는
// 빈 금색 테두리 원만 남는다 — 로드 실패 시 기본 사람 아이콘으로 대체한다.
const MyTabIcon = ({ size, focused, avatarUrl, accent }: { size: number; focused: boolean; avatarUrl: string; accent: string }) => {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => { setFailed(false); }, [avatarUrl]);
  const borderColor = focused ? accent : `${accent}80`;
  if (failed) {
    return <Feather name="user" size={size} color={borderColor} />;
  }
  const iconSize = size - 4;
  return (
    <Image
      source={{ uri: avatarUrl }}
      onError={() => setFailed(true)}
      style={{ width: iconSize, height: iconSize, borderRadius: iconSize / 2, borderWidth: 2, borderColor }}
    />
  );
};

import { Feather } from '@expo/vector-icons';
import { useTheme } from '@vinyla/ui';
import { useLocale } from '@vinyla/i18n';
import { useAuthStore } from '@vinyla/core-api';

export const TabNavigator = () => {
  const { themeColors } = useTheme();
  const { t } = useLocale();
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const styles = getStyles(themeColors);
  // 마이 탭 아이콘은 고정 아이콘 대신 본인 프로필 사진을 보여준다 — 앱의
  // 골드 accent 테두리를 둘러 다른 탭 아이콘과 구분되는 "내 계정" 느낌을 준다.
  const myAvatarUrl = user?.user_metadata?.avatar_url || 'https://i.pravatar.cc/150?img=32';

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: [styles.tabBar, { height: TAB_BAR_BASE_HEIGHT + insets.bottom, paddingBottom: insets.bottom }],
        tabBarActiveTintColor: themeColors.accent,
        tabBarInactiveTintColor: themeColors.textSecondary,
        tabBarShowLabel: true,
      }}
    >
      <Tab.Screen
        name="Home"
        component={CollectionTabsScreen}
        options={{
          tabBarLabel: t('mobile.tab.home'),
          tabBarIcon: ({ color, size }) => <Feather name="home" color={color} size={size} />
        }}
      />
      <Tab.Screen
        name="Social"
        component={SocialScreen}
        options={{
          tabBarLabel: t('nav.social'),
          tabBarIcon: ({ color, size }) => <Feather name="rss" color={color} size={size} />
        }}
      />
      <Tab.Screen
        name="Scan"
        component={ScanScreen}
        options={{
          tabBarLabel: t('mobile.tab.scan'),
          tabBarButton: (props) => <FloatingScanButton onPress={props.onPress} />
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          tabBarLabel: t('mobile.tab.search'),
          tabBarIcon: ({ color, size }) => <Feather name="search" color={color} size={size} />
        }}
      />
      <Tab.Screen
        name="My"
        component={MyScreen}
        options={{
          tabBarLabel: t('mobile.tab.my'),
          tabBarIcon: ({ size, focused }) => (
            <MyTabIcon size={size} focused={focused} avatarUrl={myAvatarUrl} accent={themeColors.accent} />
          )
        }}
      />
    </Tab.Navigator>
  );
};

const getStyles = (themeColors: any) => StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: themeColors.background,
    borderTopWidth: 1,
    borderTopColor: themeColors.border,
    overflow: 'visible',
  },
  screen: {
    flex: 1,
    backgroundColor: themeColors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: themeColors.textPrimary,
    fontSize: 24,
  }
});
