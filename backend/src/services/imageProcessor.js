import sharp from 'sharp';
import { fromPath } from 'pdf2pic';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

export async function downscaleBuffer(buffer, maxDimension = config.extraction.imageMaxDimension) {
  const image = sharp(buffer);
  const metadata = await image.metadata();
  
  if (!metadata.width || !metadata.height) {
    throw new Error('Invalid image metadata');
  }

  const scale = Math.min(1, maxDimension / Math.max(metadata.width, metadata.height));
  
  if (scale >= 1) {
    return buffer;
  }

  const newWidth = Math.round(metadata.width * scale);
  const newHeight = Math.round(metadata.height * scale);

  return image
    .resize(newWidth, newHeight, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
}

export async function convertPdfFirstPageToImage(pdfBuffer) {
  const options = {
    density: 300,
    saveFilename: 'page',
    savePath: '/tmp',
    format: 'png',
    width: config.extraction.imageMaxDimension,
    height: config.extraction.imageMaxDimension,
  };

  const convert = fromPath(options);
  const tempPdfPath = `/tmp/upload_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`;
  
  await Bun.write(tempPdfPath, pdfBuffer);
  
  try {
    const result = await convert(tempPdfPath, 1);
    
    if (result.length === 0) {
      throw new Error('PDF conversion produced no pages');
    }
    
    if (result.length > 1) {
      logger.warn('PDF has multiple pages, only first page processed', { pageCount: result.length });
    }
    
    const imageBuffer = await Bun.file(result[0].path).arrayBuffer();
    return Buffer.from(imageBuffer);
  } finally {
    try {
      await Bun.$`rm -f ${tempPdfPath} ${tempPdfPath.replace('.pdf', '.png')}`;
    } catch {
      // Ignore cleanup errors
    }
  }
}

export async function prepareImageForExtraction(buffer, mimeType) {
  if (mimeType === 'application/pdf') {
    const imageBuffer = await convertPdfFirstPageToImage(buffer);
    return downscaleBuffer(imageBuffer);
  }
  return downscaleBuffer(buffer);
}

export async function getImageDimensions(buffer) {
  const metadata = await sharp(buffer).metadata();
  return { width: metadata.width, height: metadata.height };
}