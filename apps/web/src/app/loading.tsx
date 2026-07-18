"use client";

import React from 'react';
import Image from 'next/image';

export default function Loading() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      width: '100%',
      minHeight: '50vh',
      color: 'var(--text-primary)'
    }}>
      <Image
        src="/logo.png"
        alt="Loading..."
        width={80}
        height={80}
        priority
        style={{
          animation: 'spin 2s linear infinite',
          objectFit: 'contain',
          borderRadius: '50%',
          boxShadow: '0 0 20px rgba(255, 255, 255, 0.1)'
        }}
      />
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
}
