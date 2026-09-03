import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

let s3Client = null;

function getS3Client() {
  if (!s3Client) {
    s3Client = new S3Client({
      region: config.s3.region,
      credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
      },
    });
  }
  return s3Client;
}

export async function generatePresignedUploadUrl(key, contentType, expirySeconds = config.s3.presignedUrlExpiry) {
  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn: expirySeconds });
}

export async function generatePresignedDownloadUrl(key, expirySeconds = config.s3.presignedUrlExpiry) {
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn: expirySeconds });
}

export async function downloadFromS3(key) {
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
  });
  const response = await client.send(command);
  if (!response.Body) {
    throw new Error(`Failed to download ${key} from S3`);
  }
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function deleteFromS3(key) {
  const client = getS3Client();
  const command = new DeleteObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
  });
  await client.send(command);
  logger.info('Deleted S3 object', { key });
}

export function generateS3Key(businessId, batchId, fileIndex, originalName) {
  const ext = originalName.split('.').pop().toLowerCase();
  const timestamp = Date.now();
  return `uploads/${businessId}/${batchId}/${fileIndex}_${timestamp}.${ext}`;
}