import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Base tab bar content height — TabNavigator adds the device's bottom
// safe-area inset (home indicator) on top of this at render time.
export const TAB_BAR_BASE_HEIGHT = 60;

// Static fallback matching the old fixed height, kept for any call site
// that can't use the hook. Prefer useTabBarHeight() wherever possible so
// content clears the tab bar correctly on devices with a home indicator.
export const TAB_BAR_HEIGHT = 80;

export const useTabBarHeight = () => {
  const insets = useSafeAreaInsets();
  return TAB_BAR_BASE_HEIGHT + insets.bottom;
};
