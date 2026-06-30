import React from 'react';
import styles from './DetailModal.module.css';
import { MockVinylData } from '@vinyla/shared-types';
import { searchYouTube, searchDiscogs, getAlbumMaster, createAlbumMaster, upsertUserVinyl, useAuthStore, getAlbumExtraDetails, deleteUserVinylByAlbum } from '@vinyla/core-api';
import { StoryTemplate } from '../Share/StoryTemplate';
import { captureElementAsBlob, shareImageNative } from '../../utils/shareUtils';

interface DetailModalProps {
  album: MockVinylData;
  onClose: () => void;
}

export const DetailModal: React.FC<DetailModalProps> = ({ album, onClose }) => {
  const { user } = useAuthStore();
  const [tracks, setTracks] = React.useState<string[]>(album.TRACKS || []);
  const [notes, setNotes] = React.useState<string>('');
  const [copyright, setCopyright] = React.useState<string>('');
  const [releaseDate, setReleaseDate] = React.useState<string>('');
  const [coverUrl, setCoverUrl] = React.useState<string>(album.IMAGE_URL || '');
  const [confirmTarget, setConfirmTarget] = React.useState<'OWNED' | 'WISH' | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [pricePromptOpen, setPricePromptOpen] = React.useState(false);
  const [purchasePriceInput, setPurchasePriceInput] = React.useState('');
  const [marketPrice, setMarketPrice] = React.useState<number | null>((album as any).MARKET_PRICE || null);
  
  const storyTemplateRef = React.useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = React.useState(false);

  const handleShareStory = async () => {
    if (!storyTemplateRef.current || isCapturing) return;
    setIsCapturing(true);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const blob = await captureElementAsBlob(storyTemplateRef.current);
    if (blob) {
      await shareImageNative(blob, 'vinyla-story.jpg');
    }
    setIsCapturing(false);
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
      if (details.highResCover && album.IMAGE_URL !== details.highResCover) {
        setCoverUrl(details.highResCover);
      }
      if (details.marketPrice) {
        setMarketPrice(details.marketPrice);
      } else if (!marketPrice) {
        setMarketPrice(-1);
      }
    });
  }, [album.ALBUM_ID, album.ARTIST, album.TITLE, album.TRACKS, album.IMAGE_URL]);

  const handleYoutubeListen = async () => {
    const query = `${album.ARTIST} ${album.TITLE} full album`;
    const results = await searchYouTube(query);
    if (results && results.length > 0) {
      const videoId = results[0].id?.videoId;
      if (videoId) {
        window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
        return;
      }
    }
    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, '_blank');
  };

  const handleDiscogsSearch = async () => {
    const query = `${album.ARTIST} ${album.TITLE}`;
    const results = await searchDiscogs(query);
    if (results && results.length > 0) {
      const uri = results[0].uri;
      if (uri) {
        window.open(`https://www.discogs.com${uri}`, '_blank');
        return;
      }
    }
    window.open(`https://www.discogs.com/search/?q=${encodeURIComponent(query)}`, '_blank');
  };

  const [isSaving, setIsSaving] = React.useState(false);

  const handleSave = async (status: 'OWNED' | 'WISH', price: number = 0) => {
    try {
      const finalGenres = (album.GENRES || []).filter(g => {
        // Strip any leftover country tags from old saves
        const COUNTRY_TAGS = [
          'South Korea', 'Japan', 'US', 'UK', 'Europe', 'Germany',
          'France', 'Netherlands', 'Canada', 'Australia', 'Italy',
          'Sweden', 'Taiwan', 'Brazil', 'Russia'
        ];
        return !COUNTRY_TAGS.includes(g);
      });

      let master = await getAlbumMaster(album.ALBUM_ID);
      if (!master || !master.GENRES || master.GENRES.length === 0 || (marketPrice && !master.MARKET_PRICE)) {
        await createAlbumMaster({
          ALBUM_ID: album.ALBUM_ID,
          TITLE: album.TITLE,
          ARTIST: album.ARTIST,
          RELEASE_YEAR: album.RELEASE_YEAR,
          IMAGE_URL: album.IMAGE_URL,
          VINYL_IMAGE_URL: album.VINYL_IMAGE_URL || '',
          CUSTOM_COLOR_HEX: album.CUSTOM_COLOR_HEX || '#000',
          CUSTOM_STYLE_TYPE: 'SOLID',
          TRACKS: tracks || [],
          GENRES: finalGenres,
          MARKET_PRICE: marketPrice || 0
        });
      }

      const payloadData: any = {
        USER_ID: user?.id || 1,
        ALBUM_ID: album.ALBUM_ID,
        STATUS: status,
        PURCHASE_PRICE: price
      };

      if (status === 'OWNED' && album.STATUS !== 'OWNED') {
        payloadData.PURCHASE_DATE = new Date().toISOString();
      }

      await upsertUserVinyl(payloadData);

      setIsSaving(true);
      setTimeout(() => {
        onClose();
        
        let message = `성공적으로 ${status === 'OWNED' ? '보관함' : '위시리스트'}에 추가되었습니다!`;
        if (status === 'OWNED' && album.STATUS === 'OWNED') {
          message = '구입가가 성공적으로 저장되었습니다!';
        }

        // Dispatch custom event for Toast
        window.dispatchEvent(new CustomEvent('SHOW_TOAST', {
          detail: { message }
        }));
        window.dispatchEvent(new CustomEvent('REFRESH_VINYLS'));
      }, 600);
    } catch (error) {
      console.error('Failed to save album:', error);
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', {
        detail: { message: '추가에 실패했습니다. 다시 시도해주세요.' }
      }));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (target: 'OWNED' | 'WISH') => {
    try {
      setIsDeleting(true);
      await deleteUserVinylByAlbum(user?.id || 1, album.ALBUM_ID);
      onClose();
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', {
        detail: { message: `성공적으로 ${target === 'OWNED' ? '보관함' : '위시리스트'}에서 삭제되었습니다.` }
      }));
      window.dispatchEvent(new CustomEvent('REFRESH_VINYLS'));
    } catch (e) {
      console.error(e);
      setConfirmTarget(null);
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: { message: '삭제에 실패했습니다.' }}));
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
          <div className={styles.coverContainer}>
            <div className={styles.vinyl}>
              <div 
                className={styles.vinylLabel} 
                style={{ backgroundImage: `url(${coverUrl})` }} 
              />
            </div>
            <div className={styles.cover}>
              <img src={coverUrl} alt={album.TITLE} className={styles.coverImage} />
            </div>
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
                시장 추정가: {marketPrice === -1 ? '정보 없음' : marketPrice ? `₩${marketPrice.toLocaleString()}` : '불러오는 중...'}
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginLeft: '22px', marginTop: '-2px' }}>
                * Discogs 기준 최저가
              </div>
            </div>
            {album.STATUS === 'OWNED' ? (
              <div className={styles.actualValue}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, marginRight: 4 }}>receipt_long</span>
                실제 구입가: {album.PURCHASE_PRICE ? `₩${(album.PURCHASE_PRICE).toLocaleString()}` : '미입력'}
                <button 
                  className={styles.editPriceBtn}
                  onClick={() => {
                    setPurchasePriceInput(album.PURCHASE_PRICE ? String(album.PURCHASE_PRICE) : '');
                    setPricePromptOpen(true);
                  }}
                  title="구입가 수정"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                </button>
              </div>
            ) : null}

            {(() => {
              const KNOWN_COUNTRIES = [
                'South Korea', 'Japan', 'US', 'UK', 'Europe', 'Germany', 
                'France', 'Netherlands', 'Canada', 'Australia', 'Italy', 
                'Sweden', 'Taiwan', 'Brazil', 'Russia'
              ];
              const genres = album.GENRES || [];
              const countryTags = genres.filter(tag => KNOWN_COUNTRIES.includes(tag));
              const genreTags = genres.filter(tag => !KNOWN_COUNTRIES.includes(tag));

              return (
                <>
                  {countryTags.length > 0 && (
                    <div className={styles.tagsContainer} style={{ marginBottom: '-8px' }}>
                      {countryTags.map((tag, i) => (
                        <span key={i} className={styles.tagLabel} style={{ borderColor: 'rgba(233, 195, 73, 0.4)', color: 'var(--accent)' }}>🌐 {tag}</span>
                      ))}
                    </div>
                  )}

                  {genreTags.length > 0 && (
                    <div className={styles.tagsContainer}>
                      {genreTags.slice(0, 4).map((tag, i) => (
                        <span key={i} className={styles.tagLabel}>{tag}</span>
                      ))}
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
                {releaseDate && <div className={styles.detailItem}><span className={styles.detailLabel}>발매일:</span> {releaseDate}</div>}
                {copyright && <div className={styles.detailItem}><span className={styles.detailLabel}>소속사:</span> {copyright}</div>}
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
                보관함 삭제
              </button>
            )}
            
            {album.STATUS === 'WISH' && (
              <>
                <button className={styles.btnPrimary} onClick={() => setPricePromptOpen(true)} disabled={isSaving}>
                  <span className="material-symbols-outlined">add</span>
                  보관함 추가
                </button>
                <button 
                  className={styles.btnSecondary} 
                  style={{ backgroundColor: '#d32f2f', borderColor: '#d32f2f', color: 'white' }}
                  onClick={() => setConfirmTarget('WISH')} 
                  disabled={isSaving}
                >
                  <span className="material-symbols-outlined">delete</span>
                  위시 삭제
                </button>
              </>
            )}

            {(!album.STATUS || (album.STATUS !== 'OWNED' && album.STATUS !== 'WISH')) && (
              <>
                <button className={styles.btnPrimary} onClick={() => setPricePromptOpen(true)} disabled={isSaving}>
                  <span className="material-symbols-outlined">add</span>
                  보관함 추가
                </button>
                <button className={styles.btnSecondary} onClick={() => handleSave('WISH')} disabled={isSaving}>
                  <span className="material-symbols-outlined">bookmark_add</span>
                  위시
                </button>
              </>
            )}
          </div>

          <div className={styles.externalLinks}>
            <button className={styles.linkBtn} onClick={handleShareStory} disabled={isCapturing}>
              <span className="material-symbols-outlined">camera</span>
              인스타 스토리 생성
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

        {/* Custom Confirmation Popup */}
        {confirmTarget && (
          <div className={styles.confirmOverlay} onClick={() => setConfirmTarget(null)}>
            <div className={styles.confirmPopup} onClick={(e) => e.stopPropagation()}>
              <div className={styles.confirmIcon}>
                <span className="material-symbols-outlined">warning</span>
              </div>
              <h3 className={styles.confirmTitle}>삭제 확인</h3>
              <p className={styles.confirmMessage}>
                정말로 {confirmTarget === 'OWNED' ? '보관함' : '위시리스트'}에서 삭제하시겠습니까?
              </p>
              <div className={styles.confirmActions}>
                <button className={styles.btnCancel} onClick={() => setConfirmTarget(null)} disabled={isDeleting}>
                  취소
                </button>
                <button className={styles.btnDelete} onClick={() => handleDelete(confirmTarget)} disabled={isDeleting}>
                  {isDeleting ? '삭제 중...' : '삭제하기'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Price Input Popup */}
        {pricePromptOpen && (
          <div className={styles.confirmOverlay} onClick={() => setPricePromptOpen(false)}>
            <div className={styles.confirmPopup} onClick={(e) => e.stopPropagation()}>
              <div className={styles.confirmIcon} style={{ color: 'var(--accent)', backgroundColor: 'rgba(233, 195, 73, 0.1)' }}>
                <span className="material-symbols-outlined">payments</span>
              </div>
              <h3 className={styles.confirmTitle}>구입가 입력</h3>
              <p className={styles.confirmMessage}>
                이 LP를 얼마에 구매하셨나요? (숫자만 입력)
              </p>
              <input 
                type="text" 
                inputMode="numeric"
                pattern="[0-9]*"
                value={purchasePriceInput} 
                onChange={(e) => setPurchasePriceInput(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="예: 45000"
                className={styles.priceInput}
                autoFocus
              />
              <div className={styles.confirmActions}>
                <button className={styles.btnCancel} onClick={() => setPricePromptOpen(false)} disabled={isSaving}>
                  건너뛰기
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
                  {isSaving ? '저장 중...' : '저장하기'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
      <StoryTemplate ref={storyTemplateRef} album={album} username={user?.user_metadata?.displayName || 'Collector'} />
    </div>
  );
};
