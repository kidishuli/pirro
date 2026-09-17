'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { generateMPMDeepLink, generateMPMSticker } from '@/lib/qr';

type MPMFormat = 'uri' | 'json' | 'emvco';

export default function MerchantQRPage() {
  const [selectedMerchant, setSelectedMerchant] = useState<'laguna' | 'cineplexx'>('laguna');
  const [format, setFormat] = useState<MPMFormat>('uri');
  const [amount, setAmount] = useState('');
  const [copied, setCopied] = useState(false);

  const merchantData = {
    laguna: {
      name: 'Laguna Pizza',
      shortName: 'Laguna',
      handle: '@laguna',
      city: 'Tirane',
      logo: '/assets/logos/laguna logo.png',
      color: '#51B0AA',
      category: 'Pizzeria & Bar',
      mcc: '5812',
    },
    cineplexx: {
      name: 'Cineplexx AL',
      shortName: 'Cineplexx',
      handle: '@cineplexxal',
      city: 'Tirane',
      logo: '/assets/logos/cineplexx logo.png',
      color: '#E20613',
      category: 'Kinema & Argëtim',
      mcc: '7832',
    },
  }[selectedMerchant];

  const numericAmount = amount ? parseFloat(amount) : null;

  // Compute QR string depending on chosen architectural standard
  let qrValue = '';
  if (format === 'uri') {
    // 1. Deep Link URI scheme: pirro://pay?type=mpm&merchant=@laguna&name=Laguna+Pizza&city=Tirane
    qrValue = generateMPMDeepLink(
      merchantData.handle,
      merchantData.name,
      merchantData.city,
      numericAmount
    );
  } else if (format === 'json') {
    // 2. Structured JSON payload:
    qrValue = generateMPMSticker(
      merchantData.handle,
      merchantData.name,
      merchantData.city,
      merchantData.category,
      numericAmount
    );
  } else {
    // 3. Official EMVCo TLV Standard (Chapter III.1)
    // 000201 010211 2628al.pirro.merchant:@laguna 52045812 5303008 5802AL 5912Laguna Pizza 6006Tirane 63044A8F
    const tag26Val = `al.pirro.merchant:${merchantData.handle}`;
    const tag26Len = String(tag26Val.length).padStart(2, '0');
    const tag59Len = String(merchantData.name.length).padStart(2, '0');
    const tag60Len = String(merchantData.city.length).padStart(2, '0');
    const pointOfInitiation = numericAmount ? '12' : '11'; // 11=Static, 12=Dynamic

    let emvco = `0002010102${pointOfInitiation}26${tag26Len}${tag26Val}5204${merchantData.mcc}5303008`;
    if (numericAmount && numericAmount > 0) {
      const amtStr = numericAmount.toFixed(2);
      emvco += `54${String(amtStr.length).padStart(2, '0')}${amtStr}`;
    }
    emvco += `5802AL59${tag59Len}${merchantData.name}60${tag60Len}${merchantData.city}63044A8F`;
    qrValue = emvco;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(qrValue).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="relative w-full h-full bg-[#F5F5F5] flex flex-col justify-between p-5 pt-8 pb-6 select-none overflow-y-auto">
      <div>
        {/* Top bar with Back Link */}
        <div className="flex items-center justify-between">
          <Link
            href="/merchant"
            className="w-[38px] h-[38px] rounded-full bg-white shadow-sm flex items-center justify-center active:scale-90 transition-transform"
          >
            <Image src="/assets/icons/icon_close.svg" alt="Close" width={14} height={14} />
          </Link>

          {/* Toggle Merchant */}
          <div className="flex bg-black/5 p-1 rounded-full gap-1">
            <button
              type="button"
              onClick={() => setSelectedMerchant('laguna')}
              className={`px-3 py-1 rounded-full text-[13px] font-medium transition-colors ${
                selectedMerchant === 'laguna' ? 'bg-white text-black shadow-sm' : 'text-black/50'
              }`}
            >
              Laguna
            </button>
            <button
              type="button"
              onClick={() => setSelectedMerchant('cineplexx')}
              className={`px-3 py-1 rounded-full text-[13px] font-medium transition-colors ${
                selectedMerchant === 'cineplexx' ? 'bg-white text-black shadow-sm' : 'text-black/50'
              }`}
            >
              Cineplexx
            </button>
          </div>
        </div>

        {/* Title */}
        <div className="mt-4 text-center">
          <h1 className="text-[26px] font-semibold text-black tracking-tight leading-tight">
            Kodi QR i Dyqanit
          </h1>
          <p className="text-[13px] text-black/50 mt-0.5">
            Merchant-Presented Mode (MPM) • Kapitulli III.1
          </p>
        </div>

        {/* Format Selector: URI / JSON / EMVCo */}
        <div className="mt-3 flex bg-black/5 p-1 rounded-full max-w-[320px] mx-auto text-[12px] font-medium">
          <button
            type="button"
            onClick={() => setFormat('uri')}
            className={`flex-1 py-1.5 rounded-full transition-all text-center ${
              format === 'uri' ? 'bg-white text-black shadow-sm font-semibold' : 'text-black/50'
            }`}
          >
            URI Deep-link
          </button>
          <button
            type="button"
            onClick={() => setFormat('json')}
            className={`flex-1 py-1.5 rounded-full transition-all text-center ${
              format === 'json' ? 'bg-white text-black shadow-sm font-semibold' : 'text-black/50'
            }`}
          >
            JSON Payload
          </button>
          <button
            type="button"
            onClick={() => setFormat('emvco')}
            className={`flex-1 py-1.5 rounded-full transition-all text-center ${
              format === 'emvco' ? 'bg-white text-black shadow-sm font-semibold' : 'text-black/50'
            }`}
          >
            EMVCo TLV
          </button>
        </div>
      </div>

      {/* Center QR Card */}
      <div className="flex flex-col items-center justify-center my-3">
        <div className="relative w-[280px] h-[280px] rounded-[36px] border border-black/10 bg-white p-4 flex items-center justify-center shadow-[0_12px_36px_rgba(0,0,0,0.06)]">
          <QRCodeSVG
            value={qrValue}
            size={220}
            level="H"
            includeMargin={false}
            imageSettings={{
              src: merchantData.logo,
              height: 48,
              width: 48,
              excavate: true,
            }}
          />
          {/* Logo Badge in Center */}
          <div className="absolute inset-0 m-auto w-[48px] h-[48px] rounded-[13px] overflow-hidden flex items-center justify-center pointer-events-none shadow-sm bg-white border border-black/5">
            <Image
              src={merchantData.logo}
              alt={merchantData.name}
              width={48}
              height={48}
              className="w-full h-full object-contain p-1"
              priority
            />
          </div>
        </div>

        {/* Merchant Info Badge */}
        <div className="mt-3 flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-full border border-black/5 shadow-sm">
          <div className="w-[22px] h-[22px] rounded-full overflow-hidden">
            <Image
              src={merchantData.logo}
              alt={merchantData.name}
              width={22}
              height={22}
              className="w-full h-full object-cover"
            />
          </div>
          <span className="text-[14px] font-semibold text-black">{merchantData.name}</span>
          <span className="text-[12px] text-black/40">{merchantData.handle}</span>
        </div>

        {/* Format Payload Snippet with Copy Button */}
        <div className="mt-3 w-full max-w-[320px] bg-white/70 backdrop-blur-sm border border-black/5 rounded-[16px] p-2.5 flex items-center justify-between gap-2">
          <span className="text-[11px] font-mono text-black/70 truncate flex-1 select-all">
            {qrValue}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="text-[11px] font-medium bg-black text-white px-2.5 py-1 rounded-full active:scale-95 transition-transform shrink-0"
          >
            {copied ? 'U kopjua!' : 'Kopjo'}
          </button>
        </div>
      </div>

      {/* Optional Preset Amount (Static vs Dynamic MPM) */}
      <div className="w-full max-w-[320px] mx-auto">
        <div className="flex items-center bg-white rounded-full border border-black/10 px-4 py-2">
          <span className="text-[13px] text-black/40 mr-2">Shuma (opsionale):</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Static (null)"
            className="w-full bg-transparent text-[14px] font-semibold text-black outline-none placeholder:font-normal placeholder:text-black/30"
          />
          {amount && (
            <button
              type="button"
              onClick={() => setAmount('')}
              className="text-[12px] text-black/40 hover:text-black ml-1"
            >
              Pastro
            </button>
          )}
        </div>
        <p className="text-[11px] text-black/40 text-center mt-1.5">
          {amount ? 'Dynamic MPM: Shuma do të paraplotësohet në telefonin e blerësit.' : 'Static MPM (Sticker): Blerësi vendos shumën në tastierën e tij.'}
        </p>
      </div>
    </div>
  );
}
