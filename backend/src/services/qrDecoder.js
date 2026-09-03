import jsQR from 'jsqr';
import sharp from 'sharp';

export async function decodeQrFromBuffer(buffer) {
  try {
    const { data, info } = await sharp(buffer)
      .raw()
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true });

    const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);
    
    if (!code) {
      return null;
    }

    return {
      data: code.data,
      location: code.location,
    };
  } catch {
    return null;
  }
}

export function extractCUIFromQR(qrData) {
  if (!qrData) return null;
  
  const cuinPatterns = [
    /CUIN[:\s]*([A-Z0-9-]{10,})/i,
    /cuin[:\s]*([A-Z0-9-]{10,})/i,
    /([A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3})/,
    /([A-Z0-9]{12,})/,
  ];

  for (const pattern of cuinPatterns) {
    const match = qrData.match(pattern);
    if (match) {
      return match[1].toUpperCase().replace(/\s/g, '');
    }
  }

  if (qrData.length >= 10 && /^[A-Z0-9-]+$/i.test(qrData)) {
    return qrData.toUpperCase().replace(/\s/g, '');
  }

  return null;
}