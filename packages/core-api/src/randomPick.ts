// "오늘의 LP 추천" — 오래 안 들은(또는 한 번도 안 들은) 앨범일수록 뽑힐
// 확률이 높은 가중 랜덤. 스피닝 다이어리(listeningLog.ts)의 getLastPlayedMap
// 결과를 그대로 받는다 — 다이어리 기록이 하나도 없는 유저는 lastPlayedMap이
// 빈 객체이므로 모든 앨범이 동일 가중치를 받아 자연스럽게 균등 랜덤으로
// 폴백한다(기능2는 기능1 없이도 그 자체로 동작).

// 이 값 이상 지나면 가중치가 더는 커지지 않는다 — 60일 이상 방치된 앨범과
// 1년 방치된 앨범이 극단적으로 차이 나지 않도록 완만하게 상한을 둔다.
const MAX_WEIGHT_DAYS = 60;

export const pickWeightedRandomAlbum = <T extends { ALBUM_ID: number }>(
  albums: T[],
  lastPlayedMap: Record<number, string>,
  now: number = Date.now()
): T | null => {
  if (albums.length === 0) return null;
  if (albums.length === 1) return albums[0];

  const weights = albums.map((album) => {
    const lastPlayed = lastPlayedMap[album.ALBUM_ID];
    if (!lastPlayed) return MAX_WEIGHT_DAYS + 1; // 한 번도 기록 안 됨 — 가장 "먼지 쌓인" 취급
    const daysSince = (now - new Date(lastPlayed).getTime()) / (1000 * 60 * 60 * 24);
    return 1 + Math.min(MAX_WEIGHT_DAYS, Math.max(0, daysSince));
  });

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * totalWeight;
  for (let i = 0; i < albums.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return albums[i];
  }
  return albums[albums.length - 1]; // 부동소수점 오차 대비 폴백
};
