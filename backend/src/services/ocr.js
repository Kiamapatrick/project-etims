import { createWorker } from 'tesseract.js';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

let ocrWorker = null;

export async function getOcrWorker() {
  if (!ocrWorker) {
    ocrWorker = await createWorker(config.extraction.ocrLanguage);
  }
  return ocrWorker;
}

export async function extractTextFromBuffer(buffer) {
  const worker = await getOcrWorker();
  
  try {
    const { data } = await worker.recognize(buffer);
    return {
      text: data.text,
      confidence: data.confidence / 100,
      lines: data.lines.map(line => ({
        text: line.text,
        confidence: line.confidence / 100,
        bbox: line.bbox,
      })),
      words: data.words.map(word => ({
        text: word.text,
        confidence: word.confidence / 100,
        bbox: word.bbox,
      })),
    };
  } catch (err) {
    logger.error('OCR extraction failed', { error: err.message });
    throw new Error(`OCR failed: ${err.message}`);
  }
}

export async function terminateOcrWorker() {
  if (ocrWorker) {
    await ocrWorker.terminate();
    ocrWorker = null;
  }
}