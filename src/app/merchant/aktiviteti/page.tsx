'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import MerchantDock from '@/components/merchant/MerchantDock';
import { supabase } from '@/lib/supabase';

interface PaymentTx {
    id: string;
    sender_handle: string;
    amount_p: number;
    reference_code: string;
    created_at: string;
}

export default function MerchantAktivitetiPage() {
    const [payments, setPayments] = useState<PaymentTx[]>([]);
    const [totalXhiro, setTotalXhiro] = useState(0);
    const [selectedTx, setSelectedTx] = useState<PaymentTx | null>(null);

    // Load Laguna's payments from Supabase
    const loadPayments = async () => {
        const { data } = await supabase
            .from('transactions')
            .select('*')
            .eq('receiver_handle', '@laguna')
            .order('created_at', { ascending: false });

        if (data) {
            setPayments(data);
            const sum = data.reduce((acc, curr) => acc + curr.amount_p, 0);
            setTotalXhiro(sum);
        }
    };

    useEffect(() => {
        loadPayments();

        // Listen for new payments in real-time
        const channel = supabase
            .channel('merchant_realtime_tx')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'transactions',
                    filter: 'receiver_handle=eq.@laguna',
                },
                () => {
                    loadPayments(); // Reload list instantly when a customer pays
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const totalCount = payments.length;
    const posSavings = Math.round(totalXhiro * 0.025); // 2.5% avoided POS fee

    return (
        <div className="relative w-full h-full bg-white overflow-hidden flex flex-col justify-between select-none">
            {/* ============================================================ */}
            {/* 1. PINNED UPPER SECTION (Header + Live Metrics Block)        */}
            {/* ============================================================ */}
            <div className="relative z-10 flex-shrink-0 bg-white">
                {/* 1. Header (Logo + Search) */}
                <header className="pt-4 px-5 pb-2 flex justify-between items-center">
                    <div className="w-[42px] h-[42px] rounded-full overflow-hidden border border-black/5 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
                        <Image
                            src="/assets/logos/laguna logo.png"
                            alt="Laguna Pizza"
                            width={42}
                            height={42}
                            className="w-full h-full object-cover"
                            priority
                        />
                    </div>
                    <button
                        type="button"
                        aria-label="Kërko"
                        className="w-[42px] h-[42px] rounded-full bg-white/50 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.06)] border border-black/5 flex items-center justify-center active:scale-95 transition-transform"
                    >
                        <Image src="/assets/icons/icon_search.svg" alt="Search" width={20} height={20} />
                    </button>
                </header>

                {/* 2. Live Metrics Block */}
                <section className="px-5 mt-4 pb-3 flex justify-between items-start">
                    <div className="flex flex-col">
                        <span className="text-[16px] font-medium text-black">Xhiroja me Pirro</span>
                        <span className="text-[32px] font-bold text-black tracking-tight leading-tight mt-0.5">
                            {totalXhiro.toLocaleString('en-US')} P
                        </span>
                        <span className="text-[12px] text-black/60 font-medium mt-1">
                            Sot • {totalCount} pagesa
                        </span>
                    </div>

                    {/* 2.5% Avoided POS Fee */}
                    <div className="text-right text-[#4D4D4D]/60">
                        <span className="text-[13px] text-black/60 block">Kursimi:</span>
                        <span className="text-[18px] font-bold">
                            +{posSavings.toLocaleString('en-US')} L
                        </span>
                    </div>
                </section>
            </div>

            {/* ============================================================ */}
            {/* 2. SCROLLABLE TRANSACTION LIST                               */}
            {/* ============================================================ */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 pt-3 pb-[110px] no-scrollbar">
                {/* Section Title */}
                <div className="mb-3">
                    <h2 className="text-[22px] font-medium tracking-[-0.02em] text-black leading-tight">
                        Pagesat e fundit
                    </h2>
                </div>

                {/* 3. Live Transactions Stream */}
                <main className="flex flex-col gap-4">
                    {payments.length === 0 ? (
                        <p className="text-sm text-black/40 py-8 text-center">Nuk ka pagesa të kryera ende sot.</p>
                    ) : (
                        payments.map((p) => {
                            const timeFormatted = new Date(p.created_at).toLocaleTimeString('sq-AL', {
                                hour: '2-digit',
                                minute: '2-digit',
                            });

                            return (
                                <div
                                    key={p.id}
                                    onClick={() => setSelectedTx(p)}
                                    className="w-full flex justify-between items-center py-2 cursor-pointer select-none active:opacity-75 transition-opacity"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-[44px] h-[44px] rounded-full bg-gradient-to-br from-[#CBEE8F] to-[#E0E59B] flex items-center justify-center flex-shrink-0 ">
                                            <svg
                                                width="20"
                                                height="20"
                                                viewBox="0 0 28 28"
                                                fill="none"
                                                xmlns="http://www.w3.org/2000/svg"
                                            >
                                                <path
                                                    d="M17.1382 4.72754H5.13818V7.72754H8.13818V24.2724H11.1382V7.72754H14.1382V24.2724H17.1382V16.7275C18.7295 16.7275 20.2556 16.0954 21.3808 14.9702C22.506 13.845 23.1382 12.3188 23.1382 10.7275C23.1382 9.13624 22.506 7.61012 21.3808 6.4849C20.2556 5.35968 18.7295 4.72754 17.1382 4.72754Z"
                                                    fill="white"
                                                />
                                            </svg>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[14px] font-semibold text-black leading-tight">
                                                Pagesë nga {p.sender_handle}
                                            </span>
                                            <span className="text-[12px] text-black/60 mt-0.5">
                                                Ref: {p.reference_code}
                                            </span>
                                            <span className="text-[11px] text-black/40">
                                                Sot, {timeFormatted}
                                            </span>
                                        </div>
                                    </div>

                                    <span className="text-[16px] font-bold text-black">
                                        + {p.amount_p.toLocaleString('en-US')} P
                                    </span>
                                </div>
                            );
                        })
                    )}
                </main>
            </div>

            {/* Transaction Details Modal */}
            {selectedTx && (
                <div className="absolute inset-0 z-[60] bg-white flex flex-col p-6 pt-5 pb-10 overflow-y-auto no-scrollbar animate-in fade-in duration-200">
                    <div>
                        <button
                            type="button"
                            onClick={() => setSelectedTx(null)}
                            aria-label="Mbyll"
                            className="w-[36px] h-[36px] rounded-full bg-[#F5F5F5] flex items-center justify-center active:scale-90 transition-transform"
                        >
                            <Image src="/assets/icons/icon_close.svg" alt="Close" width={14} height={14} />
                        </button>
                    </div>

                    <div className="flex flex-col items-start mt-6">
                        <h1 className="text-[32px] font-semibold text-black tracking-tight leading-none">
                            Pagesë nga {selectedTx.sender_handle}
                        </h1>
                        <span className="text-[14px] text-black/50 font-normal mt-2">
                            {new Date(selectedTx.created_at).toLocaleDateString('sq-AL', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                            })}
                            , ora{' '}
                            {new Date(selectedTx.created_at).toLocaleTimeString('sq-AL', {
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </span>
                        <div className="flex items-baseline mt-4">
                            <span className="text-[44px] font-semibold text-black tracking-tight leading-none">
                                +{selectedTx.amount_p.toLocaleString('en-US')}
                            </span>
                            <span className="text-[28px] font-semibold text-black/35 tracking-tight ml-1">
                                P
                            </span>
                        </div>
                    </div>

                    <div className="w-full h-[1px] bg-black/10 my-6" />

                    <div>
                        <h2 className="text-[20px] font-semibold text-black mb-5 tracking-tight">
                            Detajet e transaksionit
                        </h2>

                        <div className="flex flex-col gap-6">
                            <div className="flex items-start gap-4">
                                <div className="w-[24px] h-[24px] flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <Image src="/assets/icons/icon_kryer.svg" alt="Status" width={20} height={20} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[15px] font-semibold text-black leading-snug">Kryer</span>
                                    <span className="text-[13px] text-black/50 font-normal mt-0.5">
                                        Transaksioni u krye me sukses
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="w-[24px] h-[24px] flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <Image
                                        src="/assets/icons/icon_mënyra e pagesës.svg"
                                        alt="Mënyra"
                                        width={20}
                                        height={20}
                                    />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[15px] font-semibold text-black leading-snug">Mënyra</span>
                                    <span className="text-[13px] text-black/50 font-normal mt-0.5">
                                        Skanim me Pirro QR
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="w-[24px] h-[24px] flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <Image
                                        src="/assets/icons/icon_nr i transaksionit.svg"
                                        alt="ID"
                                        width={20}
                                        height={20}
                                    />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[15px] font-semibold text-black leading-snug">
                                        Numri i transaksionit
                                    </span>
                                    <span className="text-[13px] text-black/50 font-normal mt-0.5">
                                        {selectedTx.reference_code}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Scrim & Merchant Dock */}
            <div className="pointer-events-none absolute bottom-0 left-0 w-full h-[90px] z-30 bg-gradient-to-t from-white via-white/80 to-transparent" />
            <MerchantDock activeTab="aktiviteti" />
        </div>
    );
}