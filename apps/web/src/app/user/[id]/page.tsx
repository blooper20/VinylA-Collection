'use client';

import React, { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { PublicGrid } from '../../../components/Grid/PublicGrid';

function PublicProfileContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const name = searchParams?.get('n') || 'Collector';
  const avatar = searchParams?.get('a') || '/logo.png';
  const type = searchParams?.get('type') === 'wishlist' ? 'wishlist' : 'collection';

  if (!id) return null;

  return <PublicGrid userId={id} initialName={name} initialAvatar={avatar} filterType={type} />;
}

export default function PublicProfilePage() {
  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#000', color: '#fff' }}>
      <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Loading...</div>}>
        <PublicProfileContent />
      </Suspense>
    </main>
  );
}
