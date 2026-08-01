import React, { useEffect, useState } from 'react';
import { Image, ImageProps, ImageSourcePropType } from 'react-native';
import { getProxyBaseUrl } from '@vinyla/core-api';

interface CoverImageProps extends Omit<ImageProps, 'source' | 'onError'> {
  uri?: string | null;
  fallback: ImageSourcePropType;
}

// 외부 커버 소스(Discogs/애플뮤직/알라딘/Deezer)가 요청 시점에 가끔 실패해서
// 화면에 빈 이미지가 그대로 남는 문제 — 원본이 실패하면 서버 프록시
// (/api/proxy-image)로 한 번 더 시도하고, 그것도 실패하면 로컬 플레이스홀더로
// 대체한다. 웹의 useCoverImageUrl과 같은 목적, React Native용 구현.
export const CoverImage: React.FC<CoverImageProps> = ({ uri, fallback, ...rest }) => {
  const [stage, setStage] = useState<'original' | 'proxy' | 'fallback'>('original');

  useEffect(() => {
    setStage('original');
  }, [uri]);

  if (!uri || stage === 'fallback') {
    return <Image {...rest} source={fallback} />;
  }

  const currentUri = stage === 'proxy'
    ? `${getProxyBaseUrl()}/api/proxy-image?url=${encodeURIComponent(uri)}`
    : uri;

  return (
    <Image
      {...rest}
      source={{ uri: currentUri }}
      onError={() => setStage((prev) => (prev === 'original' ? 'proxy' : 'fallback'))}
    />
  );
};
