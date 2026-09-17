'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';

type MerchantTabType = 'arka' | 'aktiviteti';

interface MerchantDockProps {
    activeTab: MerchantTabType;
}

// Persist tab position across page navigations
let previousMerchantTab: MerchantTabType = 'arka';

const MERCHANT_TAB_INDEX: Record<MerchantTabType, number> = {
    arka: 0,
    aktiviteti: 1,
};

export default function MerchantDock({ activeTab }: MerchantDockProps) {
    const fromIndex = MERCHANT_TAB_INDEX[previousMerchantTab] ?? MERCHANT_TAB_INDEX[activeTab];
    const toIndex = MERCHANT_TAB_INDEX[activeTab];

    useEffect(() => {
        previousMerchantTab = activeTab;
    }, [activeTab]);

    return (
        <nav className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 w-[184px] h-[60px] rounded-full bg-white/95 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.06)] border border-black/5 p-1 pointer-events-auto select-none">
            {/* Inner Grid: 2 equal columns */}
            <div className="relative w-full h-full grid grid-cols-2 items-center">
                {/* Smooth sliding pill indicator */}
                <motion.div
                    className="absolute top-0 left-0 w-1/2 h-full rounded-full bg-[#EBEBEB] pointer-events-none"
                    initial={{ x: `${fromIndex * 100}%` }}
                    animate={{ x: `${toIndex * 100}%` }}
                    transition={{
                        type: 'spring',
                        stiffness: 450,
                        damping: 35,
                        mass: 0.8,
                    }}
                />

                {/* 1. Arka Tab */}
                <Link
                    href="/merchant"
                    aria-label="Arka"
                    className="relative z-10 w-full h-full rounded-full flex items-center justify-center active:scale-95 transition-transform"
                >
                    <Image
                        src="/assets/icons/icon_arka.svg"
                        alt="Arka"
                        width={24}
                        height={24}
                        className={`transition-opacity duration-200 ${
                            activeTab === 'arka' ? 'opacity-100 brightness-0' : 'opacity-40'
                        }`}
                    />
                </Link>

                {/* 2. Aktiviteti Tab */}
                <Link
                    href="/merchant/aktiviteti"
                    aria-label="Aktiviteti"
                    className="relative z-10 w-full h-full rounded-full flex items-center justify-center active:scale-95 transition-transform"
                >
                    <Image
                        src="/assets/icons/icon_aktiviteti.svg"
                        alt="Aktiviteti"
                        width={24}
                        height={24}
                        className={`transition-opacity duration-200 ${
                            activeTab === 'aktiviteti' ? 'opacity-100 brightness-0' : 'opacity-40'
                        }`}
                    />
                </Link>
            </div>
        </nav>
    );
}