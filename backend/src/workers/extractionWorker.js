import { Worker } from 'bullmq';
import { getRedisConnection } from '../config/redis.js';
import { config } from '../config/env.js';
import { processFile } from '../services/extraction.js';
import { logger } from '../utils/logger.js';

export const extractionWorker = new Worker('extraction', async (job) => {
  const { documentUploadId, fileIndex } = job.data;
  await processFile(documentUploadId, fileIndex);
}, {
  connection: getRedisConnection(),
  concurrency: config.worker.concurrency,
});

extractionWorker.on('completed', (job) => {
  logger.info('Extraction job completed', { jobId: job.id, documentUploadId: job.data.documentUploadId, fileIndex: job.data.fileIndex });
});

extractionWorker.on('failed', (job, err) => {
  logger.error('Extraction job failed', { 
    jobId: job?.id, 
    documentUploadId: job?.data?.documentUploadId, 
    fileIndex: job?.data?.fileIndex, 
    error: err.message 
  });
});

extractionWorker.on('error', (err) => {
  logger.error('Extraction worker error', { error: err.message });
});

console.log('Extraction worker started');