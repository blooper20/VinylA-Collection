'use client';

import React, { useState } from 'react';
import { AlbumCard } from './AlbumCard';
import { DetailModal } from '../Modal/DetailModal';
import { mockVinyls, MockVinylData } from '@vinyla/shared-types';
import styles from './VinylGrid.module.css';

interface VinylGridProps {
  statusFilter?: 'OWNED' | 'WISH' | 'ALL';
}

export const VinylGrid: React.FC<VinylGridProps> = ({ statusFilter = 'ALL' }) => {
  const [selectedAlbum, setSelectedAlbum] = useState<MockVinylData | null>(null);

  const displayedAlbums = mockVinyls.filter(album => 
    statusFilter === 'ALL' || album.STATUS === statusFilter
  );

  return (
    <>
      <div className={styles.grid}>
        {displayedAlbums.map((album) => (
          <AlbumCard key={album.ALBUM_ID} album={album} onClick={setSelectedAlbum} />
        ))}
      </div>
      {selectedAlbum && (
        <DetailModal album={selectedAlbum} onClose={() => setSelectedAlbum(null)} />
      )}
    </>
  );
};
