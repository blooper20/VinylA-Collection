import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet } from 'react-native';
import { FloatingScanButton } from '../components/TabBar/FloatingScanButton';

import { HomeScreen } from '../screens/HomeScreen';
import { WishScreen } from '../screens/WishScreen';
import { ScanScreen } from '../screens/ScanScreen';
import { SearchScreen } from '../screens/SearchScreen';

const Tab = createBottomTabNavigator();

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
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Wish" component={WishScreen} />
      <Tab.Screen
        name="Scan"
        component={ScanScreen}
        options={{
          tabBarButton: (props) => <FloatingScanButton onPress={props.onPress} />
        }}
      />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="My" component={HomeScreen} />
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
