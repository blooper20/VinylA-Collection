import React from 'react';
import styles from './DetailModal.module.css';
import { useLocale } from '@vinyla/i18n';

// 재킷 촬영본 크롭 편집기: 정사각 뷰포트 안에서 드래그(위치)·슬라이더(확대)로
// 크롭 영역을 다듬고, 적용 전 결과를 그대로 미리 보여준다. DetailModal(내 재킷
// 사진 등록)과 커뮤니티 앨범 등록 화면이 공유한다 — CSS는 여전히
// DetailModal.module.css에 있다(두 곳 다 같은 오버레이/모달 셸을 쓰므로 분리
// 이득이 없음).
export const CoverCropModal: React.FC<{
  file: File;
  onCancel: () => void;
  onConfirm: (square: Blob) => void;
  isBusy: boolean;
  t: ReturnType<typeof useLocale>['t'];
}> = ({ file, onCancel, onConfirm, isBusy, t }) => {
  const VIEW = 320; // 뷰포트 한 변(px) — CSS와 일치해야 크롭 좌표가 맞는다
  // objectUrl은 이펙트 "안에서" 새로 만들고 그 클로저가 캡처한 URL만 정리한다.
  // 개발 모드 Strict Mode는 마운트 시 이펙트를 정리→재실행으로 두 번 태우는데,
  // URL을 렌더 단계(useMemo/useState 초기화)에서 한 번만 만들고 별도 정리
  // 이펙트로 revoke하면, 그 첫 정리 실행이 아직 살아있어야 할 URL을 즉시
  // 폐기해버려 <video>가 "지원하지 않는 소스"로 실패한다(이미지는 로드가
  // 빨라 우연히 안 걸릴 뿐 같은 결함). 매 setup마다 새 URL을 만들면 두 번째
  // setup이 살아있는 새 URL로 교체하므로 이 경합을 피한다.
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null);
  const [natural, setNatural] = React.useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = React.useState(1);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const dragRef = React.useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  React.useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const baseScale = natural ? VIEW / Math.min(natural.w, natural.h) : 1;
  const scale = baseScale * zoom;
  const dispW = natural ? natural.w * scale : VIEW;
  const dispH = natural ? natural.h * scale : VIEW;

  const clamp = React.useCallback((x: number, y: number, dw: number, dh: number) => ({
    x: Math.min(0, Math.max(VIEW - dw, x)),
    y: Math.min(0, Math.max(VIEW - dh, y)),
  }), []);

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const nat = { w: img.naturalWidth, h: img.naturalHeight };
    setNatural(nat);
    const bs = VIEW / Math.min(nat.w, nat.h);
    setOffset({ x: (VIEW - nat.w * bs) / 2, y: (VIEW - nat.h * bs) / 2 });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: offset.x, baseY: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const { startX, startY, baseX, baseY } = dragRef.current;
    setOffset(clamp(baseX + (e.clientX - startX), baseY + (e.clientY - startY), dispW, dispH));
  };
  const onPointerUp = () => { dragRef.current = null; };

  const onZoom = (z: number) => {
    if (!natural) return;
    // 뷰포트 중앙 기준으로 확대/축소 (중앙이 튀지 않게 오프셋 보정)
    const prevScale = baseScale * zoom;
    const nextScale = baseScale * z;
    const cx = (VIEW / 2 - offset.x) / prevScale;
    const cy = (VIEW / 2 - offset.y) / prevScale;
    const nx = VIEW / 2 - cx * nextScale;
    const ny = VIEW / 2 - cy * nextScale;
    setZoom(z);
    setOffset(clamp(nx, ny, natural.w * nextScale, natural.h * nextScale));
  };

  const handleConfirm = () => {
    if (!natural || isBusy || !objectUrl) return;
    const img = new window.Image();
    img.onload = () => {
      const sx = -offset.x / scale;
      const sy = -offset.y / scale;
      const sSide = VIEW / scale;
      const out = Math.min(1200, Math.round(sSide));
      const canvas = document.createElement('canvas');
      canvas.width = out;
      canvas.height = out;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, sx, sy, sSide, sSide, 0, 0, out, out);
      canvas.toBlob((b) => { if (b) onConfirm(b); }, 'image/jpeg', 0.92);
    };
    img.src = objectUrl;
  };

  return (
    <div className={styles.cropOverlay} onClick={onCancel}>
      <div className={styles.cropModal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.cropTitle}>{t('detail.coverCropTitle')}</h3>
        <p className={styles.cropHint}>{t('detail.coverCropHint')}</p>
        <div
          className={styles.cropViewport}
          style={{ width: VIEW, height: VIEW }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {objectUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={objectUrl}
              alt=""
              draggable={false}
              onLoad={onImgLoad}
              style={{
                position: 'absolute',
                left: offset.x,
                top: offset.y,
                width: dispW,
                height: dispH,
                maxWidth: 'none',
                userSelect: 'none',
                touchAction: 'none',
              }}
            />
          )}
        </div>
        <input
          type="range"
          className={styles.cropZoom}
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => onZoom(Number(e.target.value))}
          aria-label={t('detail.coverCropZoom')}
        />
        <div className={styles.cropActions}>
          <button type="button" className={styles.cropCancelBtn} onClick={onCancel} disabled={isBusy}>
            {t('common.cancel')}
          </button>
          <button type="button" className={styles.cropConfirmBtn} onClick={handleConfirm} disabled={isBusy || !natural}>
            {isBusy ? t('detail.coverPhotoUploading') : t('detail.coverCropApply')}
          </button>
        </div>
      </div>
    </div>
  );
};
