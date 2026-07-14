import { describe, it, expect } from 'vitest';
import { pickWeightedRandomAlbum } from '../randomPick';

const NOW = new Date('2026-07-14T00:00:00.000Z').getTime();
const daysAgo = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

describe('pickWeightedRandomAlbum', () => {
  it('returns null for an empty list', () => {
    expect(pickWeightedRandomAlbum([], {}, NOW)).toBeNull();
  });

  it('returns the only album when there is exactly one', () => {
    const albums = [{ ALBUM_ID: 1 }];
    expect(pickWeightedRandomAlbum(albums, {}, NOW)).toEqual({ ALBUM_ID: 1 });
  });

  it('falls back to uniform-ish behavior when lastPlayedMap is empty (no diary history)', () => {
    // 다이어리 기록이 없으면 전부 동일 가중치를 받는다 — 여러 번 뽑아 모든
    // 앨범이 최소 한 번은 나오는지로 "균등에 가까운" 분포를 간접 확인.
    const albums = [{ ALBUM_ID: 1 }, { ALBUM_ID: 2 }, { ALBUM_ID: 3 }];
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const picked = pickWeightedRandomAlbum(albums, {}, NOW);
      if (picked) seen.add(picked.ALBUM_ID);
    }
    expect(seen.size).toBe(3);
  });

  it('never picks an album whose weight rolled out to zero probability (single candidate vs. rest)', () => {
    // 앨범 1은 방금 들었고(가중치 최소), 앨범 2는 다이어리 기록이 전혀 없음
    // (가중치 최대) — 충분히 많이 뽑으면 앨범 2가 압도적으로 자주 나와야 한다.
    const albums = [{ ALBUM_ID: 1 }, { ALBUM_ID: 2 }];
    const lastPlayedMap = { 1: daysAgo(0) };
    let countAlbum2 = 0;
    const trials = 500;
    for (let i = 0; i < trials; i++) {
      const picked = pickWeightedRandomAlbum(albums, lastPlayedMap, NOW);
      if (picked?.ALBUM_ID === 2) countAlbum2++;
    }
    expect(countAlbum2).toBeGreaterThan(trials * 0.9);
  });

  it('weights older last-played dates higher than recently played ones', () => {
    const albums = [{ ALBUM_ID: 1 }, { ALBUM_ID: 2 }];
    const lastPlayedMap = { 1: daysAgo(1), 2: daysAgo(90) }; // 2는 90일 전(상한 60일 초과)
    let countAlbum2 = 0;
    const trials = 500;
    for (let i = 0; i < trials; i++) {
      const picked = pickWeightedRandomAlbum(albums, lastPlayedMap, NOW);
      if (picked?.ALBUM_ID === 2) countAlbum2++;
    }
    expect(countAlbum2).toBeGreaterThan(trials * 0.7);
  });
});
