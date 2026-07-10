'use client';

import { useEffect } from 'react';
import { logEvent, captureFirstTouch, classifySource } from '@vinyla/core-api';

// Mounted once in the root layout. Records a VISIT event (once per browser
// session) with referrer/UTM/landing-path info, and captures first-touch
// attribution into localStorage for the later SIGNUP event.
export const AttributionTracker = () => {
  useEffect(() => {
    try {
      captureFirstTouch();

      if (sessionStorage.getItem('vinyla_visit_logged')) return;
      sessionStorage.setItem('vinyla_visit_logged', '1');

      const params = new URLSearchParams(window.location.search);
      const path = window.location.pathname;
      const referrer = document.referrer || '';
      const sharedMatch = path.match(/^\/user\/([^/]+)/);
      logEvent('VISIT', {
        source: classifySource(referrer, path, params.get('utm_source')),
        referrer: referrer.slice(0, 200),
        path,
        sharedFrom: sharedMatch?.[1],
      });
    } catch {
      /* tracking must never break the app */
    }
  }, []);

  return null;
};
