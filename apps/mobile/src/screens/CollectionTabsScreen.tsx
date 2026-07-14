import React, { useState } from 'react';
import { HomeScreen } from './HomeScreen';
import { WishScreen } from './WishScreen';

// 하단 탭 통합: 보관함과 위시리스트를 한 탭으로 묶고 AppHeader의 모드
// 배지(MY COLLECTION / WISHLIST)를 눌러 전환한다 — 웹의 '컬렉션' 메뉴와 동일.
export const CollectionTabsScreen = () => {
  const [mode, setMode] = useState<'collection' | 'wishlist'>('collection');
  return mode === 'collection'
    ? <HomeScreen onModeChange={setMode} />
    : <WishScreen onModeChange={setMode} />;
};
