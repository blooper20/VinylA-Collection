'use client';

import React from 'react';
import { ShowcaseCarouselItem } from './showcaseCarouselItems';
import styles from './ShowcaseCarousel.module.css';

// 사진/영상 + 첨부 앨범(오노추의 노래 포함)을 하나의 스와이프형 캐러셀로
// 보여준다 — 가로 스크롤 + scroll-snap이라 별도 JS 없이도 터치 스와이프가
// 자연스럽다. 현재 위치는 scroll 이벤트에서 계산해 하단 점으로만 표시한다
// (좌우 화살표는 넣지 않음 — 모바일 스와이프가 주 사용 방식).
export const ShowcaseCarousel: React.FC<{
  items: ShowcaseCarouselItem[];
  onAlbumClick?: (albumId: number) => void;
}> = ({ items, onAlbumClick }) => {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [index, setIndex] = React.useState(0);

  const handleScroll = () => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    setIndex(Math.round(track.scrollLeft / track.clientWidth));
  };

  if (items.length === 0) return null;

  return (
    <div className={styles.wrap}>
      <div className={styles.track} ref={trackRef} onScroll={handleScroll}>
        {items.map((item, i) =>
          item.kind === 'video' ? (
            <div key={i} className={styles.slide}>
              <video className={styles.media} src={item.url} controls playsInline />
            </div>
          ) : item.kind === 'photo' ? (
            <div key={i} className={styles.slide}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.media} src={item.url} alt="" />
            </div>
          ) : (
            <div key={i} className={styles.slide}>
              <button type="button" className={styles.albumSlide} onClick={() => onAlbumClick?.(item.albumId)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.media} src={item.imageUrl || ''} alt="" />
                <div className={styles.albumCaption}>
                  <span className={styles.albumTitle}>{item.title}</span>
                  <span className={styles.albumArtist}>{item.artist}</span>
                </div>
              </button>
            </div>
          )
        )}
      </div>
      {items.length > 1 && (
        <div className={styles.dots}>
          {items.map((_, i) => (
            <span key={i} className={`${styles.dot} ${i === index ? styles.dotActive : ''}`} />
          ))}
        </div>
      )}
    </div>
  );
};
