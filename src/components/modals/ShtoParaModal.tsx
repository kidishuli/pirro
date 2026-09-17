'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { usePirro } from '@/context/PirroContext';

interface ShtoParaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_AMOUNTS = [1000, 2500, 5000, 10000, 20000];

export default function ShtoParaModal({ isOpen, onClose }: ShtoParaModalProps) {
  const { balance, addFunds, formatPirro } = usePirro();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(1000);
  const [isCustom, setIsCustom] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSelect = (amt: number) => {
    setIsCustom(false);
    setSelectedAmount(amt);
  };

  const handleCustomClick = () => {
    setIsCustom(true);
    setSelectedAmount(null);
  };

  const handleConfirm = () => {
    const amountToAdd = isCustom ? Number(customValue) : selectedAmount;
    if (amountToAdd && amountToAdd > 0) {
      addFunds(amountToAdd);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setIsCustom(false);
        setCustomValue('');
        setSelectedAmount(1000);
        onClose();
      }, 900);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />

          {/* Bottom Sheet Modal Container */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative z-10 w-full max-w-full md:max-w-[390px] bg-white rounded-t-[36px] px-6 pt-3 pb-8 shadow-2xl flex flex-col"
          >
            {/* Grab handle */}
            <div className="w-10 h-1 bg-black/20 rounded-full mx-auto mb-4" />

            {/* Header */}
            <h2 className="text-[26px] font-bold text-center text-black leading-tight">
              Shto para
            </h2>
            <p className="text-[14px] text-black/50 text-center mt-1 mb-6 font-normal">
              Balanca: {formatPirro(balance)} Pirro
            </p>

            {/* Amount Grid */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {PRESET_AMOUNTS.map((amt) => {
                const isSelected = selectedAmount === amt && !isCustom;
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleSelect(amt)}
                    className={`h-[52px] rounded-[16px] border flex items-center justify-center text-[16px] font-semibold transition-all active:scale-95 ${
                      isSelected
                        ? 'border-black bg-black/[0.04] text-black shadow-sm'
                        : 'border-black/15 text-black hover:border-black/30'
                    }`}
                  >
                    {amt.toLocaleString()}
                  </button>
                );
              })}

              {/* Custom '...' Button */}
              <button
                type="button"
                onClick={handleCustomClick}
                className={`h-[52px] rounded-[16px] border flex items-center justify-center text-[18px] font-bold tracking-widest transition-all active:scale-95 ${
                  isCustom
                    ? 'border-black bg-black/[0.04] text-black shadow-sm'
                    : 'border-black/15 text-black hover:border-black/30'
                }`}
              >
                ...
              </button>
            </div>

            {/* Custom Input Field if '...' clicked */}
            {isCustom && (
              <div className="mb-4">
                <input
                  type="number"
                  placeholder="Shkruani shumën (P)"
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  autoFocus
                  className="w-full h-[48px] px-4 rounded-[14px] border border-black/20 text-[16px] font-medium text-black focus:outline-none focus:border-black"
                />
              </div>
            )}

            {/* Payment Source Row (Image 5: clean row directly on modal background) */}
            <div className="flex items-center justify-between py-3 px-1 mb-6">
              <div className="flex items-center gap-2.5">
                <span className="text-[14px] text-black font-medium">Nga</span>
                <div className="w-[30px] h-[20px] relative flex items-center justify-center">
                  <Image
                    src="/assets/logos/mastercard logo.png"
                    alt="Mastercard"
                    width={30}
                    height={20}
                    className="object-contain"
                  />
                </div>
                <span className="text-[14px] font-semibold text-black">
                  karta e debitit BKT 4667
                </span>
              </div>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="black"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>

            {/* Submit Button */}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSuccess}
              className="w-full h-[52px] rounded-full bg-black text-white text-[16px] font-medium flex items-center justify-center active:scale-[0.98] transition-all shadow-md"
            >
              {isSuccess ? (
                <span className="flex items-center gap-2">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  U shtua me sukses!
                </span>
              ) : (
                'Shto'
              )}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
