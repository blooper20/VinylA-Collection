import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocale } from '@vinyla/i18n';
import { resolveEditionVisual, SPLATTER_MULTI_PALETTE, SplatterForm } from '@vinyla/core-api';

type EditionRow = {
  EDITION_LABEL?: string | null;
  EDITION_COLOR?: string | null;
  EDITION_COLOR_ALT?: string | null;
  EDITION_STYLE?: string | null;
  EDITION_SPLATTER_FORM?: string | null;
  EDITION_TAG?: string | null;
  EDITION_TAG_TEXT?: string | null;
  EDITION_STICKER_STYLE?: string | null;
  EDITION_ON_COVER?: boolean | null;
};

// 스플래터 물감 — 회전하는 판에 튀기므로 중심에서 바깥으로 늘어난다. 웹은 SVG로
// 그리지만 RN에는 SVG가 없어서, 얇은 View를 각도별로 회전시켜 같은 방사형을 만든다.
// 형태 3종(긴 줄기 / 꼬리 달린 물방울 / 짧은 꼬리의 작은 점)을 웹과 동일한 규칙으로.
const FORM_SPEC: Record<SplatterForm, { count: number; r0: [number, number]; len: [number, number]; w: [number, number]; head: number }> = {
  streak: { count: 30, r0: [0.25, 0.34], len: [0.08, 0.3], w: [0.9, 2], head: 0 },
  drip: { count: 16, r0: [0.24, 0.33], len: [0.12, 0.26], w: [1.8, 3.6], head: 1.5 },
  speck: { count: 28, r0: [0.26, 0.4], len: [0.03, 0.09], w: [1.8, 3.2], head: 1.4 },
};

// 시드 고정 — 어느 앨범에서든 같은 모양이 나온다.
const buildMarks = (form: SplatterForm) => {
  const spec = FORM_SPEC[form];
  let seed = 20260731;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const lerp = ([lo, hi]: [number, number]) => lo + rnd() * (hi - lo);
  return Array.from({ length: spec.count }, (_, i) => {
    const w = lerp(spec.w);
    return {
      a: (360 / spec.count) * i + rnd() * 6 - 3,
      r0: lerp(spec.r0),
      len: lerp(spec.len),
      w,
      head: spec.head * w,
      ci: Math.floor(rnd() * SPLATTER_MULTI_PALETTE.length),
      o: [1, 0.68, 0.86][i % 3],
    };
  });
};

const MARKS: Record<SplatterForm, ReturnType<typeof buildMarks>> = {
  streak: buildMarks('streak'),
  drip: buildMarks('drip'),
  speck: buildMarks('speck'),
};

/**
 * 스플래터 물감 오버레이 — 상세 화면의 큰 회전 디스크 위에 얹는다.
 * 웹은 SVG로 그리지만 RN에는 SVG가 없어서 얇은 View를 각도별로 회전시킨다.
 * altColor가 없으면 빨·주·노·초·파가 섞여 튄 기본 형태가 된다.
 */
export const EditionSplatterMarks: React.FC<{ album: EditionRow; size: number }> = ({
  album,
  size,
}) => {
  const visual = resolveEditionVisual(album);
  if (!visual || !visual.hasDisc || visual.style !== 'splatter') return null;
  return (
    <>
      {MARKS[visual.splatterForm].map((m, i) => {
        const fill = visual.altColor ?? SPLATTER_MULTI_PALETTE[m.ci];
        return (
          <View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: size,
              height: size,
              alignItems: 'center',
              opacity: m.o,
              transform: [{ rotate: `${m.a}deg` }],
            }}
          >
            {m.head > 0 ? (
              <View
                style={{
                  marginTop: size * (0.5 - m.r0 - m.len) - m.head / 2,
                  width: m.head,
                  height: m.head,
                  borderRadius: m.head / 2,
                  backgroundColor: fill,
                }}
              />
            ) : null}
            <View
              style={{
                marginTop: m.head > 0 ? 0 : size * (0.5 - m.r0 - m.len),
                width: m.w,
                height: size * m.len,
                borderRadius: m.w / 2,
                backgroundColor: fill,
              }}
            />
          </View>
        );
      })}
    </>
  );
};

// 앨범 커버 위에 얹는 에디션 표현 — 재킷에 붙은 하이프 스티커만(웹과 동일 규칙).
// LP 종류는 커버에 얹지 않는다. 상세 화면에서 실제 디스크가 그 색으로 보이므로
// 커버에 칩을 덧붙이면 같은 정보를 두 번 말하면서 아트워크만 가린다.
export const EditionCoverArt: React.FC<{ album: EditionRow }> = ({ album }) => {
  const { t } = useLocale();
  const visual = resolveEditionVisual(album);
  if (!visual || !visual.onCover || !visual.tag) return null;

  // 'custom'이면 프리셋 이름이 아니라 유저가 직접 적은 문구를 쓴다.
  const stickerText =
    visual.tag === 'custom' ? visual.tagText : t(`detail.editionPresets.${visual.tag}` as any);
  if (!stickerText) return null;

  // ② 도장 — 낙관처럼 찍은 느낌. 배경을 채우지 않고 테두리와 글자만 남긴다.
  if (visual.stickerStyle === 'stamp') {
    return (
      <View style={styles.stamp}>
        <View pointerEvents="none" style={styles.stampRule} />
        {/* numberOfLines를 두지 않는다 — 생략부호 없이 전부 보이고, 원은
            aspectRatio 덕분에 내용이 늘면 함께 커진다 */}
        <Text style={styles.stampText}>{stickerText}</Text>
      </View>
    );
  }

  // ① 금박 스티커 (기본)
  return (
    <LinearGradient
      // 강한 대비 대신 샴페인 골드의 좁은 색폭 — 은은하게 떠 있는 고급 포일
      colors={['#f8efd9', '#eadfbe', '#d9c493', '#e6d7ae', '#cdb583']}
      locations={[0, 0.28, 0.52, 0.74, 1]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.sticker}
    >
      {/* 포일 씰의 얇은 안쪽 괘선 */}
      <View pointerEvents="none" style={styles.stickerRule} />
      <Text style={styles.stickerText}>{stickerText}</Text>
    </LinearGradient>
  );
};

/**
 * 상세 화면의 큰 회전 디스크에 얹을 스타일. RN에는 CSS 그라디언트가 없어
 * 웹처럼 그루브까지 물들이진 못하고 판 색만 바꾸지만, 그 판이 실제로 이
 * 실물의 색을 갖는다는 핵심은 같다. 색이 지정되어 있으면 onCover 토글과
 * 무관하게 항상 적용한다(실물이 원래 그런 색이라는 표현이므로).
 */
export const editionDiscTint = (album: EditionRow): { backgroundColor: string } | undefined => {
  const visual = resolveEditionVisual(album);
  if (!visual || !visual.hasDisc || !visual.color) return undefined;
  return { backgroundColor: visual.color };
};

const styles = StyleSheet.create({
  // 금박 스티커 — 넓고 옅은 그림자로 재킷에서 살짝 떠 있는 느낌
  sticker: {
    position: 'absolute',
    top: '6.5%',
    left: '6.5%',
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 3,
    transform: [{ rotate: '-2deg' }],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(90,70,30,0.28)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.26,
    shadowRadius: 10,
    elevation: 6,
  },
  stickerRule: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: 3,
    bottom: 3,
    borderRadius: 1.5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(90,70,30,0.22)',
  },
  stickerText: {
    color: '#4a3a1c',
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  // 도장 — 어떤 아트워크 위에서도 읽히도록 종이 같은 밝은 바탕 + 붉은 인주 링
  stamp: {
    position: 'absolute',
    top: '6%',
    left: '6%',
    minWidth: 58,
    maxWidth: '62%',
    aspectRatio: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
    transform: [{ rotate: '-7deg' }],
    borderWidth: 3,
    borderColor: '#c62828',
    backgroundColor: '#fffdf7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 7,
  },
  // 인주 링의 얇은 내곽
  stampRule: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: 3,
    bottom: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#c62828',
  },
  stampText: {
    color: '#c62828',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
});
