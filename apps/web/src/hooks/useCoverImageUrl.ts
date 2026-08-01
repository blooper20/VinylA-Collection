'use client';

import { useEffect, useState } from 'react';

// 외부 커버 소스(Discogs/애플뮤직/알라딘/Deezer)가 요청 시점에 가끔 실패해서
// 브라우저 기본 "깨진 이미지" 아이콘이 그대로 노출되는 문제 — 원본 URL이
// 실패하면 서버 프록시(/api/proxy-image)로 한 번 더 시도하고, 그것도
// 실패하면 폴백 이미지로 조용히 대체한다. <img>/<Image>의 src와 CSS
// backgroundImage 양쪽에 그대로 꽂아 쓸 수 있도록 최종 URL 문자열만 반환한다.
export function useCoverImageUrl(rawUrl: string | null | undefined, fallback: string): string {
  const [resolved, setResolved] = useState(rawUrl || fallback);

  useEffect(() => {
    if (!rawUrl) {
      setResolved(fallback);
      return;
    }

    let cancelled = false;
    setResolved(rawUrl);

    const probe = (url: string, onFail: () => void) => {
      const img = new window.Image();
      img.onload = () => { if (!cancelled) setResolved(url); };
      img.onerror = onFail;
      img.src = url;
    };

    probe(rawUrl, () => {
      if (cancelled) return;
      const proxied = `/api/proxy-image?url=${encodeURIComponent(rawUrl)}`;
      probe(proxied, () => { if (!cancelled) setResolved(fallback); });
    });

    return () => { cancelled = true; };
  }, [rawUrl, fallback]);

  return resolved;
}
