import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet } from 'react-native';
import { FloatingScanButton } from '../components/TabBar/FloatingScanButton';

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

export const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#e9c349',
        tabBarInactiveTintColor: '#8e9192',
        tabBarShowLabel: true,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: '홈' }} />
      <Tab.Screen name="Wish" component={WishScreen} options={{ tabBarLabel: '위시' }} />
      <Tab.Screen
        name="Scan"
        component={ScanScreen}
        options={{
          tabBarLabel: '스캔',
          tabBarButton: (props) => <FloatingScanButton onPress={props.onPress} />
        }}
      />
      <Tab.Screen name="Search" component={SearchScreen} options={{ tabBarLabel: '검색' }} />
      <Tab.Screen name="My" component={MyScreen} options={{ tabBarLabel: '마이' }} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: '#000000', // Pure Deep Black
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  screen: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 24,
  }
});
