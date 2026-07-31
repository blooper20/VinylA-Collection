import React from 'react';
import { useLocale } from '@vinyla/i18n';
import { resolveEditionVisual, findDiscKind, SPLATTER_MULTI_PALETTE, SplatterForm } from '@vinyla/core-api';
import styles from './EditionCoverArt.module.css';

type EditionRow = {
  EDITION_LABEL?: string | null;
  EDITION_COLOR?: string | null;
  EDITION_COLOR_ALT?: string | null;
  EDITION_STYLE?: string | null;
  EDITION_SPLATTER_FORM?: string | null;
  EDITION_TAG?: string | null;
  EDITION_ON_COVER?: boolean | null;
};

// 스플래터 물감 — 회전하는 판에 물감을 튀기므로 반점이 둥글게 남지 않고 중심에서
// 바깥으로 늘어난다. 실물은 형태가 확연히 갈려서(긴 줄기 / 꼬리 달린 물방울 /
// 짧은 꼬리의 작은 점) 유저가 고를 수 있게 세 종류를 각각 그린다.
//
// CSS conic 그라디언트로도 방사형은 되지만 주기가 완벽해서 톱니바퀴처럼 보인다.
// SVG로 직접 그리면 물감마다 시작 반지름·길이·굵기·색을 다르게 줄 수 있다.
// 형태별 파라미터: count(개수), r0(시작 반지름), len(길이), w(굵기), head(방울 머리 배율)
const FORM_SPEC: Record<SplatterForm, { count: number; r0: [number, number]; len: [number, number]; w: [number, number]; head: number }> = {
  // 촘촘하고 길게 뻗은 가는 줄기
  streak: { count: 56, r0: [25, 34], len: [6, 23], w: [0.7, 1.5], head: 0 },
  // 드문드문 떨어진 큰 물방울 — 바깥쪽에 둥근 머리, 안쪽으로 꼬리
  drip: { count: 22, r0: [24, 33], len: [9, 20], w: [1.4, 2.8], head: 1.5 },
  // 촘촘한 작은 점 + 짧은 꼬리
  speck: { count: 52, r0: [26, 40], len: [2.5, 7], w: [1.3, 2.4], head: 1.4 },
};

type SplatterMark = { a: number; r0: number; r1: number; w: number; head: number; ci: number; o: number };

// 시드 고정 — 어느 앨범에서든 같은 모양이 나오고, 형태를 바꿔도 배치가 튀지 않는다.
const buildMarks = (form: SplatterForm): SplatterMark[] => {
  const spec = FORM_SPEC[form];
  let seed = 20260731;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const lerp = ([lo, hi]: [number, number]) => lo + rnd() * (hi - lo);
  return Array.from({ length: spec.count }, (_, i) => {
    const r0 = lerp(spec.r0);
    const w = lerp(spec.w);
    return {
      // 균등 배치에 흔들기를 더해 규칙성을 깬다
      a: (360 / spec.count) * i + rnd() * 6 - 3,
      r0,
      r1: Math.min(r0 + lerp(spec.len), 49),
      w,
      head: spec.head * w,
      // 다색일 때 어느 색을 쓸지 — 색 개수와 무관하게 미리 뽑아둔다
      ci: Math.floor(rnd() * SPLATTER_MULTI_PALETTE.length),
      o: [1, 0.68, 0.86][i % 3],
    };
  });
};

const MARKS: Record<SplatterForm, SplatterMark[]> = {
  streak: buildMarks('streak'),
  drip: buildMarks('drip'),
  speck: buildMarks('speck'),
};

/**
 * 스플래터 물감 오버레이 — 미니 칩과 상세 화면의 큰 디스크가 함께 쓴다.
 * color가 null이면 기본값인 "여러 색"(빨·주·노·초·파)이 섞여 튄 형태가 된다.
 */
export const EditionSplatterMarks: React.FC<{
  color: string | null;
  form: SplatterForm;
}> = ({ color, form }) => (
  <svg className={styles.splatterSvg} viewBox="0 0 100 100" aria-hidden="true">
    {MARKS[form].map((m, i) => {
      const fill = color ?? SPLATTER_MULTI_PALETTE[m.ci];
      // 바깥쪽이 넓어지는 꼬리 — 물감이 원심력으로 늘어난 모양
      const wi = m.w * 0.16;
      const wo = m.w * 0.5;
      return (
        <g key={i} transform={`rotate(${m.a} 50 50)`} opacity={m.o}>
          <polygon
            points={`${50 - wi},${50 - m.r0} ${50 + wi},${50 - m.r0} ${50 + wo},${50 - m.r1} ${50 - wo},${50 - m.r1}`}
            fill={fill}
          />
          {m.head > 0 && <circle cx="50" cy={50 - m.r1} r={m.head * 0.5} fill={fill} />}
        </g>
      );
    })}
  </svg>
);

// 앨범 커버 위에 얹는 에디션 표현 — 재킷에 붙은 하이프 스티커만.
//
// LP 종류(컬러반/스플래터반 등)는 커버에 아무것도 얹지 않는다. 호버하면 커버 뒤에서
// 실제 디스크가 나오고 상세 화면에서도 그 판이 보이므로, 커버에 칩을 덧붙이면
// 같은 정보를 두 번 말하면서 아트워크만 가린다.
export const EditionCoverArt: React.FC<{
  album: EditionRow;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}> = ({ album, size = 'md' }) => {
  const { t } = useLocale();
  const visual = resolveEditionVisual(album);
  if (!visual || !visual.onCover || !visual.tag) return null;

  // 'custom'이면 프리셋 이름이 아니라 유저가 직접 적은 문구를 쓴다.
  const stickerText =
    visual.tag === 'custom' ? visual.tagText : t(`detail.editionPresets.${visual.tag}` as any);
  if (!stickerText) return null;

  return (
    <div
      className={`${styles.sticker} ${styles[visual.stickerStyle]} ${styles[size]}`}
      aria-label={stickerText}
    >
      {visual.stickerStyle === 'foil' ? (
        <>
          <span className={styles.foilRule} />
          <span className={styles.foilSheen} />
        </>
      ) : (
        <span className={styles.stampRule} />
      )}
      <span className={styles.stickerText}>{stickerText}</span>
    </div>
  );
};

// 테이블(목록) 뷰용 태그 — 썸네일이 60px밖에 안 돼서 디스크 칩을 얹으면
// 읽히지 않으므로, 여기서는 텍스트를 유지하고 앞의 아이콘 자리에 실물
// 디스크 색을 점으로 보여준다.
export const EditionTag: React.FC<{ album: EditionRow; className: string }> = ({
  album,
  className,
}) => {
  const { t } = useLocale();
  const visual = resolveEditionVisual(album);
  if (!visual) return null;
  // 목록에는 디스크가 보이지 않으니, 라벨이 없으면 LP 종류 이름으로라도 어떤
  // 실물인지 알려준다(같은 앨범 여러 장을 구분하는 게 이 태그의 목적).
  const text =
    visual.label ?? (findDiscKind(visual.style) ? t(`detail.editionPresets.${findDiscKind(visual.style)!.key}` as any) : null);
  if (!text) return null;
  return (
    <span className={className}>
      {visual.color ? (
        <span className={styles.tagDot} style={{ background: visual.color }} />
      ) : (
        <span className="material-symbols-outlined">auto_awesome</span>
      )}
      {text}
    </span>
  );
};

/**
 * 상세 화면의 큰 회전 디스크에 얹을 인라인 스타일. 커버 뒤에서 나오는 그
 * 디스크가 실제로 이 실물의 색을 갖게 한다 — 커버에 무언가를 덧붙이는 게
 * 아니라 "실물이 원래 그런 색"이라는 표현이므로 onCover 토글과 무관하게
 * 색이 지정되어 있으면 항상 적용한다.
 */
export const editionDiscStyle = (
  album: EditionRow,
  coverUrl?: string | null
): React.CSSProperties | undefined => {
  const visual = resolveEditionVisual(album);
  if (!visual || !visual.hasDisc) return undefined;
  if (visual.style === 'pictureDisc') {
    return coverUrl
      ? {
          backgroundImage: `radial-gradient(circle, rgba(0,0,0,0.35) 0 12%, transparent 12%), url(${coverUrl})`,
          backgroundSize: 'cover, cover',
          backgroundPosition: 'center, center',
        }
      : undefined;
  }
  const c = visual.color;
  if (!c) return undefined;
  const grooves = `repeating-radial-gradient(
      color-mix(in srgb, ${c} 78%, #000) 0px,
      color-mix(in srgb, ${c} 78%, #000) 2px,
      color-mix(in srgb, ${c} 92%, #fff) 3px,
      color-mix(in srgb, ${c} 78%, #000) 4px
    )`;
  if (visual.style === 'clear') {
    return {
      background: `${grooves}, radial-gradient(circle at 32% 28%, rgba(255,255,255,0.35), transparent 60%), ${c}`,
      opacity: 0.72,
    };
  }
  if (visual.style === 'marbled') {
    const sw = visual.altColor ?? `color-mix(in srgb, ${c} 55%, #fff)`;
    return {
      background: `
        conic-gradient(from 210deg at 42% 38%,
          ${sw} 0deg,
          ${c} 90deg,
          color-mix(in srgb, ${c} 60%, #000) 180deg,
          ${c} 270deg,
          ${sw} 360deg),
        ${grooves}, ${c}`,
    };
  }
  return { background: `${grooves}, ${c}` };
};
