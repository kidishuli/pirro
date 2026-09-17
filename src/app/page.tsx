'use client';

import { useState } from 'react';
import Image from 'next/image';
import FloatingDock from '@/components/shared/FloatingDock';
import ShtoParaModal from '@/components/modals/ShtoParaModal';
import { usePirro } from '@/context/PirroContext';
import { supabase } from '@/lib/supabase';

export default function PortofoliPage() {
  const { balance, isDormant, toggleDormant, showBalance, setShowBalance, formatPirro, addFunds } = usePirro();
  const [showDormantBanner, setShowDormantBanner] = useState(true);
  const [isShtoParaOpen, setIsShtoParaOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [selectedTopUpAmount, setSelectedTopUpAmount] = useState<number>(1000);
  const [isTopUpLoading, setIsTopUpLoading] = useState(false);

  const displayBalance = isDormant ? Math.max(0, balance - 50) : balance;

  // Real Top-up Execution: Updates balance AND logs transaction in Supabase
  const handleTopUpSubmit = async () => {
    setIsTopUpLoading(true);
    const newBal = balance + selectedTopUpAmount;
    const refCode = 'TOPUP-' + Math.floor(100000 + Math.random() * 900000);

    // 1. Update @alkid's balance
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ balance_p: newBal, last_active_at: new Date().toISOString() })
      .eq('handle', '@alkid');

    // 2. Insert into the transactions ledger
    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        sender_handle: '@bkt',
        receiver_handle: '@alkid',
        amount_p: selectedTopUpAmount,
        reference_code: refCode,
        status: 'COMPLETED',
      });

    if (!profileError && !txError) {
      addFunds(selectedTopUpAmount);
      setIsShtoParaOpen(false);
    } else {
      console.error('Gabim gjatë rimbushjes:', profileError || txError);
    }
    setIsTopUpLoading(false);
  };

  return (
    <div className="relative w-full h-full bg-[#F5F5F5] overflow-hidden">
      {/* ============================================================ */}
      {/* 1. TOP HEADER CONTROLS (z-40)                                */}
      {/* ============================================================ */}
      <header className="absolute top-0 left-0 w-full z-40 pointer-events-none">
        {/* Gradient scrim that fades in on scroll */}
        <div
          className={`absolute inset-0 h-[80px] bg-gradient-to-b from-[#F5F5F5] to-transparent transition-opacity duration-200 pointer-events-none -z-10 ${isScrolled ? 'opacity-100' : 'opacity-0'
            }`}
        />

        {/* Top Controls Row */}
        <div className="relative z-10 pt-4 px-5 pb-2 flex justify-between items-center pointer-events-auto">
          {/* Avatar (Alkid) */}
          <div className="w-[42px] h-[42px] rounded-full overflow-hidden border border-black/5 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <Image
              src="/assets/images/avatar-alkid.png"
              alt="Alkid"
              width={42}
              height={42}
              className="w-full h-full object-cover"
              priority
            />
          </div>

          {/* Search Button */}
          <button
            type="button"
            aria-label="Kërko"
            className="w-[42px] h-[42px] rounded-full bg-white/50 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.06)] flex items-center justify-center border border-white/20 active:scale-95 transition-transform"
          >
            <Image
              src="/assets/icons/icon_search.svg"
              alt="Search"
              width={20}
              height={20}
            />
          </button>
        </div>
      </header>

      {/* ============================================================ */}
      {/* 2. SCROLLABLE CANVAS SHEET                                    */}
      {/* ============================================================ */}
      <div
        onScroll={(e) => {
          setIsScrolled(e.currentTarget.scrollTop > 15);
        }}
        className="relative w-full h-full overflow-y-auto overflow-x-hidden scroll-smooth no-scrollbar overscroll-contain touch-pan-y"
      >
        {/* Top Banner SVG (z-0) - Maintains exact 390/268 aspect ratio */}
        <div className="absolute top-0 left-0 w-full aspect-[390/268] pointer-events-none z-0">
          <Image
            src="/assets/top banner_portofoli.svg"
            alt="Pirro Top Banner"
            width={390}
            height={268}
            priority
            className="w-full h-full object-contain object-top"
          />
        </div>

        {/* Main Content (z-10) - pt scales proportionally with the banner (230/390 = 59vw) */}
        <main className="relative z-10 pt-[59vw] md:pt-[230px] pb-[110px] w-full px-[15px] flex flex-col items-center gap-3">
          {/* --- Section 1: Balanca në Pirro (Directly on #F5F5F5) --- */}
          <section className="w-full flex flex-col">
            {/* Label + Eye Toggle */}
            <div className="flex justify-between items-center pl-3 pr-1">
              <span className="text-[16px] font-medium text-black">
                Balanca në Pirro
              </span>
              <button
                type="button"
                onClick={() => setShowBalance(!showBalance)}
                className="p-1 active:scale-90 transition-transform"
                aria-label={showBalance ? 'Fshih balancën' : 'Shfaq balancën'}
              >
                <Image
                  src={
                    showBalance
                      ? '/assets/icons/icon_hide.svg'
                      : '/assets/icons/icon_unhide.svg'
                  }
                  alt="Toggle visibility"
                  width={20}
                  height={20}
                />
              </button>
            </div>

            {/* Numerals: 50pt bold + 30pt (30% black) */}
            <div className="mt-1 flex items-baseline pl-3">
              {showBalance ? (
                <>
                  <span className="text-[50px] leading-none font-semibold tracking-tight text-black">
                    {displayBalance.toLocaleString('en-US')}
                  </span>
                  <span className="text-[30px] font-normal text-black/30 ml-1">
                    .00 P
                  </span>
                </>
              ) : (
                <span className="text-[40px] font-bold text-black/40 tracking-widest leading-none">
                  ••••••
                </span>
              )}
            </div>

            {/* Action Buttons: 2 responsive pills */}
            <div className="mt-5 grid grid-cols-2 gap-3 w-full">
              <button
                type="button"
                onClick={() => setIsShtoParaOpen(true)}
                className="w-full h-[52px] rounded-full bg-white text-black font-medium flex items-center justify-center active:scale-[0.98] transition-transform"
              >
                Shto para
              </button>
              <button
                type="button"
                className="w-full h-[52px] rounded-full bg-white text-black font-medium flex items-center justify-center active:scale-[0.98] transition-transform"
              >
                Tërhiq
              </button>
            </div>
          </section>

          {/* --- Card 2: Shëndeti i Llogarisë --- */}
          <section
            onClick={toggleDormant}
            className="w-full min-h-[146px] rounded-[24px] bg-white p-5 cursor-pointer select-none flex flex-col justify-between transition-all"
            title="Kliko për të alternuar gjendjen Day 0 (Aktive) vs Day 180+ (Në pushim)"
          >
            <div className="flex justify-between items-start">
              <div className="flex flex-col">
                <span className="text-[12pt] font-semibold tracking-tight text-black">
                  Shëndeti i llogarisë
                </span>
                <span className="text-[22pt] font-semibold tracking-[-0.02em] text-black leading-tight mt-0.5">
                  {isDormant ? 'Në pushim' : 'Aktive'}
                </span>
                {isDormant && (
                  <span className="text-[10pt] text-black/60 font-medium mt-0.5">
                    Statusi: - 50 P drejt Fondit Qytetar
                  </span>
                )}
              </div>

              {/* Icon: 52px × 52px */}
              <div className="w-[52px] h-[52px] flex items-center justify-center flex-shrink-0">
                <Image
                  src={
                    isDormant
                      ? '/assets/icons/icon_llogari në pushim.svg'
                      : '/assets/icons/icon_llogari aktive.svg'
                  }
                  alt="Statusi i shëndetit"
                  width={52}
                  height={52}
                />
              </div>
            </div>

            {/* Body Copy */}
            {!isDormant ? (
              <p className="text-[10pt] leading-tight text-black/60 mt-2">
                Çdo pagesë e thjeshtë në Pirro e mban llogarinë aktive dhe pa kosto.
              </p>
            ) : (
              showDormantBanner && (
                <div className="mt-3.5 -mb-3 h-[50px] bg-[#EEEEEE] rounded-full px-4 -mx-2 sm:px-5 sm:-mx-3 flex justify-between items-center text-[12px] font-normal text-[#5F5F5F]">
                  <span className="text-[11px] sm:text-[12px] leading-tight">50 P zbriten çdo muaj derisa të kryesh 1 pagesë</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDormantBanner(false);
                    }}
                    className="w-[18px] h-[18px] flex items-center justify-center active:scale-90 transition-transform flex-shrink-0 ml-2"
                    aria-label="Mbyll njoftimin"
                  >
                    <Image src="/assets/icons/icon_clear.svg" alt="Mbyll" width={18} height={18} />
                  </button>
                </div>
              )
            )}
          </section>

          {/* --- Section Header: Më shumë --- */}
          <div className="w-full pl-3 mt-6 mb-3">
            <h2 className="text-[20pt] tracking-[-0.03em] leading-none font-book text-black">
              Më shumë
            </h2>
          </div>

          {/* --- Civic Card: Alternates between Skanderbeg (Active) and Katërputroshët (Dormant) --- */}
          {!isDormant ? (
            /* Image 4: Fondi Qytetar i Tiranës (Skanderbeg Card) - Maintains 1:1 square aspect ratio */
            <section className="w-full aspect-square rounded-[40px] bg-white p-6 relative overflow-hidden flex flex-col justify-between">
              <div className="relative z-10">
                <span className="text-[12pt] font-semibold text-black">
                  Komuniteti
                </span>
                <h3 className="text-[28px] font-regular text-black tracking-[-0.02em] leading-tight mt-0.5">
                  Fondi Qytetar i Tiranës
                </h3>
                <p className="text-[10pt] leading-tight text-black/50 mt-2 max-w-[310px]">
                  Çdo pagesë me Pirro ushqen projekte komunitare në qytet nga rendimenti i rezervës, pa asnjë kosto shtesë për ty.
                </p>
              </div>

              {/* Statue Cutout Image on Right (flush to bottom edge, scaled down) */}
              <div className="absolute right-0 bottom-0 w-[150px] h-[215px] pointer-events-none">
                <Image
                  src="/assets/images/skanderbeg image for fondi qytetar.png"
                  alt="Skanderbeg"
                  fill
                  sizes="150px"
                  className="object-contain object-bottom"
                  priority
                />
              </div>

              {/* Mëso Button (Matching Katërputroshët: h-[38px], text-[14pt]) */}
              <div className="absolute bottom-6 left-6 z-10">
                <button
                  type="button"
                  className="h-[38px] px-6 rounded-full bg-[#EBEBEB] text-[12pt] font-book text-black active:scale-95 transition-transform flex items-center justify-center"
                >
                  Mëso
                </button>
              </div>
            </section>
          ) : (
            /* Image 3 (Right): Katërputroshët Card */
            <section className="w-full min-h-[360px] rounded-[40px] bg-white p-6 overflow-hidden flex flex-col justify-between">
              <div>
                <span className="text-[12pt] font-semibold text-black">
                  Fondi Qytetar
                </span>
                <h3 className="text-[28pt] font-regular tracking-[-0.02em]
 text-black leading-tight mt-0.5">
                  Katërputroshët
                </h3>

                {/* Dog Graphic Cutout */}
                <div className="w-full flex justify-center my-2">
                  <Image
                    src="/assets/images/katërputroshët.png"
                    alt="Katërputroshët"
                    width={150}
                    height={130}
                    className="object-contain"
                    priority
                  />
                </div>

                {/* Progress Numbers */}
                <div className="w-full flex justify-between items-baseline mt-1">
                  <span className="text-[20pt] font-semibold text-black">108,000 P</span>
                  <span className="text-[12pt] font-normal text-black/50">120,000 P</span>
                </div>

                {/* 10px Progress Bar with Gradient (90% fill) */}
                <div className="w-full h-[10px] bg-[#F5F5F5] rounded-full overflow-hidden mt-1.5">
                  <div className="h-full w-[90%] bg-gradient-to-r from-[#CBEE8F] to-[#E0E59B] rounded-full" />
                </div>

                {/* Subtitle */}
                <p className="text-[10pt] leading-tight text-black/70 mt-3">
                  Edhe 12,000 Pirro për trajtimin dhe strehimin e 50 qenve të rrugës.
                </p>
              </div>

              {/* CTA Button */}
              <div className="mt-6">
                <button
                  type="button"
                  className="h-[38px] px-6 rounded-full bg-[#EBEBEB] tracking-[-0.03em] text-[12pt] font-book text-black active:scale-95 transition-transform flex items-center justify-center"
                >
                  Shiko detajet
                </button>
              </div>
            </section>
          )}
        </main>
      </div>

      {/* ============================================================ */}
      {/* 3. BOTTOM SCRIM & FLOATING DOCK (z-50)                        */}
      {/* ============================================================ */}
      <div className="pointer-events-none absolute bottom-0 left-0 w-full h-[100px] z-30 bg-gradient-to-t from-[#F5F5F5] via-[#F5F5F5]/80 to-transparent" />
      <FloatingDock activeTab="portofoli" />

      {/* ============================================================ */}
      {/* 4. SHTO PARA BOTTOM SHEET MODAL (Image 5)                    */}
      {/* ============================================================ */}
      <ShtoParaModal
        isOpen={isShtoParaOpen}
        onClose={() => setIsShtoParaOpen(false)}
      />
    </div>
  );
}