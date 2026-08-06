import { CommunityMediaItem } from '@vinyla/shared-types';
import { CommunityPostAlbum } from '@vinyla/core-api';

// 자랑 글의 "사진/영상"과 "첨부 앨범/노래"를 하나의 캐러셀로 합칠 때 쓰는
// 공통 아이템 모양 — 앨범을 먼저, 그다음 사진/영상 순으로 둔다(앨범 자랑이
// 핵심인 글에서 임의로 찍은 사진보다 앨범 커버가 더 유의미한 첫 화면이라는
// 기존 ShowcasePostCard의 결정을 그대로 따름). 카드 썸네일은 이 배열의
// 첫 항목만 보여주면 된다.
export type ShowcaseCarouselItem =
  | { kind: 'photo'; url: string }
  | { kind: 'video'; url: string }
  | { kind: 'album'; albumId: number; title: string; artist: string; imageUrl: string | null };

export const buildShowcaseItems = (
  albums: CommunityPostAlbum[],
  media: CommunityMediaItem[]
): ShowcaseCarouselItem[] => [
  ...albums.map((a): ShowcaseCarouselItem => ({
    kind: 'album',
    albumId: a.ALBUM_ID,
    title: a.TITLE,
    artist: a.ARTIST,
    imageUrl: a.IMAGE_URL,
  })),
  ...media.map((m): ShowcaseCarouselItem => ({
    kind: m.type === 'video' ? 'video' : 'photo',
    url: m.url,
  })),
];
