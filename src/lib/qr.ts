// src/lib/qr.ts

export interface PirroCPMPayload {
  type: 'PIRRO_CPM';
  handle: string;
  iat: number; // Issued at (Unix timestamp)
  exp: number; // Expires at (Unix timestamp, +60s)
  nonce: string; // Cryptographic single-use nonce
}

export interface PirroMPMPayload {
  type: 'PIRRO_MPM';
  version?: string;
  merchant_handle: string;
  name: string;
  city?: string;
  category?: string;
  amount?: number | null;
}

// ============================================================
// 1. CPM (Consumer-Presented Mode)
// ============================================================

/**
 * Generates a dynamic CPM token for the customer (TTL = 60s)
 */
export function generateCPMToken(handle: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: PirroCPMPayload = {
    type: 'PIRRO_CPM',
    handle,
    iat: now,
    exp: now + 60, // 60 seconds Time-To-Live
    nonce: Math.random().toString(36).substring(2, 10),
  };
  return JSON.stringify(payload);
}

/**
 * Parses and validates the scanned CPM QR code on the merchant side
 */
export function parseCPMPayload(rawText: string): {
  valid: boolean;
  handle?: string;
  error?: string;
} {
  try {
    const data = JSON.parse(rawText) as PirroCPMPayload;

    // Check protocol type
    if (data.type !== 'PIRRO_CPM' || !data.handle) {
      return { valid: false, error: 'Ky nuk është një kod i vlefshëm Pirro.' };
    }

    // Check 60-second expiration (TTL)
    const now = Math.floor(Date.now() / 1000);
    if (now > data.exp) {
      return { valid: false, error: 'Kodi QR ka skaduar. Kërkoni rinovimin e kodit.' };
    }

    return { valid: true, handle: data.handle };
  } catch {
    return { valid: false, error: 'Format i pavlefshëm i kodit QR.' };
  }
}

// ============================================================
// 2. MPM (Merchant-Presented Mode)
// ============================================================

/**
 * Generates a static or dynamic MPM JSON sticker payload
 */
export function generateMPMSticker(
  merchantHandle: string,
  name: string,
  city = 'Tiranë',
  category = 'Pizzeria & Bar',
  amount: number | null = null
): string {
  const payload: PirroMPMPayload = {
    type: 'PIRRO_MPM',
    version: '1.0',
    merchant_handle: merchantHandle,
    name,
    city,
    category,
    amount,
  };
  return JSON.stringify(payload);
}

/**
 * Generates a deep link URI format:
 * pirro://pay?type=mpm&merchant=@laguna&name=Laguna+Pizza&city=Tirane
 */
export function generateMPMDeepLink(
  merchantHandle: string,
  name: string,
  city = 'Tirane',
  amount?: number | null
): string {
  const params = new URLSearchParams({
    type: 'mpm',
    merchant: merchantHandle,
    name,
    city,
  });
  if (amount && amount > 0) {
    params.set('amount', String(amount));
  }
  return `pirro://pay?${params.toString()}`;
}

/**
 * Calculates CRC-16/CCITT-FALSE (polynomial 0x1021, init 0xFFFF)
 * according to EMVCo QRCPS Tag 63 specification.
 */
export function computeEMVCoCRC(payloadWithoutCrc: string): string {
  const str = payloadWithoutCrc.endsWith('6304') ? payloadWithoutCrc : `${payloadWithoutCrc}6304`;
  let crc = 0xffff;
  const polynomial = 0x1021;

  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ polynomial) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Generates the official EMVCo QRCPS-MPM (Merchant-Presented Mode)
 * string format (Tag-Length-Value hierarchy) for thesis Chapter III.1
 */
export function generateEMVCoMPM(
  merchantHandle: string,
  name = 'Laguna Pizza',
  city = 'Tirane',
  amount?: number | null,
  mcc = '5812'
): string {
  const cleanHandle = merchantHandle.startsWith('@') ? merchantHandle : `@${merchantHandle}`;
  const tag26Val = `al.pirro.merchant:${cleanHandle}`;
  const tag26Len = String(tag26Val.length).padStart(2, '0');
  const tag59Len = String(name.length).padStart(2, '0');
  const tag60Len = String(city.length).padStart(2, '0');
  const pointOfInitiation = amount && amount > 0 ? '12' : '11'; // 11=Static, 12=Dynamic

  let payload = `0002010102${pointOfInitiation}26${tag26Len}${tag26Val}5204${mcc}5303008`;
  if (amount && amount > 0) {
    const amtStr = amount.toFixed(2);
    payload += `54${String(amtStr.length).padStart(2, '0')}${amtStr}`;
  }
  payload += `5802AL59${tag59Len}${name}60${tag60Len}${city}6304`;

  const checksum = computeEMVCoCRC(payload);
  return `${payload}${checksum}`;
}

/**
 * Helper to parse EMVCo Tag-Length-Value (TLV) strings
 */
function parseEMVCoTLV(tlv: string): Record<string, string> {
  const tags: Record<string, string> = {};
  let i = 0;
  while (i + 4 <= tlv.length) {
    const tag = tlv.substring(i, i + 2);
    const len = parseInt(tlv.substring(i + 2, i + 4), 10);
    if (isNaN(len) || i + 4 + len > tlv.length) break;
    const value = tlv.substring(i + 4, i + 4 + len);
    tags[tag] = value;
    i += 4 + len;
  }
  return tags;
}

/**
 * Parses any incoming Merchant-Presented QR code:
 * 1. JSON payload ({ type: 'PIRRO_MPM', ... })
 * 2. Deep-link URI (pirro://pay?type=mpm&merchant=...)
 * 3. Official EMVCo TLV string (0002010102112628al.pirro.merchant:...)
 * 4. Plain merchant handle (@laguna or laguna)
 */
export function parseMPMPayload(rawText: string): {
  valid: boolean;
  merchant_handle?: string;
  name?: string;
  city?: string;
  amount?: number | null;
  error?: string;
} {
  const trimmed = rawText.trim();

  // 1. Check Deep Link URI Scheme: pirro://pay?...
  if (trimmed.startsWith('pirro://pay') || trimmed.startsWith('pirro:')) {
    try {
      const urlStr = trimmed.replace('pirro://pay', 'http://dummy.local');
      const url = new URL(urlStr);
      const merchant = url.searchParams.get('merchant') || url.searchParams.get('handle');
      if (merchant) {
        const name = url.searchParams.get('name') || merchant.replace(/^@/, '');
        const city = url.searchParams.get('city') || 'Tiranë';
        const amtStr = url.searchParams.get('amount');
        const amount = amtStr ? parseFloat(amtStr) : null;
        return {
          valid: true,
          merchant_handle: merchant.startsWith('@') ? merchant : `@${merchant}`,
          name: decodeURIComponent(name.replace(/\+/g, ' ')),
          city: decodeURIComponent(city.replace(/\+/g, ' ')),
          amount: amount && !isNaN(amount) ? amount : null,
        };
      }
    } catch {
      // Fallback
    }
  }

  // 2. Check JSON payload
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const data = JSON.parse(trimmed);
      if (data.type === 'PIRRO_MPM' || data.merchant_handle || data.merchant) {
        const handle = data.merchant_handle || data.merchant;
        return {
          valid: true,
          merchant_handle: handle.startsWith('@') ? handle : `@${handle}`,
          name: data.name || handle.replace(/^@/, ''),
          city: data.city || 'Tiranë',
          amount: typeof data.amount === 'number' ? data.amount : null,
        };
      }
    } catch {
      // Not JSON
    }
  }

  // 3. Check EMVCo TLV format (starts with 000201...)
  if (trimmed.startsWith('000201')) {
    try {
      const tags = parseEMVCoTLV(trimmed);
      // Tag 26: Merchant Account Information (e.g. al.pirro.merchant:@laguna)
      const tag26 = tags['26'] || '';
      const handleMatch = tag26.match(/@([a-zA-Z0-9_-]+)/);
      const handle = handleMatch ? `@${handleMatch[1]}` : (tag26 || '@merchant');
      const name = tags['59'] || 'Dyqan Pirro';
      const city = tags['60'] || 'Tiranë';
      const amtStr = tags['54'];
      const amount = amtStr ? parseFloat(amtStr) : null;

      return {
        valid: true,
        merchant_handle: handle,
        name,
        city,
        amount: amount && !isNaN(amount) ? amount : null,
      };
    } catch {
      // Fallback
    }
  }

  // 4. Check plain handle or keyword (@laguna, laguna, cineplexx)
  const lower = trimmed.toLowerCase();
  if (lower.includes('laguna')) {
    return {
      valid: true,
      merchant_handle: '@laguna',
      name: 'Laguna Pizza',
      city: 'Tiranë',
      amount: null,
    };
  }
  if (lower.includes('cineplexx')) {
    return {
      valid: true,
      merchant_handle: '@cineplexxal',
      name: 'Cineplexx AL',
      city: 'Tiranë',
      amount: null,
    };
  }

  if (trimmed.startsWith('@') || /^[a-zA-Z0-9._-]+$/.test(trimmed)) {
    const cleanHandle = trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
    return {
      valid: true,
      merchant_handle: cleanHandle,
      name: cleanHandle.replace(/^@/, ''),
      city: 'Tiranë',
      amount: null,
    };
  }

  return { valid: false, error: 'Format i panjohur i kodit QR të dyqanit.' };
}