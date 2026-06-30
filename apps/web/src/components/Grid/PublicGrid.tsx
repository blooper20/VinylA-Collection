import React, { useEffect, useState } from 'react';
import styles from './PublicGrid.module.css';
import { supabase } from '@vinyla/core-api/src/supabase';

interface PublicGridProps {
  userId: string;
}

export const PublicGrid: React.FC<PublicGridProps> = ({ userId }) => {
  const [dbData, setDbData] = useState<any[]>([]);
  const [profileName, setProfileName] = useState<string>('Collector');
  const [avatarUrl, setAvatarUrl] = useState<string>('/logo.png');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchPublicData() {
      setIsLoading(true);
      try {
        // Fetch user vinyls
        const { data: vinyls } = await supabase
          .from('USER_VINYL')
          .select(`
            *,
            ALBUM_MASTER!inner (*)
          `)
          .eq('USER_ID', userId)
          .eq('del_yn', 'N');

        if (vinyls) {
          const formatted = vinyls.map((v: any) => ({
            ...v.ALBUM_MASTER,
            STATUS: v.STATUS,
            PURCHASE_PRICE: v.PURCHASE_PRICE,
            PURCHASE_DATE: v.PURCHASE_DATE
          }));
          setDbData(formatted);
        }

        // Ideally we'd fetch the user profile from a public profiles table,
        // but since auth.users is not public by default, we just show a generic title
        // or if there's a profiles table, we'd query it. 
        // For now, we'll just show "Collector's Collection" if no public profile is available.
        // In a real app with Supabase, you'd query a public `profiles` table.
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

  return (
    <div className={styles.pageWrapper}>
      <header className={styles.header}>
        <img src={avatarUrl} alt="Avatar" className={styles.avatar} />
        <h1 className={styles.title}>{profileName}'s Collection</h1>
        <p className={styles.subtitle}>{ownedCount} Records</p>
      </header>

      <div className={styles.grid}>
        {dbData.map(album => (
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
