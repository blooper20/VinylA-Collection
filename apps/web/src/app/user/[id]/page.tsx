'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { PublicGrid } from '../../../components/Grid/PublicGrid';

export default function PublicProfilePage() {
  const params = useParams();
  const id = params?.id as string;

  if (!id) return null;

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#000', color: '#fff' }}>
      <PublicGrid userId={id} />
    </main>
  );
}
