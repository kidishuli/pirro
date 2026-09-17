'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

type TabType = 'portofoli' | 'paguaj' | 'aktiviteti';

interface FloatingDockProps {
    activeTab: TabType;
}

// Persists the previous tab index across client-side page navigations in Next.js
let previousTab: TabType = 'portofoli';

const TAB_INDEX: Record<TabType, number> = {
    portofoli: 0,
    paguaj: 1,
    aktiviteti: 2,
};

export default function FloatingDock({ activeTab }: FloatingDockProps) {
    const fromIndex = TAB_INDEX[previousTab] ?? TAB_INDEX[activeTab];
    const toIndex = TAB_INDEX[activeTab];

    useEffect(() => {
        previousTab = activeTab;
    }, [activeTab]);

    return (
        <nav className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 w-[270px] h-[60px] rounded-full bg-white/95 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.06)] border border-black/5 p-1 pointer-events-auto select-none">
            {/* Inner Grid: perfectly divides the 262px inner area into 3 equal columns */}
            <div className="relative w-full h-full grid grid-cols-3 items-center">
                {/* Smooth animated active pill indicator - perfectly aligned to 1/3 grid intervals */}
                <motion.div
                    className="absolute top-0 left-0 w-1/3 h-full rounded-full bg-[#EBEBEB] pointer-events-none"
                    initial={{ x: `${fromIndex * 100}%` }}
                    animate={{ x: `${toIndex * 100}%` }}
                    transition={{
                        type: 'spring',
                        stiffness: 450,
                        damping: 35,
                        mass: 0.8,
                    }}
                />

                {/* 1. Portofoli Tab */}
                <Link
                    href="/"
                    aria-label="Portofoli"
                    className="relative z-10 w-full h-full rounded-full flex items-center justify-center active:scale-95 transition-transform"
                >
                    <svg
                        width="28"
                        height="28"
                        viewBox="0 0 28 28"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className={`transition-colors duration-200 ${
                            activeTab === 'portofoli' ? 'text-black' : 'text-[#4D4D4D]'
                        }`}
                    >
                        <path d="M7.35791 12.583V23.3132" stroke="currentColor" strokeWidth="3" />
                        <path d="M13.8848 12.583V23.3132" stroke="currentColor" strokeWidth="3" />
                        <path d="M20.4116 12.583V23.3132" stroke="currentColor" strokeWidth="3" />
                        <path
                            d="M2.79346 11.1733L13.5446 5.21139C13.6943 5.1284 13.876 5.12771 14.0262 5.20956L24.9763 11.1733"
                            stroke="currentColor"
                            strokeWidth="3"
                        />
                    </svg>
                </Link>

                {/* 2. Paguaj Tab */}
                <Link
                    href="/paguaj"
                    aria-label="Paguaj"
                    className="relative z-10 w-full h-full rounded-full flex items-center justify-center active:scale-95 transition-transform"
                >
                    <svg
                        width="28"
                        height="28"
                        viewBox="0 0 28 28"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className={`transition-colors duration-200 ${
                            activeTab === 'paguaj' ? 'text-black' : 'text-[#4D4D4D]'
                        }`}
                    >
                        <path
                            d="M17.1382 4.72754H5.13818V7.72754H8.13818V24.2724H11.1382V7.72754H14.1382V24.2724H17.1382V16.7275C18.7295 16.7275 20.2556 16.0954 21.3808 14.9702C22.506 13.845 23.1382 12.3188 23.1382 10.7275C23.1382 9.13624 22.506 7.61012 21.3808 6.4849C20.2556 5.35968 18.7295 4.72754 17.1382 4.72754Z"
                            fill="currentColor"
                        />
                    </svg>
                </Link>

                {/* 3. Aktiviteti Tab */}
                <Link
                    href="/aktiviteti"
                    aria-label="Aktiviteti"
                    className="relative z-10 w-full h-full rounded-full flex items-center justify-center active:scale-95 transition-transform"
                >
                    <svg
                        width="28"
                        height="28"
                        viewBox="0 0 28 28"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className={`transition-colors duration-200 ${
                            activeTab === 'aktiviteti' ? 'text-black' : 'text-[#4D4D4D]'
                        }`}
                    >
                        <path
                            d="M13.8306 9.06738V14.3523C13.8306 14.6284 14.0544 14.8523 14.3306 14.8523H19.2811"
                            stroke="currentColor"
                            strokeWidth="3"
                        />
                        <circle cx="14.3969" cy="13.9525" r="9.68494" stroke="currentColor" strokeWidth="3" />
                    </svg>
                </Link>
            </div>
        </nav>
    );
}