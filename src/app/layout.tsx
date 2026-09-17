import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { PirroProvider } from '@/context/PirroContext';

export const suisseIntl = localFont({
  src: [
    {
      path: './fonts/Suisse Intl Book.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/Suisse Intl Medium.otf',
      weight: '500',
      style: 'normal',
    },
    {
      path: './fonts/Suisse Intl Semibold.otf',
      weight: '600',
      style: 'normal',
    },
    {
      path: './fonts/SuisseIntl-Bold.ttf',
      weight: '700',
      style: 'normal',
    },
    {
      path: './fonts/Suisse Intl Black.otf',
      weight: '900',
      style: 'normal',
    },
  ],
  variable: '--font-suisse',
  display: 'swap',
});

import ThemeColorManager from '@/components/shared/ThemeColorManager';
import ServiceWorkerRegister from '@/components/shared/ServiceWorkerRegister';

export const metadata: Metadata = {
  title: 'PIRRO',
  description: 'Valuta Komplementare Digjitale',
  icons: {
    icon: [
      { url: '/assets/logos/Pirro-logo-favicon.svg', type: 'image/svg+xml' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/assets/logos/Pirro-logo-favicon.svg' },
    ],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PIRRO',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#F5F5F5',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sq" className={suisseIntl.variable} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/assets/logos/Pirro-logo-favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/assets/logos/Pirro-logo-favicon.svg" />
      </head>
      <body
        suppressHydrationWarning
        className={`${suisseIntl.className} antialiased bg-[#F5F5F5] md:bg-[#0F172A] min-h-[100dvh] flex justify-center items-center p-0 md:p-4`}
      >
        {/* Full-screen edge-to-edge canvas on mobile, centered iPhone 390 × 848 mockup on desktop */}
        <div className="w-full max-w-none md:max-w-[390px] h-[100dvh] md:h-[848px] md:max-h-[calc(100dvh-2rem)] bg-[#F5F5F5] relative flex flex-col overflow-hidden md:rounded-[48px] md:shadow-2xl md:border md:border-white/10">
          <PirroProvider>
            <ThemeColorManager />
            <ServiceWorkerRegister />
            {children}
          </PirroProvider>
        </div>
      </body>
    </html>
  );
}