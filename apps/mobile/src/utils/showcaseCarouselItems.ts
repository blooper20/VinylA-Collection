import { CommunityMediaItem } from '@vinyla/shared-types';
import { CommunityPostAlbum } from '@vinyla/core-api';

// 웹의 showcaseCarouselItems.ts와 동일한 로직 — 자랑 글의 "사진/영상"과
// "첨부 앨범/노래"를 하나의 캐러셀로 합칠 때 쓰는 공통 아이템 모양. 앨범을
// 먼저, 그다음 사진/영상 순으로 둔다(앨범 자랑이 핵심인 글에서 임의로 찍은
// 사진보다 앨범 커버가 더 유의미한 첫 화면이라는 기존 결정을 그대로 따름).
// 순수 로직이라 웹/모바일 양쪽에 각자 파일로 둔다(패키지 경계를 새로
// 만들기보다 이 정도 중복이 더 간단하고 안전하다).
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
