"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      minHeight: '60vh',
      padding: '2rem',
      textAlign: 'center',
      color: 'var(--text-primary)'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '3rem',
        borderRadius: '16px',
        maxWidth: '500px'
      }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>문제가 발생했습니다.</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          페이지를 불러오는 중 오류가 발생했습니다.<br/>일시적인 네트워크 문제일 수 있습니다.
        </p>
        <button
          onClick={() => reset()}
          style={{
            background: 'var(--brand-primary)',
            color: 'white',
            border: 'none',
            padding: '0.8rem 2rem',
            borderRadius: '24px',
            fontSize: '1rem',
            cursor: 'pointer',
            fontWeight: '600',
            transition: 'opacity 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.opacity = '0.8'}
          onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}
