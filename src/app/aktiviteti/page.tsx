'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import FloatingDock from '@/components/shared/FloatingDock';
import { usePirro, Transaction } from '@/context/PirroContext';

export default function AktivitetiPage() {
  const { transactions, formatPirro } = usePirro();
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  return (
    <div className="relative w-full h-full bg-white overflow-hidden flex flex-col justify-between select-none">
      {/* ============================================================ */}
      {/* 1. TOP HEADER (Avatar left, Search right)                     */}
      {/* ============================================================ */}
      <header className="relative z-10 pt-4 px-5 pb-2 flex justify-between items-center">
        {/* Avatar (Alkid) */}
        <Link
          href="/"
          className="w-[42px] h-[42px] rounded-full overflow-hidden border border-black/5 shadow-[0_4px_20px_rgba(0,0,0,0.06)] cursor-pointer active:scale-95 transition-transform"
        >
          <Image
            src="/assets/images/avatar-alkid.png"
            alt="Alkid"
            width={42}
            height={42}
            className="w-full h-full object-cover"
            priority
          />
        </Link>

        {/* Search Button (Same style as Portofoli and Paguaj) */}
        <button
          type="button"
          aria-label="Kërko"
          className="w-[42px] h-[42px] rounded-full bg-white/50 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.06)] border border-black/5 flex items-center justify-center active:scale-95 transition-transform"
        >
          <Image
            src="/assets/icons/icon_search.svg"
            alt="Search"
            width={20}
            height={20}
          />
        </button>
      </header>

      {/* ============================================================ */}
      {/* 2. TRANSACTION LIST & SECTION HEADER                         */}
      {/* ============================================================ */}
      <div className="flex-1 overflow-y-auto px-6 pt-2 pb-[110px] no-scrollbar">
        {/* Section Header: Këtë muaj */}
        <h1 className="text-[26px] font-book tracking-[-0.03em] text-black leading-tight mb-7">
          <br />Këtë muaj
        </h1>

        {/* Transactions List */}
        <div className="flex flex-col gap-7">
          {transactions.map((tx) => {
            const isDebit = tx.type === 'debit';
            const title = isDebit ? 'Blerje' : 'Para të shtuara';
            const subtitle = isDebit ? tx.recipient : (tx.recipient || 'Banka Kombëtare Tregtare');
            const integerAmount = Math.round(tx.amount).toLocaleString('en-US');

            return (
              <div
                key={tx.id}
                onClick={() => setSelectedTx(tx)}
                className="flex items-start justify-between w-full cursor-pointer select-none active:opacity-75 transition-opacity"
              >
                {/* Left: Icon + Text Info */}
                <div className="flex items-center gap-4">
                  {/* Circular Badge with white Pirro P */}
                  <div
                    className={`w-[48px] h-[48px] rounded-full flex items-center justify-center flex-shrink-0 ${isDebit
                      ? 'bg-gradient-to-br from-[#FDD4C1] to-[#F7BBA0]'
                      : 'bg-gradient-to-br from-[#D9F39D] to-[#C0EA77]'
                      }`}
                  >
                    <svg
                      width="22"
                      height="22"
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

                  {/* Text Column */}
                  <div className="flex flex-col">
                    <span className="text-[14px] font-semibold text-black leading-tight">
                      {title}
                    </span>
                    <span className="text-[12px] font-regular text-black/80 leading-tight mt-1">
                      {subtitle}
                    </span>
                    <span className="text-[12px] font-regular text-black/45 leading-tight mt-1">
                      {tx.date}
                    </span>
                  </div>
                </div>

                {/* Right: Amount */}
                <div className="pt-0.5">
                  <span className="text-[14px] font-semibold text-black tracking-tight leading-tight">
                    {isDebit ? '- ' : '+ '}
                    {integerAmount} P
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. OPTIONAL RECEIPT MODAL (When tapping an item)             */}
      {/* ============================================================ */}
      {selectedTx && (
        <div className="absolute inset-0 z-[60] bg-white flex flex-col p-6 pt-5 pb-10 overflow-y-auto no-scrollbar animate-in fade-in duration-200">
          {/* Close Button */}
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

          {/* Header Info */}
          <div className="flex flex-col items-start mt-6">
            <h1 className="text-[32px] font-semibold text-black tracking-tight leading-none">
              {selectedTx.recipient}
            </h1>
            <span className="text-[14px] text-black/50 font-normal mt-2">
              {selectedTx.date}, ora {selectedTx.time}
            </span>
            <div className="flex items-baseline mt-4">
              <span className="text-[44px] font-semibold text-black tracking-tight leading-none">
                {selectedTx.type === 'debit' ? '-' : '+'}{formatPirro(selectedTx.amount)}
              </span>
              <span className="text-[28px] font-semibold text-black/35 tracking-tight ml-1">
                P
              </span>
            </div>
          </div>

          <div className="w-full h-[1px] bg-black/10 my-6" />

          {/* Details */}
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
                  <span className="text-[13px] text-black/50 font-normal mt-0.5">Transaksioni u krye me sukses</span>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-[24px] h-[24px] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Image src="/assets/icons/icon_mënyra e pagesës.svg" alt="Mënyra" width={20} height={20} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[15px] font-semibold text-black leading-snug">Mënyra</span>
                  <span className="text-[13px] text-black/50 font-normal mt-0.5">Bilanci në Pirro</span>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-[24px] h-[24px] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Image src="/assets/icons/icon_nr i transaksionit.svg" alt="ID" width={20} height={20} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[15px] font-semibold text-black leading-snug">Numri i transaksionit</span>
                  <span className="text-[13px] text-black/50 font-normal mt-0.5">
                    {selectedTx.transactionNumber}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. BOTTOM SCRIM & FLOATING DOCK                              */}
      {/* ============================================================ */}
      <div className="pointer-events-none absolute bottom-0 left-0 w-full h-[90px] z-30 bg-gradient-to-t from-white via-white/80 to-transparent" />
      <FloatingDock activeTab="aktiviteti" />
    </div>
  );
}
