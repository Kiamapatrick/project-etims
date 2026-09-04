import { connectDB } from './src/db/mongoose.js';
import { startExtractionWorker } from './src/workers/extractionWorker.js';

await connectDB();
startExtractionWorker();

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing worker...');
  const { closeRedisConnection } = await import('./src/config/redis.js');
  await closeRedisConnection();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing worker...');
  const { closeRedisConnection } = await import('./src/config/redis.js');
  await closeRedisConnection();
  process.exit(0);
});