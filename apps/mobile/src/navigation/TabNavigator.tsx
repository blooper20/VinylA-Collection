import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FloatingScanButton } from '../components/TabBar/FloatingScanButton';
import { TAB_BAR_BASE_HEIGHT } from '../constants/layout';

import { HomeScreen } from '../screens/HomeScreen';
import { WishScreen } from '../screens/WishScreen';
import { ScanScreen } from '../screens/ScanScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { MyScreen } from '../screens/MyScreen';

const Tab = createBottomTabNavigator();

export const tabLinkingConfig = {
  screens: {
    My: {
      path: ':username',
    },
  },
};

import { Feather } from '@expo/vector-icons';
import { useTheme } from '@vinyla/ui';
import { useLocale } from '@vinyla/i18n';

export const TabNavigator = () => {
  const { themeColors } = useTheme();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const styles = getStyles(themeColors);

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
        component={HomeScreen} 
        options={{
          tabBarLabel: t('mobile.tab.home'),
          tabBarIcon: ({ color, size }) => <Feather name="home" color={color} size={size} />
        }}
      />
      <Tab.Screen
        name="Wish"
        component={WishScreen}
        options={{
          tabBarLabel: t('mobile.tab.wish'),
          tabBarIcon: ({ color, size }) => <Feather name="heart" color={color} size={size} />
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
          tabBarIcon: ({ color, size }) => <Feather name="user" color={color} size={size} />
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
