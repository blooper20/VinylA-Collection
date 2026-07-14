'use client';

import React, { useState, useEffect, useCallback } from 'react';
import styles from './log.module.css';
import { useAuthStore, getMyListeningLog, updateSpinLog, deleteSpinLog, uploadSpinLogMedia, getErrorMessage, ListeningLogWithAlbum, getSpinSocialSummary, SpinSocialSummary } from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';
import { MediaAttachPicker, EditMediaState } from '../../components/Modal/MediaAttachPicker';
import { VisibilityToggle } from '../../components/Modal/VisibilityToggle';
import { SpinSocialModal } from '../../components/Modal/SpinSocialModal';
import { SpinSocialActions } from '../../components/SpinSocialActions';

const PAGE_SIZE = 20;
const MOOD_PRESETS = ['🤩', '🙂', '😌', '😐', '😢'] as const;
const NOTE_MAX_LENGTH = 500;

// 날짜(YYYY-MM-DD, 로컬 기준) 별로 묶어서 Letterboxd 다이어리 스타일로 렌더.
const groupByDate = (entries: ListeningLogWithAlbum[]): [string, ListeningLogWithAlbum[]][] => {
  const groups = new Map<string, ListeningLogWithAlbum[]>();
  for (const entry of entries) {
    const key = new Date(entry.LISTENED_AT).toLocaleDateString('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
    });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }
  return Array.from(groups.entries());
};

// 앨범별 히스토리 — 같은 앨범의 재생 기록을 모아 재생 횟수와 함께 보여준다.
// entries가 이미 최신순이라 그룹 순서 = 가장 최근에 들은 앨범 순.
const groupByAlbum = (entries: ListeningLogWithAlbum[]): { albumId: number; album: ListeningLogWithAlbum['ALBUM_MASTER']; logs: ListeningLogWithAlbum[] }[] => {
  const groups = new Map<number, { albumId: number; album: ListeningLogWithAlbum['ALBUM_MASTER']; logs: ListeningLogWithAlbum[] }>();
  for (const entry of entries) {
    if (!groups.has(entry.ALBUM_ID)) {
      groups.set(entry.ALBUM_ID, { albumId: entry.ALBUM_ID, album: entry.ALBUM_MASTER, logs: [] });
    }
    groups.get(entry.ALBUM_ID)!.logs.push(entry);
  }
  return Array.from(groups.values());
};

export default function ListeningLogPage() {
  const { user } = useAuthStore();
  const { t } = useLocale();
  const [entries, setEntries] = useState<ListeningLogWithAlbum[]>([]);
  const [viewMode, setViewMode] = useState<'date' | 'album'>('date');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // 수정: 작성자 본인 글만 화면에 뜨고(getMyListeningLog가 본인 것만 조회) DB
  // RLS(listening_log_update_own/delete_own)도 auth.uid()=USER_ID만 허용하므로,
  // 이 페이지에 보이는 항목은 전부 내가 쓴 것 — 별도 소유권 체크가 필요 없다.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editMood, setEditMood] = useState<string | undefined>(undefined);
  const [editNote, setEditNote] = useState('');
  const [editMedia, setEditMedia] = useState<EditMediaState>({ kind: 'none' });
  const [editIsPublic, setEditIsPublic] = useState(true);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // 좋아요/댓글 카운트 맵 + 소셜 상세 모달로 연 기록
  const [socialMap, setSocialMap] = useState<Record<number, SpinSocialSummary>>({});
  const [socialEntry, setSocialEntry] = useState<ListeningLogWithAlbum | null>(null);

  const loadSocialSummary = useCallback(async (list: ListeningLogWithAlbum[]) => {
    if (list.length === 0) return;
    const map = await getSpinSocialSummary(list.map((e) => e.LOG_ID));
    setSocialMap((prev) => ({ ...prev, ...map }));
  }, []);

  const loadFirstPage = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const data = await getMyListeningLog(user.id, { limit: PAGE_SIZE });
      setEntries(data);
      setHasMore(data.length === PAGE_SIZE);
      loadSocialSummary(data);
    } catch (e) {
      console.error('Failed to load listening log', e);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    // 마운트/유저 변경 시 다이어리를 불러오는 비동기 데이터 로딩 패턴 (의도된 동작)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFirstPage();
  }, [loadFirstPage]);

  const handleLoadMore = async () => {
    if (!user?.id || isLoadingMore || entries.length === 0) return;
    setIsLoadingMore(true);
    try {
      const last = entries[entries.length - 1];
      const more = await getMyListeningLog(user.id, { limit: PAGE_SIZE, beforeLogId: last.LOG_ID });
      setEntries((prev) => [...prev, ...more]);
      setHasMore(more.length === PAGE_SIZE);
      loadSocialSummary(more);
    } catch (e) {
      console.error('Failed to load more listening log entries', e);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const showToast = (message: string) =>
    window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: { message } }));

  const handleStartEdit = (entry: ListeningLogWithAlbum) => {
    setDeletingId(null);
    setEditingId(entry.LOG_ID);
    setEditMood(entry.MOOD || undefined);
    setEditNote(entry.NOTE || '');
    setEditMedia(
      entry.MEDIA_URL
        ? { kind: 'existing', url: entry.MEDIA_URL, type: entry.MEDIA_TYPE || 'image' }
        : { kind: 'none' }
    );
    setEditIsPublic(entry.IS_PUBLIC);
  };

  const handleCancelEdit = () => {
    if (editMedia.kind === 'new') URL.revokeObjectURL(editMedia.previewUrl);
    setEditingId(null);
  };

  const handleSaveEdit = async (logId: number) => {
    if (editSubmitting) return;
    setEditSubmitting(true);
    try {
      // 'existing'이면 있던 미디어를 그대로 유지, 'none'이면 명시적으로
      // 지우고(null), 'new'면 먼저 업로드해 그 결과 URL로 교체한다.
      let mediaUrl: string | null = null;
      let mediaType: 'image' | 'video' | null = null;
      if (editMedia.kind === 'existing') {
        mediaUrl = editMedia.url;
        mediaType = editMedia.type;
      } else if (editMedia.kind === 'new') {
        const uploaded = await uploadSpinLogMedia(editMedia.file);
        mediaUrl = uploaded.url;
        mediaType = uploaded.type;
      }
      const updated = await updateSpinLog(logId, { mood: editMood, note: editNote, mediaUrl, mediaType, isPublic: editIsPublic });
      setEntries((prev) => prev.map((e) => (e.LOG_ID === logId ? { ...e, ...updated } : e)));
      setEditingId(null);
      showToast(t('log.editSaved'));
    } catch (e) {
      showToast(getErrorMessage(e, t));
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteClick = (logId: number) => {
    setEditingId(null);
    setDeletingId(logId);
  };

  const handleConfirmDelete = async (logId: number) => {
    if (deleteSubmitting) return;
    setDeleteSubmitting(true);
    try {
      await deleteSpinLog(logId);
      setEntries((prev) => prev.filter((e) => e.LOG_ID !== logId));
      setDeletingId(null);
      showToast(t('log.deleted'));
    } catch (e) {
      showToast(getErrorMessage(e, t));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const grouped = groupByDate(entries);
  const albumGroups = groupByAlbum(entries);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>{t('log.eyebrow')}</p>
        <h1 className={styles.title}>{t('log.title')}</h1>
        <p className={styles.subtitle}>{t('log.subtitle')}</p>
      </header>

      <div className={styles.viewSwitch}>
        <button
          type="button"
          className={`${styles.viewChip} ${viewMode === 'date' ? styles.viewChipActive : ''}`}
          onClick={() => setViewMode('date')}
        >
          {t('log.viewByDate')}
        </button>
        <button
          type="button"
          className={`${styles.viewChip} ${viewMode === 'album' ? styles.viewChipActive : ''}`}
          onClick={() => setViewMode('album')}
        >
          {t('log.viewByAlbum')}
        </button>
      </div>

      {isLoading ? (
        <p className={styles.emptyText}>{t('log.loading')}</p>
      ) : entries.length === 0 ? (
        <p className={styles.emptyText}>{t('log.empty')}</p>
      ) : viewMode === 'album' ? (
        <>
          {albumGroups.map((g) => (
            <section key={g.albumId} className={styles.albumGroup}>
              <div className={styles.albumGroupHeader}>
                {g.album && (
                  <img src={g.album.IMAGE_URL} alt={g.album.TITLE} className={styles.albumGroupCover} />
                )}
                <div className={styles.albumGroupInfo}>
                  <div className={styles.timelineTitle}>{g.album?.TITLE || '(삭제된 앨범)'}</div>
                  <div className={styles.timelineArtist}>{g.album?.ARTIST}</div>
                </div>
                <span className={styles.albumPlayCount}>{t('log.playCount', { count: g.logs.length })}</span>
              </div>
              <div className={styles.albumEntryList}>
                {g.logs.map((entry) => (
                  <div
                    key={entry.LOG_ID}
                    className={styles.albumEntryRow}
                    onClick={() => setSocialEntry(entry)}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className={styles.albumEntryDate}>
                      {new Date(entry.LISTENED_AT).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                      {' · '}
                      {new Date(entry.LISTENED_AT).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      {entry.MOOD ? ` · ${entry.MOOD}` : ''}
                      {!entry.IS_PUBLIC && (
                        <span className={styles.privateBadge}>
                          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>lock</span>
                          {t('detail.spinLogPrivate')}
                        </span>
                      )}
                    </span>
                    {entry.NOTE && <p className={styles.albumEntryNote}>{entry.NOTE}</p>}
                    <SpinSocialActions
                      entry={entry}
                      ownerName={user?.user_metadata?.displayName || null}
                      summary={socialMap[entry.LOG_ID]}
                      onOpenComments={() => setSocialEntry(entry)}
                      onSummaryChange={(logId, s) => setSocialMap((prev) => ({ ...prev, [logId]: s }))}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}

          {hasMore && (
            <button type="button" className={styles.loadMoreBtn} onClick={handleLoadMore} disabled={isLoadingMore}>
              {isLoadingMore ? t('log.loading') : t('log.loadMore')}
            </button>
          )}
        </>
      ) : (
        <>
          {grouped.map(([date, dayEntries]) => (
            <section key={date} className={styles.dateGroup}>
              <h2 className={styles.dateHeading}>{date}</h2>
              <div className={styles.timeline}>
                {dayEntries.map((entry) => {
                  const album = entry.ALBUM_MASTER;
                  const isBusy = editingId === entry.LOG_ID || deletingId === entry.LOG_ID;
                  return (
                    <div
                      key={entry.LOG_ID}
                      className={styles.timelineItem}
                      onClick={() => { if (!isBusy) setSocialEntry(entry); }}
                      style={{ cursor: isBusy ? 'default' : 'pointer' }}
                    >
                      <div className={styles.timelineDot} />
                      {album && (
                        <img
                          src={album.IMAGE_URL}
                          alt={album.TITLE}
                          className={styles.timelineImage}
                        />
                      )}
                      <div className={styles.timelineText}>
                        <span className={styles.timelineTime}>
                          {new Date(entry.LISTENED_AT).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                          {entry.MOOD && editingId !== entry.LOG_ID ? ` · ${entry.MOOD}` : ''}
                          {!entry.IS_PUBLIC && editingId !== entry.LOG_ID && (
                            <span className={styles.privateBadge}>
                              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>lock</span>
                              {t('detail.spinLogPrivate')}
                            </span>
                          )}
                        </span>
                        <div className={styles.timelineTitle}>{album?.TITLE || '(삭제된 앨범)'}</div>
                        <div className={styles.timelineArtist}>{album?.ARTIST}</div>

                        {editingId === entry.LOG_ID ? (
                          <div className={styles.editBox} onClick={(e) => e.stopPropagation()}>
                            <div className={styles.editMoodRow}>
                              {MOOD_PRESETS.map((m) => (
                                <button
                                  key={m}
                                  type="button"
                                  className={`${styles.editMoodBtn} ${editMood === m ? styles.editMoodActive : ''}`}
                                  onClick={() => setEditMood(editMood === m ? undefined : m)}
                                  disabled={editSubmitting}
                                  aria-pressed={editMood === m}
                                >
                                  {m}
                                </button>
                              ))}
                            </div>
                            <textarea
                              className={styles.editNoteInput}
                              value={editNote}
                              maxLength={NOTE_MAX_LENGTH}
                              rows={3}
                              onChange={(e) => setEditNote(e.target.value)}
                              disabled={editSubmitting}
                            />
                            <div className={styles.editNoteCounter}>{editNote.length}/{NOTE_MAX_LENGTH}</div>
                            <div className={styles.editMediaWrap}>
                              <MediaAttachPicker value={editMedia} onChange={setEditMedia} disabled={editSubmitting} t={t} />
                            </div>
                            <div className={styles.editVisibilityRow}>
                              <VisibilityToggle value={editIsPublic} onChange={setEditIsPublic} disabled={editSubmitting} t={t} />
                            </div>
                            <div className={styles.editActions}>
                              <button type="button" className={styles.editCancelBtn} onClick={handleCancelEdit} disabled={editSubmitting}>
                                {t('log.editCancel')}
                              </button>
                              <button type="button" className={styles.editSaveBtn} onClick={() => handleSaveEdit(entry.LOG_ID)} disabled={editSubmitting}>
                                {editSubmitting ? t('log.editSaving') : t('log.editSave')}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {entry.NOTE && <p className={styles.timelineNote}>{entry.NOTE}</p>}
                            {entry.MEDIA_URL && (
                              entry.MEDIA_TYPE === 'video' ? (
                                <video className={styles.timelineMedia} src={entry.MEDIA_URL} controls playsInline loop muted onClick={(e) => e.stopPropagation()} />
                              ) : (
                                <img className={styles.timelineMedia} src={entry.MEDIA_URL} alt="" />
                              )
                            )}

                            {deletingId === entry.LOG_ID ? (
                              <div className={styles.deleteConfirmRow} onClick={(e) => e.stopPropagation()}>
                                <span>{t('log.deleteConfirm')}</span>
                                <button type="button" className={styles.deleteConfirmYes} onClick={() => handleConfirmDelete(entry.LOG_ID)} disabled={deleteSubmitting}>
                                  {deleteSubmitting ? t('log.editSaving') : t('log.deleteConfirmYes')}
                                </button>
                                <button type="button" className={styles.deleteConfirmNo} onClick={() => setDeletingId(null)} disabled={deleteSubmitting}>
                                  {t('log.deleteConfirmNo')}
                                </button>
                              </div>
                            ) : (
                              <>
                                <SpinSocialActions
                                  entry={entry}
                                  ownerName={user?.user_metadata?.displayName || null}
                                  summary={socialMap[entry.LOG_ID]}
                                  onOpenComments={() => setSocialEntry(entry)}
                                  onSummaryChange={(logId, s) => setSocialMap((prev) => ({ ...prev, [logId]: s }))}
                                />
                                <div className={styles.timelineActions}>
                                  <button type="button" className={styles.timelineActionBtn} onClick={(e) => { e.stopPropagation(); handleStartEdit(entry); }}>
                                    {t('log.edit')}
                                  </button>
                                  <button type="button" className={styles.timelineActionBtn} onClick={(e) => { e.stopPropagation(); handleDeleteClick(entry.LOG_ID); }}>
                                    {t('log.delete')}
                                  </button>
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {hasMore && (
            <button type="button" className={styles.loadMoreBtn} onClick={handleLoadMore} disabled={isLoadingMore}>
              {isLoadingMore ? t('log.loading') : t('log.loadMore')}
            </button>
          )}
        </>
      )}

      {socialEntry && (
        <SpinSocialModal
          entry={socialEntry}
          ownerName={user?.user_metadata?.displayName || null}
          onClose={() => setSocialEntry(null)}
          onSummaryChange={(logId, s) => setSocialMap((prev) => ({ ...prev, [logId]: s }))}
        />
      )}
    </div>
  );
}
