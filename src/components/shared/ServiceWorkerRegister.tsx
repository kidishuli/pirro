'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('PIRRO PWA ServiceWorker active:', registration.scope);
          })
          .catch((error) => {
            console.warn('PIRRO PWA ServiceWorker registration error:', error);
          });
      });
    }
  }, []);

  return null;
}
