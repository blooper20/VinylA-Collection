'use client';

import React from 'react';
import styles from './login.module.css';

export default function LoginPage() {
  const handleGoogleLogin = async () => {
    try {
      const { signInWithGoogle } = await import('@vinyla/core-api');
      await signInWithGoogle(window.location.origin);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.loginBox}>
        <h1 className={styles.title}>Vinyl Noir</h1>
        <p className={styles.subtitle}>당신만의 프라이빗 LP 갤러리에 오신 것을 환영합니다</p>
        
        <button className={styles.glassBtn} onClick={handleGoogleLogin}>
          Continue with Google
        </button>
      </div>
    </div>
  );
}
