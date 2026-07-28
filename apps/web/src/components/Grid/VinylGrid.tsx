'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlbumCard } from './AlbumCard';
import { DetailModal } from '../Modal/DetailModal';
import { RandomPickModal } from '../Modal/RandomPickModal';
import { ShareBottomSheet } from '../Modal/ShareBottomSheet';
import { ShareableGridTemplate } from '../Share/ShareableGridTemplate';
import { SharePreviewModal } from '../Modal/SharePreviewModal';
import { copyToClipboard, captureElementAsBlob } from '../../utils/shareUtils';
import { useAuthStore, createAlbumMaster, getUserVinyls, updateUserVinylOrder, mapToFrontendModel, supabase } from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';
import { MockVinylData } from '@vinyla/shared-types';
import styles from './VinylGrid.module.css';
import { PageTabs } from '../Navigation/PageTabs';

type FilterType = 'ALL' | 'OWNED' | 'WISH';
type ViewMode = 'grid4' | 'grid6' | 'table';
type SortMode = 'latest' | 'oldest' | 'alpha' | 'year' | 'custom';
type VinylItem = ReturnType<typeof mapToFrontendModel> & { TRACKS?: string[] };

// "직접 정렬" 모드에서 카드를 드래그할 수 있게 감싸는 래퍼. 카드 전체가 드래그
// 핸들이고(listeners를 래퍼 div에 건다), 우측 상단 아이콘은 순수 시각적
// 힌트일 뿐 — 클릭 영역을 따로 나누면 실수로 드래그가 씹히는 경우가 잦다.
function SortableAlbumCard({ album, onSelect, isEditMode }: {
  album: VinylItem;
  onSelect: (album: MockVinylData) => void;
  isEditMode: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: album.USER_VINYL_ID! });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={styles.sortableCardWrap}>
      <AlbumCard album={album} onClick={isEditMode ? () => {} : onSelect} />
      <div className={styles.dragHandle}>
        <span className="material-symbols-outlined">drag_indicator</span>
      </div>
    </div>
  );
}

interface VinylGridProps {
  statusFilter?: FilterType;
}

export const VinylGrid: React.FC<VinylGridProps> = ({ statusFilter = 'ALL' }) => {
  const [selectedAlbum, setSelectedAlbum] = useState<MockVinylData | null>(null);
  const [activeTag, setActiveTag] = useState<string>('ALL');
  const [dbData, setDbData] = useState<VinylItem[]>([]);
  const [, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid4');
  const [sortMode, setSortMode] = useState<SortMode>('custom');
  const [isEditMode, setIsEditMode] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isRandomPickOpen, setIsRandomPickOpen] = useState(false);
  
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewMode, setPreviewMode] = useState<'save' | 'copy' | null>(null);

  const shareGridRef = useRef<HTMLDivElement>(null);
  // updateUserVinylOrder fires one PATCH per row — each lands as its own
  // postgres_changes event on the subscription below, so a 17-record reorder
  // triggers up to 17 concurrent loadData() refetches. Those land out of
  // order relative to how many of the 17 writes have actually landed on the
  // server yet, so the grid visibly flickers between the new order and a
  // half-applied one until the last echo arrives. Suppress refetches for the
  // duration of a manual reorder (+ a grace period for trailing echoes) since
  // we already know the correct order from the optimistic local update.
  const suppressRealtimeRefetchRef = useRef(false);

  const { user, initializeAuth } = useAuthStore();
  const { t } = useLocale();
  const router = useRouter();

  useEffect(() => { initializeAuth(); }, [initializeAuth]);

  // 편집 모드는 "직접 정렬" 모드의 그리드 뷰에서만 의미가 있다 — 다른 정렬
  // 기준으로 바꾸거나 테이블 뷰로 전환하면 드래그 순서 변경이 무의미해지므로
  // 자동으로 빠져나온다.
  useEffect(() => {
    if (sortMode !== 'custom' || viewMode === 'table') setIsEditMode(false);
  }, [sortMode, viewMode]);

  useEffect(() => {
    if (user && !user.user_metadata?.displayName) {
      router.replace('/setup');
    }
  }, [user, router]);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('vinyls_dbData');
        if (cached) { try { setDbData(JSON.parse(cached)); } catch {} }
      }
      if (!user) { setDbData([]); setIsLoading(false); return; }
      const userVinyls = await getUserVinyls(user.id);
      if (userVinyls && userVinyls.length > 0) {
        const mapped = userVinyls.map(v => mapToFrontendModel(v, null));
        setDbData(mapped);
        if (typeof window !== 'undefined') localStorage.setItem('vinyls_dbData', JSON.stringify(mapped));
      } else {
        setDbData([]);
        if (typeof window !== 'undefined') localStorage.setItem('vinyls_dbData', '[]');
      }
      setIsLoading(false);
    }
    if (user !== undefined) loadData();

    const handleRefresh = () => loadData();
    window.addEventListener('REFRESH_VINYLS', handleRefresh);

    // Subscribe only to this user's rows — an unfiltered subscription makes
    // every client refetch on every other user's change.
    if (!user) {
      return () => window.removeEventListener('REFRESH_VINYLS', handleRefresh);
    }
    const subscription = supabase
      .channel('public:USER_VINYL:web_home')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'USER_VINYL', filter: `USER_ID=eq.${user.id}` }, () => {
        if (suppressRealtimeRefetchRef.current) return;
        loadData();
      })
      .subscribe();
    return () => {
        window.removeEventListener('REFRESH_VINYLS', handleRefresh);
        subscription.unsubscribe();
      };
  }, [user]);

  useEffect(() => {
    const handleToast = (e: Event) => {
      setToastMessage((e as CustomEvent<{ message: string }>).detail.message);
      setTimeout(() => setToastMessage(null), 3000);
    };
    window.addEventListener('SHOW_TOAST', handleToast);
    return () => window.removeEventListener('SHOW_TOAST', handleToast);
  }, []);



  const dataToUse = dbData.filter(album => statusFilter === 'ALL' || album.STATUS === statusFilter);
  const allTags = Array.from(new Set(dataToUse.flatMap(album => album.GENRES || []))).sort();

  const filteredAlbums = dataToUse.filter(album =>
    activeTag === 'ALL' || (album.GENRES && album.GENRES.includes(activeTag))
  );

  const displayedAlbums = [...filteredAlbums].sort((a, b) => {
    switch (sortMode) {
      case 'oldest': return (a.PURCHASE_DATE || '').localeCompare(b.PURCHASE_DATE || '');
      case 'alpha':  return a.TITLE.localeCompare(b.TITLE, 'ko');
      case 'year':   return (Number(b.RELEASE_YEAR) || 0) - (Number(a.RELEASE_YEAR) || 0);
      case 'custom': {
        // 아직 한 번도 드래그로 정렬한 적 없는(SORT_ORDER === null) 앨범은
        // 뒤로 밀어낸다 — 새로 추가한 앨범이 기존에 손으로 정해둔 순서
        // 한가운데 임의로 끼어들지 않도록.
        const ao = a.SORT_ORDER;
        const bo = b.SORT_ORDER;
        if (ao == null && bo == null) return (b.PURCHASE_DATE || '').localeCompare(a.PURCHASE_DATE || '');
        if (ao == null) return 1;
        if (bo == null) return -1;
        return ao - bo;
      }
      default:       return (b.PURCHASE_DATE || '').localeCompare(a.PURCHASE_DATE || '');
    }
  });

  const dragSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleToggleEditMode = () => {
    // 태그로 일부만 걸러진 상태에서 드래그하면 화면에 안 보이는 나머지
    // 행들의 SORT_ORDER와 뒤섞여 꼬일 수 있어, 편집 시작 시 전체 보기로 되돌린다.
    if (!isEditMode) setActiveTag('ALL');
    setIsEditMode((v) => !v);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = displayedAlbums.findIndex((a) => a.USER_VINYL_ID === active.id);
    const newIndex = displayedAlbums.findIndex((a) => a.USER_VINYL_ID === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(displayedAlbums, oldIndex, newIndex).map((a, idx) => ({ ...a, SORT_ORDER: idx }));

    setDbData((prev) => {
      const byId = new Map(reordered.map((a) => [a.USER_VINYL_ID, a]));
      return prev.map((a) => byId.get(a.USER_VINYL_ID) || a);
    });

    suppressRealtimeRefetchRef.current = true;
    try {
      await updateUserVinylOrder(reordered.map((a) => a.USER_VINYL_ID!));
    } catch {
      setToastMessage(t('collection.orderSaveFailed'));
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      // The 17 PATCHes' own postgres_changes echoes can keep trickling in
      // for a bit after the last one resolves — give them a moment to drain
      // before trusting the subscription's refetches again.
      setTimeout(() => { suppressRealtimeRefetchRef.current = false; }, 1500);
    }
  };

  const handleShareLink = async () => {
    if (user?.id) {
      const name = encodeURIComponent(user.user_metadata?.displayName || 'Collector');
      const avatar = encodeURIComponent(user.user_metadata?.avatar_url || '/logo.png');
      const link = `${window.location.origin}/user/${user.id}?n=${name}&a=${avatar}`;
      await copyToClipboard(link);
      setToastMessage(t('collection.linkCopied'));
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  return (
    <div className={styles.pageWrapper}>
      <PageTabs group="collection" />
      <header className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <span className={styles.pageEyebrow}>My Collection</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h1 className={styles.pageTitle}>{t('collection.title')}</h1>
            <button className={styles.shareBtn} onClick={() => setIsShareOpen(true)} title={t('common.share')}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>ios_share</span>
            </button>
          </div>
          <p className={styles.pageSubtitle}>{displayedAlbums.length} Records</p>
          {statusFilter === 'OWNED' && dataToUse.length > 0 && (
            <button className={styles.randomPickBtn} onClick={() => setIsRandomPickOpen(true)}>
              {t('randomPick.triggerButton')}
            </button>
          )}
        </div>
        <div className={styles.headerRight}>
          <div className={styles.controlsRow}>
            <div className={styles.sortGroup}>
              {([
                { key: 'latest', label: t('sort.latest') },
                { key: 'oldest', label: t('sort.oldest') },
                { key: 'alpha',  label: t('sort.alpha') },
                { key: 'year',   label: t('sort.year') },
                { key: 'custom', label: t('sort.custom') },
              ] as { key: SortMode; label: string }[]).map(({ key, label }) => (
                <button key={key} className={`${styles.controlChip} ${sortMode === key ? styles.controlActive : ''}`} onClick={() => setSortMode(key)}>
                  {label}
                </button>
              ))}
              {sortMode === 'custom' && viewMode !== 'table' && (
                <button
                  className={`${styles.controlChip} ${styles.editModeBtn} ${isEditMode ? styles.controlActive : ''}`}
                  onClick={handleToggleEditMode}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px', verticalAlign: '-2px' }}>
                    {isEditMode ? 'check' : 'drag_indicator'}
                  </span>
                  {isEditMode ? t('collection.editModeDone') : t('collection.editMode')}
                </button>
              )}
            </div>
            <div className={styles.viewGroup}>
              <button className={`${styles.viewBtn} ${viewMode === 'grid4' ? styles.viewActive : ''}`} onClick={() => setViewMode('grid4')} title={t('view.grid4')}>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
                  <rect x="0" y="0" width="6" height="6"/><rect x="9" y="0" width="6" height="6"/>
                  <rect x="0" y="9" width="6" height="6"/><rect x="9" y="9" width="6" height="6"/>
                </svg>
              </button>
              <button className={`${styles.viewBtn} ${viewMode === 'grid6' ? styles.viewActive : ''}`} onClick={() => setViewMode('grid6')} title={t('view.compact')}>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
                  <rect x="0" y="0" width="3" height="3"/><rect x="6" y="0" width="3" height="3"/><rect x="12" y="0" width="3" height="3"/>
                  <rect x="0" y="6" width="3" height="3"/><rect x="6" y="6" width="3" height="3"/><rect x="12" y="6" width="3" height="3"/>
                  <rect x="0" y="12" width="3" height="3"/><rect x="6" y="12" width="3" height="3"/><rect x="12" y="12" width="3" height="3"/>
                </svg>
              </button>
              <button className={`${styles.viewBtn} ${viewMode === 'table' ? styles.viewActive : ''}`} onClick={() => setViewMode('table')} title={t('view.table')}>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
                  <rect x="0" y="0" width="15" height="2.5"/><rect x="0" y="4.5" width="15" height="2.5"/>
                  <rect x="0" y="9" width="15" height="2.5"/><rect x="0" y="13.5" width="15" height="1.5"/>
                </svg>
              </button>
            </div>
          </div>
          <div className={styles.tagRow}>
            <div className={styles.spacer} />
            <button className={`${styles.filterChip} ${activeTag === 'ALL' ? styles.active : ''}`} onClick={() => setActiveTag('ALL')}>{t('collection.filterAll')}</button>
            {allTags.map(tag => (
              <button key={tag} className={`${styles.filterChip} ${activeTag === tag ? styles.active : ''}`} onClick={() => setActiveTag(tag)}>{tag}</button>
            ))}
          </div>
        </div>
      </header>

      {displayedAlbums.length === 0 ? (
        <div className={styles.emptyState}>
          <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'rgba(255,255,255,0.2)', marginBottom: '16px' }}>album</span>
          <p className={styles.emptyStateText}>{t('collection.emptyTitle')}</p>
          <button className={styles.emptyStateBtn} onClick={() => router.push('/search')}>{t('collection.emptyCta')}</button>
        </div>
      ) : viewMode !== 'table' ? (
        isEditMode ? (
          <>
            <p className={styles.editModeHint}>{t('collection.editModeHint')}</p>
            <DndContext sensors={dragSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={displayedAlbums.map((a) => a.USER_VINYL_ID!)} strategy={rectSortingStrategy}>
                <div className={viewMode === 'grid4' ? styles.grid4 : styles.grid6}>
                  {displayedAlbums.map(album => (
                    <SortableAlbumCard key={album.USER_VINYL_ID} album={album} onSelect={setSelectedAlbum} isEditMode={isEditMode} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </>
        ) : (
          <div className={viewMode === 'grid4' ? styles.grid4 : styles.grid6}>
            {displayedAlbums.map(album => (
              <AlbumCard key={album.ALBUM_ID} album={album} onClick={setSelectedAlbum} />
            ))}
          </div>
        )
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thCover}></th>
                <th className={styles.thTitle}>{t('table.album')}</th>
                <th className={styles.thArtist}>{t('table.artist')}</th>
                <th className={styles.thYear}>{t('table.year')}</th>
                <th className={styles.thTags}>{t('table.tags')}</th>
                <th className={styles.thStatus}>{t('table.status')}</th>
              </tr>
            </thead>
            <tbody>
              {displayedAlbums.map(album => (
                <tr key={album.ALBUM_ID} className={styles.tableRow} onClick={() => setSelectedAlbum(album)}>
                  <td className={styles.tdCover}>
                    <div className={styles.tableCoverBox}>
                      <img src={album.IMAGE_URL || `https://picsum.photos/seed/${album.ALBUM_ID}/60/60`} alt={album.TITLE} className={styles.tableThumb} />
                    </div>
                  </td>
                  <td className={styles.tdTitle}>{album.TITLE}</td>
                  <td className={styles.tdArtist}>{album.ARTIST}</td>
                  <td className={styles.tdYear}>{album.RELEASE_YEAR || '—'}</td>
                  <td className={styles.tdTags}>
                    {(album.GENRES || []).slice(0, 3).map((g: string) => <span key={g} className={styles.tableTag}>{g}</span>)}
                  </td>
                  <td className={styles.tdStatus}>
                    <span className={album.STATUS === 'OWNED' ? styles.statusOwned : styles.statusWish}>
                      {album.STATUS === 'OWNED' ? t('collection.statusOwned') : t('collection.statusWish')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedAlbum && <DetailModal album={selectedAlbum} onClose={() => setSelectedAlbum(null)} />}
      {isRandomPickOpen && (
        <RandomPickModal
          albums={dataToUse}
          onClose={() => setIsRandomPickOpen(false)}
          onOpenAlbum={setSelectedAlbum}
        />
      )}

      {toastMessage && (
        <div className={styles.toast}>
          <span className="material-symbols-outlined">check_circle</span>
          {toastMessage}
        </div>
      )}

      <ShareBottomSheet
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        title={t('collection.shareSheetTitle')}
        options={[
          { id: 'image', label: t('share.saveImage'), icon: 'download', action: async () => {
              setIsShareOpen(false);
              const blob = await captureElementAsBlob(shareGridRef.current!, 'jpeg');
              if (blob) {
                setPreviewBlob(blob);
                setPreviewMode('save');
                setIsPreviewOpen(true);
              }
            }
          },
          { id: 'copy', label: t('share.copyImage'), icon: 'content_copy', action: async () => {
              setIsShareOpen(false);
              const blob = await captureElementAsBlob(shareGridRef.current!, 'png');
              if (blob) {
                setPreviewBlob(blob);
                setPreviewMode('copy');
                setIsPreviewOpen(true);
              }
            }
          },
          { id: 'link', label: t('share.copyLink'), icon: 'link', action: handleShareLink }
        ]}
      />

      <SharePreviewModal 
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        blob={previewBlob}
        mode={previewMode}
      />

      <ShareableGridTemplate 
        ref={shareGridRef}
        albums={displayedAlbums.filter(a => a.STATUS !== 'WISH')}
        username={user?.user_metadata?.displayName || 'Collector'}
        title={t('collection.title')}
      />
    </div>
  );
};
