import React from 'react';
import styles from './DetailModal.module.css';
import { MockVinylData, USER_VINYL } from '@vinyla/shared-types';
import { searchYouTube, getAlbumMaster, createAlbumMaster, upsertUserVinyl, useAuthStore, getAlbumExtraDetails, deleteUserVinylByAlbum, getErrorMessage, uploadUserCover, setUserVinylCover, updateAlbumMasterImage, revertAlbumMasterCover } from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';
import { StoryTemplate } from '../Share/StoryTemplate';
import { ShareBottomSheet } from '../Modal/ShareBottomSheet';
import { SharePreviewModal } from '../Modal/SharePreviewModal';
import { captureElementAsBlob, shareImageNative } from '../../utils/shareUtils';
import Image from 'next/image';

interface DetailModalProps {
  album: MockVinylData;
  onClose: () => void;
}

type CoverScope = 'mine' | 'everyone';

// 재킷 촬영본 크롭 편집기: 정사각 뷰포트 안에서 드래그(위치)·슬라이더(확대)로
// 크롭 영역을 다듬고, 적용 전 결과를 그대로 미리 보여준다. 공개 범위 설정은
// 커버 아래의 토글이 담당(적용 직후 기본값은 '나만 보기').
const CoverCropModal: React.FC<{
  file: File;
  onCancel: () => void;
  onConfirm: (square: Blob) => void;
  isBusy: boolean;
  t: ReturnType<typeof useLocale>['t'];
}> = ({ file, onCancel, onConfirm, isBusy, t }) => {
  const VIEW = 320; // 뷰포트 한 변(px) — CSS와 일치해야 크롭 좌표가 맞는다
  const [objectUrl] = React.useState(() => URL.createObjectURL(file));
  const [natural, setNatural] = React.useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = React.useState(1);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const dragRef = React.useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  React.useEffect(() => () => URL.revokeObjectURL(objectUrl), [objectUrl]);

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
    if (!natural || isBusy) return;
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
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

export const DetailModal: React.FC<DetailModalProps> = ({ album, onClose }) => {
  const { user } = useAuthStore();
  const { t } = useLocale();
  const [tracks, setTracks] = React.useState<string[]>(album.TRACKS || []);
  const [notes, setNotes] = React.useState<string>('');
  const [copyright, setCopyright] = React.useState<string>('');
  const [releaseDate, setReleaseDate] = React.useState<string>('');
  const [coverUrl, setCoverUrl] = React.useState<string>(album.IMAGE_URL || '');
  const [confirmTarget, setConfirmTarget] = React.useState<'OWNED' | 'WISH' | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [pricePromptOpen, setPricePromptOpen] = React.useState(false);
  const [purchasePriceInput, setPurchasePriceInput] = React.useState('');
  const [marketPrice, setMarketPrice] = React.useState<number | null>(album.MARKET_PRICE || null);
  
  const storyTemplateRef = React.useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = React.useState(false);
  const [isShareOpen, setIsShareOpen] = React.useState(false);
  const [shareTag, setShareTag] = React.useState<string>(album.STATUS || 'NONE');

  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
  const [previewBlob, setPreviewBlob] = React.useState<Blob | null>(null);
  const [previewMode, setPreviewMode] = React.useState<'save' | 'copy' | null>(null);

  const coverFileRef = React.useRef<HTMLInputElement>(null);
  const [isUploadingCover, setIsUploadingCover] = React.useState(false);
  const [cropFile, setCropFile] = React.useState<File | null>(null);
  // 내가 촬영해 올린 재킷 (null이면 기존 카탈로그 커버 사용 중)
  const [myPhoto, setMyPhoto] = React.useState<string | null>(album.CUSTOM_IMAGE_URL || null);
  // 공유 마스터의 현재 커버 (범위 토글의 현재값 판정 + 공유 이미지용)
  const [masterImage, setMasterImage] = React.useState<string | null>(null);

  React.useEffect(() => {
    // 내 사진을 쓰는 앨범만 마스터 커버를 조회
    if (!myPhoto || masterImage !== null) return;
    let alive = true;
    getAlbumMaster(Number(album.ALBUM_ID))
      .then((m) => { if (alive) setMasterImage(m?.IMAGE_URL || ''); })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myPhoto]);

  const coverScope: CoverScope = myPhoto && masterImage === myPhoto ? 'everyone' : 'mine';

  // 마스터를 '기존(카탈로그) 커버'로 되돌리고 그 URL을 반환한다.
  // 1차: 서버가 백업해둔 ORIGINAL_IMAGE_URL로 복원 (세션과 무관하게 동작)
  // 2차: 백업이 없는(과거에 망가진) 행이면 검색 파이프라인에서 카탈로그
  //      커버를 새로 받아와 치유. 둘 다 실패하면 '' — 호출부는 성공 토스트를
  //      띄우지 않는다.
  const restoreCatalogCover = async (numericAlbumId: number): Promise<string> => {
    const reverted = await revertAlbumMasterCover(numericAlbumId);
    if (reverted) return reverted;
    const details = await getAlbumExtraDetails(numericAlbumId, album.ARTIST, album.TITLE).catch(() => null);
    if (details?.highResCover) {
      await updateAlbumMasterImage(numericAlbumId, details.highResCover);
      return details.highResCover;
    }
    return '';
  };

  const handleCoverPhoto = (file: File | null) => {
    if (!file || !user?.id || isUploadingCover) return;
    if (!file.type.startsWith('image/')) {
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: { message: t('detail.coverPhotoInvalid') } }));
      return;
    }
    // 바로 업로드하지 않고 크롭 편집기를 먼저 띄운다.
    setCropFile(file);
    if (coverFileRef.current) coverFileRef.current.value = '';
  };

  const handleCropConfirm = async (square: Blob) => {
    if (!user?.id || isUploadingCover) return;
    setIsUploadingCover(true);
    try {
      const numericAlbumId = Number(album.ALBUM_ID);
      const url = await uploadUserCover(numericAlbumId, square);
      // 항상 '나만 보기'로 먼저 적용 — 전체 공개는 아래 토글에서 명시적으로.
      await setUserVinylCover(user.id, numericAlbumId, url);
      setMyPhoto(url);
      setCoverUrl(url);
      setCropFile(null);
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: { message: t('detail.coverPhotoSaved') } }));
      window.dispatchEvent(new CustomEvent('REFRESH_VINYLS'));
    } catch (e) {
      console.error('cover photo update failed', e);
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: { message: getErrorMessage(e, t) } }));
    } finally {
      setIsUploadingCover(false);
    }
  };

  // 기존(카탈로그) 커버로 복귀: 마스터가 내 사진으로 덮여 있으면 복원(또는
  // 치유)하고, 내 개인 커버를 지운다. 실제로 복원된 경우에만 성공 토스트.
  const handleUseOriginalCover = async () => {
    if (!user?.id || !myPhoto || isUploadingCover) return;
    setIsUploadingCover(true);
    try {
      const numericAlbumId = Number(album.ALBUM_ID);
      const restored = await restoreCatalogCover(numericAlbumId);
      await setUserVinylCover(user.id, numericAlbumId, null);
      setMyPhoto(null);
      if (restored) {
        setMasterImage(restored);
        setCoverUrl(restored);
        window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: { message: t('detail.coverUseOriginalDone') } }));
      } else {
        window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: { message: t('detail.coverRestoreFailed') } }));
      }
      window.dispatchEvent(new CustomEvent('REFRESH_VINYLS'));
    } catch (e) {
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: { message: getErrorMessage(e, t) } }));
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleScopeChange = async (next: CoverScope) => {
    if (!user?.id || !myPhoto || isUploadingCover || next === coverScope) return;
    setIsUploadingCover(true);
    try {
      const numericAlbumId = Number(album.ALBUM_ID);
      if (next === 'everyone') {
        // 서버가 직전 카탈로그 커버를 ORIGINAL_IMAGE_URL로 자동 백업한다
        await updateAlbumMasterImage(numericAlbumId, myPhoto);
        setMasterImage(myPhoto);
        window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: { message: t('detail.coverScopeAppliedEveryone') } }));
      } else {
        const restored = await restoreCatalogCover(numericAlbumId);
        if (restored) {
          setMasterImage(restored);
          setCoverUrl(myPhoto); // 내 화면은 계속 내 사진 (나만 보기)
          window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: { message: t('detail.coverScopeRevertedMine') } }));
        } else {
          window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: { message: t('detail.coverRestoreFailed') } }));
        }
      }
      window.dispatchEvent(new CustomEvent('REFRESH_VINYLS'));
    } catch (e) {
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: { message: getErrorMessage(e, t) } }));
    } finally {
      setIsUploadingCover(false);
    }
  };

  const captureStoryImage = async (format: 'jpeg' | 'png' = 'jpeg') => {
    if (!storyTemplateRef.current || isCapturing) return null;
    setIsCapturing(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    const blob = await captureElementAsBlob(storyTemplateRef.current, format);
    setIsCapturing(false);
    return blob;
  };

  const handleShareOptions = {
    copyUrl: async () => {
      setIsShareOpen(false);
      const link = `${window.location.origin}/collection?album=${album.ALBUM_ID}`;
      await import('../../utils/shareUtils').then(m => m.copyToClipboard(link));
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: { message: t('detail.linkCopied') } }));
    },
    saveImage: async () => {
      setIsShareOpen(false);
      const blob = await captureStoryImage('jpeg');
      if (blob) {
        setPreviewBlob(blob);
        setPreviewMode('save');
        setIsPreviewOpen(true);
      }
    },
    copyImage: async () => {
      setIsShareOpen(false);
      const blob = await captureStoryImage('png');
      if (blob) {
        setPreviewBlob(blob);
        setPreviewMode('copy');
        setIsPreviewOpen(true);
      }
    },
    shareNative: async () => {
      const blob = await captureStoryImage('jpeg');
      if (blob) {
        await shareImageNative(blob, 'vinyla-story.jpg', t('previewModal.imageCopied'));
      }
    }
  };

  React.useEffect(() => {
    // Prevent body and html scrolling while modal is open
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
      document.documentElement.style.overflow = 'unset';
    };
  }, []);

  React.useEffect(() => {
    getAlbumExtraDetails(album.ALBUM_ID, album.ARTIST, album.TITLE).then(details => {
      if (details.tracks.length > 0 && (!album.TRACKS || album.TRACKS.length === 0)) {
        setTracks(details.tracks);
      }
      if (details.notes) setNotes(details.notes);
      if (details.copyright) setCopyright(details.copyright);
      if (details.releaseDate) setReleaseDate(details.releaseDate);
      // 실물 LP 재킷(검색 소스가 준 커버)이 항상 우선 — 디지털 스토어 아트로
      // 갈아끼우면 다른 에디션의 재킷이 표시될 수 있다. 커버가 아예 없을 때만 보강.
      if (details.highResCover && (!album.IMAGE_URL || album.IMAGE_URL.includes('spacer.gif'))) {
        setCoverUrl(details.highResCover);
      }
      if (details.marketPrice) {
        setMarketPrice(details.marketPrice);
      } else if (!marketPrice) {
        setMarketPrice(-1);
      }
    });
    // marketPrice를 deps에 넣으면 setMarketPrice로 인해 상세정보 재조회 루프가 발생하므로 제외
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [album.ALBUM_ID, album.ARTIST, album.TITLE, album.TRACKS, album.IMAGE_URL]);

  const handleYoutubeListen = async () => {
    const query = `${album.ARTIST} ${album.TITLE} full album`;
    const results = await searchYouTube(query);
    if (results && results.length > 0) {
      const videoId = results[0];
      if (videoId) {
        window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank', 'noopener,noreferrer');
        return;
      }
    }
    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer');
  };

  const handleDiscogsSearch = async () => {
    const query = `${album.ARTIST} ${album.TITLE}`;
    window.open(`https://www.discogs.com/search/?q=${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer');
  };

  const [isSaving, setIsSaving] = React.useState(false);

  const handleSave = async (status: 'OWNED' | 'WISH', price: number = 0) => {
    try {
      const finalGenres = (album.GENRES || []).filter(g => {
        // Strip any leftover country tags from old saves
        const EXCLUDED_TAGS = [
          'South Korea', 'Japan', 'US', 'UK', 'Europe', 'Germany',
          'France', 'Netherlands', 'Canada', 'Australia', 'Italy',
          'Sweden', 'Taiwan', 'Brazil', 'Russia', 'Vinyl', 'LP', 'Album'
        ];
        return !EXCLUDED_TAGS.includes(g);
      });

      if (!user?.id) {
        window.dispatchEvent(new CustomEvent('SHOW_TOAST', {
          detail: { message: t('detail.loginRequired') }
        }));
        return;
      }

      const numericAlbumId = Number(album.ALBUM_ID);
      const master = await getAlbumMaster(numericAlbumId);

      // 검색 파이프라인이 실물 LP 커버를 주도록 개선되기 전에 저장된 마스터에는
      // 옛(디지털 스토어) 커버가 남아 있다 — 검색에서 새로 열어 저장하는 경우,
      // 지금 카드에 보이는 커버(=검색 소스가 준 실물 재킷)로 마스터를 갱신한다.
      // 개인 촬영 커버(CUSTOM_IMAGE_URL)나 플레이스홀더는 마스터에 쓰지 않는다.
      const isCatalogCover = !!album.IMAGE_URL &&
        !album.CUSTOM_IMAGE_URL &&
        !album.IMAGE_URL.includes('supabase.co') &&
        !album.IMAGE_URL.includes('unsplash.com');
      if (master?.IMAGE_URL && isCatalogCover && album.IMAGE_URL !== master.IMAGE_URL) {
        // 갱신 실패해도 저장 흐름은 계속 (커버는 부가 정보)
        await updateAlbumMasterImage(numericAlbumId, album.IMAGE_URL).catch(() => {});
      }

      // LP 재킷 고정 원칙: 마스터에 커버가 없을 때만 채워넣고,
      // 이미 있는 커버를 디지털 스토어 아트로 덮어쓰지 않는다.
      const isNewImageBetter = !!album.IMAGE_URL && !master?.IMAGE_URL;
      
      if (!master || !master.GENRES || master.GENRES.length === 0 || (master.GENRES.length === 1 && master.GENRES[0] === 'Vinyl') || (marketPrice && !master.MARKET_PRICE) || isNewImageBetter) {
        await createAlbumMaster({
          ALBUM_ID: numericAlbumId,
          TITLE: album.TITLE,
          ARTIST: album.ARTIST,
          RELEASE_YEAR: album.RELEASE_YEAR,
          IMAGE_URL: album.IMAGE_URL,
          VINYL_IMAGE_URL: album.VINYL_IMAGE_URL || master?.VINYL_IMAGE_URL || '',
          CUSTOM_COLOR_HEX: album.CUSTOM_COLOR_HEX || master?.CUSTOM_COLOR_HEX || '#000',
          CUSTOM_STYLE_TYPE: master?.CUSTOM_STYLE_TYPE || 'SOLID',
          TRACKS: tracks.length > 0 ? tracks : (master?.TRACKS || []),
          GENRES: finalGenres,
          MARKET_PRICE: marketPrice || master?.MARKET_PRICE || 0
        });
      }

      const payloadData: Partial<USER_VINYL> = {
        USER_ID: user.id,
        ALBUM_ID: numericAlbumId,
        STATUS: status,
        PURCHASE_PRICE: price
      };

      if (status === 'OWNED' && album.STATUS !== 'OWNED') {
        payloadData.PURCHASE_DATE = new Date().toISOString();
      }

      const result = await upsertUserVinyl(payloadData);

      setIsSaving(true);
      setTimeout(() => {
        onClose();

        let message = t('detail.savedToTarget', { target: status === 'OWNED' ? t('nav.collection') : t('nav.wishlist') });
        if (status === 'OWNED' && album.STATUS === 'OWNED') {
          message = t('detail.priceSaved');
        } else if (result?.isFirstEverSave) {
          message = t('detail.firstSaveCelebration');
        }

        // Dispatch custom event for Toast
        window.dispatchEvent(new CustomEvent('SHOW_TOAST', {
          detail: { message }
        }));
        window.dispatchEvent(new CustomEvent('REFRESH_VINYLS'));
      }, 600);
    } catch (error) {
      console.error('Failed to save album:', error);
      const msg = getErrorMessage(error, t);
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', {
        detail: { message: msg }
      }));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (target: 'OWNED' | 'WISH') => {
    try {
      setIsDeleting(true);
      if (!user?.id) return;
      await deleteUserVinylByAlbum(user.id, Number(album.ALBUM_ID));
      onClose();
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', {
        detail: { message: t('detail.removedFromTarget', { target: target === 'OWNED' ? t('nav.collection') : t('nav.wishlist') }) }
      }));
      window.dispatchEvent(new CustomEvent('REFRESH_VINYLS'));
    } catch (e) {
      console.error(e);
      setConfirmTarget(null);
      const msg = getErrorMessage(e, t);
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: { message: msg }}));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={`${styles.overlay} ${isSaving ? styles.overlaySavedAnim : ''}`} onClick={onClose}>
      <div className={`${styles.modal} ${isSaving ? styles.modalSavedAnim : ''}`} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose}>
          <span className="material-symbols-outlined">close</span>
        </button>

        <div className={styles.leftPanel}>
          <div className={styles.coverStack}>
            <div className={styles.coverContainer}>
              <div className={styles.vinyl}>
                <div
                  className={styles.vinylLabel}
                  style={{ backgroundImage: `url(${coverUrl})` }}
                />
              </div>
              <div className={styles.cover}>
                <Image src={coverUrl} alt={album.TITLE} className={styles.coverImage} width={800} height={800} style={{ objectFit: 'cover' }} />
              </div>
            </div>

            {album.STATUS === 'OWNED' && (
              <div className={styles.coverControls}>
                <input
                  ref={coverFileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={(e) => handleCoverPhoto(e.target.files?.[0] || null)}
                />
                <div className={styles.coverBtnRow}>
                  {myPhoto && (
                    <button
                      type="button"
                      className={styles.coverActionBtn}
                      onClick={handleUseOriginalCover}
                      disabled={isUploadingCover}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>undo</span>
                      {t('detail.coverUseOriginal')}
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.coverActionBtn}
                    onClick={() => coverFileRef.current?.click()}
                    disabled={isUploadingCover}
                    title={t('detail.coverPhotoTitle')}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                      {isUploadingCover ? 'hourglass_top' : 'photo_camera'}
                    </span>
                    {isUploadingCover ? t('detail.coverPhotoUploading') : t('detail.coverPhotoButton')}
                  </button>
                </div>
                {myPhoto && (
                  <div className={styles.coverScopeToggle} role="radiogroup" aria-label={t('detail.coverScopeLabel')}>
                    <button
                      type="button"
                      className={`${styles.coverScopeBtn} ${coverScope === 'mine' ? styles.coverScopeActive : ''}`}
                      onClick={() => handleScopeChange('mine')}
                      disabled={isUploadingCover}
                    >
                      {t('detail.coverScopeMineShort')}
                    </button>
                    <button
                      type="button"
                      className={`${styles.coverScopeBtn} ${coverScope === 'everyone' ? styles.coverScopeActive : ''}`}
                      onClick={() => handleScopeChange('everyone')}
                      disabled={isUploadingCover}
                    >
                      {t('detail.coverScopeEveryoneShort')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className={styles.rightPanel}>
          <div className={styles.headerInfo}>
            <div className={styles.eyebrow}>{album.RELEASE_YEAR || 'Unknown Year'} • LP</div>
            <h2 className={styles.title}>{album.TITLE}</h2>
            <h3 className={styles.artist}>{album.ARTIST}</h3>
            
            <div style={{ marginBottom: 24 }}>
              <div className={styles.estimatedValue} style={{ marginBottom: 4 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, marginRight: 4 }}>monetization_on</span>
                {t('detail.marketPrice')} {marketPrice === -1 ? t('detail.marketPriceUnknown') : marketPrice ? `₩${marketPrice.toLocaleString()}` : t('common.loading')}
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginLeft: '22px', marginTop: '-2px' }}>
                {t('detail.discogsLowestNote')}
              </div>
            </div>
            {album.STATUS === 'OWNED' ? (
              <div className={styles.actualValue}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, marginRight: 4 }}>receipt_long</span>
                {t('detail.actualPrice')} {album.PURCHASE_PRICE ? `₩${(album.PURCHASE_PRICE).toLocaleString()}` : t('detail.notEntered')}
                <button
                  className={styles.editPriceBtn}
                  onClick={() => {
                    setPurchasePriceInput(album.PURCHASE_PRICE ? String(album.PURCHASE_PRICE) : '');
                    setPricePromptOpen(true);
                  }}
                  title={t('detail.editPriceTitle')}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                </button>
              </div>
            ) : null}

            {(() => {
              const EXCLUDED_TAGS = [
                'South Korea', 'Japan', 'US', 'UK', 'Europe', 'Germany', 
                'France', 'Netherlands', 'Canada', 'Australia', 'Italy', 
                'Sweden', 'Taiwan', 'Brazil', 'Russia', 'Vinyl', 'LP', 'Album'
              ];
              const genres = album.GENRES || [];
              const genreTags = genres.filter(tag => !EXCLUDED_TAGS.includes(tag)).slice(0, 4); // Only display top 4 genres

              return (
                <>
                  {/* Tags Section */}
                  {(genreTags.length > 0) && (
                    <div className={styles.tagsContainer}>
                      {genreTags.map((tag, i) => {
                        const tTag = t(`genres.${tag}` as any);
                        const displayTag = tTag && !tTag.startsWith('genres.') ? tTag : tag;
                        return (
                          <div key={`g-${i}`} className={styles.tagLabel}>
                            {displayTag}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          
          <div className={styles.tracklistContainer}>
            <div className={styles.tracklistHeader}>Tracklist</div>
            <ul className={styles.tracklist}>
              {tracks.length > 0 ? tracks.map((track, i) => (
                <li key={i}>
                  <span className={styles.trackNum}>{String(i + 1).padStart(2, '0')}</span>
                  <span className={styles.trackName}>{track}</span>
                </li>
              )) : (
                <li className={styles.emptyTrack}>No tracklist available</li>
              )}
            </ul>
            {(releaseDate || copyright || notes) && (
              <div className={styles.extraDetails}>
                {releaseDate && <div className={styles.detailItem}><span className={styles.detailLabel}>{t('detail.releaseDate')}</span> {releaseDate}</div>}
                {copyright && <div className={styles.detailItem}><span className={styles.detailLabel}>{t('detail.label')}</span> {copyright}</div>}
                {notes && <div className={styles.detailNotes}>{notes}</div>}
              </div>
            )}
          </div>
          
          <div className={styles.actions}>
            {album.STATUS === 'OWNED' && (
              <button 
                className={styles.btnPrimary} 
                style={{ backgroundColor: '#d32f2f', borderColor: '#d32f2f' }}
                onClick={() => setConfirmTarget('OWNED')} 
                disabled={isSaving}
              >
                <span className="material-symbols-outlined">delete</span>
                {t('detail.removeFromCollection')}
              </button>
            )}

            {album.STATUS === 'WISH' && (
              <>
                <button className={styles.btnPrimary} onClick={() => setPricePromptOpen(true)} disabled={isSaving}>
                  <span className="material-symbols-outlined">add</span>
                  {t('detail.addToCollection')}
                </button>
                <button
                  className={styles.btnSecondary}
                  style={{ backgroundColor: '#d32f2f', borderColor: '#d32f2f', color: 'white' }}
                  onClick={() => setConfirmTarget('WISH')}
                  disabled={isSaving}
                >
                  <span className="material-symbols-outlined">delete</span>
                  {t('detail.removeFromWishlist')}
                </button>
              </>
            )}

            {(!album.STATUS || (album.STATUS !== 'OWNED' && album.STATUS !== 'WISH')) && (
              <>
                <button className={styles.btnPrimary} onClick={() => setPricePromptOpen(true)} disabled={isSaving}>
                  <span className="material-symbols-outlined">add</span>
                  {t('detail.addToCollection')}
                </button>
                <button className={styles.btnSecondary} onClick={() => handleSave('WISH')} disabled={isSaving}>
                  <span className="material-symbols-outlined">bookmark_add</span>
                  {t('detail.addToWishlist')}
                </button>
              </>
            )}
          </div>

          <div className={styles.externalLinks}>
            <button className={styles.linkBtn} onClick={() => setIsShareOpen(true)} disabled={isCapturing}>
              <span className="material-symbols-outlined">ios_share</span>
              {t('common.share')}
            </button>
            <button className={styles.linkBtn} onClick={handleYoutubeListen}>
              <span className="material-symbols-outlined">play_circle</span>
              Listen on YouTube
            </button>
            <button className={styles.linkBtn} onClick={handleDiscogsSearch}>
              <span className="material-symbols-outlined">album</span>
              Search on Discogs
            </button>
          </div>
      </div>

      </div>

      {/* Custom Confirmation Popup */}
      {confirmTarget && (
        <div className={styles.confirmOverlay} onClick={(e) => { e.stopPropagation(); setConfirmTarget(null); }}>
          <div className={styles.confirmPopup} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmIcon}>
              <span className="material-symbols-outlined">warning</span>
            </div>
            <h3 className={styles.confirmTitle}>{t('detail.deleteConfirmTitle')}</h3>
            <p className={styles.confirmMessage}>
              {t('detail.deleteConfirmMessage', { target: confirmTarget === 'OWNED' ? t('nav.collection') : t('nav.wishlist') })}
            </p>
            <div className={styles.confirmActions}>
              <button className={styles.btnCancel} onClick={() => setConfirmTarget(null)} disabled={isDeleting}>
                {t('common.cancel')}
              </button>
              <button className={styles.btnDelete} onClick={() => handleDelete(confirmTarget)} disabled={isDeleting}>
                {isDeleting ? t('common.deleting') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Price Input Popup */}
      {pricePromptOpen && (
        <div className={styles.confirmOverlay} onClick={(e) => { e.stopPropagation(); setPricePromptOpen(false); }}>
          <div className={styles.confirmPopup} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmIcon} style={{ color: 'var(--accent)', backgroundColor: 'rgba(233, 195, 73, 0.1)' }}>
              <span className="material-symbols-outlined">payments</span>
            </div>
            <h3 className={styles.confirmTitle}>{t('detail.priceInputTitle')}</h3>
            <p className={styles.confirmMessage}>
              {t('detail.priceInputQuestion')}
            </p>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={purchasePriceInput}
              onChange={(e) => setPurchasePriceInput(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder={t('detail.pricePlaceholder')}
              className={styles.priceInput}
              autoFocus
            />
            <div className={styles.confirmActions}>
              <button
                className={styles.btnCancel}
                onClick={() => {
                  handleSave('OWNED', 0);
                  setPricePromptOpen(false);
                }}
                disabled={isSaving}
              >
                {t('detail.skip')}
              </button>
              <button
                className={styles.btnPrimary}
                style={{ flex: 1, padding: '12px' }}
                onClick={() => {
                  const price = Number(purchasePriceInput) || 0;
                  handleSave('OWNED', price);
                  setPricePromptOpen(false);
                }}
                disabled={isSaving}
              >
                {isSaving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 공유 이미지는 밖으로 나가는 화면 — '나만 보기' 개인 커버 대신 공유
          마스터 커버를 사용 ('전체 공개'면 masterImage가 곧 내 사진이라 함께 나감) */}
      <StoryTemplate
        ref={storyTemplateRef}
        album={myPhoto ? { ...album, COVER_URL: masterImage || undefined, IMAGE_URL: masterImage || album.IMAGE_URL } : album}
        username={user?.user_metadata?.displayName || 'Collector'}
        overrideStatus={shareTag as any}
      />
      <ShareBottomSheet
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        title={t('common.share')}
        options={[
          { id: 'link', label: t('share.copyUrl'), icon: 'link', action: handleShareOptions.copyUrl },
          { id: 'save', label: t('share.saveImage'), icon: 'download', action: handleShareOptions.saveImage },
          { id: 'copy', label: t('share.copyImage'), icon: 'content_copy', action: handleShareOptions.copyImage },
          { id: 'ig', label: t('share.instagram'), icon: 'camera_alt', action: handleShareOptions.shareNative },
        ]}
      >
        <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginBottom: '4px' }}>
            {t('detail.tagSelectPrompt')}
          </div>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '4px' }}>
            {[
              { value: 'OWNED', label: 'COLLECTED' },
              { value: 'WISH', label: 'WANTED' },
              { value: 'NONE', label: 'JUST DROPPED' },
              { value: 'NEW', label: 'NEW' }
            ].map(tag => (
              <button
                key={tag.value}
                onClick={() => setShareTag(tag.value as any)}
                style={{
                  flex: 1,
                  padding: '10px 4px',
                  background: shareTag === tag.value ? 'rgba(255,255,255,0.15)' : 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  color: shareTag === tag.value ? '#fff' : 'rgba(255,255,255,0.5)',
                  fontSize: '12px',
                  fontWeight: shareTag === tag.value ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>
      </ShareBottomSheet>

      <SharePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        blob={previewBlob}
        mode={previewMode}
      />

      {cropFile && (
        <CoverCropModal
          file={cropFile}
          isBusy={isUploadingCover}
          onCancel={() => !isUploadingCover && setCropFile(null)}
          onConfirm={handleCropConfirm}
          t={t}
        />
      )}
    </div>
  );
};
