import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './PublicGrid.module.css';
import { supabase } from '@vinyla/core-api/src/supabase';
import { getUserVinyls } from '@vinyla/core-api';

interface PublicGridProps {
  userId: string;
  initialName?: string;
  initialAvatar?: string;
}

export const PublicGrid: React.FC<PublicGridProps> = ({ userId, initialName = 'Collector', initialAvatar = '/logo.png' }) => {
  const [dbData, setDbData] = useState<any[]>([]);
  const [profileName, setProfileName] = useState<string>(initialName);
  const [avatarUrl, setAvatarUrl] = useState<string>(initialAvatar);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchPublicData() {
      setIsLoading(true);
      try {
        const vinyls = await getUserVinyls(userId);

        if (vinyls && vinyls.length > 0) {
          const formatted = vinyls.map((v: any) => ({
            ...(v.ALBUM_MASTER || {}),
            STATUS: v.STATUS,
            PURCHASE_PRICE: v.PURCHASE_PRICE,
            PURCHASE_DATE: v.PURCHASE_DATE
          }));
          setDbData(formatted);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }

    if (userId) {
      fetchPublicData();
    }
  }, [userId]);

  if (isLoading) {
    return <div className={styles.loading}>컬렉션 불러오는 중...</div>;
  }

  const ownedCount = dbData.filter(v => v.STATUS === 'OWNED').length;
  // Exclude WISH status for public view
  const displayData = dbData.filter(v => v.STATUS !== 'WISH');

  return (
    <div className={styles.pageWrapper}>
      <header className={styles.header}>
        <Link href={`/user/${userId}`}>
          <img src={avatarUrl} alt="Avatar" className={styles.avatar} style={{ cursor: 'pointer' }} />
        </Link>
        <h1 className={styles.title}>{profileName}'s Collection</h1>
        <p className={styles.subtitle}>{ownedCount} Records</p>
      </header>

      <div className={styles.grid}>
        {displayData.map(album => (
          <div key={album.ALBUM_ID} className={styles.card}>
            <div className={styles.coverWrapper}>
              <img src={album.COVER_URL || album.IMAGE_URL} alt={album.TITLE} className={styles.cover} />
              {album.STATUS === 'WISH' && <div className={styles.wishBadge}>WISH</div>}
            </div>
            <div className={styles.info}>
              <p className={styles.albumTitle}>{album.TITLE}</p>
              <p className={styles.albumArtist}>{album.ARTIST}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
