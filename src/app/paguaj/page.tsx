'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import FloatingDock from '@/components/shared/FloatingDock';
import { usePirro, Transaction } from '@/context/PirroContext';
import { generateCPMToken, parseMPMPayload } from '@/lib/qr';
import { Html5Qrcode } from 'html5-qrcode';
import { setThemeColor } from '@/components/shared/ThemeColorManager';
import { playPaymentChime } from '@/lib/sound';
import { supabase } from '@/lib/supabase';

type PaguajStep = 'keypad' | 'search' | 'scanner' | 'confirm' | 'confirmation' | 'receipt' | 'kodi_im';

// ============================================================
// NUMPAD AMOUNT CONTROLS
// ============================================================
// Change MAX_AMOUNT_LIMIT to set maximum allowed amount:
// - Set to a specific number (e.g. 10000)
// - Or set to 'balance' to cap automatically to the user's available balance
export const MAX_AMOUNT_LIMIT: number | 'balance' = 'balance';
export const MAX_DECIMAL_DIGITS = 2; // Maximum decimal places (cents)

export default function PaguajPage() {
  const { balance, payMerchant, formatPirro } = usePirro();

  // Effective maximum amount allowed based on configuration
  const maxAllowed = MAX_AMOUNT_LIMIT === 'balance' ? balance : MAX_AMOUNT_LIMIT;

  const [step, setStep] = useState<PaguajStep>('keypad');
  const [amountStr, setAmountStr] = useState('0');
  const [selectedMerchant, setSelectedMerchant] = useState<{
    name: string;
    sub: string;
    logo: string;
    color?: string;
  }>({
    name: 'Laguna',
    sub: '@laguna',
    logo: '/assets/logos/laguna logo.png',
    color: '#51B0AA',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [lastTx, setLastTx] = useState<Transaction | null>(null);

  // Kodi im dynamic CPM token & 60s countdown timer
  const [qrPayload, setQrPayload] = useState('');
  const [qrCountdown, setQrCountdown] = useState(60);

  const showQRModal = step === 'kodi_im';

  // Regenerate token and countdown every 60 seconds
  useEffect(() => {
    if (!showQRModal) return;

    // Generate initial token
    setQrPayload(generateCPMToken('@alkid'));
    setQrCountdown(60);

    const interval = setInterval(() => {
      setQrCountdown((prev) => {
        if (prev <= 1) {
          // Refresh token at 0
          setQrPayload(generateCPMToken('@alkid'));
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showQRModal]);

  // Max brightness and Screen Wake Lock when presenting CPM code
  useEffect(() => {
    if (step !== 'kodi_im') return;

    let wakeLockSentinel: any = null;

    // 1. Keep the screen awake at full brightness and prevent OS dimming/sleeping
    const acquireWakeLock = async () => {
      try {
        if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
          wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
        }
      } catch {
        // Wake Lock may fail if battery saver is engaged or permission denied
      }
    };

    acquireWakeLock();

    // 2. Hardware brightness hook for mobile webviews / Cordova / Capacitor / Samsung Internet
    let originalBrightness: number | null = null;
    try {
      const win = typeof window !== 'undefined' ? (window as any) : null;
      if (win?.plugins?.brightness?.setBrightness) {
        win.plugins.brightness.getBrightness((val: number) => {
          originalBrightness = val;
          win.plugins.brightness.setBrightness(1.0);
        });
      } else if (win?.screen?.brightness !== undefined) {
        originalBrightness = win.screen.brightness;
        win.screen.brightness = 1.0;
      }
    } catch {
      // Ignore unsupported platforms
    }

    // 3. Keep status bar and root in pure white for 100% luminance
    setThemeColor('#FFFFFF');

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        acquireWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockSentinel) {
        wakeLockSentinel.release().catch(() => {});
        wakeLockSentinel = null;
      }
      try {
        const win = typeof window !== 'undefined' ? (window as any) : null;
        if (originalBrightness !== null && win?.plugins?.brightness?.setBrightness) {
          win.plugins.brightness.setBrightness(originalBrightness);
        } else if (originalBrightness !== null && win?.screen?.brightness !== undefined) {
          win.screen.brightness = originalBrightness;
        }
      } catch {
        // Ignore
      }
    };
  }, [step]);

  // Chime of confirmation when transaction completes
  useEffect(() => {
    if (step === 'confirmation') {
      playPaymentChime();
    }
  }, [step]);

  // Listen for transactions completed via CPM code while Kodi im is active
  useEffect(() => {
    if (step !== 'kodi_im') return;

    const channel = supabase
      .channel('customer_cpm_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: 'sender_handle=eq.@alkid',
        },
        (payload: any) => {
          const newTx = payload?.new;
          if (newTx) {
            playPaymentChime();
            setAmountStr(String(newTx.amount_p || '0'));
            if (newTx.receiver_handle?.toLowerCase().includes('laguna')) {
              setSelectedMerchant({
                name: 'Laguna',
                sub: '@laguna',
                logo: '/assets/logos/laguna logo.png',
                color: '#51B0AA',
              });
            }
            setStep('confirmation');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [step]);

  // Scanner ref and engine
  const customerScannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    let isMounted = true;

    const startScanner = async () => {
      if (step !== 'scanner') return;

      // Poll up to 10 times (500ms max) to ensure the DOM element is mounted
      let elem = document.getElementById('customer-qr-reader');
      let retries = 0;
      while (!elem && retries < 10) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        elem = document.getElementById('customer-qr-reader');
        retries++;
      }

      if (!elem || !isMounted) return;

      // Clean up existing scanner instance if any
      if (customerScannerRef.current) {
        try {
          if (customerScannerRef.current.isScanning) {
            await customerScannerRef.current.stop();
          }
          customerScannerRef.current.clear();
        } catch {
          // ignore
        }
        customerScannerRef.current = null;
      }

      try {
        const scanner = new Html5Qrcode('customer-qr-reader');
        customerScannerRef.current = scanner;

        // Discover available cameras
        let targetCamera: any = { facingMode: 'environment' };
        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            const backCam = devices.find((d) =>
              /back|rear|environment|mbrapa|prapa/i.test(d.label)
            );
            if (backCam) {
              targetCamera = backCam.id;
            } else {
              // If desktop webcam or only 1 camera, use it directly
              targetCamera = devices[0].id;
            }
          }
        } catch (enumErr) {
          console.warn('Could not enumerate cameras, will use facingMode constraints:', enumErr);
        }

        if (!isMounted) return;

        const qrConfig = { fps: 15 };

        const onScanSuccess = async (decodedText: string) => {
          if (!isMounted) return;
          try {
            if (scanner.isScanning) {
              await scanner.stop();
            }
          } catch (err) {
            console.warn('Error stopping scanner:', err);
          }

          const parsed = parseMPMPayload(decodedText);
          if (parsed.valid && parsed.merchant_handle) {
            const handle = parsed.merchant_handle;
            const isLaguna = handle.toLowerCase().includes('laguna');
            const isCineplexx = handle.toLowerCase().includes('cineplexx');

            setSelectedMerchant({
              name: parsed.name || (isLaguna ? 'Laguna Pizza' : isCineplexx ? 'Cineplexx AL' : handle),
              sub: handle,
              logo: isLaguna
                ? '/assets/logos/laguna logo.png'
                : isCineplexx
                ? '/assets/logos/cineplexx logo.png'
                : '/assets/logos/laguna logo.png',
              color: isCineplexx ? '#E20613' : '#51B0AA',
            });

            // If the MPM QR code contains a dynamic pre-filled amount, populate it
            if (parsed.amount && parsed.amount > 0) {
              setAmountStr(String(parsed.amount));
            }

            setStep('confirm');
          } else {
            // Fallback for raw text
            setSelectedMerchant({
              name: decodedText.replace(/^@/, ''),
              sub: decodedText.startsWith('@') ? decodedText : `@${decodedText}`,
              logo: '/assets/logos/laguna logo.png',
              color: '#51B0AA',
            });
            setStep('confirm');
          }
        };

        // Try preferred camera, then gracefully fallback
        try {
          await scanner.start(targetCamera, qrConfig, onScanSuccess, () => {});
        } catch (primaryErr) {
          console.warn('Primary camera start failed, attempting user camera fallback:', primaryErr);
          if (!isMounted) return;

          try {
            await scanner.start({ facingMode: 'user' }, qrConfig, onScanSuccess, () => {});
          } catch (userErr) {
            console.warn('User camera fallback failed, attempting first camera ID:', userErr);
            if (!isMounted) return;

            const devices = await Html5Qrcode.getCameras().catch(() => []);
            if (devices && devices.length > 0) {
              await scanner.start(devices[0].id, qrConfig, onScanSuccess, () => {});
            } else {
              throw userErr;
            }
          }
        }
      } catch (err: any) {
        console.error('Kamera nuk u hap ose nuk është e disponueshme:', err);
      }
    };

    if (step === 'scanner') {
      setThemeColor('#000000');
      startScanner();
    } else {
      setThemeColor('#FFFFFF');
    }

    return () => {
      isMounted = false;
      setThemeColor('#FFFFFF');
      if (customerScannerRef.current) {
        try {
          if (customerScannerRef.current.isScanning) {
            customerScannerRef.current.stop().catch(() => {});
          }
          customerScannerRef.current.clear();
        } catch {
          // ignore
        }
        customerScannerRef.current = null;
      }
    };
  }, [step]);

  // Keypad actions with amount and decimal controls
  const handleKeypadPress = (val: string) => {
    if (val === 'backspace') {
      setAmountStr((prev) => (prev.length > 1 ? prev.slice(0, -1) : '0'));
      return;
    }

    if (val === '.') {
      if (!amountStr.includes('.')) {
        setAmountStr((prev) => prev + '.');
      }
      return;
    }

    // Limit decimal places
    if (amountStr.includes('.')) {
      const [, decimals] = amountStr.split('.');
      if (decimals && decimals.length >= MAX_DECIMAL_DIGITS) {
        return;
      }
    }

    const nextStr = amountStr === '0' ? val : amountStr + val;
    const nextNumeric = parseFloat(nextStr) || 0;

    // Enforce maximum amount allowed
    if (nextNumeric > maxAllowed) {
      return;
    }

    setAmountStr(nextStr);
  };

  const numericAmount = parseFloat(amountStr) || 0;

  // Execute payment
  const handleExecutePayment = () => {
    const tx = payMerchant(numericAmount, selectedMerchant.name, selectedMerchant.logo, selectedMerchant.sub);
    setLastTx(tx);
    playPaymentChime();
    setStep('confirmation');
  };

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      {/* ============================================================ */}
      {/* SCREEN 1: KEYPAD SCREEN (Image 1 Screen 1 & Image 2 Screen 1) */}
      {/* ============================================================ */}
      {step === 'keypad' && (
        <div className="relative w-full h-full bg-white flex flex-col">
          {/* Top Controls Row */}
          <div className="px-5 pt-4 pb-2 flex justify-between items-center z-10">
            {/* Avatar (Alkid) */}
            <Link href="/" className="w-[42px] h-[42px] rounded-full overflow-hidden border border-black/5 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
              <Image
                src="/assets/images/avatar-alkid.png"
                alt="Alkid"
                width={42}
                height={42}
                className="w-full h-full object-cover"
                priority
              />
            </Link>

            {/* Top Right Action Buttons: QR Button + Search Button */}
            <div className="flex items-center gap-2">
              {/* QR Code Button (triggers 'kodi_im') */}
              <button
                type="button"
                onClick={() => setStep('kodi_im')}
                aria-label="Kodi im QR"
                className="w-[42px] h-[42px] rounded-full bg-white/50 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.06)] border border-black/5 flex items-center justify-center active:scale-95 transition-transform"
              >
                <Image
                  src="/assets/icons/icon_qr code.svg"
                  alt="QR Code"
                  width={20}
                  height={20}
                />
              </button>

              {/* Search Button (triggers 'search') */}
              <button
                type="button"
                onClick={() => setStep('search')}
                aria-label="Search"
                className="w-[42px] h-[42px] rounded-full bg-white/50 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.06)] border border-black/5 flex items-center justify-center active:scale-95 transition-transform"
              >
                <Image
                  src="/assets/icons/icon_search.svg"
                  alt="Search"
                  width={20}
                  height={20}
                />
              </button>
            </div>
          </div>

          {/* Amount Display */}
          <div className="flex-1 flex flex-col items-center justify-center pb-2">
            <span className="text-[68px] font-semibold text-black tracking-tight leading-none">
              {amountStr}
            </span>
            <span className="text-[18px] text-black/40 font-medium mt-1">
              Pirro
            </span>
          </div>

          {/* Numeric Keypad Grid */}
          <div className="w-full max-w-[340px] mx-auto grid grid-cols-3 gap-x-6 gap-y-7 mb-10">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'].map((key) => {
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleKeypadPress(key)}
                  className="h-[56px] flex items-center justify-center text-[28px] font-medium text-black active:scale-90 active:bg-black/5 rounded-full transition-all"
                >
                  {key === 'backspace' ? (
                    <span className="leading-none text-[30px] font-normal select-none">←</span>
                  ) : (
                    key
                  )}
                </button>
              );
            })}
          </div>

          {/* Pay Button & Bottom Spacing */}
          <div className="w-full px-4 flex flex-col items-center pb-[124px]">
            <button
              type="button"
              disabled={numericAmount <= 0 || numericAmount > maxAllowed}
              onClick={() => setStep('search')}
              className={`w-full max-w-[360px] h-[52px] rounded-full text-[16px] font-medium transition-all ${numericAmount > 0 && numericAmount <= maxAllowed
                ? 'bg-black text-white active:scale-[0.98]'
                : 'bg-black/20 text-white/60 cursor-not-allowed'
                }`}
            >
              Paguaj
            </button>
          </div>

          {/* Floating Dock (P active) */}
          <FloatingDock activeTab="paguaj" />
        </div>
      )}

      {/* ============================================================ */}
      {/* SCREEN 2: SEARCH / RECENTS (Image 1 Screen 2)                */}
      {/* ============================================================ */}
      {step === 'search' && (
        <div className="relative w-full h-full bg-white flex flex-col justify-between p-6 pt-5 pb-8">
          <div>
            {/* Close Button Row */}
            <div>
              <button
                type="button"
                onClick={() => setStep('keypad')}
                className="w-[28px] h-[28px] flex items-center justify-center active:scale-90 transition-transform"
                aria-label="Mbyll"
              >
                <Image src="/assets/icons/icon_close.svg" alt="Close" width={18} height={18} />
              </button>
            </div>

            {/* Title: Paguaj {amount} Pirro te */}
            <h1 className="text-[32px] font-semibold text-black leading-tight tracking-tight mt-3">
              Paguaj {numericAmount} Pirro <span className="text-black/35 font-semibold">te</span>
            </h1>

            {/* Search Bar with QR code scanner icon on right */}
            <div className="flex items-center gap-3 mt-4">
              <div className="flex-1 h-[44px] rounded-full bg-[#EEEEEE] px-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5 flex-1">
                  <Image src="/assets/icons/icon_search.svg" alt="Search" width={18} height={18} className="opacity-40" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent text-[15px] font-medium text-black focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="w-[18px] h-[18px] flex items-center justify-center active:scale-90 transition-transform flex-shrink-0"
                  aria-label="Pastro"
                >
                  <Image src="/assets/icons/icon_clear.svg" alt="Pastro" width={18} height={18} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setStep('scanner')}
                aria-label="Scan QR"
                className="p-1 active:scale-90 transition-transform"
              >
                <Image src="/assets/icons/icon_qr code.svg" alt="Scan QR" width={22} height={22} />
              </button>
            </div>

            {/* Recents Section: Të fundit */}
            <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-black mt-6 mb-3">Të fundit</h2>
            <div className="flex flex-col gap-2 -mx-2">
              {/* Item 1: Cineplexx AL */}
              <button
                type="button"
                onClick={() => {
                  setSelectedMerchant({
                    name: 'Cineplexx AL',
                    sub: '@cineplexxal',
                    logo: '/assets/logos/cineplexx logo.png',
                    color: '#E20613',
                  });
                  setStep('confirm');
                }}
                className="flex items-center gap-3.5 px-2 py-1.5 rounded-full hover:bg-[#F5F5F5] active:scale-[0.99] transition-all text-left w-full"
              >
                <div className="w-[44px] h-[44px] rounded-full overflow-hidden relative flex-shrink-0">
                  <Image src="/assets/logos/cineplexx logo.png" alt="Cineplexx" fill className="object-cover" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[16px] font-semibold text-black leading-tight">Cineplexx AL</span>
                  <span className="text-[13px] text-black/50 font-normal mt-0.5">@cineplexxal</span>
                </div>
              </button>

              {/* Item 2: Laguna */}
              <button
                type="button"
                onClick={() => {
                  setSelectedMerchant({
                    name: 'Laguna',
                    sub: '@laguna',
                    logo: '/assets/logos/laguna logo.png',
                    color: '#51B0AA',
                  });
                  setStep('confirm');
                }}
                className="flex items-center gap-3.5 px-2 py-1.5 rounded-full hover:bg-[#F5F5F5] active:scale-[0.99] transition-all text-left w-full"
              >
                <div className="w-[44px] h-[44px] rounded-full overflow-hidden relative flex-shrink-0">
                  <Image src="/assets/logos/laguna logo.png" alt="Laguna" fill className="object-cover" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[16px] font-semibold text-black leading-tight">Laguna</span>
                  <span className="text-[13px] text-black/50 font-normal mt-0.5">@laguna</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SCREEN 3: CAMERA QR SCANNER (Image 1 Screen 3)               */}
      {/* ============================================================ */}
      {step === 'scanner' && (
        <div className="relative w-full h-full overflow-hidden select-none bg-black">
          {/* 1. Full camera feed in the background */}
          <div className="absolute inset-0 z-0 overflow-hidden flex items-center justify-center">
            <div id="customer-qr-reader" className="w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:h-full" />
          </div>

          {/* 2. Gray overlay with transparent viewfinder cut-out window */}
          <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-center justify-between pt-16 pb-8 px-6 overflow-hidden">
            {/* Subtle Back Button */}
            <button
              type="button"
              onClick={async () => {
                if (customerScannerRef.current && customerScannerRef.current.isScanning) {
                  await customerScannerRef.current.stop().catch(() => {});
                }
                setStep('search');
              }}
              className="pointer-events-auto absolute top-6 left-6 w-[36px] h-[36px] rounded-full flex items-center justify-center text-white/60 hover:text-white active:scale-90 transition-all z-20 bg-black/20 backdrop-blur-sm"
              aria-label="Kthehu"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>

            {/* Header Section */}
            <div className="text-center flex flex-col items-center mt-2 z-20">
              <span className="text-[13px] font-semibold text-white tracking-tight drop-shadow">
                Pagesë me kod QR
              </span>
              <h1 className="text-[32px] font-regular text-white tracking-[-0.03em] leading-tight mt-1 drop-shadow">
                Skanoni kodin QR
              </h1>
              <p className="text-[13px] font-regular text-white/80 leading-[1.35] tracking-tight mt-2.5 text-center max-w-[280px] drop-shadow">
                Mund të dërgosh para duke skanuar<br />kodin QR të Pirros në arkë.
              </p>
            </div>

            {/* Clear Viewfinder Window in the middle with giant gray outer shadow */}
            <div
              onClick={async () => {
                if (customerScannerRef.current && customerScannerRef.current.isScanning) {
                  await customerScannerRef.current.stop().catch(() => {});
                }
                setSelectedMerchant({
                  name: 'Laguna',
                  sub: '@laguna',
                  logo: '/assets/logos/laguna logo.png',
                  color: '#51B0AA',
                });
                setStep('confirm');
              }}
              className="pointer-events-auto w-[280px] h-[280px] rounded-[48px] shadow-[0_0_0_9999px_rgba(46,46,46,0.92)] border border-white/20 cursor-pointer active:scale-[0.98] transition-all relative flex items-center justify-center my-auto z-10"
              title="Kliko për të simuluar skanimin e kodit QR të Laguna"
            >
              {/* Corner accent indicators */}
              <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-white/60 rounded-tl-lg pointer-events-none" />
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-white/60 rounded-tr-lg pointer-events-none" />
              <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-white/60 rounded-bl-lg pointer-events-none" />
              <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-white/60 rounded-br-lg pointer-events-none" />
            </div>

            <div className="h-6" />
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SCREEN 4: CONFIRM PAYMENT RECIPIENT (Image 1 Screen 4)       */}
      {/* ============================================================ */}
      {step === 'confirm' && (
        <div className="relative w-full h-full bg-white flex flex-col justify-between p-6 pt-5 pb-8">
          <div>
            {/* Close Button */}
            <div>
              <button
                type="button"
                onClick={() => setStep('search')}
                className="w-[28px] h-[28px] flex items-center justify-center active:scale-90 transition-transform"
                aria-label="Kthehu"
              >
                <Image src="/assets/icons/icon_close.svg" alt="Close" width={18} height={18} />
              </button>
            </div>

            {/* Title: Paguaj {amount} Pirro te */}
            <h1 className="text-[32px] font-semibold text-black leading-tight tracking-tight mt-3">
              Paguaj {numericAmount} Pirro <span className="text-black/35 font-semibold">te</span>
            </h1>

            {/* Selected Merchant Row */}
            <div className="flex items-center gap-3 mt-4">
              <div className="w-[42px] h-[42px] rounded-full overflow-hidden relative flex-shrink-0">
                <Image src={selectedMerchant.logo} alt={selectedMerchant.name} fill className="object-cover" />
              </div>
              <span
                className="text-[32px] font-semibold tracking-tight leading-none"
                style={{ color: selectedMerchant.color || '#51B0AA' }}
              >
                {selectedMerchant.name}
              </span>
            </div>
          </div>

          {/* Bottom Confirm Button: Paguaj */}
          <div className="w-full flex flex-col items-center">
            <button
              type="button"
              onClick={handleExecutePayment}
              className="w-full h-[52px] rounded-full bg-black text-white text-[16px] font-semibold flex items-center justify-center active:scale-[0.98] transition-transform"
            >
              Paguaj
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SCREEN 5: CONFIRMATION SCREEN (Image 1 Screen 5)             */}
      {/* ============================================================ */}
      {step === 'confirmation' && (
        <div className="relative w-full h-full bg-[#E2F2A8] flex flex-col justify-between p-5 pt-4">
          <div>

            {/* Close Button */}
            <div className="pt-2 pb-4">
              <button
                type="button"
                onClick={() => setStep('keypad')}
                className="w-[36px] h-[36px] flex items-center justify-center active:scale-90 transition-transform"
              >
                <Image src="/assets/icons/icon_close.svg" alt="Close" width={18} height={18} />
              </button>
            </div>
          </div>

          {/* Center Checkmark & Headline */}
          <div className="flex flex-col items-center justify-center my-auto px-4">
            <div className="w-[64px] h-[64px] relative">
              <Image src="/assets/icons/accepted.svg" alt="Accepted" width={64} height={64} />
            </div>

            <h1 className="text-[32px] font-semibold text-black text-center leading-[1.15] mt-6 tracking-tight max-w-[280px]">
              Ti dërgove {numericAmount} Pirro te {selectedMerchant.name}
            </h1>
          </div>

          {/* Bottom Action Buttons: Fatura & Përfundo */}
          <div className="flex flex-col gap-3 pb-8 items-center w-full px-4">
            <button
              type="button"
              onClick={() => setStep('receipt')}
              className="w-full max-w-[360px] h-[52px] rounded-full bg-white text-black text-[16px] font-medium flex items-center justify-center active:scale-[0.98] transition-transform"
            >
              Fatura
            </button>
            <button
              type="button"
              onClick={() => {
                setAmountStr('0');
                setStep('keypad');
              }}
              className="w-full max-w-[360px] h-[52px] rounded-full bg-black text-white text-[16px] font-medium flex items-center justify-center active:scale-[0.98] transition-transform"
            >
              Përfundo
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SCREEN 6: FATURA / RECEIPT SCREEN (Image 1 Screen 6)         */}
      {/* ============================================================ */}
      {step === 'receipt' && (
        <div className="relative w-full h-full bg-white flex flex-col p-6 pt-5 pb-10 overflow-y-auto no-scrollbar">
          {/* Close Button */}
          <div>
            <button
              type="button"
              onClick={() => setStep('keypad')}
              aria-label="Mbyll"
              className="w-[36px] h-[36px] rounded-full bg-[#F5F5F5] flex items-center justify-center active:scale-90 transition-transform"
            >
              <Image src="/assets/icons/icon_close.svg" alt="Close" width={14} height={14} />
            </button>
          </div>

          {/* Merchant Info Header (Left Aligned) */}
          <div className="flex flex-col items-start mt-6">
            <div className="w-[52px] h-[52px] rounded-full overflow-hidden relative">
              <Image src={selectedMerchant.logo} alt={selectedMerchant.name} fill className="object-cover" />
            </div>
            <h1 className="text-[32px] font-semibold text-black tracking-tight mt-4 leading-none">
              {selectedMerchant.name}
            </h1>
            <span className="text-[14px] text-black/50 font-normal mt-2">
              Sot, ora 09:41
            </span>
            <div className="flex items-baseline mt-4">
              <span className="text-[44px] font-semibold text-black tracking-tight leading-none">
                {Math.floor(numericAmount) || 150}
              </span>
              <span className="text-[28px] font-semibold text-black/35 tracking-tight ml-0.5">
                .00 P
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="w-full h-[1px] bg-black/10 my-6" />

          {/* Detajet e transaksionit */}
          <div>
            <h2 className="text-[20px] font-semibold text-black mb-5 tracking-tight">
              Detajet e transaksionit
            </h2>

            <div className="flex flex-col gap-6">
              {/* 1. Kryer */}
              <div className="flex items-start gap-4">
                <div className="w-[24px] h-[24px] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Image src="/assets/icons/icon_kryer.svg" alt="Kryer" width={20} height={20} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[15px] font-semibold text-black leading-snug">Kryer</span>
                  <span className="text-[13px] text-black/50 font-normal mt-0.5">Pagesa u dërgua me sukses</span>
                </div>
              </div>

              {/* 2. Pagesa midis */}
              <div className="flex items-start gap-4">
                <div className="w-[24px] h-[24px] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Image src="/assets/icons/icon_pagesa midis.svg" alt="Pagesa midis" width={20} height={20} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[15px] font-semibold text-black leading-snug">Pagesa midis</span>
                  <span className="text-[13px] text-black/50 font-normal mt-0.5">Te: {selectedMerchant.name}</span>
                  <span className="text-[13px] text-black/50 font-normal">Nga: Alkid Shuli</span>
                </div>
              </div>

              {/* 3. Mënyra e pagesës */}
              <div className="flex items-start gap-4">
                <div className="w-[24px] h-[24px] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Image src="/assets/icons/icon_mënyra e pagesës.svg" alt="Mënyra e pagesës" width={20} height={20} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[15px] font-semibold text-black leading-snug">Mënyra e pagesës</span>
                  <span className="text-[13px] text-black/50 font-normal mt-0.5">Balanca në Pirro</span>
                </div>
              </div>

              {/* 4. Numri i transaksionit */}
              <div className="flex items-start gap-4">
                <div className="w-[24px] h-[24px] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Image src="/assets/icons/icon_nr i transaksionit.svg" alt="Numri i transaksionit" width={20} height={20} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[15px] font-semibold text-black leading-snug">Numri i transaksionit</span>
                  <span className="text-[13px] text-black/50 font-normal mt-0.5">
                    {lastTx?.transactionNumber || '87836329437294821'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SCREEN 7: KODI IM QR (CPM MODE - Image 2 Screen 2)           */}
      {/* ============================================================ */}
      {step === 'kodi_im' && (
        <div className="relative w-full h-full bg-white flex flex-col justify-between p-6 pt-10 pb-8">
          <div>
            {/* Close Button */}
            <div>
              <button
                type="button"
                onClick={() => setStep('keypad')}
                aria-label="Mbyll"
                className="w-[36px] h-[36px] rounded-full bg-[#F5F5F5] flex items-center justify-center active:scale-90 transition-transform"
              >
                <Image src="/assets/icons/icon_close.svg" alt="Close" width={14} height={14} />
              </button>
            </div>

            {/* Header: Kodi im + Balanca */}
            <div className="flex items-end justify-between mt-5">
              <h1 className="text-[32px] font-semibold text-black tracking-tight leading-none">
                Kodi im
              </h1>
              <div className="text-right">
                <span className="text-[14px] text-black/50 font-normal block leading-tight">Balanca:</span>
                <span className="text-[15px] font-semibold text-black block mt-1 leading-none">
                  {formatPirro(balance)} P
                </span>
              </div>
            </div>
          </div>

          {/* Centered Large QR Code with Pirro Emblem */}
          <div className="flex flex-col items-center justify-center my-auto">
            <div className="relative w-[300px] h-[300px] rounded-[36px] border border-black/10 bg-white p-5 flex items-center justify-center">
              <QRCodeSVG
                value={qrPayload || 'loading'}
                size={230}
                level="H"
                includeMargin={false}
                imageSettings={{
                  src: '/assets/logos/Pirro-logo-qrcode.svg',
                  height: 52,
                  width: 52,
                  excavate: true,
                }}
              />
              {/* Center Pirro Emblem Badge */}
              <div className="absolute inset-0 m-auto w-[52px] h-[52px] rounded-[13px] overflow-hidden flex items-center justify-center pointer-events-none border border-black/10 bg-white">
                <Image
                  src="/assets/logos/Pirro-logo-qrcode.svg"
                  alt="Pirro Logo"
                  width={52}
                  height={52}
                  className="w-full h-full object-contain"
                  priority
                />
              </div>
            </div>

            {/* Countdown Badge */}
            <div className="w-[36px] h-[36px] rounded-full bg-[#E5E5EA] flex items-center justify-center text-[13px] font-medium text-black/70 mt-12">
              {qrCountdown}
            </div>

            {/* Guidance Copy */}
            <p className="text-[13px] text-black/50 text-center max-w-[270px] mx-auto mt-12 leading-tight font-normal">
              Tregojani këtë kod arkëtarit për ta skanuar. Pagesa kryhet në çast pa nevojë për konfirmim manual.
            </p>
          </div>

          {/* Bottom Spacing */}
          <div className="pb-4" />
        </div>
      )}
    </div>
  );
}
