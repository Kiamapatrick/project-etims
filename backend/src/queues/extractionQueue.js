import { Queue } from 'bullmq';
import { getRedisConnection } from '../config/redis.js';

export const extractionQueue = new Queue('extraction', {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export async function addExtractionJob(documentUploadId, fileIndex) {
  return extractionQueue.add('process-file', { documentUploadId, fileIndex });
}

export async function getQueueStats() {
  const waiting = await extractionQueue.getWaitingCount();
  const active = await extractionQueue.getActiveCount();
  const completed = await extractionQueue.getCompletedCount();
  const failed = await extractionQueue.getFailedCount();
  return { waiting, active, completed, failed };
}

export async function closeQueue() {
  await extractionQueue.close();
}