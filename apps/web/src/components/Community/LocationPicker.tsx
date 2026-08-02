'use client';

import React from 'react';
import { useLocale } from '@vinyla/i18n';
import styles from './LocationPicker.module.css';

export interface PickedLocation {
  placeName: string;
  placeAddress: string;
  latitude: number | null;
  longitude: number | null;
}

declare global {
  interface Window {
    google?: any;
    __vinylaGoogleMapsCallback?: () => void;
  }
}

let scriptLoadPromise: Promise<void> | null = null;

// 구글맵 Places JS SDK를 딱 한 번만 스크립트 태그로 로드한다 — 이 프로젝트에
// 지도 SDK 의존성이 전혀 없어(패키지 설치 없이) 가볍게 스크립트 태그로만
// 붙인다. 키가 없으면 아예 시도하지 않고 호출부가 폴백 UI(수동 텍스트 입력)로
// 넘어간다.
const loadGoogleMapsScript = (apiKey: string): Promise<void> => {
  if (window.google?.maps?.places) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;
  scriptLoadPromise = new Promise((resolve, reject) => {
    window.__vinylaGoogleMapsCallback = () => resolve();
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=__vinylaGoogleMapsCallback`;
    script.async = true;
    script.onerror = () => reject(new Error('google maps script failed to load'));
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
};

// 정보게시판 전용 위치 공유 피커. 구글맵 API 키(NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)가
// 설정돼 있으면 Places Autocomplete로 장소를 검색해 좌표까지 확보하고, 키가
// 없거나 스크립트 로드에 실패하면 장소명/주소를 직접 타이핑하는 폴백으로
// 조용히 전환한다(기능 자체가 막히지 않도록).
export const LocationPicker: React.FC<{
  value: PickedLocation | null;
  onChange: (next: PickedLocation | null) => void;
}> = ({ value, onChange }) => {
  const { t } = useLocale();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const autocompleteRef = React.useRef<any>(null);
  const [mode, setMode] = React.useState<'loading' | 'autocomplete' | 'manual'>('loading');

  React.useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setMode('manual');
      return;
    }
    let cancelled = false;
    loadGoogleMapsScript(apiKey)
      .then(() => { if (!cancelled) setMode('autocomplete'); })
      .catch(() => { if (!cancelled) setMode('manual'); });
    return () => { cancelled = true; };
  }, []);

  React.useEffect(() => {
    if (mode !== 'autocomplete' || !inputRef.current || autocompleteRef.current) return;
    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      fields: ['name', 'formatted_address', 'geometry'],
    });
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place?.geometry?.location) return;
      onChange({
        placeName: place.name || '',
        placeAddress: place.formatted_address || '',
        latitude: place.geometry.location.lat(),
        longitude: place.geometry.location.lng(),
      });
      if (inputRef.current) inputRef.current.value = place.name || '';
    });
    autocompleteRef.current = autocomplete;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  if (value) {
    return (
      <div className={styles.wrap}>
        <div className={styles.selected}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>location_on</span>
          <span className={styles.selectedText}>
            <strong>{value.placeName}</strong>
            {value.placeAddress && <span className={styles.selectedAddress}>{value.placeAddress}</span>}
          </span>
          <button type="button" className={styles.clearBtn} onClick={() => onChange(null)}>
            {t('communityBoard.locationClear')}
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'manual') {
    return (
      <div className={styles.wrap}>
        <input
          type="text"
          placeholder={t('communityBoard.locationSearchPlaceholder')}
          className={styles.input}
          onBlur={(e) => {
            const name = e.target.value.trim();
            if (!name) return;
            onChange({ placeName: name, placeAddress: '', latitude: null, longitude: null });
          }}
        />
        <p className={styles.hint}>{t('communityBoard.locationUnavailable')}</p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <input
        ref={inputRef}
        type="text"
        placeholder={t('communityBoard.locationSearchPlaceholder')}
        className={styles.input}
        disabled={mode === 'loading'}
      />
    </div>
  );
};
