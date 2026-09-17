'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function setThemeColor(color: string) {
  if (typeof document === 'undefined') return;
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', color);
}

export default function ThemeColorManager() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === '/') {
      // Matches the #F5F5F5 background of the Portofoli screen
      setThemeColor('#F5F5F5');
    } else {
      // Pure white header for Paguaj, Aktiviteti, Merchant Arka, and Merchant Aktiviteti
      setThemeColor('#FFFFFF');
    }
  }, [pathname]);

  return null;
}
