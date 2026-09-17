'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import MerchantDock from '@/components/merchant/MerchantDock';
import { supabase } from '@/lib/supabase';
import { parseCPMPayload, generateEMVCoMPM, generateMPMDeepLink } from '@/lib/qr';
import { Html5Qrcode } from 'html5-qrcode';
import { QRCodeSVG } from 'qrcode.react';
import { setThemeColor } from '@/components/shared/ThemeColorManager';
import { playPaymentChime } from '@/lib/sound';

export default function MerchantArkaPage() {
    const [amount, setAmount] = useState('0');
    const [viewState, setViewState] = useState<'keypad' | 'scanning' | 'success' | 'mpm_qr'>('keypad');
    const [mpmFormat, setMpmFormat] = useState<'emvco' | 'uri'>('emvco');

    // Chime of confirmation when transaction completes successfully
    useEffect(() => {
        if (viewState === 'success') {
            playPaymentChime();
        }
    }, [viewState]);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [lastPayerHandle, setLastPayerHandle] = useState<string>('');
    const scannerRef = useRef<Html5Qrcode | null>(null);

    // Listen for live payments to @laguna so the green success sheet pops up automatically
    useEffect(() => {
        const channel = supabase
            .channel('merchant_arka_realtime')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'transactions',
                    filter: 'receiver_handle=eq.@laguna',
                },
                (payload: any) => {
                    if (scannerRef.current && scannerRef.current.isScanning) {
                        scannerRef.current.stop().catch(() => { });
                    }
                    const newTx = payload?.new;
                    if (newTx?.sender_handle) {
                        setLastPayerHandle(newTx.sender_handle);
                    }
                    if (newTx?.amount_p) {
                        setAmount(String(newTx.amount_p));
                    }
                    setViewState('success');
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Keypad Handlers
    const handleDigit = (digit: string) => {
        if (amount === '0' && digit !== '.') {
            setAmount(digit);
            return;
        }
        if (digit === '.') {
            if (!amount.includes('.')) {
                setAmount(amount + '.');
            }
            return;
        }
        if (amount.includes('.')) {
            const [, decimals] = amount.split('.');
            if (decimals && decimals.length >= 2) return;
        }
        if (amount.length >= 8) return;
        setAmount(amount + digit);
    };

    const handleBackspace = () => {
        if (amount.length <= 1) setAmount('0');
        else setAmount(amount.slice(0, -1));
    };

    const numericAmount = parseFloat(amount) || 0;

    // ============================================================
    // CAMERA SCANNER ENGINE (html5-qrcode)
    // ============================================================
    useEffect(() => {
        let isMounted = true;

        const startScanner = async () => {
            if (viewState !== 'scanning') return;

            // Poll up to 10 times (500ms max) to ensure the DOM element is mounted
            let elem = document.getElementById('qr-reader');
            let retries = 0;
            while (!elem && retries < 10) {
                await new Promise((resolve) => setTimeout(resolve, 50));
                elem = document.getElementById('qr-reader');
                retries++;
            }

            if (!elem || !isMounted) return;

            // Clean up existing scanner instance if any
            if (scannerRef.current) {
                try {
                    if (scannerRef.current.isScanning) {
                        await scannerRef.current.stop();
                    }
                    scannerRef.current.clear();
                } catch {
                    // ignore
                }
                scannerRef.current = null;
            }

            try {
                const scanner = new Html5Qrcode('qr-reader');
                scannerRef.current = scanner;

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
                    // 1. QR Detected! Stop camera immediately
                    try {
                        if (scanner.isScanning) {
                            await scanner.stop();
                        }
                    } catch (err) {
                        console.warn('Error stopping scanner on detect:', err);
                    }

                    // 2. Validate payload
                    const result = parseCPMPayload(decodedText);
                    if (!result.valid || !result.handle) {
                        setErrorMessage(result.error || 'Kod i pavlefshëm');
                        return;
                    }

                    // 3. Execute atomic payment in Supabase using the SCANNED handle
                    const chargeAmount = Number(amount);
                    const { data, error } = await supabase.rpc('execute_pirro_payment', {
                        p_sender_handle: result.handle,
                        p_receiver_handle: '@laguna',
                        p_amount_p: chargeAmount,
                    });

                    if (error || !data?.success) {
                        setErrorMessage(data?.error || error?.message || 'Pagesa dështoi');
                        setViewState('keypad');
                    } else {
                        setLastPayerHandle(result.handle);
                        setViewState('success');
                    }
                };

                // Try preferred camera, then gracefully fallback
                try {
                    await scanner.start(targetCamera, qrConfig, onScanSuccess, () => { });
                } catch (primaryErr) {
                    console.warn('Primary camera start failed, attempting user camera fallback:', primaryErr);
                    if (!isMounted) return;

                    try {
                        await scanner.start({ facingMode: 'user' }, qrConfig, onScanSuccess, () => { });
                    } catch (userErr) {
                        console.warn('User camera fallback failed, attempting first camera ID:', userErr);
                        if (!isMounted) return;

                        const devices = await Html5Qrcode.getCameras().catch(() => []);
                        if (devices && devices.length > 0) {
                            await scanner.start(devices[0].id, qrConfig, onScanSuccess, () => { });
                        } else {
                            throw userErr;
                        }
                    }
                }
            } catch (err: any) {
                console.error('Kamera nuk u hap ose nuk është e disponueshme:', err);
                if (isMounted) {
                    setErrorMessage('Kamera nuk mund të hapej. Kontrolloni lejet e shfletuesit.');
                }
            }
        };

        if (viewState === 'scanning') {
            setThemeColor('#000000');
            startScanner();
        } else {
            setThemeColor('#FFFFFF');
        }

        return () => {
            isMounted = false;
            setThemeColor('#FFFFFF');
            if (scannerRef.current) {
                try {
                    if (scannerRef.current.isScanning) {
                        scannerRef.current.stop().catch(() => { });
                    }
                    scannerRef.current.clear();
                } catch {
                    // ignore
                }
                scannerRef.current = null;
            }
        };
    }, [viewState, amount]);

    const handleCompletePayment = () => {
        setViewState('keypad');
        setAmount('0');
        setErrorMessage(null);
    };

    return (
        <div className="relative w-full h-full bg-white flex flex-col overflow-hidden select-none">
            {/* ============================================================ */}
            {/* 1. TOP HEADER (Laguna Pizza Logo only)                       */}
            {/* ============================================================ */}
            <header className="relative z-10 pt-4 px-5 pb-2 flex justify-between items-center">
                <Link
                    href="/"
                    className="w-[42px] h-[42px] rounded-full overflow-hidden border border-black/5 shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
                >
                    <Image
                        src="/assets/logos/laguna logo.png"
                        alt="Laguna Pizza"
                        width={42}
                        height={42}
                        className="w-full h-full object-cover"
                        priority
                    />
                </Link>

                <div className="flex items-center gap-2">
                    {errorMessage && (
                        <span className="text-[12px] bg-red-100 text-red-700 px-3 py-1 rounded-full">
                            {errorMessage}
                        </span>
                    )}

                    <button
                        type="button"
                        onClick={() => setViewState('mpm_qr')}
                        aria-label="Kodi QR i Dyqanit"
                        className="w-[42px] h-[42px] rounded-full bg-white/50 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.06)] border border-black/5 flex items-center justify-center active:scale-95 transition-transform"
                    >
                        <Image
                            src="/assets/icons/icon_qr code.svg"
                            alt="Kodi QR i Dyqanit"
                            width={20}
                            height={20}
                            className="opacity-90"
                        />
                    </button>
                </div>
            </header>

            {/* ============================================================ */}
            {/* 2. AMOUNT DISPLAY                                            */}
            {/* ============================================================ */}
            <div className="flex-1 flex flex-col items-center justify-center pb-2">
                <span className="text-[68px] font-semibold text-black tracking-tight leading-none">
                    {amount}
                </span>
                <span className="text-[18px] text-black/40 font-medium mt-1">
                    Pirro
                </span>
            </div>

            {/* ============================================================ */}
            {/* 3. NUMERIC KEYPAD GRID (Increased horizontal & vertical gap) */}
            {/* ============================================================ */}
            <div className="w-full max-w-[340px] mx-auto grid grid-cols-3 gap-x-6 gap-y-7 mb-10">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'].map((key) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => (key === 'backspace' ? handleBackspace() : handleDigit(key))}
                        className="h-[56px] flex items-center justify-center text-[28px] font-medium text-black active:scale-90 active:bg-black/5 rounded-full transition-all"
                    >
                        {key === 'backspace' ? (
                            <span className="leading-none text-[30px] font-normal select-none">←</span>
                        ) : (
                            key
                        )}
                    </button>
                ))}
            </div>

            {/* ============================================================ */}
            {/* 4. PRIMARY ACTION CTA: Arkëto (Positioned higher on Y axis)  */}
            {/* ============================================================ */}
            <div className="w-full px-4 flex flex-col items-center pb-[124px]">
                <button
                    type="button"
                    disabled={numericAmount <= 0}
                    onClick={() => {
                        if (numericAmount <= 0) return;
                        setErrorMessage(null);
                        setViewState('scanning');
                    }}
                    className={`w-full max-w-[360px] h-[52px] rounded-full text-[16px] font-medium transition-all ${numericAmount > 0
                        ? 'bg-black text-white active:scale-[0.98]'
                        : 'bg-black/20 text-white/60 cursor-not-allowed'
                        }`}
                >
                    Arkëto
                </button>
            </div>

            {/* Floating 2-Tab Dock (Hidden during scanning & success overlay) */}
            {viewState === 'keypad' && <MerchantDock activeTab="arka" />}

            {/* ============================================================ */}
            {/* OVERLAY 1: CAMERA QR SCANNER (No dock, clean full view)      */}
            {/* ============================================================ */}
            <AnimatePresence>
                {viewState === 'scanning' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 bg-black overflow-hidden select-none"
                    >
                        {/* 1. Full camera feed in the background */}
                        <div className="absolute inset-0 z-0 overflow-hidden flex items-center justify-center">
                            <div id="qr-reader" className="w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:h-full" />
                        </div>

                        {/* 2. Gray overlay with transparent viewfinder cut-out window */}
                        <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-center justify-between pt-16 pb-8 px-6 overflow-hidden">
                            {/* Subtle Back Button */}
                            <button
                                type="button"
                                onClick={async () => {
                                    if (scannerRef.current && scannerRef.current.isScanning) {
                                        await scannerRef.current.stop().catch(() => { });
                                    }
                                    setViewState('keypad');
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
                                    Arkëtim me kod QR
                                </span>
                                <h1 className="text-[32px] font-regular text-white tracking-[-0.03em] leading-tight mt-1 drop-shadow">
                                    Skanoni kodin QR
                                </h1>
                                <p className="text-[13px] font-regular text-white/80 leading-[1.35] tracking-tight mt-2.5 text-center max-w-[280px] drop-shadow">
                                    Mund të arkëtoni pagesën duke skanuar<br />kodin QR të Pirros në pajisjen e klientit.
                                </p>
                            </div>

                            {/* Clear Viewfinder Window in the middle with giant gray outer shadow */}
                            <div
                                onClick={async () => {
                                    // Fallback simulation when clicking the viewfinder box directly
                                    if (scannerRef.current && scannerRef.current.isScanning) {
                                        await scannerRef.current.stop().catch(() => { });
                                    }
                                    const { data, error } = await supabase.rpc('execute_pirro_payment', {
                                        p_sender_handle: '@alkid',
                                        p_receiver_handle: '@laguna',
                                        p_amount_p: Number(amount),
                                    });
                                    if (data?.success) {
                                        setLastPayerHandle('@alkid');
                                        setViewState('success');
                                    } else {
                                        setErrorMessage(data?.error || error?.message || 'Pagesa dështoi');
                                        setViewState('keypad');
                                    }
                                }}
                                className="pointer-events-auto w-[280px] h-[280px] rounded-[48px] shadow-[0_0_0_9999px_rgba(46,46,46,0.92)] border border-white/20 cursor-pointer active:scale-[0.98] transition-all relative flex items-center justify-center my-auto z-10"
                                title="Kliko për të simuluar skanimin e suksesshëm"
                            />

                            <div className="h-6" />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ============================================================ */}
            {/* OVERLAY 2: SUCCESS SHEET OVER ARKA UI WITH GRAY BACKDROP     */}
            {/* ============================================================ */}
            <AnimatePresence>
                {viewState === 'success' && (
                    <>
                        {/* Dimmed Gray Backdrop Overlay */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={handleCompletePayment}
                            className="absolute inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
                        />

                        {/* Bottom Sheet Popup */}
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                            className="absolute bottom-0 left-0 w-full h-[400px] z-[60] rounded-t-[40px] bg-gradient-to-b from-[#CBEE8F] to-[#E0E59B] p-6 flex flex-col justify-between items-center shadow-2xl"
                        >
                            {/* White Checkmark Icon */}
                            <div className="w-[64px] h-[64px] relative mt-4">
                                <Image
                                    src="/assets/icons/accepted.svg"
                                    alt="Accepted"
                                    width={64}
                                    height={64}
                                />
                            </div>

                            {/* 32pt Headline (Semibold) */}
                            <div className="text-center">
                                <h2 className="text-[32px] font-semibold text-black text-center leading-tight">
                                    Pagesa u arkëtua
                                    <br />
                                    me sukses.
                                </h2>
                                {lastPayerHandle && (
                                    <span className="text-[13px] text-black/60 font-medium mt-1 block">
                                        Arkëtuar nga {lastPayerHandle} • {Number(amount).toLocaleString('en-US')} P
                                    </span>
                                )}
                            </div>

                            {/* Përfundo CTA */}
                            <button
                                type="button"
                                onClick={handleCompletePayment}
                                className="w-full max-w-[360px] h-[52px] rounded-full bg-black text-white text-[16px] font-medium flex items-center justify-center active:scale-[0.98] transition-transform"
                            >
                                Përfundo
                            </button>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ============================================================ */}
            {/* OVERLAY 3: MPM QR SCREEN (MERCHANT-PRESENTED MODE)           */}
            {/* ============================================================ */}
            <AnimatePresence>
                {viewState === 'mpm_qr' && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.18 }}
                        className="absolute inset-0 z-50 bg-white flex flex-col justify-between p-6 pt-10 pb-8 select-none"
                    >
                        <div>
                            {/* Close Button */}
                            <div>
                                <button
                                    type="button"
                                    onClick={() => setViewState('keypad')}
                                    aria-label="Mbyll"
                                    className="w-[36px] h-[36px] rounded-full bg-[#F5F5F5] flex items-center justify-center active:scale-90 transition-transform"
                                >
                                    <Image src="/assets/icons/icon_close.svg" alt="Close" width={14} height={14} />
                                </button>
                            </div>

                            {/* Header: Kodi i dyqanit + Llogaria */}
                            <div className="flex items-end justify-between mt-5">
                                <h1 className="text-[32px] font-semibold text-black tracking-tight leading-none">
                                    Kodi i dyqanit
                                </h1>
                                <div className="text-right">
                                    <span className="text-[14px] text-black/50 font-normal block leading-tight">Llogaria:</span>
                                    <span className="text-[15px] font-semibold text-black block mt-1 leading-none">
                                        @laguna
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Centered Large QR Code Section */}
                        <div className="flex flex-col items-center justify-center my-auto">
                            {/* Centered Large QR Code (NO DROP SHADOWS) */}
                            <div className="relative w-[300px] h-[300px] rounded-[36px] border border-black/10 bg-white p-5 flex items-center justify-center">
                                <QRCodeSVG
                                    value={
                                        mpmFormat === 'emvco'
                                            ? generateEMVCoMPM('@laguna', 'Laguna Pizza', 'Tirane', numericAmount > 0 ? numericAmount : null)
                                            : generateMPMDeepLink('@laguna', 'Laguna Pizza', 'Tirane', numericAmount > 0 ? numericAmount : null)
                                    }
                                    size={230}
                                    level="H"
                                    includeMargin={false}
                                    imageSettings={{
                                        src: '/assets/logos/laguna logo.png',
                                        height: 52,
                                        width: 52,
                                        excavate: true,
                                    }}
                                />
                                {/* Center Laguna Badge (Clean border, NO drop shadows) */}
                                <div className="absolute inset-0 m-auto w-[52px] h-[52px] rounded-[14px] overflow-hidden flex items-center justify-center pointer-events-none bg-white border border-black/10">
                                    <Image
                                        src="/assets/logos/laguna logo.png"
                                        alt="Laguna"
                                        width={52}
                                        height={52}
                                        className="w-full h-full object-cover"
                                        priority
                                    />
                                </div>
                            </div>

                            {/* Format Toggle Pill: Placed where the badge was, below the QR code (NO shadows) */}
                            <div className="flex bg-[#F5F5F5] p-1 rounded-full w-fit mx-auto mt-10">
                                <button
                                    type="button"
                                    onClick={() => setMpmFormat('emvco')}
                                    className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-all ${mpmFormat === 'emvco'
                                        ? 'bg-white text-black font-semibold'
                                        : 'text-black/50 hover:text-black'
                                        }`}
                                >
                                    EMVCo Standard
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMpmFormat('uri')}
                                    className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-all ${mpmFormat === 'uri'
                                        ? 'bg-white text-black font-semibold'
                                        : 'text-black/50 hover:text-black'
                                        }`}
                                >
                                    URI Deep-link
                                </button>
                            </div>

                            {/* Subtitle text brought higher, directly under the toggle */}
                            <p className="text-[13px] text-black/50 text-center max-w-[270px] mx-auto mt-10 leading-tight font-normal">
                                Tregojani këtë kod blerësit për ta skanuar. Pagesa kryhet në çast në llogarinë tuaj.
                            </p>
                        </div>

                        {/* Bottom Spacing */}
                        <div className="pb-4" />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}