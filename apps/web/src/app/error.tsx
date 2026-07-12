"use client";

import { useEffect } from "react";
import { useLocale } from "@vinyla/i18n";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLocale();

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
        <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>{t('errorPage.title')}</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          {t('errorPage.subtitleLine1')}<br/>{t('errorPage.subtitleLine2')}
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
          {t('errorPage.retry')}
        </button>
      </div>
    </div>
  );
}
